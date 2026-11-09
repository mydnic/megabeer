"""
Prépare un personnage KayKit (Kay Lousberg) pour la foule du jeu, en variantes.

Les personnages KayKit et leurs animations sont livrés à part, sur le même squelette (Rig_Medium) :
ce script les assemble, retire des pièces (masque, chapeau...), recolore la texture, accroche au
besoin un objet à un os (main), puis range les textures dans un atlas avec un seul matériau, comme
le demande la foule (enemies/zombieLibrary.ts). Les animations utiles sont renommées comme celles
des zombies Quaternius (Idle, Walk, Run, Punch, HitReact, Death).

Variantes (--variant) :
- porte_reliques : le Rogue encapuchonné sans son masque, en bure crème, qui tient à deux mains
  devant lui un coffret doré (le coffre en or du KayKit Dungeon, réduit) : le Moine porte-reliques.

Les fichiers source sont lus dans la bibliothèque d'assets (--lib, le dossier MODELS trié).

Usage (Blender 5.2) :
  blender -b --factory-startup --disable-autoexec -P tools/blender/kaykit.py -- --lib C:/Users/mydnic/Desktop/MODELS
      --variant porte_reliques --out src/assets/models/porte_reliques.glb
"""
import argparse
import os
import sys

import bpy
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from crowd_utils import pixels, recolor  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument('--lib', required=True)
ap.add_argument('--variant', required=True)
ap.add_argument('--out', required=True)
args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:])

# Animation KayKit gardée -> nom attendu par le jeu
CLIPS = {
    'Idle_A': 'Idle',
    'Walking_A': 'Walk',
    'Running_A': 'Run',
    'Use_Item': 'Punch',  # il brandit ce qu'il tient : sert de coup
    'Hit_A': 'HitReact',
    'Death_A': 'Death',
}
ANIMS = [
    'personnages/kaykit_adventurers/animations/Rig_Medium/Rig_Medium_General.glb',
    'personnages/kaykit_adventurers/animations/Rig_Medium/Rig_Medium_MovementBasic.glb',
]
# Côté d'une case de l'atlas (px) : une case par texture
CELL = 1024

VARIANTS = {
    'porte_reliques': {
        'character': 'personnages/kaykit_adventurers/personnages/Rogue_Hooded.glb',
        'drop': ['Mask'],
        # Le vert (capuche, pèlerine, tunique) devient une bure crème
        'recolor': [{'mask': {'hue': (0.22, 0.5), 'sat': (0.15, 1.0)}, 'to': {'hue': 0.11, 'sat': 0.3, 'val': 1.7}}],
        # Le reliquaire tenu devant la poitrine : os qui le porte, taille (m, plus grande dimension), position
        # (repère du personnage : face vers -Y, pieds en Z = 0)
        'prop': {
            'file': 'decor/kaykit_dungeon/gltf/chest_gold.gltf', 'bone': 'chest', 'size': 0.56, 'at': (0, -0.5, 0.97),
            # Bois brun et ferrures grises passés à l'or
            'recolor': [
                {'mask': {'hue': (0.0, 0.1), 'sat': (0.2, 1.0)}, 'to': {'hue': 0.12, 'sat': 1.3, 'val': 1.9}},
                {'mask': {'hue': (0.0, 1.0), 'sat': (0.0, 0.2), 'val': (0.15, 0.9)}, 'to': {'hue': 0.13, 'sat': 4.0, 'val': 1.4}},
            ],
        },
        # Les deux mains posées de chaque côté du reliquaire (poignet gauche ; le droit en miroir), dans ces animations
        'hold': {'wrist': (0.33, -0.46, 0.97), 'actions': ['Idle', 'Walk', 'Run', 'HitReact']},
    },
}
variant = VARIANTS[args.variant]
lib = lambda p: os.path.join(args.lib, p)  # noqa: E731


def import_new(path):
    """Importe un glTF et renvoie les objets créés."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]


def select(objs, active):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active


def base_image(material):
    """Image de couleur d'un matériau importé."""
    return next(n.image for n in material.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image)


bpy.ops.wm.read_factory_settings(use_empty=True)

# Le personnage, sans les pièces retirées
objs = import_new(lib(variant['character']))
arm = next(o for o in objs if o.type == 'ARMATURE')
for o in [o for o in objs if o.type == 'MESH' and any(d in o.name for d in variant['drop'])]:
    bpy.data.objects.remove(o)
meshes = [o for o in bpy.data.objects if o.type == 'MESH']

# Ses animations : celles des fichiers d'animations (même squelette), gardées et renommées
for path in ANIMS:
    new = import_new(lib(path))
    for a in bpy.data.actions:
        a.use_fake_user = True
    for o in new:
        bpy.data.objects.remove(o)
for a in list(bpy.data.actions):
    if a.name in CLIPS:
        a.name = CLIPS[a.name]
    else:
        bpy.data.actions.remove(a)
arm.animation_data_create()


def use_action(action):
    arm.animation_data.action = action
    if len(getattr(action, 'slots', ())):
        arm.animation_data.action_slot = action.slots[0]


def hold_with_both_hands(cfg):
    """
    Bras posés sur l'objet tenu devant lui : des IK temporaires (cibles portées par la poitrine)
    placent les bras à chaque image ; la pose obtenue est relevée, puis inscrite dans l'animation.
    """
    scene = bpy.context.scene
    arm.data.pose_position = 'REST'
    bpy.context.view_layer.update()
    targets = []
    for side, sx in (('l', 1), ('r', -1)):
        e = bpy.data.objects.new('cible_' + side, None)
        scene.collection.objects.link(e)
        e.parent = arm
        e.parent_type = 'BONE'
        e.parent_bone = 'chest'
        bpy.context.view_layer.update()
        e.matrix_world = Matrix.Translation(Vector((cfg['wrist'][0] * sx, cfg['wrist'][1], cfg['wrist'][2])))
        c = arm.pose.bones['lowerarm.' + side].constraints.new('IK')
        c.target = e
        c.chain_count = 2
        targets.append(e)
    arm.data.pose_position = 'POSE'
    bones = ['upperarm.l', 'lowerarm.l', 'upperarm.r', 'lowerarm.r']
    poses = {}
    for name in cfg['actions']:
        action = bpy.data.actions[name]
        use_action(action)
        for f in range(int(action.frame_range[0]), int(action.frame_range[1]) + 1):
            scene.frame_set(f)
            poses[(name, f)] = {b: arm.pose.bones[b].matrix.copy() for b in bones}
    for b in ('lowerarm.l', 'lowerarm.r'):
        pb = arm.pose.bones[b]
        for c in list(pb.constraints):
            pb.constraints.remove(c)
    for e in targets:
        bpy.data.objects.remove(e)
    for name in cfg['actions']:
        action = bpy.data.actions[name]
        use_action(action)
        for f in range(int(action.frame_range[0]), int(action.frame_range[1]) + 1):
            scene.frame_set(f)
            for b in bones:  # le bras avant l'avant-bras : chaque os se pose sur son parent déjà placé
                pb = arm.pose.bones[b]
                pb.matrix = poses[(name, f)][b]
                bpy.context.view_layer.update()
                pb.keyframe_insert('rotation_quaternion', frame=f)
    arm.animation_data.action = None


if 'hold' in variant:
    hold_with_both_hands(variant['hold'])

# Rattachées au squelette du personnage, une piste NLA par animation (exportées piste par piste)
for a in bpy.data.actions:
    track = arm.animation_data.nla_tracks.new()
    track.name = a.name
    strip = track.strips.new(a.name, int(a.frame_range[0]), a)
    if len(getattr(a, 'slots', ())):
        strip.action_slot = a.slots[0]
    track.mute = True

# L'objet tenu : rigide, porté par un os
prop_cfg = variant.get('prop')
if prop_cfg:
    new = import_new(lib(prop_cfg['file']))
    prop = max((o for o in new if o.type == 'MESH'), key=lambda o: len(o.data.polygons))
    for o in new:
        if o is not prop:
            bpy.data.objects.remove(o)
    prop.parent = None
    select([prop], prop)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    vs = [v.co for v in prop.data.vertices]
    lo = Vector([min(v[i] for v in vs) for i in range(3)])
    hi = Vector([max(v[i] for v in vs) for i in range(3)])
    k = prop_cfg['size'] / max(hi - lo)
    if 'at' in prop_cfg:
        at = Vector(prop_cfg['at'])
    else:
        at = arm.matrix_world @ arm.data.bones[prop_cfg['bone']].head_local + Vector(prop_cfg.get('offset', (0, 0, 0)))
    center = (lo + hi) / 2
    for v in prop.data.vertices:
        v.co = (v.co - center) * k + at
    prop.vertex_groups.new(name=prop_cfg['bone']).add(range(len(prop.data.vertices)), 1.0, 'REPLACE')
    meshes.append(prop)

# Un seul maillage
body = next(o for o in meshes if o.vertex_groups and o.modifiers)
select(meshes, body)
bpy.ops.object.join()
body.data.validate()

# Atlas : une case par matériau, côte à côte ; le personnage recoloré
mats = list(body.data.materials)
atlas = np.zeros((CELL, CELL * len(mats), 4), dtype=np.float32)
for i, m in enumerate(mats):
    px = pixels(base_image(m), CELL)
    # Case 0 : le personnage ; les suivantes : l'objet tenu
    rules = variant.get('recolor', []) if i == 0 else (prop_cfg or {}).get('recolor', [])
    for rule in rules:
        px = recolor(px, rule['mask'], rule['to'])
    atlas[:, i * CELL:(i + 1) * CELL] = px
img = bpy.data.images.new('kaykit_atlas', CELL * len(mats), CELL)
img.pixels[:] = atlas.ravel()
img.file_format = 'PNG'
img.pack()
uv = body.data.uv_layers.active.data
for poly in body.data.polygons:
    for li in poly.loop_indices:
        u, v = uv[li].uv
        u = min(max(u, 0.0), 1.0)
        uv[li].uv = ((poly.material_index + u) / len(mats), min(max(v, 0.0), 1.0))
mat = bpy.data.materials.new('KayKit')
mat.use_nodes = True
tex = mat.node_tree.nodes.new('ShaderNodeTexImage')
tex.image = img
tex.interpolation = 'Closest'
bsdf = mat.node_tree.nodes['Principled BSDF']
mat.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
bsdf.inputs['Roughness'].default_value = 1
body.data.materials.clear()
body.data.materials.append(mat)
for p in body.data.polygons:
    p.material_index = 0

bpy.ops.export_scene.gltf(
    filepath=args.out, export_format='GLB', export_animations=True, export_animation_mode='NLA_TRACKS',
    export_apply=False, export_cameras=False, export_lights=False,
)
print('KayKit exporté :', args.variant, args.out, '| animations :', sorted(a.name for a in bpy.data.actions))
