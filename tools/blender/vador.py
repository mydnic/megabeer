"""
Dark Vador (boss, issue #19) : le modèle OBJ fourni par l'utilisateur (dark-vador-model.zip, `darkvadorblend1.obj`, sans
texture ni squelette, pose en A, une pièce par matière : casque, corps, cape, gants, lumières du plastron et de la
ceinture), monté sur le squelette de la Universal Animation Library (Quaternius, CC0) comme `allies.py` :
1. une couleur par pièce (`COLORS`) ; les lumières du plastron et de la ceinture, et la lame du sabre, dans des matières
   `glow_*` que le jeu dessine lumineuses ;
2. squelette provisoire sur ses articulations (`JOINTS`, relevées sur des vues quadrillées), poids presque rigides ; la
   cape suit le dos d'un bloc, l'intérieur de la cape suit les jambes avec un fondu large ;
3. membres tournés en pose en T, articulations du mannequin replacées sur les siennes, clips du mannequin (`CLIPS`) ;
4. le sabre laser du jeu (`sabre.glb`, lame rouge) dans la main droite, rigide sur l'os de la main.

Usage (Blender 5.2) :
  blender -b --factory-startup -P tools/blender/vador.py -- --src DOSSIER/darkvadorblend1.obj
      --ual "C:/Users/mydnic/Desktop/MODELS/animations/quaternius_universal_animation_library/UAL1_Standard.glb"
      --sabre src/assets/models/sabre.glb --out src/assets/models/vador.glb [--render DOSSIER]
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
ap.add_argument('--sabre', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--render', default='')
args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:])

HEIGHT = 1.9  # taille dans le fichier (le jeu le met à la taille du boss)
# Articulations (m, unités du fichier : face vers -Y, gauche du perso = +X ; le côté droit en miroir)
JOINTS = {'pelvis': (0, -0.05, 0.95), 'chest': (0, -0.05, 1.30), 'neck': (0, -0.05, 1.55), 'top': (0, -0.03, 1.84),
          'shoulder': (0.24, -0.05, 1.42), 'elbow': (0.40, -0.10, 1.20), 'wrist': (0.48, -0.24, 1.08),
          'fingers': (0.51, -0.32, 1.00), 'hip': (0.09, -0.05, 0.90), 'knee': (0.09, -0.07, 0.48),
          'ankle': (0.10, -0.04, 0.09), 'toe': (0.10, -0.16, 0.02)}
# Garde au sabre, marche solennelle, coup de sabre, main tendue (Force), étranglement (main tenue), touché, mort
CLIPS = {'Sword_Idle': 'idle', 'Walk_Formal_Loop': 'walk', 'Sword_Attack': 'strike', 'Spell_Simple_Shoot': 'cast',
         'Spell_Simple_Idle_Loop': 'choke', 'Hit_Chest': 'hit', 'Death01': 'death'}
# Pièce du fichier (début du nom) : matière, couleur
COLORS = [('mat_helmet', 'casque', (0.035, 0.035, 0.04)), ('mat_body', 'corps', (0.05, 0.05, 0.055)),
          ('mat_cape', 'cape', (0.03, 0.03, 0.035)), ('mat_innercape', 'cape_int', (0.06, 0.06, 0.065)),
          ('mat_glove', 'gants', (0.04, 0.04, 0.045)), ('mat_beltEmRed', 'ceinture', (0.55, 0.55, 0.58)),
          ('mat_emissiveChest1', 'glow_rouge', (1.0, 0.1, 0.08)), ('mat_emissiveChest2', 'glow_bleu', (0.2, 0.5, 1.0)),
          ('mat_emissiveChest3', 'glow_rouge', (1.0, 0.1, 0.08)), ('mat_emissiveChestGreen', 'glow_vert', (0.2, 1.0, 0.3)),
          ('mat_beltEmGreen', 'glow_vert', (0.2, 1.0, 0.3))]
SABRE_LENGTH = 1.05  # longueur du sabre, poignée comprise (m, à la taille du fichier)
SABRE_COLOR = (1.0, 0.06, 0.04)
# Direction de la lame en pose en T, dans le repère du squelette (vers le haut : en garde, la lame se lève en diagonale)
SABRE_DIR = Vector((0, 0, 1))

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


def material(name, rgb):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*rgb, 1)
    bsdf.inputs['Roughness'].default_value = 0.35 if name == 'casque' else 0.7
    return m


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

# --- Le modèle : une matière par pièce, réunies
before = set(bpy.context.scene.objects)
bpy.ops.wm.obj_import(filepath=args.src)
parts = [o for o in bpy.context.scene.objects if o not in before and o.type == 'MESH']
for o in parts:
    o.data.transform(o.matrix_world)
    o.matrix_world = Matrix()
    name, rgb = next(((n, c) for p, n, c in COLORS if o.name.startswith(p)), ('corps', COLORS[1][2]))
    o.data.materials.clear()
    o.data.materials.append(material(name, rgb))
bpy.ops.object.select_all(action='DESELECT')
for o in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
body = bpy.context.view_layer.objects.active
body.name = 'vador'
for m in list(bpy.data.materials):
    if m.users == 0:
        bpy.data.materials.remove(m)
bm = bmesh.new(); bm.from_mesh(body.data)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
bm.to_mesh(body.data); bm.free()

# Mise à l'échelle provisoire : pieds à 0, taille voulue ; les articulations suivent
vs = [v.co for v in body.data.vertices]
lo = Vector(map(min, *vs)); hi = Vector(map(max, *vs))
S0 = Matrix.Scale(HEIGHT / (hi.z - lo.z), 4) @ Matrix.Translation(Vector((-(lo.x + hi.x) / 2, 0, -lo.z)))
body.data.transform(S0)
src_joint = joint
joint = lambda n: S0 @ src_joint(n)

# --- 1. Squelette provisoire, poids presque rigides
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

mat_of = [body.data.materials[p.material_index].name for p in body.data.polygons]
vmat = ['corps'] * len(body.data.vertices)
for p in body.data.polygons:
    for i in p.vertices:
        vmat[i] = mat_of[p.index]
segs = {n: (joint(a), joint(b)) for n, (a, b) in TEMP.items()}
blend = 0.03 * HEIGHT / 1.78
groups = {n: body.vertex_groups.new(name=n) for n in TEMP}
for v in body.data.vertices:
    if vmat[v.index] == 'cape':
        # La cape pend des épaules : elle suit le dos d'un bloc (pas les jambes, elle se déchirerait)
        groups['spine_03'].add([v.index], 1.0, 'REPLACE')
        continue
    ds = sorted((seg_dist(v.co, a, b), n) for n, (a, b) in segs.items())
    (d0, n0), (d1, n1) = ds[0], ds[1]
    # L'intérieur de la cape, autour des jambes : il suit les jambes avec un fondu large (sinon il se déchire entre elles)
    bl = blend * (5 if vmat[v.index] == 'cape_int' else 1)
    w1 = max(0.0, 0.5 - (d1 - d0) / (2 * bl)) if d1 - d0 < bl else 0.0
    groups[n0].add([v.index], 1.0 - w1, 'REPLACE')
    if w1 > 0:
        groups[n1].add([v.index], w1, 'REPLACE')
mod = body.modifiers.new('tmp', 'ARMATURE'); mod.object = tmp
body.parent = tmp

# --- 2. Membres tournés dans la direction du mannequin (pose en T), la pose devient la forme du maillage
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

# --- 3. Articulations du mannequin replacées sur celles du modèle
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

# --- 4. Le sabre dans la main droite : poignée dans le poing, lame dans `SABRE_DIR`
before = set(bpy.context.scene.objects)
bpy.ops.import_scene.gltf(filepath=args.sabre)
sab = [o for o in bpy.context.scene.objects if o not in before]
sm = next(o for o in sab if o.type == 'MESH')
sm.data.transform(sm.matrix_world)
for o in sab:
    if o is not sm:
        bpy.data.objects.remove(o)
sm.parent = None
sm.matrix_world = Matrix()
vs = [v.co for v in sm.data.vertices]
lo = Vector(map(min, *vs)); hi = Vector(map(max, *vs))
# Lame vers +Z dans le fichier du sabre, poignée en bas ; la poignée tenue à 8 cm de son bout
grip = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
ks = SABRE_LENGTH / (hi.z - lo.z)
palm = hand[0].lerp(hand[1], 0.55) + Vector((0, 0, -0.025))
R = Vector((0, 0, 1)).rotation_difference(SABRE_DIR).to_matrix().to_4x4()
sm.data.transform(Matrix.Translation(palm) @ R @ Matrix.Scale(ks, 4) @ Matrix.Translation(-grip - Vector((0, 0, 0.08 / ks))))
for slot in sm.material_slots:
    if slot.material and slot.material.name.startswith('lame'):
        slot.material = material('glow_sabre', SABRE_COLOR)
    elif slot.material:
        slot.material = material('poignee', (0.55, 0.55, 0.6))
g = sm.vertex_groups.new(name='hand_r')
g.add(list(range(len(sm.data.vertices))), 1.0, 'REPLACE')
bpy.ops.object.select_all(action='DESELECT')
sm.select_set(True); body.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.join()

mod = body.modifiers.new('rig', 'ARMATURE'); mod.object = rig
body.parent = rig
rig.name = 'vador_rig'
bpy.ops.export_scene.gltf(filepath=args.out, export_format='GLB', export_animation_mode='ACTIONS', export_cameras=False,
                          export_lights=False)
print('VADOR_OK', args.out, 'triangles', sum(len(p.vertices) - 2 for p in body.data.polygons), 'clips',
      sorted(a.name for a in bpy.data.actions), 'matieres', sorted(m.name for m in body.data.materials))

if args.render:
    os.makedirs(args.render, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.color_type = 'MATERIAL'
    sc.display.shading.light = 'STUDIO'
    sc.render.resolution_x, sc.render.resolution_y = 420, 480
    world = bpy.data.worlds.new('w'); sc.world = world
    cam = bpy.data.cameras.new('c'); cam.type = 'ORTHO'; cam.ortho_scale = HEIGHT * 1.5
    co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co
    rig.animation_data_create()
    for name, act, frame, d in (('garde', 'idle', 10, (0, -1, 0)), ('garde34', 'idle', 10, (1, -1, 0)),
                                ('marche', 'walk', 8, (1, 0, 0)), ('marche2', 'walk', 20, (1, -1, 0)),
                                ('coup', 'strike', 10, (1, -1, 0)), ('coup2', 'strike', 20, (0, -1, 0)),
                                ('force', 'choke', 10, (1, -1, 0)), ('dos', 'idle', 10, (0, 1, 0))):
        rig.animation_data.action = bpy.data.actions[act]
        if hasattr(rig.animation_data, 'action_slot') and rig.animation_data.action.slots:
            rig.animation_data.action_slot = rig.animation_data.action.slots[0]
        sc.frame_set(frame)
        dv = Vector(d).normalized()
        co.location = Vector((0, 0, HEIGHT * 0.55)) + dv * HEIGHT * 4
        co.rotation_euler = (-dv).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.join(args.render, f'{name}.png')
        bpy.ops.render.render(write_still=True)
