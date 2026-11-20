"""
Guts (boss optionnel d'un cimetière, issue #19) : le modèle `guts.glb` fourni par l'utilisateur (Sketchfab, texturé, sans
squelette, pose en A, l'épée géante dans la main droite, chaque pièce en double), monté sur le squelette de la Universal
Animation Library (Quaternius, CC0) comme `vador.py` :
1. pièces en double retirées, mise à l'échelle (le corps, sans l'épée, à `HEIGHT`) ;
2. squelette provisoire sur ses articulations (`JOINTS`, relevées sur des vues quadrillées), poids presque rigides ; la
   cape (tout ce qui pend derrière le dos et sur les côtés, sous les mains) suit le dos d'un bloc ;
3. membres tournés en pose en T, articulations du mannequin replacées sur les siennes, clips du mannequin (`CLIPS`) ;
4. l'épée remise dans la main droite, lame dans `SWORD_DIR`, rigide sur l'os de la main ;
5. le fauchage (`sweep`) fait ici à partir de la garde : le buste s'enroule, puis l'épée balaie tout l'avant.

Usage (Blender 5.2) :
  blender -b --factory-startup -P tools/blender/guts.py -- --src "C:/Users/mydnic/Desktop/MODELS/guts.glb"
      --ual "C:/Users/mydnic/Desktop/MODELS/animations/quaternius_universal_animation_library/UAL1_Standard.glb"
      --out src/assets/models/guts.glb [--render DOSSIER]
"""
import argparse
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

ap = argparse.ArgumentParser()
ap.add_argument('--src', required=True)
ap.add_argument('--ual', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--render', default='')
args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:])

HEIGHT = 1.9  # taille du corps dans le fichier (le jeu le met à la taille du boss)
# Articulations (m, après mise à l'échelle : face vers -Y, gauche du perso = +X ; le côté droit en miroir)
JOINTS = {'pelvis': (0, -0.13, 1.08), 'chest': (0, -0.13, 1.38), 'neck': (0, -0.14, 1.62), 'top': (0, -0.16, 1.9),
          'shoulder': (0.21, -0.13, 1.5), 'elbow': (0.44, -0.12, 1.29), 'wrist': (0.61, -0.12, 1.15),
          'fingers': (0.72, -0.14, 1.05), 'hip': (0.1, -0.13, 1.02), 'knee': (0.11, -0.15, 0.5),
          'ankle': (0.11, -0.12, 0.12), 'toe': (0.11, -0.36, 0.03)}
# Garde, marche, coup abattu, cri du Berserker (il se ramasse puis se redresse), touché, mort
CLIPS = {'Sword_Idle': 'idle', 'Walk_Loop': 'walk', 'Sword_Attack': 'slam', 'Jump_Land': 'roar', 'Hit_Chest': 'hit',
         'Death01': 'death'}
# Direction de la lame en pose en T, dans le repère du squelette (comme le sabre de Vador : vers le haut)
SWORD_DIR = Vector((0, 0, 1))
SWEEP = 1.0  # durée du fauchage (s)

TEMP = {'pelvis': ('pelvis', 'chest'), 'spine_03': ('chest', 'neck'), 'Head': ('neck', 'top')}
for s in ('l', 'r'):
    TEMP.update({f'upperarm_{s}': (f'shoulder.{s}', f'elbow.{s}'), f'lowerarm_{s}': (f'elbow.{s}', f'wrist.{s}'),
                 f'hand_{s}': (f'wrist.{s}', f'fingers.{s}'), f'thigh_{s}': (f'hip.{s}', f'knee.{s}'),
                 f'calf_{s}': (f'knee.{s}', f'ankle.{s}'), f'foot_{s}': (f'ankle.{s}', f'toe.{s}')})
ALIGN = [f'{b}_{s}' for s in ('l', 'r') for b in ('upperarm', 'lowerarm', 'hand', 'thigh', 'calf', 'foot')]


def curves_of(action):
    try:
        return action.fcurves
    except AttributeError:
        return action.layers[0].strips[0].channelbags[0].fcurves


def seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
    return (a + ab * t - p).length


def joint(name):
    base, _, side = name.partition('.')
    x, y, z = JOINTS[base]
    return Vector((-x if side == 'r' else x, y, z))


bpy.ops.wm.read_factory_settings(use_empty=True)

# --- Le mannequin : squelette et clips
bpy.ops.import_scene.gltf(filepath=args.ual)
rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
for o in [o for o in bpy.context.scene.objects if o.type == 'MESH']:
    bpy.data.objects.remove(o)
for a in list(bpy.data.actions):
    if a.name in CLIPS:
        a.name = CLIPS[a.name]
    else:
        bpy.data.actions.remove(a)
if rig.animation_data:
    rig.animation_data.action = None
ual = {b.name: (rig.matrix_world @ b.head_local, rig.matrix_world @ b.tail_local) for b in rig.data.bones}

# --- 1. Le modèle : pièces en double retirées, à l'échelle
before = set(bpy.context.scene.objects)
bpy.ops.import_scene.gltf(filepath=args.src)
new = [o for o in bpy.context.scene.objects if o not in before]
parts, seen = [], set()
for o in new:
    if o.type != 'MESH':
        continue
    key = (len(o.data.vertices), o.data.materials[0].name)
    if key in seen:
        continue
    seen.add(key)
    parts.append(o)
for o in parts:
    o.data.transform(o.matrix_world)
    o.parent = None
    o.matrix_world = Matrix()
for o in new:
    if o not in parts:
        bpy.data.objects.remove(o)
sword = next(o for o in parts if 'sword' in o.data.materials[0].name)
parts.remove(sword)
vs = [v.co for o in parts for v in o.data.vertices]
lo = Vector(map(min, *vs)); hi = Vector(map(max, *vs))
S0 = Matrix.Scale(HEIGHT / (hi.z - lo.z), 4) @ Matrix.Translation(Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z)))
for o in parts + [sword]:
    o.data.transform(S0)
for m in bpy.data.materials:
    if m.name.startswith('mat_dvl_mdl_'):
        m.name = m.name[len('mat_dvl_mdl_'):]
bpy.ops.object.select_all(action='DESELECT')
for o in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
body = bpy.context.view_layer.objects.active
body.name = 'guts'

# --- 2. Squelette provisoire, poids presque rigides
tmp_data = bpy.data.armatures.new('tmp')
tmp = bpy.data.objects.new('tmp', tmp_data)
bpy.context.scene.collection.objects.link(tmp)
bpy.context.view_layer.objects.active = tmp
bpy.ops.object.mode_set(mode='EDIT')
for name, (a, b) in TEMP.items():
    eb = tmp_data.edit_bones.new(name)
    eb.head, eb.tail = joint(a), joint(b)
for name in TEMP:
    s = name[-1]
    parent = {'spine_03': 'pelvis', 'Head': 'spine_03', f'upperarm_{s}': 'spine_03', f'lowerarm_{s}': f'upperarm_{s}',
              f'hand_{s}': f'lowerarm_{s}', f'thigh_{s}': 'pelvis', f'calf_{s}': f'thigh_{s}', f'foot_{s}': f'calf_{s}'}.get(name)
    if parent:
        tmp_data.edit_bones[name].parent = tmp_data.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')


def is_cape(p):
    # Derrière le dos (sauf la nuque et les cheveux), ou sur les côtés sous les mains, loin des jambes
    if p.y > 0.03 and not (p.z > 1.6 and abs(p.x) < 0.16):
        return True
    return p.z < 1.0 and abs(p.x) > 0.23


segs = {n: (joint(a), joint(b)) for n, (a, b) in TEMP.items()}
blend = 0.03
groups = {n: body.vertex_groups.new(name=n) for n in TEMP}
for v in body.data.vertices:
    if is_cape(v.co):
        groups['spine_03'].add([v.index], 1.0, 'REPLACE')
        continue
    ds = sorted((seg_dist(v.co, a, b), n) for n, (a, b) in segs.items())
    (d0, n0), (d1, n1) = ds[0], ds[1]
    w1 = max(0.0, 0.5 - (d1 - d0) / (2 * blend)) if d1 - d0 < blend else 0.0
    groups[n0].add([v.index], 1.0 - w1, 'REPLACE')
    if w1 > 0:
        groups[n1].add([v.index], w1, 'REPLACE')
mod = body.modifiers.new('tmp', 'ARMATURE'); mod.object = tmp
body.parent = tmp

# --- 3. Membres tournés dans la direction du mannequin (pose en T), la pose devient la forme du maillage
bpy.context.view_layer.objects.active = tmp
bpy.ops.object.mode_set(mode='POSE')
for name in ALIGN:
    pb = tmp.pose.bones[name]
    h0, t0 = ual[name]
    q = (pb.tail - pb.head).normalized().rotation_difference((t0 - h0).normalized())
    m = pb.matrix.copy()
    head = m.translation.copy()
    pb.matrix = Matrix.Translation(head) @ q.to_matrix().to_4x4() @ Matrix.Translation(-head) @ m
    bpy.context.view_layer.update()
posed = {pb.name: (tmp.matrix_world @ pb.head, tmp.matrix_world @ pb.tail) for pb in tmp.pose.bones}
bpy.ops.object.mode_set(mode='OBJECT')
bpy.context.view_layer.objects.active = body
bpy.ops.object.modifier_apply(modifier=mod.name)
body.parent = None
bpy.data.objects.remove(tmp)

vs = [v.co for v in body.data.vertices]
lo = Vector(map(min, *vs)); hi = Vector(map(max, *vs))
T = Matrix.Scale(HEIGHT / (hi.z - lo.z), 4) @ Matrix.Translation(Vector((-(lo.x + hi.x) / 2, 0, -lo.z)))
body.data.transform(T)
posed = {n: (T @ h, T @ t) for n, (h, t) in posed.items()}
P = lambda n: posed[n][0]
PT = lambda n: posed[n][1]

# Articulations du mannequin replacées sur celles du modèle
k = (PT('Head') - P('pelvis')).length / (ual['Head'][1] - ual['pelvis'][0]).length
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
eb = rig.data.edit_bones
for b in eb:
    b.use_connect = False
moved = set()


def place(name, head, tail=None):
    b = eb[name]
    h0, t0 = ual[name]
    d = t0 - h0
    L = (tail - head).length if tail is not None else d.length * k
    b.head = head
    b.tail = head + d.normalized() * L
    moved.add(name)


chest, neck = P('spine_03'), P('Head')
place('pelvis', P('pelvis'), P('pelvis').lerp(chest, 0.35))
place('spine_01', P('pelvis').lerp(chest, 0.35), P('pelvis').lerp(chest, 0.7))
place('spine_02', P('pelvis').lerp(chest, 0.7), chest)
place('spine_03', chest, neck)
place('neck_01', neck, neck.lerp(PT('Head'), 0.15))
place('Head', neck.lerp(PT('Head'), 0.15), PT('Head'))
for s in ('l', 'r'):
    place(f'clavicle_{s}', chest.lerp(neck, 0.6), P(f'upperarm_{s}'))
    place(f'upperarm_{s}', P(f'upperarm_{s}'), P(f'lowerarm_{s}'))
    place(f'lowerarm_{s}', P(f'lowerarm_{s}'), P(f'hand_{s}'))
    place(f'hand_{s}', P(f'hand_{s}'), PT(f'hand_{s}'))
    place(f'thigh_{s}', P(f'thigh_{s}'), P(f'calf_{s}'))
    place(f'calf_{s}', P(f'calf_{s}'), P(f'foot_{s}'))
    place(f'foot_{s}', P(f'foot_{s}'), PT(f'foot_{s}'))
    place(f'ball_{s}', PT(f'foot_{s}'))
for b in eb:
    if b.name in moved or b.name == 'root':
        continue
    p = b.parent
    while p is not None and p.name not in moved:
        p = p.parent
    if p is not None:
        h0, t0 = ual[b.name]
        b.head = p.head + (h0 - ual[p.name][0]) * k
        b.tail = b.head + (t0 - h0) * k
hand = (eb['hand_r'].head.copy(), eb['hand_r'].tail.copy())
bpy.ops.object.mode_set(mode='OBJECT')
for a in bpy.data.actions:
    for fc in curves_of(a):
        if fc.data_path.endswith('location') and ('"pelvis"' in fc.data_path or '"root"' in fc.data_path):
            for kp in fc.keyframe_points:
                kp.co.y *= k
                kp.handle_left.y *= k
                kp.handle_right.y *= k

# --- 4. L'épée dans la main droite : la poignée dans le poing (là où il la tenait), lame dans `SWORD_DIR`
sv = [v.co for v in sword.data.vertices]
slo = Vector(map(min, *sv)); shi = Vector(map(max, *sv))
# Lame le long de -Y dans le fichier (pointe devant lui), pommeau derrière ; il la tenait à la hauteur de sa main
fist = Vector(((slo.x + shi.x) / 2, joint('wrist.r').y - 0.02, (slo.z + shi.z) / 2))
palm = hand[0].lerp(hand[1], 0.55)
R = Vector((0, -1, 0)).rotation_difference(SWORD_DIR).to_matrix().to_4x4()
sword.data.transform(Matrix.Translation(palm) @ R @ Matrix.Translation(-fist))
g = sword.vertex_groups.new(name='hand_r')
g.add(list(range(len(sword.data.vertices))), 1.0, 'REPLACE')
bpy.ops.object.select_all(action='DESELECT')
sword.select_set(True); body.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.join()
mod = body.modifiers.new('rig', 'ARMATURE'); mod.object = rig
body.parent = rig
rig.name = 'guts_rig'

# --- 5. Le fauchage, à partir de la garde : il s'enroule vers la droite, puis le buste balaie tout l'avant vers la gauche
FPS = bpy.context.scene.render.fps
rig.animation_data_create()
idle = bpy.data.actions['idle']
rig.animation_data.action = idle
if hasattr(rig.animation_data, 'action_slot') and idle.slots:
    rig.animation_data.action_slot = idle.slots[0]
bpy.context.scene.frame_set(1)
base = {pb.name: pb.matrix_basis.copy() for pb in rig.pose.bones}
rig.animation_data.action = None
Z = Vector((0, 0, 1))


def rot(name, axis, deg):
    pb = rig.pose.bones[name]
    h = pb.head.copy()
    pb.matrix = Matrix.Translation(h) @ Matrix.Rotation(math.radians(deg), 4, axis) @ Matrix.Translation(-h) @ pb.matrix
    bpy.context.view_layer.update()


SWEEP_AT = 0.45  # moment où l'épée passe devant lui (part du clip)


def sweep_pose(u):
    # Enroulé (0 à 0.35), balayage rapide (0.35 à 0.55), il finit loin à gauche puis revient en garde
    if u < 0.35:
        e = u / 0.35; a = -55 * (e * e * (3 - 2 * e))
    elif u < 0.55:
        e = (u - 0.35) / 0.2; a = -55 + 140 * e
    else:
        e = (u - 0.55) / 0.45; a = 85 * (1 - e * e * (3 - 2 * e))
    # L'épée couchée à l'horizontale, pointe devant lui (d'abord, le buste l'emporte ensuite)
    lay = math.sin(math.pi * min(1.0, u / 0.85))
    rot('lowerarm_r', Vector((1, 0, 0)), 70 * lay)
    rot('pelvis', Z, a * 0.25)
    for n in ('spine_01', 'spine_02', 'spine_03'):
        rot(n, Z, a * 0.25)


act = bpy.data.actions.new('sweep')
frames = round(FPS * SWEEP)
for f in range(frames + 1):
    rig.animation_data.action = None
    for pb in rig.pose.bones:
        pb.matrix_basis = base[pb.name]
    bpy.context.view_layer.update()
    sweep_pose(f / frames)
    rig.animation_data.action = act
    if hasattr(rig.animation_data, 'action_slot') and act.slots:
        rig.animation_data.action_slot = act.slots[0]
    for pb in rig.pose.bones:
        pb.keyframe_insert('location', frame=f)
        pb.keyframe_insert('rotation_quaternion' if pb.rotation_mode == 'QUATERNION' else 'rotation_euler', frame=f)
rig.animation_data.action = None
for pb in rig.pose.bones:
    pb.matrix_basis = Matrix()
bpy.context.view_layer.update()

for img in bpy.data.images:
    if img.size[0] > 1024:
        img.scale(1024, 1024)
bpy.ops.export_scene.gltf(filepath=args.out, export_format='GLB', export_animation_mode='ACTIONS', export_cameras=False,
                          export_lights=False, export_image_format='JPEG')
print('GUTS_OK', args.out, 'triangles', sum(len(p.vertices) - 2 for p in body.data.polygons), 'clips',
      sorted((a.name, round((a.frame_range[1] - a.frame_range[0]) / FPS, 2)) for a in bpy.data.actions),
      'matieres', sorted(m.name for m in body.data.materials))

if args.render:
    os.makedirs(args.render, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.color_type = 'TEXTURE'
    sc.display.shading.light = 'STUDIO'
    sc.render.resolution_x, sc.render.resolution_y = 420, 480
    cam = bpy.data.cameras.new('c'); cam.type = 'ORTHO'; cam.ortho_scale = HEIGHT * 2.2
    co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co
    for name, act, frame, d in (('garde', 'idle', 10, (0, -1, 0)), ('garde34', 'idle', 10, (1, -1, 0)),
                                ('marche', 'walk', 8, (1, 0, 0)), ('marche2', 'walk', 20, (1, -1, 0.3)),
                                ('abat', 'slam', 12, (1, -1, 0)), ('abat2', 'slam', 22, (1, 0, 0)),
                                ('faux1', 'sweep', 9, (0.2, -0.3, 1)), ('faux2', 'sweep', 14, (0.2, -0.3, 1)),
                                ('faux3', 'sweep', 17, (0.2, -0.3, 1)), ('cri', 'roar', 12, (1, -1, 0)),
                                ('mort', 'death', 50, (1, -1, 0.5)), ('dos', 'idle', 10, (0, 1, 0))):
        rig.animation_data.action = bpy.data.actions[act]
        if hasattr(rig.animation_data, 'action_slot') and rig.animation_data.action.slots:
            rig.animation_data.action_slot = rig.animation_data.action.slots[0]
        sc.frame_set(frame)
        dv = Vector(d).normalized()
        co.location = Vector((0, 0, HEIGHT * 0.55)) + dv * HEIGHT * 4
        co.rotation_euler = (-dv).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.join(args.render, f'{name}.png')
        bpy.ops.render.render(write_still=True)
