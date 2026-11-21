"""
Sauron (boss de la Montagne du Destin, issue #20) : le modèle `sauron.glb` fourni par l'utilisateur (Sketchfab, export
SketchUp texturé, sans squelette, en armure et couronne, cape, la masse tenue en diagonale dans la main droite, chaque
face en double), monté sur le squelette de la Universal Animation Library (Quaternius, CC0) comme `guts.py` :
1. débris lointain retiré, mise à l'échelle (le corps, couronne comprise, sans la masse, à `HEIGHT`) ; la matière de la
   masse habille aussi des pièces de l'armure : seules les pièces à sa droite (`MACE_X`) forment la masse ;
2. squelette provisoire sur ses articulations (`JOINTS`, relevées sur des vues quadrillées ; le bras droit, qui tient la
   masse, a les siennes : `JOINTS_R`), poids presque rigides ; la cape est retirée (rigide, ses jambes la traversaient) ;
3. membres tournés en pose en T, articulations du mannequin replacées sur les siennes, clips du mannequin (`CLIPS`) ;
4. la masse remise dans la main droite, tête dans `MACE_DIR`, rigide sur l'os de la main ;
5. deux gestes faits ici à partir de la garde : le balayage (`sweep` : la masse passe à l'horizontale sur tout l'avant)
   et l'appel de l'Oeil (`roar` : le bras gauche se lève vers le ciel, le buste se cambre).

Usage (Blender 5.2) :
  blender -b --factory-startup -P tools/blender/sauron.py -- --src "C:/Users/mydnic/Desktop/MODELS/sauron.glb"
      --ual "C:/Users/mydnic/Desktop/MODELS/animations/quaternius_universal_animation_library/UAL1_Standard.glb"
      --out src/assets/models/sauron.glb [--render DOSSIER]
"""
import argparse
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

ap = argparse.ArgumentParser()
ap.add_argument('--src', required=True)
ap.add_argument('--ual', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--render', default='')
args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:])

HEIGHT = 1.9  # taille du corps dans le fichier, couronne comprise (le jeu le met à la taille du boss)
# Articulations (m, après mise à l'échelle : face vers -Y, gauche du perso = +X ; le côté droit en miroir, sauf JOINTS_R)
JOINTS = {'pelvis': (0, -0.04, 0.93), 'chest': (0, -0.04, 1.2), 'neck': (0, -0.05, 1.45), 'top': (0, -0.06, 1.7),
          'shoulder': (0.24, -0.05, 1.36), 'elbow': (0.37, -0.07, 1.12), 'wrist': (0.39, -0.06, 0.89),
          'fingers': (0.38, -0.07, 0.79), 'hip': (0.11, -0.03, 0.9), 'knee': (0.12, -0.06, 0.5),
          'ankle': (0.13, -0.03, 0.1), 'toe': (0.13, -0.24, 0.02)}
# Le bras droit, plus replié sur la masse
JOINTS_R = {'elbow': (-0.3, -0.08, 1.11), 'wrist': (-0.38, -0.05, 0.9), 'fingers': (-0.41, -0.05, 0.82)}
# Garde, marche solennelle, coup abattu, touché, mort
CLIPS = {'Sword_Idle': 'idle', 'Walk_Formal_Loop': 'walk', 'Sword_Attack': 'slam', 'Hit_Chest': 'hit',
         'Death01': 'death'}
# Pièces de la matière de la masse à droite de ce x : la masse (les autres habillent l'armure)
MACE_X = -0.25
# Une pièce dont le centre est à plus de LOOSE m de tout os est un bord de cape (retiré avec elle)
LOOSE = 0.11
# Sous LEGS_Z m, une pièce loin des os reste aux jambes ; sous BOOT_Z m près des pieds, c'est une botte (jamais la cape)
LEGS_Z = 0.4
BOOT_Z = 0.14
# Une pièce plus grande que CAPE_SIZE m (diagonale) est la nappe de la cape
CAPE_SIZE = 1.0
# Direction de la tête de la masse en pose en T, dans le repère du squelette (comme l'épée de Guts : vers le haut)
MACE_DIR = Vector((0, 0, 1))
SWEEP = 1.1  # durée du balayage (s)
ROAR = 1.6  # durée de l'appel de l'Oeil (s)

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
    if side == 'r' and base in JOINTS_R:
        return Vector(JOINTS_R[base])
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

# --- 1. Le modèle : débris lointain (`Material_Boots`, loin du corps) retiré, à l'échelle
before = set(bpy.context.scene.objects)
bpy.ops.import_scene.gltf(filepath=args.src)
new = [o for o in bpy.context.scene.objects if o not in before]
parts = [o for o in new if o.type == 'MESH' and o.data.materials[0].name != 'Material_Boots']
for o in parts:
    o.data.transform(o.matrix_world)
    o.parent = None
    o.matrix_world = Matrix()
for o in new:
    if o not in parts:
        bpy.data.objects.remove(o)
mace_all = next(o for o in parts if 'mace' in o.data.materials[0].name)
vs = [v.co for o in parts if o is not mace_all for v in o.data.vertices]
lo = Vector(map(min, *vs)); hi = Vector(map(max, *vs))
S0 = Matrix.Scale(HEIGHT / (hi.z - lo.z), 4) @ Matrix.Translation(Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z)))
for o in parts:
    o.data.transform(S0)
# La matière de la masse habille aussi l'armure : seules les pièces à sa droite forment la masse
bpy.ops.object.select_all(action='DESELECT')
bpy.context.view_layer.objects.active = mace_all
mace_all.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.separate(type='LOOSE')
bpy.ops.object.mode_set(mode='OBJECT')
loose = [o for o in bpy.context.scene.objects if o.type == 'MESH' and 'mace' in o.data.materials[0].name]
mace_bits = [o for o in loose if sum((v.co for v in o.data.vertices), Vector()).x / len(o.data.vertices) < MACE_X]
armor_bits = [o for o in loose if o not in mace_bits]
bpy.ops.object.select_all(action='DESELECT')
for o in mace_bits:
    o.select_set(True)
bpy.context.view_layer.objects.active = mace_bits[0]
bpy.ops.object.join()
sword = bpy.context.view_layer.objects.active
sword.name = 'masse'
parts = [o for o in parts if o is not mace_all and o.name in bpy.data.objects] + armor_bits
bpy.ops.object.select_all(action='DESELECT')
for o in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
body = bpy.context.view_layer.objects.active
body.name = 'sauron'

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


def is_boot(p):
    # Les bottes : au ras du sol, près des pieds (la cape, elle, s'évasait plus loin)
    return p.z < BOOT_Z and abs(p.x) < 0.3


def is_cape(p):
    # Derrière le dos (sauf le casque et la couronne), ou sur les côtés sous les mains ; jamais les bottes
    if is_boot(p):
        return False
    if p.y > 0.07 and p.z < 1.42:
        return True
    return p.z < 0.72 and abs(p.x) > 0.21


segs = {n: (joint(a), joint(b)) for n, (a, b) in TEMP.items()}
groups = {n: body.vertex_groups.new(name=n) for n in TEMP}
# Un export SketchUp : des centaines de petites pièces d'armure. Chacune suit un seul os, celui le plus proche de son
# centre (rigide : une plaque tirée par deux os s'étirait en dalle) ; la jupe d'armure suit le bassin ; la cape est retirée.
links = [[] for _ in body.data.vertices]
for e in body.data.edges:
    a, b = e.vertices
    links[a].append(b); links[b].append(a)
seen = [False] * len(body.data.vertices)
cape = []
for start in range(len(body.data.vertices)):
    if seen[start]:
        continue
    island, stack = [], [start]
    seen[start] = True
    while stack:
        i = stack.pop(); island.append(i)
        for j in links[i]:
            if not seen[j]:
                seen[j] = True; stack.append(j)
    c = sum((body.data.vertices[i].co for i in island), Vector()) / len(island)
    lo_ = Vector(map(min, *(body.data.vertices[i].co for i in island)))
    hi_ = Vector(map(max, *(body.data.vertices[i].co for i in island)))
    # La grande nappe de la cape : une seule pièce, plus grande que toutes les plaques d'armure
    if (hi_ - lo_).length > CAPE_SIZE:
        cape.extend(island)
    if is_cape(c):
        bone = 'spine_03'
        cape.extend(island)
    elif abs(c.x) < 0.09 and 0.35 < c.z < 0.95:
        bone = 'pelvis'
    else:
        bone = min(segs, key=lambda n: seg_dist(c, *segs[n]))
        # Loin de tout os (un bord de cape près d'une main) : retiré avec la cape ; pas aux jambes (jambières, bottes)
        if seg_dist(c, *segs[bone]) > LOOSE and LEGS_Z < c.z < 1.42:
            bone = 'spine_03'
            cape.extend(island)
    groups[bone].add(island, 1.0, 'REPLACE')

# La cape est retirée (demande de l'utilisateur) : rigide, ses jambes la traversaient en marchant
bm = bmesh.new()
bm.from_mesh(body.data)
bm.verts.ensure_lookup_table()
bmesh.ops.delete(bm, geom=[bm.verts[i] for i in set(cape)], context='VERTS')
bm.to_mesh(body.data)
bm.free()
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

# --- 4. La masse dans la main droite : le manche dans le poing (là où il le tenait), tête dans `MACE_DIR`
sv = [v.co for v in sword.data.vertices]
# Son axe : du bout du manche (derrière lui) à la tête (devant, en bas)
tail_end = max(sv, key=lambda c: c.y).copy()
head_end = sum(sorted(sv, key=lambda c: c.y)[:40], Vector()) / 40
axis = (head_end - tail_end).normalized()
# Le poing : le point du manche le plus proche de son poignet droit d'origine
w = joint('fingers.r')
fist = tail_end + axis * (w - tail_end).dot(axis)
palm = hand[0].lerp(hand[1], 0.55)
R = axis.rotation_difference(MACE_DIR).to_matrix().to_4x4()
sword.data.transform(Matrix.Translation(palm) @ R @ Matrix.Translation(-fist))
g = sword.vertex_groups.new(name='hand_r')
g.add(list(range(len(sword.data.vertices))), 1.0, 'REPLACE')
bpy.ops.object.select_all(action='DESELECT')
sword.select_set(True); body.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.join()
mod = body.modifiers.new('rig', 'ARMATURE'); mod.object = rig
body.parent = rig
rig.name = 'sauron_rig'

# --- 5. Les gestes faits main, à partir de la garde : le balayage et l'appel de l'Oeil
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


def smooth(e):
    e = max(0.0, min(1.0, e))
    return e * e * (3 - 2 * e)


def sweep_pose(u):
    # Enroulé (0 à 0.4), balayage rapide (0.4 à 0.6), il finit loin à gauche puis revient en garde
    if u < 0.4:
        a = -60 * smooth(u / 0.4)
    elif u < 0.6:
        a = -60 + 150 * (u - 0.4) / 0.2
    else:
        a = 90 * (1 - smooth((u - 0.6) / 0.4))
    # La masse couchée à l'horizontale, tête devant lui (d'abord, le buste l'emporte ensuite)
    lay = math.sin(math.pi * min(1.0, u / 0.85))
    rot('lowerarm_r', Vector((1, 0, 0)), 75 * lay)
    rot('pelvis', Z, a * 0.25)
    for n in ('spine_01', 'spine_02', 'spine_03'):
        rot(n, Z, a * 0.25)


def roar_pose(u):
    # Le bras gauche se lève vers le ciel (0 à 0.35), il tient (jusqu'à 0.75), puis redescend ; le buste se cambre
    e = smooth(u / 0.35) * (1 - smooth((u - 0.75) / 0.25))
    rot('upperarm_l', Vector((0, 1, 0)), -150 * e)
    rot('lowerarm_l', Vector((0, 1, 0)), -20 * e)
    for n in ('spine_02', 'spine_03'):
        rot(n, Vector((1, 0, 0)), -8 * e)
    rot('Head', Vector((1, 0, 0)), -18 * e)


def bake(name, seconds, pose):
    act = bpy.data.actions.new(name)
    frames = round(FPS * seconds)
    for f in range(frames + 1):
        rig.animation_data.action = None
        for pb in rig.pose.bones:
            pb.matrix_basis = base[pb.name]
        bpy.context.view_layer.update()
        pose(f / frames)
        rig.animation_data.action = act
        if hasattr(rig.animation_data, 'action_slot') and act.slots:
            rig.animation_data.action_slot = act.slots[0]
        for pb in rig.pose.bones:
            pb.keyframe_insert('location', frame=f)
            pb.keyframe_insert('rotation_quaternion' if pb.rotation_mode == 'QUATERNION' else 'rotation_euler', frame=f)


bake('sweep', SWEEP, sweep_pose)
bake('roar', ROAR, roar_pose)
rig.animation_data.action = None
for pb in rig.pose.bones:
    pb.matrix_basis = Matrix()
bpy.context.view_layer.update()

for img in bpy.data.images:
    if img.size[0] > 1024:
        img.scale(1024, 1024)
bpy.ops.export_scene.gltf(filepath=args.out, export_format='GLB', export_animation_mode='ACTIONS', export_cameras=False,
                          export_lights=False, export_image_format='JPEG')
print('SAURON_OK', args.out, 'triangles', sum(len(p.vertices) - 2 for p in body.data.polygons), 'clips',
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
                                ('faux1', 'sweep', 10, (0.2, -0.3, 1)), ('faux2', 'sweep', 15, (0.2, -0.3, 1)),
                                ('faux3', 'sweep', 19, (0.2, -0.3, 1)), ('cri', 'roar', 30, (1, -1, 0)),
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
