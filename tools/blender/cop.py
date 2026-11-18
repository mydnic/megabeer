"""
Le Cop (perso jouable) : le modèle « Mall Cop » (Mixamo, fourni par l'utilisateur, dossier mall-cop-animated) passé
sur le squelette et les animations du Buveur.

Le modèle a un squelette Mixamo en pose T (bras à l'horizontale) et une peau lissée. Le script :
1. abaisse les bras le long du corps et prend cette pose comme pose de repos (la peau suit) ;
2. remplace le squelette Mixamo par celui du Buveur : ses articulations sont replacées sur celles du Cop (chaque os
   garde son orientation, donc les animations du Buveur restent valables) et les poids de peau des os Mixamo passent
   aux os du Buveur correspondants ;
3. réduit les textures (couleur seulement, `--tex` px) et exporte le tout avec les animations.

Usage (Blender 5.2) :
  blender -b --factory-startup -P tools/blender/cop.py -- --src "C:/Users/mydnic/Desktop/MODELS/mall-cop-animated/source/mall_cop_sf.glb"
      --out src/assets/models/cop.glb [--render DOSSIER]
"""
import argparse
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

ap = argparse.ArgumentParser()
ap.add_argument('--src', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--buveur', default='src/assets/models/buveur.glb')
ap.add_argument('--tex', type=int, default=512)
ap.add_argument('--render', default='')
args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:])

HEIGHT = 1.85          # taille du Cop (m)
ARM_DOWN = Vector((0.2, 0.02, -1)).normalized()  # direction du bras abaissé (côté gauche ; x opposé à droite)

# Os Mixamo -> os du Buveur (les doigts et les orteils suivent la main et le pied)
MAP = {
    'Hips': 'hips', 'Spine': 'spine', 'Spine1': 'spine', 'Spine2': 'chest', 'Neck': 'head', 'Head': 'head', 'HeadTop_End': 'head',
    'LeftShoulder': 'chest', 'RightShoulder': 'chest',
    'LeftArm': 'upperarm.L', 'LeftForeArm': 'forearm.L', 'LeftHand': 'hand.L',
    'RightArm': 'upperarm.R', 'RightForeArm': 'forearm.R', 'RightHand': 'hand.R',
    'LeftUpLeg': 'thigh.L', 'LeftLeg': 'shin.L', 'LeftFoot': 'foot.L', 'LeftToeBase': 'foot.L', 'LeftToe_End': 'foot.L',
    'RightUpLeg': 'thigh.R', 'RightLeg': 'shin.R', 'RightFoot': 'foot.R', 'RightToeBase': 'foot.R', 'RightToe_End': 'foot.R',
}
for side in ('Left', 'Right'):
    for i in range(1, 5):
        MAP[f'{side}HandIndex{i}'] = f'hand.{side[0]}'


def target(mixamo_name):
    short = mixamo_name.split(':')[-1]
    return MAP.get(short)


bpy.ops.wm.read_factory_settings(use_empty=True)

# --- Le squelette et les animations du Buveur
bpy.ops.import_scene.gltf(filepath=args.buveur)
rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
for o in [o for o in bpy.context.scene.objects if o.type == 'MESH']:
    bpy.data.objects.remove(o)
old = {b.name: (rig.matrix_world @ b.head_local, rig.matrix_world @ b.tail_local) for b in rig.data.bones}
keep_actions = set(bpy.data.actions)

# --- Le Cop
before = set(bpy.context.scene.objects)
bpy.ops.import_scene.gltf(filepath=args.src)
new = [o for o in bpy.context.scene.objects if o not in before]
mix = next(o for o in new if o.type == 'ARMATURE')
for o in [o for o in new if o.type == 'MESH' and not o.vertex_groups]:
    bpy.data.objects.remove(o)  # la sphère qui traîne dans le fichier
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.parent == mix]
for a in set(bpy.data.actions) - keep_actions:
    bpy.data.actions.remove(a)
if mix.animation_data:
    mix.animation_data.action = None

# --- Bras abaissés (pose), puis cette pose devient la forme du maillage
bpy.context.view_layer.objects.active = mix
bpy.ops.object.mode_set(mode='POSE')
for pb in mix.pose.bones:
    pb.rotation_mode = 'QUATERNION'
    pb.rotation_quaternion = (1, 0, 0, 0)
bpy.context.view_layer.update()
inv = mix.matrix_world.inverted()
for side, sx in (('Left', 1), ('Right', -1)):
    pb = mix.pose.bones[f'mixamorig:{side}Arm']
    want = Vector((ARM_DOWN.x * sx, ARM_DOWN.y, ARM_DOWN.z))
    # Directions dans l'espace de l'armature (le monde est tourné et mis à l'échelle par l'objet)
    want_arm = (inv.to_3x3() @ want).normalized()
    cur = (pb.tail - pb.head).normalized()
    q = cur.rotation_difference(want_arm)
    m = pb.matrix.copy()
    head = m.translation.copy()
    rot = q.to_matrix().to_4x4() @ Matrix.Translation(-head) @ m
    pb.matrix = Matrix.Translation(head) @ rot
    bpy.context.view_layer.update()
bpy.ops.object.mode_set(mode='OBJECT')
# Le maillage prend la pose (modificateur appliqué), en coordonnées du monde
for o in meshes:
    bpy.context.view_layer.objects.active = o
    for mod in list(o.modifiers):
        if mod.type == 'ARMATURE':
            bpy.ops.object.modifier_apply(modifier=mod.name)
    mw = o.matrix_world.copy()
    o.parent = None
    o.data.transform(mw)
    o.matrix_world = Matrix()

# Articulations du Cop (pose abaissée), en coordonnées du monde
joints = {pb.name.split(':')[-1]: (mix.matrix_world @ pb.head, mix.matrix_world @ pb.tail) for pb in mix.pose.bones}
bpy.data.objects.remove(mix)

# Mise à la taille voulue, pieds au sol, centré
allv = [v.co for o in meshes for v in o.data.vertices]
lo = Vector(map(min, *allv)); hi = Vector(map(max, *allv))
k = HEIGHT / (hi.z - lo.z)
shift = Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z))
T = Matrix.Scale(k, 4) @ Matrix.Translation(shift)
for o in meshes:
    o.data.transform(T)
joints = {n: (T @ h, T @ t) for n, (h, t) in joints.items()}

# --- Le squelette du Buveur replacé sur les articulations du Cop
def place(name, head, tail=None, length=None):
    eb = rig.data.edit_bones[name]
    h0, t0 = old[name]
    d = (t0 - h0)
    L = (tail - head).length if tail is not None else (length if length is not None else d.length)
    eb.head = head
    eb.tail = head + d.normalized() * L

J = lambda n: joints[n][0]
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
for eb in rig.data.edit_bones:
    eb.use_connect = False
place('hips', J('Hips'), tail=J('Spine'))
place('spine', J('Spine'), tail=J('Spine2'))
place('belly', J('Spine1') + Vector((0, -0.12, 0)), length=0.12)
place('chest', J('Spine2'), tail=J('Neck'))
place('head', J('Neck'), tail=J('HeadTop_End'))
for s, side in (('L', 'Left'), ('R', 'Right')):
    place(f'upperarm.{s}', J(f'{side}Arm'), tail=J(f'{side}ForeArm'))
    place(f'forearm.{s}', J(f'{side}ForeArm'), tail=J(f'{side}Hand'))
    place(f'hand.{s}', J(f'{side}Hand'), tail=J(f'{side}HandIndex4'))
    place(f'thigh.{s}', J(f'{side}UpLeg'), tail=J(f'{side}Leg'))
    place(f'shin.{s}', J(f'{side}Leg'), tail=J(f'{side}Foot'))
    place(f'foot.{s}', J(f'{side}Foot'), tail=J(f'{side}Toe_End'))
place('pint', rig.data.edit_bones['hand.R'].tail.copy(), length=0.15)
bpy.ops.object.mode_set(mode='OBJECT')

# --- Poids de peau : groupes Mixamo fusionnés dans les groupes du Buveur
for o in meshes:
    sums = {}
    for v in o.data.vertices:
        acc = {}
        for g in v.groups:
            t = target(o.vertex_groups[g.group].name)
            if t and g.weight > 0:
                acc[t] = acc.get(t, 0) + g.weight
        sums[v.index] = acc
    for g in list(o.vertex_groups):
        o.vertex_groups.remove(g)
    groups = {}
    for i, acc in sums.items():
        for t, w in acc.items():
            if t not in groups:
                groups[t] = o.vertex_groups.new(name=t)
            groups[t].add([i], min(1.0, w), 'REPLACE')
    mod = o.modifiers.new('rig', 'ARMATURE')
    mod.object = rig
    o.parent = rig

# --- Textures réduites, sans carte de relief (le cel-shading n'en a pas besoin)
for mat in bpy.data.materials:
    if not mat.use_nodes:
        continue
    for n in list(mat.node_tree.nodes):
        if n.type == 'NORMAL_MAP':
            mat.node_tree.nodes.remove(n)
for img in bpy.data.images:
    if 'normal' in img.name.lower():
        continue
    if img.size[0] > args.tex:
        img.scale(args.tex, args.tex)
rig.name = 'Cop_rig'

bpy.ops.export_scene.gltf(filepath=args.out, export_format='GLB', export_animation_mode='ACTIONS', export_cameras=False, export_lights=False,
                          export_image_format='JPEG')
print('OK', args.out, 'triangles', sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes))

if args.render:
    os.makedirs(args.render, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = 500, 600
    w = bpy.data.worlds.new('w'); w.color = (0.6, 0.65, 0.7); sc.world = w
    bpy.ops.object.light_add(type='SUN', rotation=(0.7, 0.2, 2.6)); bpy.context.active_object.data.energy = 4
    cam = bpy.data.cameras.new('c'); cam.type = 'ORTHO'; cam.ortho_scale = 2.4
    co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co
    for name, act, frame, loc in (('face', 'idle', 1, (0.6, -4, 1.1)), ('profil', 'idle', 1, (4, 0, 1.1)), ('course', 'run', 6, (3, -3, 1.1)), ('lancer', 'throw', 8, (3, -3, 1.1)), ('mort', 'death', 30, (3, -3, 1.1))):
        rig.animation_data.action = bpy.data.actions.get(act)
        sc.frame_set(frame)
        co.location = loc
        co.rotation_euler = (Vector((0, 0, 0.95)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.join(args.render, f'{name}.png')
        bpy.ops.render.render(write_still=True)
