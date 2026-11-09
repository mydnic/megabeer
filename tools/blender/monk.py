"""
Prépare le Moine (MONK.blend, Čestmír Dammer / kelgar.org) pour la foule du jeu, en variantes.

Le jeu fusionne chaque ennemi en une seule géométrie avec une seule texture (enemies/zombieLibrary.ts) :
- les textures (corps, tête, cheveux, accessoires) sont rangées dans un atlas, l'occlusion ambiante
  peinte fondue dedans, et les UV recalées sur l'atlas ;
- un seul matériau ;
- seules les animations utiles sont gardées, renommées comme celles des zombies Quaternius
  (Idle, Walk, Run, Punch, HitReact, Death) pour se passer de clips propres dans la config.

Variantes (--variant) :
- lanceur : le moine tel quel ;
- pelerin : bure rouge vin, et un tonneau sans fond enfilé autour du ventre (--barrel : un glTF de
  tonneau, son apparence est cuite dans une petite texture de l'atlas) ;
- tonnelier : bure gris ardoise, et un tonneau fermé tenu couché devant lui comme un bélier (--barrel).

Usage (Blender 5.2) :
  blender -b --factory-startup --disable-autoexec -P tools/blender/monk.py -- --src MONK.blend
      --variant lanceur --out src/assets/models/moine.glb
  blender ... -- --src MONK.blend --variant pelerin --barrel Barrel.gltf --out src/assets/models/moine_pelerin.glb
"""
import argparse
import math
import sys

import bmesh
import bpy
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument('--src', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--variant', default='lanceur')
ap.add_argument('--barrel', help='glTF du tonneau (variante pelerin)')
args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:])

# Animation gardée -> nom attendu par le jeu
CLIPS = {
    'Idle': 'Idle',
    'Walk': 'Walk',
    'Flee': 'Run',
    'Attack1': 'Punch',  # bras lancé en avant : sert de coup et de lancer
    'TortureFire': 'HitReact',  # il sautille, comme brûlé
    'Die': 'Death',
}

# Atlas (px) : corps et tête côte à côte en haut ; cheveux et accessoire en bas
CELL = 512
ATLAS_W, ATLAS_H = 2 * CELL, CELL + CELL // 2
AO_STRENGTH = 0.55
# Matériau -> (texture de couleur, texture d'occlusion, x, y, taille) dans l'atlas (y depuis le bas)
SLOTS = {
    'MonkBody': ('monk-tuc-body', 'monk-tuc-body-AO', 0, CELL // 2, CELL),
    'MonkHead': ('monk-tuc-head', 'monk-tuc-head-AO', CELL, CELL // 2, CELL),
    'MonkHair': ('hair-skin.png', None, 0, 0, CELL // 2),
    'Tonneau': ('tonneau_cuit', None, CELL // 2, 0, CELL // 2),
}

# La bure dans la texture du corps (mesurée) : brun teinte 0,03 à 0,05, saturation 0,5 à 0,7, sombre ;
# la peau des mains est plus claire (au-dessus de 0,48), la cordelière plus saturée
ROBE_MASK = {'hue': (0.02, 0.06), 'sat': (0.45, 0.75), 'val_max': 0.47}

VARIANTS = {
    'lanceur': {},
    'pelerin': {
        # Bure rouge vin : nouvelle teinte, saturation et luminosité multipliées
        'robe': {'hue': 0.985, 'sat': 1.7, 'val': 1.0},
        # Tonneau autour du ventre (m, repère du moine : face vers -Y, pieds en Z = 0)
        'barrel': {
            'open': True,  # sans fond : il l'a transpercé
            'bulge': 0.42,  # rayon au ventre du tonneau
            'height': 0.8,
            'center': (0.0, -0.09, 1.06),
            'wall': 0.025,  # épaisseur des douelles vues par l'ouverture
            'bone': 'Spine',  # os qui le porte
            'bake': CELL // 2,  # taille de sa texture cuite
        },
    },
    'tonnelier': {
        # Bure gris ardoise
        'robe': {'hue': 0.6, 'sat': 0.45, 'val': 1.15},
        # Tonneau fermé, couché devant le ventre comme un bélier
        'barrel': {
            'axis': 'forward',
            'bulge': 0.27,
            'height': 0.62,  # longueur
            'center': (0.0, -0.52, 0.98),
            'bone': 'Spine',
            'bake': CELL // 2,
        },
    },
}
variant = VARIANTS[args.variant]

bpy.ops.wm.open_mainfile(filepath=args.src, load_ui=False)
for o in list(bpy.data.objects):
    if o.type in ('LIGHT', 'CAMERA'):
        bpy.data.objects.remove(o)
mesh = bpy.data.objects['Monk']
mesh.data.validate()
scene = bpy.context.scene


def select_only(obj):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def add_barrel(path, cfg):
    """Importe le tonneau, le vide de ses couvercles, le cuit dans sa texture et l'enfile au moine."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == 'MESH']
    # Le plus gros maillage est le tonneau (le pack ajoute parfois une boîte d'aide)
    barrel = max(meshes, key=lambda o: len(o.data.polygons))
    for o in new:
        if o is not barrel:
            bpy.data.objects.remove(o)
    barrel.parent = None
    select_only(barrel)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    # Travail dans le repère du tonneau : axe en Z, centré, mis à la taille voulue
    bm = bmesh.new()
    bm.from_mesh(barrel.data)
    zs = [v.co.z for v in bm.verts]
    z0, z1 = min(zs), max(zs)
    h = z1 - z0
    caps = [f for f in bm.faces if abs(f.normal.z) > 0.7 and not (z0 + 0.2 * h < f.calc_center_median().z < z1 - 0.2 * h)]
    if cfg.get('open'):
        # Sans couvercles : on enlève les faces horizontales des deux bouts
        bmesh.ops.delete(bm, geom=caps, context='FACES')
        caps = []
    caps = set(caps)
    cx = sum(v.co.x for v in bm.verts) / len(bm.verts)
    cy = sum(v.co.y for v in bm.verts) / len(bm.verts)
    bulge = max(((v.co.x - cx) ** 2 + (v.co.y - cy) ** 2) ** 0.5 for v in bm.verts)
    s = cfg['bulge'] / bulge
    sz = cfg['height'] / h
    for v in bm.verts:
        v.co.x = (v.co.x - cx) * s
        v.co.y = (v.co.y - cy) * s
        v.co.z = (v.co.z - (z0 + h / 2)) * sz

    # UV de cuisson : les douelles dépliées en cylindre (tour en U, hauteur en V) ; les couvercles
    # éventuels à plat dans deux carrés en bas de la texture
    cuv = bm.loops.layers.uv.new('cuisson')
    R, hh = cfg['bulge'], cfg['height']
    v0, v1 = (0.27, 0.99) if caps else (0.01, 0.99)
    for f in bm.faces:
        if f in caps:
            u0 = 0.01 if f.calc_center_median().z > 0 else 0.27
            for l in f.loops:
                l[cuv].uv = (u0 + (l.vert.co.x / (2 * R) + 0.5) * 0.24, 0.01 + (l.vert.co.y / (2 * R) + 0.5) * 0.24)
            continue
        us = [math.atan2(l.vert.co.y, l.vert.co.x) / (2 * math.pi) + 0.5 for l in f.loops]
        if max(us) - min(us) > 0.5:  # face à cheval sur la couture : refermée sur le bord droit
            us = [u if u >= 0.5 else 1.0 for u in us]
        for l, u in zip(f.loops, us):
            l[cuv].uv = (u * 0.98 + 0.01, v0 + (l.vert.co.z / hh + 0.5) * (v1 - v0))

    # Orienté (debout, ou couché vers l'avant comme un bélier) puis posé sur le moine
    for v in bm.verts:
        if cfg.get('axis') == 'forward':
            v.co.y, v.co.z = -v.co.z, v.co.y
        v.co.x += cfg['center'][0]
        v.co.y += cfg['center'][1]
        v.co.z += cfg['center'][2]
    bm.normal_update()
    bm.to_mesh(barrel.data)
    bm.free()

    if cfg.get('open'):
        # Épaisseur, pour voir l'intérieur des douelles par l'ouverture
        mod = barrel.modifiers.new('epaisseur', 'SOLIDIFY')
        mod.thickness = cfg['wall']
        mod.offset = -1
        bpy.ops.object.modifier_apply(modifier=mod.name)

    # Apparence cuite dans une texture à lui, sur de nouvelles UV
    me = barrel.data
    src_uv = me.uv_layers[0]
    src_uv.active_render = True
    me.uv_layers.active = me.uv_layers['cuisson']
    img = bpy.data.images.new('tonneau_cuit', cfg['bake'], cfg['bake'])
    for m in me.materials:
        node = m.node_tree.nodes.new('ShaderNodeTexImage')
        node.image = img
        m.node_tree.nodes.active = node
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 1
    scene.cycles.device = 'CPU'
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, margin=4, use_clear=True)
    img.pack()
    me.uv_layers.remove(src_uv)
    me.uv_layers[0].name = mesh.data.uv_layers.active.name
    me.materials.clear()
    me.materials.append(bpy.data.materials.new('Tonneau'))

    # Porté rigidement par un os du moine, puis fusionné dans son maillage
    group = barrel.vertex_groups.new(name=cfg['bone'])
    group.add(range(len(me.vertices)), 1.0, 'REPLACE')
    select_only(mesh)
    barrel.select_set(True)
    bpy.ops.object.join()


def rgb_to_hsv(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx, mn = rgb.max(-1), rgb.min(-1)
    d = mx - mn
    h = np.zeros_like(mx)
    nz = d > 1e-6
    rm, gm = nz & (mx == r), nz & (mx == g) & (mx != r)
    bm_ = nz & ~rm & ~gm
    h[rm] = ((g - b)[rm] / d[rm]) % 6
    h[gm] = (b - r)[gm] / d[gm] + 2
    h[bm_] = (r - g)[bm_] / d[bm_] + 4
    s = np.where(mx > 1e-6, d / np.maximum(mx, 1e-6), 0)
    return np.stack([h / 6, s, mx], -1)


def hsv_to_rgb(hsv):
    h, s, v = hsv[..., 0] * 6, hsv[..., 1], hsv[..., 2]
    i = np.floor(h).astype(int) % 6
    f = h - np.floor(h)
    p, q, t = v * (1 - s), v * (1 - s * f), v * (1 - s * (1 - f))
    choices = [np.stack(c, -1) for c in ((v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q))]
    out = np.zeros(h.shape + (3,), dtype=np.float32)
    for k, c in enumerate(choices):
        out[i == k] = c[i == k]
    return out


def recolor_robe(px, cfg):
    """Vire la bure à une autre teinte, sans toucher la peau ni la cordelière."""
    hsv = rgb_to_hsv(px[..., :3])
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    m = ROBE_MASK
    robe = (h >= m['hue'][0]) & (h <= m['hue'][1]) & (s >= m['sat'][0]) & (s <= m['sat'][1]) & (v <= m['val_max'])
    hsv[..., 0] = np.where(robe, cfg['hue'], h)
    hsv[..., 1] = np.where(robe, np.minimum(s * cfg['sat'], 1), s)
    hsv[..., 2] = np.where(robe, np.minimum(v * cfg['val'], 1), v)
    px[..., :3] = hsv_to_rgb(hsv)
    return px


def pixels(name, size):
    """Pixels RGBA (size x size, origine en bas) d'une image du fichier, redimensionnée."""
    img = bpy.data.images[name].copy()
    img.scale(size, size)
    return np.array(img.pixels[:], dtype=np.float32).reshape(size, size, 4)


if 'barrel' in variant:
    if not args.barrel:
        sys.exit(f'La variante {args.variant} demande --barrel')
    add_barrel(args.barrel, variant['barrel'])

# Atlas des matériaux présents
names = [m.name for m in mesh.data.materials]
atlas = np.zeros((ATLAS_H, ATLAS_W, 4), dtype=np.float32)
atlas[..., 3] = 1
for name in names:
    color, ao, x, y, size = SLOTS[name]
    px = pixels(color, size)
    if ao:
        px[..., :3] *= (1 - AO_STRENGTH) + AO_STRENGTH * pixels(ao, size)[..., :1]
    if name == 'MonkBody' and 'robe' in variant:
        px = recolor_robe(px, variant['robe'])
    atlas[y:y + size, x:x + size] = px
img = bpy.data.images.new('moine_atlas', ATLAS_W, ATLAS_H)
img.pixels[:] = atlas.ravel()
img.file_format = 'PNG'
img.pack()

# UV recalées sur l'atlas, matériau par matériau
uv = mesh.data.uv_layers.active.data
for poly in mesh.data.polygons:
    _, _, x, y, size = SLOTS[names[poly.material_index]]
    for li in poly.loop_indices:
        u, v = uv[li].uv
        uv[li].uv = ((x + u * size) / ATLAS_W, (y + v * size) / ATLAS_H)

# Un seul matériau texturé
mat = bpy.data.materials.new('Moine')
mat.use_nodes = True
nt = mat.node_tree
tex = nt.nodes.new('ShaderNodeTexImage')
tex.image = img
bsdf = nt.nodes['Principled BSDF']
nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
bsdf.inputs['Roughness'].default_value = 1
mesh.data.materials.clear()
mesh.data.materials.append(mat)
for p in mesh.data.polygons:
    p.material_index = 0

# Animations : on ne garde et ne renomme que les utiles
for a in list(bpy.data.actions):
    if a.name in CLIPS:
        a.name = CLIPS[a.name]
    else:
        bpy.data.actions.remove(a)

select_only(mesh)
bpy.ops.export_scene.gltf(
    filepath=args.out,
    export_format='GLB',
    export_animations=True,
    export_animation_mode='ACTIONS',
    export_apply=False,
    export_cameras=False,
    export_lights=False,
)
print('Moine exporté :', args.variant, args.out, '| animations :', sorted(CLIPS.values()))
