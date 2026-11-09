"""
Prépare le Moine (MONK.blend, Čestmír Dammer / kelgar.org) pour la foule du jeu.

Le jeu fusionne chaque ennemi en une seule géométrie avec une seule texture (enemies/zombieLibrary.ts) :
- les 3 textures (corps, tête, cheveux) sont rangées dans un atlas, l'occlusion ambiante peinte
  fondue dedans, et les UV recalées sur l'atlas ;
- un seul matériau ;
- seules les animations utiles sont gardées, renommées comme celles des zombies Quaternius
  (Idle, Walk, Punch, HitReact, Death) pour se passer de clips propres dans la config.

Usage (Blender 5.2) :
  blender -b --factory-startup --disable-autoexec -P tools/blender/monk.py -- --src MONK.blend --out src/assets/models/moine.glb
"""
import argparse
import sys

import bpy
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument('--src', required=True)
ap.add_argument('--out', required=True)
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
# Atlas (px) : corps et tête côte à côte, cheveux dessous ; part d'occlusion ambiante fondue
CELL = 512
ATLAS_W, ATLAS_H = 2 * CELL, CELL + CELL // 2
AO_STRENGTH = 0.55
# Matériau -> (texture de couleur, texture d'occlusion, x, y, taille) dans l'atlas (y depuis le bas)
SLOTS = {
    'MonkBody': ('monk-tuc-body', 'monk-tuc-body-AO', 0, CELL // 2, CELL),
    'MonkHead': ('monk-tuc-head', 'monk-tuc-head-AO', CELL, CELL // 2, CELL),
    'MonkHair': ('hair-skin.png', None, 0, 0, CELL // 2),
}

bpy.ops.wm.open_mainfile(filepath=args.src, load_ui=False)
for o in list(bpy.data.objects):
    if o.type in ('LIGHT', 'CAMERA'):
        bpy.data.objects.remove(o)
mesh = bpy.data.objects['Monk']
mesh.data.validate()


def pixels(name, size):
    """Pixels RGBA (size x size, origine en bas) d'une image du fichier, redimensionnée."""
    img = bpy.data.images[name].copy()
    img.scale(size, size)
    return np.array(img.pixels[:], dtype=np.float32).reshape(size, size, 4)


atlas = np.zeros((ATLAS_H, ATLAS_W, 4), dtype=np.float32)
atlas[..., 3] = 1
for color, ao, x, y, size in SLOTS.values():
    px = pixels(color, size)
    if ao:
        px[..., :3] *= (1 - AO_STRENGTH) + AO_STRENGTH * pixels(ao, size)[..., :1]
    atlas[y:y + size, x:x + size] = px
img = bpy.data.images.new('moine_atlas', ATLAS_W, ATLAS_H)
img.pixels[:] = atlas.ravel()
img.file_format = 'PNG'
img.pack()

# UV recalées sur l'atlas, matériau par matériau
uv = mesh.data.uv_layers.active.data
names = [m.name for m in mesh.data.materials]
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

bpy.ops.export_scene.gltf(
    filepath=args.out,
    export_format='GLB',
    export_animations=True,
    export_animation_mode='ACTIONS',
    export_apply=False,
    export_cameras=False,
    export_lights=False,
)
print('Moine exporté :', args.out, '| animations :', sorted(CLIPS.values()))
