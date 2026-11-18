"""
Le Barman robot (perso jouable) : un robot à tête de vieille télé (modèle fourni par l'utilisateur, sans squelette, dans
une pose bras levés) monté sur le squelette de la Universal Animation Library (Quaternius, CC0), avec des clips à lui
(il râle en gesticulant au repos, sprinte raide, s'éteint en s'asseyant).

Le script :
1. pose un squelette provisoire sur les articulations du robot (relevées sur des rendus quadrillés, `JOINTS`) et lui
   donne des poids presque rigides (chaque pièce suit l'os le plus proche, fondu court aux articulations) ;
2. tourne les membres de ce squelette dans la direction des os du mannequin (pose en T), applique la pose au maillage ;
3. replace les articulations du mannequin sur celles du robot (orientation des os gardée : les clips restent valables),
   renomme les os que le jeu cherche, garde et renomme les clips choisis ;
4. réduit les textures et exporte.

Usage (Blender 5.2) :
  blender -b --factory-startup -P tools/blender/robot.py -- --src "C:/Users/mydnic/Desktop/MODELS/6047602-20260925122643977-um84.glb"
      --ual "C:/Users/mydnic/Desktop/MODELS/animations/quaternius_universal_animation_library/UAL1_Standard.glb"
      --out src/assets/models/robot.glb [--render DOSSIER]
"""
import argparse
import os
import sys

import bpy
from mathutils import Matrix, Vector

ap = argparse.ArgumentParser()
ap.add_argument('--src', required=True)
ap.add_argument('--ual', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--tex', type=int, default=1024)
ap.add_argument('--render', default='')
args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:])

HEIGHT = 1.78  # taille du robot, antenne comprise (m)

# Articulations du robot dans le fichier source (m ; face vers -Y ; côté gauche du robot = +X, le droit en miroir)
JOINTS = {
    'pelvis': (0, 0.10, -0.03), 'chest': (0, 0.17, 0.30), 'neck': (0, 0.16, 0.50), 'top': (0, 0.15, 0.76),
    'shoulder': (0.25, 0.10, 0.40), 'elbow': (0.40, 0.04, 0.21), 'wrist': (0.53, -0.30, 0.40), 'fingers': (0.56, -0.37, 0.50),
    'hip': (0.11, 0.08, -0.08), 'knee': (0.19, -0.05, -0.44), 'ankle': (0.20, 0.14, -0.80), 'toe': (0.20, -0.06, -0.93),
}
# Os du squelette provisoire (noms du mannequin) : de l'articulation `a` à l'articulation `b`
TEMP = {'pelvis': ('pelvis', 'chest'), 'spine_03': ('chest', 'neck'), 'Head': ('neck', 'top')}
for s, sx in (('l', 1), ('r', -1)):
    TEMP.update({f'upperarm_{s}': (f'shoulder.{s}', f'elbow.{s}'), f'lowerarm_{s}': (f'elbow.{s}', f'wrist.{s}'),
                 f'hand_{s}': (f'wrist.{s}', f'fingers.{s}'), f'thigh_{s}': (f'hip.{s}', f'knee.{s}'),
                 f'calf_{s}': (f'knee.{s}', f'ankle.{s}'), f'foot_{s}': (f'ankle.{s}', f'toe.{s}')})
# Segments tournés vers la direction du mannequin avant de figer la pose de repos
ALIGN = [f'{b}_{s}' for s in ('l', 'r') for b in ('upperarm', 'lowerarm', 'hand', 'thigh', 'calf', 'foot')]

# Clips du mannequin -> clips du jeu (différents de ceux du Cop là où la bibliothèque le permet)
CLIPS = {'Idle_Talking_Loop': 'idle', 'Sprint_Loop': 'run', 'Jump_Start': 'jump', 'Jump_Loop': 'fall', 'Jump_Land': 'land',
         'Sitting_Enter': 'death', 'Spell_Simple_Shoot': 'throw'}
RENAME = {'thigh_l': 'thigh.L', 'calf_l': 'shin.L', 'foot_l': 'foot.L', 'hand_l': 'hand.L',
          'thigh_r': 'thigh.R', 'calf_r': 'shin.R', 'foot_r': 'foot.R', 'hand_r': 'hand.R'}


def joint(name):
    base, _, side = name.partition('.')
    x, y, z = JOINTS[base]
    return Vector((-x if side == 'r' else x, y, z))


def curves_of(action):
    try:
        return action.fcurves
    except AttributeError:
        return action.layers[0].strips[0].channelbags[0].fcurves


def seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
    return (a + ab * t - p).length


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

# --- Le robot
before = set(bpy.context.scene.objects)
bpy.ops.import_scene.gltf(filepath=args.src)
robot = next(o for o in bpy.context.scene.objects if o not in before and o.type == 'MESH')
for o in [o for o in bpy.context.scene.objects if o not in before and o is not robot]:
    bpy.data.objects.remove(o)
mw = robot.matrix_world.copy()
robot.parent = None
robot.data.transform(mw)
robot.matrix_world = Matrix()

# --- 1. Squelette provisoire sur les articulations du robot, poids presque rigides
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
segs = {n: (joint(a), joint(b)) for n, (a, b) in TEMP.items()}
groups = {n: robot.vertex_groups.new(name=n) for n in TEMP}
for v in robot.data.vertices:
    ds = sorted((seg_dist(v.co, a, b), n) for n, (a, b) in segs.items())
    (d0, n0), (d1, n1) = ds[0], ds[1]
    # Fondu court entre les deux os les plus proches, seulement si leurs distances se valent (articulations)
    w1 = max(0.0, 0.5 - (d1 - d0) / 0.06) if d1 - d0 < 0.03 else 0.0
    groups[n0].add([v.index], 1.0 - w1, 'REPLACE')
    if w1 > 0:
        groups[n1].add([v.index], w1, 'REPLACE')
mod = robot.modifiers.new('tmp', 'ARMATURE'); mod.object = tmp
robot.parent = tmp

# --- 2. Membres tournés dans la direction du mannequin (pose en T), puis la pose devient la forme du maillage
bpy.context.view_layer.objects.active = tmp
bpy.ops.object.mode_set(mode='POSE')
for name in ALIGN:
    pb = tmp.pose.bones[name]
    h0, t0 = ual[name]
    want = (t0 - h0).normalized()
    cur = (pb.tail - pb.head).normalized()
    q = cur.rotation_difference(want)
    m = pb.matrix.copy()
    head = m.translation.copy()
    pb.matrix = Matrix.Translation(head) @ q.to_matrix().to_4x4() @ Matrix.Translation(-head) @ m
    bpy.context.view_layer.update()
posed = {pb.name: (tmp.matrix_world @ pb.head, tmp.matrix_world @ pb.tail) for pb in tmp.pose.bones}
bpy.ops.object.mode_set(mode='OBJECT')
bpy.context.view_layer.objects.active = robot
bpy.ops.object.modifier_apply(modifier=mod.name)
robot.parent = None
bpy.data.objects.remove(tmp)

# Mise à la taille, pieds au sol, centré
vs = [v.co for v in robot.data.vertices]
lo = Vector(map(min, *vs)); hi = Vector(map(max, *vs))
k_size = HEIGHT / (hi.z - lo.z)
T = Matrix.Scale(k_size, 4) @ Matrix.Translation(Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z)))
robot.data.transform(T)
posed = {n: (T @ h, T @ t) for n, (h, t) in posed.items()}
P = lambda n: posed[n][0]
PT = lambda n: posed[n][1]

# --- 3. Articulations du mannequin replacées sur celles du robot
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
bpy.ops.object.mode_set(mode='OBJECT')
for a in bpy.data.actions:
    for fc in curves_of(a):
        if fc.data_path.endswith('location') and ('"pelvis"' in fc.data_path or '"root"' in fc.data_path):
            for kp in fc.keyframe_points:
                kp.co.y *= k
                kp.handle_left.y *= k
                kp.handle_right.y *= k

# Poids : les groupes du squelette provisoire portent déjà les noms du mannequin
mod = robot.modifiers.new('rig', 'ARMATURE'); mod.object = rig
robot.parent = rig
for old, new in RENAME.items():
    rig.data.bones[old].name = new
    g = robot.vertex_groups.get(old)
    if g:
        g.name = new
    for a in bpy.data.actions:
        for fc in curves_of(a):
            if f'"{old}"' in fc.data_path:
                fc.data_path = fc.data_path.replace(f'"{old}"', f'"{new}"')

# --- 4. Textures réduites, sans carte de relief
for mat in bpy.data.materials:
    if not mat.use_nodes:
        continue
    for n in list(mat.node_tree.nodes):
        if n.type == 'NORMAL_MAP':
            mat.node_tree.nodes.remove(n)
for img in bpy.data.images:
    if img.size[0] > args.tex:
        img.scale(args.tex, args.tex)
rig.name = 'Robot_rig'
bpy.ops.export_scene.gltf(filepath=args.out, export_format='GLB', export_animation_mode='ACTIONS', export_cameras=False, export_lights=False,
                          export_image_format='JPEG')
print('ROBOT_OK', args.out, 'triangles', sum(len(p.vertices) - 2 for p in robot.data.polygons), 'clips', sorted(a.name for a in bpy.data.actions))

if args.render:
    os.makedirs(args.render, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = 500, 600
    w = bpy.data.worlds.new('w'); w.color = (0.6, 0.65, 0.7); sc.world = w
    bpy.ops.object.light_add(type='SUN', rotation=(0.7, 0.2, 2.6)); bpy.context.active_object.data.energy = 4
    cam = bpy.data.cameras.new('c'); cam.type = 'ORTHO'; cam.ortho_scale = 2.4
    co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co
    rig.animation_data_create()
    for name, act, frame, loc in (('repos_brut', None, 1, (0.6, -4, 1.0)), ('face', 'idle', 10, (0.6, -4, 1.0)), ('trois_quarts', 'idle', 40, (3, -3, 1.0)),
                                  ('course', 'run', 4, (3, -3, 1.0)), ('course2', 'run', 10, (3, -3, 1.0)), ('lancer', 'throw', 6, (3, -3, 1.0)),
                                  ('saut', 'fall', 10, (3, -3, 1.0)), ('mort', 'death', 30, (3, -3, 1.0))):
        rig.animation_data.action = bpy.data.actions.get(act) if act else None
        if act is None:
            for pb in rig.pose.bones:
                pb.matrix_basis = Matrix()
        elif hasattr(rig.animation_data, 'action_slot') and rig.animation_data.action.slots:
            rig.animation_data.action_slot = rig.animation_data.action.slots[0]
        sc.frame_set(frame)
        co.location = loc
        co.rotation_euler = (Vector((0, 0, 0.9)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.join(args.render, f'{name}.png')
        bpy.ops.render.render(write_still=True)
