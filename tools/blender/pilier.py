"""
Le Pilier de bar (perso jouable) : un vieux costaud bedonnant, accoudé au comptoir depuis toujours. Base : le modèle
« free pack cartoon base mesh » (sculpt nu, sans squelette ni texture), habillé et monté ici sur le squelette de la
Universal Animation Library (Quaternius, CC0).

Le script :
1. retouche la silhouette (ventre plus gros, bras et épaules moins musclés : ce n'est pas le Videur) ;
2. découpe le corps net le long de plans (ceinture, ourlets, emmanchures, encolure) et range chaque face dans sa pièce
   (peau, tee-shirt, pantalon, ceinture, charentaises) ; nez rougi, yeux peints ;
3. pose un squelette provisoire sur ses articulations (relevées sur des rendus quadrillés, `JOINTS`), poids
   automatiques, membres tournés dans la direction du mannequin (pose en T), pose appliquée au maillage ;
4. replace les articulations du mannequin sur les siennes, poids automatiques (doigts exclus : la main suit d'un bloc) ;
5. habille : chaque pièce devient une coque un peu au-dessus de la peau, épaissie (ourlets visibles), qui reprend les
   poids du corps ; casquette plate et moustache faites ici ;
6. clips à lui : repos qui tangue (Idle_Loop ralenti), marche lourde qui se dandine (Walk_Loop), lancer de dés
   (Interact), mort en planche (il bascule en arrière d'un bloc, fait main).

Usage (Blender 5.2) :
  blender -b --factory-startup -P tools/blender/pilier.py -- --src "C:/Users/mydnic/Desktop/MODELS/free_pack_cartoon_base_mesh.glb"
      --ual "C:/Users/mydnic/Desktop/MODELS/animations/quaternius_universal_animation_library/UAL1_Standard.glb"
      --out src/assets/models/pilier.glb [--render DOSSIER]
"""
import argparse
import math
import os
import sys

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

ap = argparse.ArgumentParser()
ap.add_argument('--src', required=True)
ap.add_argument('--ual', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--render', default='')
args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:])

HEIGHT = 1.8  # taille, casquette comprise (m)

# Articulations dans le fichier source (unités du fichier ; face vers -Y ; côté gauche du perso = +X, le droit en miroir)
JOINTS = {
    'pelvis': (0, 0.32, 1.15), 'chest': (0, 0.36, 2.15), 'neck': (0, 0.30, 2.62), 'top': (0, 0.33, 3.28),
    'shoulder': (0.66, 0.52, 2.36), 'elbow': (1.32, 0.55, 2.05), 'wrist': (1.76, 0.45, 1.80), 'fingers': (2.08, 0.18, 1.62),
    'hip': (0.22, 0.32, 1.10), 'knee': (0.25, 0.38, 0.50), 'ankle': (0.32, 0.45, 0.16), 'toe': (0.32, 0.12, 0.04),
}
TEMP = {'pelvis': ('pelvis', 'chest'), 'spine_03': ('chest', 'neck'), 'Head': ('neck', 'top')}
for s in ('l', 'r'):
    TEMP.update({f'upperarm_{s}': (f'shoulder.{s}', f'elbow.{s}'), f'lowerarm_{s}': (f'elbow.{s}', f'wrist.{s}'),
                 f'hand_{s}': (f'wrist.{s}', f'fingers.{s}'), f'thigh_{s}': (f'hip.{s}', f'knee.{s}'),
                 f'calf_{s}': (f'knee.{s}', f'ankle.{s}'), f'foot_{s}': (f'ankle.{s}', f'toe.{s}')})
TEMP_PARENT = {'spine_03': 'pelvis', 'Head': 'spine_03'}
for s in ('l', 'r'):
    TEMP_PARENT.update({f'upperarm_{s}': 'spine_03', f'lowerarm_{s}': f'upperarm_{s}', f'hand_{s}': f'lowerarm_{s}',
                        f'thigh_{s}': 'pelvis', f'calf_{s}': f'thigh_{s}', f'foot_{s}': f'calf_{s}'})
ALIGN = [f'{b}_{s}' for s in ('l', 'r') for b in ('upperarm', 'lowerarm', 'hand', 'thigh', 'calf')]

# Silhouette : ventre (poussée vers l'avant, m du fichier, centre et étendue en hauteur), bras (rayon gardé)
BELLY = {'push': 0.17, 'z': 1.62, 'spread': 0.32, 'widen': 0.06}
ARMS = {'keep': 0.74}

# Pièces (index de matériau) et leurs couleurs
SKIN, TANK, PANTS, BELT, SHOE, NOSE, EYE_W, EYE_I, BROW, CAP, MOUSTACHE = range(11)
COLORS = {SKIN: (0.86, 0.60, 0.47), TANK: (0.93, 0.91, 0.84), PANTS: (0.42, 0.33, 0.24), BELT: (0.16, 0.10, 0.06),
          SHOE: (0.48, 0.16, 0.14), NOSE: (0.88, 0.38, 0.36), EYE_W: (0.95, 0.95, 0.93), EYE_I: (0.12, 0.08, 0.05),
          BROW: (0.62, 0.60, 0.58), CAP: (0.30, 0.27, 0.22), MOUSTACHE: (0.70, 0.68, 0.66)}
# Coques des vêtements : décalage au-dessus de la peau et épaisseur (m du fichier)
SHELL = {TANK: 0.028, PANTS: 0.035, BELT: 0.055, SHOE: 0.04}
# Plans de coupe (point, normale) ; découpe : ceinture entre deux plans horizontaux
WAIST = (1.43, 1.53)
CUFF = 0.25
NECK = ((0, 0.3, 2.50), (0, -0.4, 1))
# Manches du tee-shirt : coupées net en travers du bras, à cette part de l'épaule au coude (un marcel laissait l'épaule
# nue, et la peau de l'épaule, qui se déforme le plus, passait par-dessus les bretelles dès qu'il levait le bras)
SLEEVE = 0.45

CLIPS = {'Idle_Loop': 'idle_src', 'Walk_Loop': 'run', 'Jump_Start': 'jump', 'Jump_Loop': 'fall', 'Jump_Land': 'land', 'Interact': 'throw'}
RENAME = {'thigh_l': 'thigh.L', 'calf_l': 'shin.L', 'foot_l': 'foot.L', 'hand_l': 'hand.L',
          'thigh_r': 'thigh.R', 'calf_r': 'shin.R', 'foot_r': 'foot.R', 'hand_r': 'hand.R'}
NO_DEFORM = ('root', 'ball_leaf', 'thumb', 'index', 'middle', 'ring', 'pinky')


def joint(name):
    base, _, side = name.partition('.')
    x, y, z = JOINTS[base]
    return Vector((-x if side == 'r' else x, y, z))


def curves_of(action):
    try:
        return action.fcurves
    except AttributeError:
        return action.layers[0].strips[0].channelbags[0].fcurves


def seg_closest(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
    return a + ab * t, t


def smooth01(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def material(name, rgb, rough=0.8):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*rgb, 1)
    bsdf.inputs['Roughness'].default_value = rough
    m.diffuse_color = (*rgb, 1)
    return m


def select_only(objs, active):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active


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

# --- Le modèle : corps, yeux, sourcils, transformations appliquées
before = set(bpy.context.scene.objects)
bpy.ops.import_scene.gltf(filepath=args.src)
new = [o for o in bpy.context.scene.objects if o not in before]
parts = {}
for o in new:
    if o.type == 'MESH':
        mw = o.matrix_world.copy()
        o.parent = None
        o.data.transform(mw)
        o.matrix_world = Matrix()
        parts[o.name.split('_')[0]] = o
for o in new:
    if o.type != 'MESH':
        bpy.data.objects.remove(o)
body, eyes, brows = parts['Body'], parts['Eye'], parts['Fur']
mats = [material(f'pilier_{i}', COLORS[i], 0.45 if i in (EYE_W, EYE_I) else 0.8) for i in range(len(COLORS))]
for o in (body, eyes, brows):
    o.data.materials.clear()
    for m in mats:
        o.data.materials.append(m)

# --- 1. Silhouette : ventre plus gros, bras moins musclés
arm_segs = {s: [(joint(f'shoulder.{s}'), joint(f'elbow.{s}')), (joint(f'elbow.{s}'), joint(f'wrist.{s}'))] for s in ('l', 'r')}
for v in body.data.vertices:
    p = v.co
    # Ventre : l'avant du tronc, en cloche autour de la hauteur du nombril
    f = math.exp(-((p.z - BELLY['z']) / BELLY['spread']) ** 2)
    front = smooth01((0.38 - p.y) / 0.45)
    if abs(p.x) < 0.7:
        p.y -= BELLY['push'] * f * front
        p.x *= 1 + BELLY['widen'] * f
    # Bras : rapprochés de leur axe (moins à l'épaule, qui se fond dans le tronc)
    s = 'l' if p.x > 0 else 'r'
    if abs(p.x) > 0.45 and p.z > 1.55:
        best = None
        for i, (a, b) in enumerate(arm_segs[s]):
            q, t = seg_closest(p, a, b)
            d = (p - q).length
            if best is None or d < best[0]:
                best = (d, q, i, t)
        d, q, i, t = best
        reach = i + t  # 0 à l'épaule, 2 au poignet
        keep = ARMS['keep'] + (1 - ARMS['keep']) * (1 - smooth01(reach / 0.6)) * 0.6
        # Pas les mains (le poignet est la fin du second segment)
        if not (i == 1 and t >= 0.999):
            v.co = q + (p - q) * keep

# --- 2. Découpe nette, puis chaque face dans sa pièce
bm = bmesh.new()
bm.from_mesh(body.data)


def cut(co, no):
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=Vector(co), plane_no=Vector(no).normalized(), dist=1e-5)


cut((0, 0, WAIST[0]), (0, 0, 1)); cut((0, 0, WAIST[1]), (0, 0, 1)); cut((0, 0, CUFF), (0, 0, 1))
cut(*NECK)
sleeves = {}
for s_ in ('l', 'r'):
    a_, b_ = joint(f'shoulder.{s_}'), joint(f'elbow.{s_}')
    sleeves[s_] = (a_.lerp(b_, SLEEVE), (b_ - a_).normalized())
    cut(*sleeves[s_])


def side_of(p, co, no):
    return (p - Vector(co)).dot(Vector(no).normalized())


nose_tip = max((v.co for v in bm.verts if v.co.z > 2.8 and abs(v.co.x) < 0.05), key=lambda c: -c.y)
for f in bm.faces:
    c = f.calc_center_median()
    # Bras nu : au-delà de la manche (seulement côté bras : le plan de coupe traverse aussi le bas du corps)
    arm = abs(c.x) > 0.4 and c.z > 1.6 and side_of(c, *sleeves['l' if c.x > 0 else 'r']) > 0
    if abs(c.x) > 0.75 and c.z < 1.75:
        f.material_index = SKIN  # mains (les doigts descendent jusqu'à la ceinture)
    elif c.z < CUFF:
        f.material_index = SHOE
    elif c.z < WAIST[0]:
        f.material_index = PANTS
    elif c.z < WAIST[1]:
        f.material_index = BELT
    elif side_of(c, *NECK) < 0 and not arm:
        f.material_index = TANK
    else:
        f.material_index = SKIN
bm.to_mesh(body.data)
bm.free()
for poly in body.data.polygons:
    poly.use_smooth = True

# Yeux : pupille et iris tournés vers l'avant, le reste blanc ; sourcils gris
for o, default in ((eyes, EYE_W), (brows, BROW)):
    for poly in o.data.polygons:
        poly.material_index = default
        poly.use_smooth = True
for side in (1, -1):
    polys = [p for p in eyes.data.polygons if p.center.x * side > 0]
    vs = [eyes.data.vertices[i].co for p in polys for i in p.vertices]
    centre = sum(vs, Vector()) / len(vs)
    for p in polys:
        d = (p.center - centre).normalized()
        if d.dot(Vector((0, -1, 0.05)).normalized()) > 0.86:
            p.material_index = EYE_I

# Casquette plate (une calotte aplatie penchée en avant, une visière) et moustache en brosse
def blob(name, loc, scale, mat_index, rot=(0, 0, 0), half=False):
    bm2 = bmesh.new()
    bmesh.ops.create_uvsphere(bm2, u_segments=24, v_segments=14, radius=1)
    if half:
        bmesh.ops.delete(bm2, geom=[v for v in bm2.verts if v.co.z < -0.15], context='VERTS')
    for v in bm2.verts:
        v.co = Vector((v.co.x * scale[0], v.co.y * scale[1], v.co.z * scale[2]))
    R = Euler([math.radians(a) for a in rot], 'XYZ').to_matrix().to_4x4()
    bmesh.ops.transform(bm2, matrix=Matrix.Translation(loc) @ R, verts=bm2.verts)
    me = bpy.data.meshes.new(name)
    bm2.to_mesh(me); bm2.free()
    for m in mats:
        me.materials.append(m)
    for p in me.polygons:
        p.material_index = mat_index
        p.use_smooth = True
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    return o


top = max((v.co for v in body.data.vertices), key=lambda c: c.z)
extras = [
    blob('calotte', top + Vector((0, -0.06, -0.12)), (0.25, 0.30, 0.16), CAP, rot=(9, 0, 0), half=True),
    blob('visiere', Vector((0, nose_tip.y - 0.05, top.z - 0.15)), (0.19, 0.11, 0.022), CAP, rot=(14, 0, 0)),
    blob('nez', nose_tip + Vector((0, 0.035, -0.01)), (0.06, 0.055, 0.055), NOSE),
    blob('moustache_l', nose_tip + Vector((0.075, 0.06, -0.095)), (0.1, 0.05, 0.045), MOUSTACHE, rot=(0, 18, -12)),
    blob('moustache_r', nose_tip + Vector((-0.075, 0.06, -0.095)), (0.1, 0.05, 0.045), MOUSTACHE, rot=(0, -18, 12)),
]

# --- 3. Squelette provisoire, poids automatiques, pose en T appliquée
tmp_data = bpy.data.armatures.new('tmp')
tmp = bpy.data.objects.new('tmp', tmp_data)
bpy.context.scene.collection.objects.link(tmp)
bpy.context.view_layer.objects.active = tmp
bpy.ops.object.mode_set(mode='EDIT')
for name, (a, b) in TEMP.items():
    eb = tmp_data.edit_bones.new(name)
    eb.head, eb.tail = joint(a), joint(b)
for name, parent in TEMP_PARENT.items():
    tmp_data.edit_bones[name].parent = tmp_data.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
select_only([body, tmp], tmp)
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
# Yeux, sourcils et accessoires de tête : rigides sur la tête
for o in [eyes, brows] + extras:
    o.vertex_groups.new(name='Head').add(list(range(len(o.data.vertices))), 1.0, 'REPLACE')
    m = o.modifiers.new('tmp', 'ARMATURE'); m.object = tmp
    o.parent = tmp
head_parts = [eyes, brows] + extras

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
# Les pieds reprennent leur orientation d'avant (à plat, vers l'avant)
posed = {pb.name: (tmp.matrix_world @ pb.head, tmp.matrix_world @ pb.tail) for pb in tmp.pose.bones}
bpy.ops.object.mode_set(mode='OBJECT')
for o in [body] + head_parts:
    bpy.context.view_layer.objects.active = o
    for mod in list(o.modifiers):
        if mod.type == 'ARMATURE':
            bpy.ops.object.modifier_apply(modifier=mod.name)
    o.parent = None
    o.matrix_world = Matrix()
    for g in list(o.vertex_groups):
        o.vertex_groups.remove(g)
bpy.data.objects.remove(tmp)

# Mise à la taille, pieds au sol, centré
allv = [v.co for o in [body] + head_parts for v in o.data.vertices]
lo = Vector(map(min, *allv)); hi = Vector(map(max, *allv))
k_size = HEIGHT / (hi.z - lo.z)
T = Matrix.Scale(k_size, 4) @ Matrix.Translation(Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z)))
for o in [body] + head_parts:
    o.data.transform(T)
posed = {n: (T @ h, T @ t) for n, (h, t) in posed.items()}
P = lambda n: posed[n][0]
PT = lambda n: posed[n][1]

# --- 4. Articulations du mannequin replacées sur les siennes
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
place('pelvis', P('pelvis'), P('pelvis').lerp(chest, 0.3))
place('spine_01', P('pelvis').lerp(chest, 0.3), P('pelvis').lerp(chest, 0.62))
place('spine_02', P('pelvis').lerp(chest, 0.62), chest)
place('spine_03', chest, neck)
place('neck_01', neck, neck.lerp(PT('Head'), 0.18))
place('Head', neck.lerp(PT('Head'), 0.18), PT('Head'))
for s in ('l', 'r'):
    place(f'clavicle_{s}', chest.lerp(neck, 0.5) + Vector((0, -0.03, 0)), P(f'upperarm_{s}'))
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

# Poids automatiques sur le mannequin, sans les doigts (la main suit d'un bloc) ni les os de service
for b in rig.data.bones:
    b.use_deform = not any(b.name.startswith(n) for n in NO_DEFORM)
select_only([body, rig], rig)
bpy.ops.object.parent_set(type='ARMATURE_AUTO')

# --- 5. Vêtements : coques au-dessus de la peau, épaissies, avec les poids du corps ; peau cachée dessous retirée
shells = []
for idx, off in SHELL.items():
    o = body.copy()
    o.data = body.data.copy()
    o.name = f'coque_{idx}'
    bpy.context.scene.collection.objects.link(o)
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index != idx], context='FACES')
    for v in bm.verts:
        v.co += v.normal * off * k_size
    bm.to_mesh(o.data); bm.free()
    sol = o.modifiers.new('epaisseur', 'SOLIDIFY')
    sol.thickness = off * k_size
    sol.offset = -1
    sol.use_rim = True
    o.modifiers.move(o.modifiers.find('epaisseur'), 0)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier='epaisseur')
    shells.append(o)
bm = bmesh.new(); bm.from_mesh(body.data)
bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index in SHELL], context='FACES')
bm.to_mesh(body.data); bm.free()

# Tête : yeux, sourcils et accessoires rigides sur l'os de la tête
for o in head_parts:
    o.vertex_groups.new(name='Head').add(list(range(len(o.data.vertices))), 1.0, 'REPLACE')
select_only([body] + shells + head_parts, body)
bpy.ops.object.join()
body = bpy.context.view_layer.objects.active
body.name = 'Pilier'
if not any(m.type == 'ARMATURE' for m in body.modifiers):
    mod = body.modifiers.new('rig', 'ARMATURE'); mod.object = rig
body.parent = rig
body.matrix_parent_inverse = rig.matrix_world.inverted()
# Matériaux inutilisés retirés
used = {p.material_index for p in body.data.polygons}
for i in reversed(range(len(body.data.materials))):
    if i not in used:
        for p in body.data.polygons:
            if p.material_index > i:
                p.material_index -= 1
        body.data.materials.pop(index=i)


# --- 6. Clips à lui
def frames_of(action):
    rig.animation_data_create()
    rig.animation_data.action = action
    if hasattr(rig.animation_data, 'action_slot') and action.slots:
        rig.animation_data.action_slot = action.slots[0]
    s, e = (int(round(x)) for x in action.frame_range)
    out = []
    for f in range(s, e + 1):
        bpy.context.scene.frame_set(f)
        out.append({pb.name: pb.matrix.copy() for pb in rig.pose.bones})
    rig.animation_data.action = None
    return out


def turned(fr, bone, rot, pivot=None):
    """Tourne `bone` et ses enfants (matrices dans l'armature) autour de la tête de l'os (ou de `pivot`)."""
    head = pivot if pivot is not None else fr[bone].translation.copy()
    R = Matrix.Translation(head) @ rot.to_matrix().to_4x4() @ Matrix.Translation(-head)
    for n in [bone] + [c.name for c in rig.data.bones[bone].children_recursive]:
        fr[n] = R @ fr[n]


def E(x, y, z):
    return Euler((math.radians(x), math.radians(y), math.radians(z)), 'XYZ').to_quaternion()


def bake(name, frames):
    act = bpy.data.actions.new(name)
    rig.animation_data_create()
    rig.animation_data.action = act
    if hasattr(rig.animation_data, 'action_slot') and act.slots:
        rig.animation_data.action_slot = act.slots[0]
    for i, fr in enumerate(frames):
        for pb in rig.pose.bones:
            pb.rotation_mode = 'QUATERNION'
            pb.matrix = fr[pb.name]
            bpy.context.view_layer.update()
        for pb in rig.pose.bones:
            pb.keyframe_insert('rotation_quaternion', frame=i)
            pb.keyframe_insert('location', frame=i)
    rig.animation_data.action = None
    for pb in rig.pose.bones:
        pb.matrix_basis = Matrix()
    return act


src_idle = frames_of(bpy.data.actions['idle_src'])
# Repos : le clip ralenti, le buste qui tangue doucement en rond, la tête qui dodeline
n_idle = int(len(src_idle) * 1.5)
idle = []
for i in range(n_idle):
    a = i / n_idle * math.tau
    fr = {k_: m.copy() for k_, m in src_idle[int(i / 1.5) % len(src_idle)].items()}
    turned(fr, 'spine_01', E(3 + 2 * math.sin(a), 3 * math.cos(a), 0))
    turned(fr, 'neck_01', E(4 * math.sin(2 * a), 0, 5 * math.sin(a + 1)))
    idle.append(fr)
bake('idle', idle)

# Marche lourde : le haut du corps se dandine d'un pied sur l'autre
walk = frames_of(bpy.data.actions['run'])
for i, fr in enumerate(walk):
    a = i / max(1, len(walk) - 1) * math.tau
    turned(fr, 'spine_01', E(4, 6 * math.sin(a), 4 * math.sin(a)))
bpy.data.actions.remove(bpy.data.actions['run'])
bake('run', walk)

# Mort en planche : raide, il bascule en arrière autour des talons, rebondit un peu et reste à terre
base = src_idle[0]
heel = Vector((0, base['foot_l'].translation.y + 0.05, 0))
BACK = 0.24  # le dos dépasse des talons vers l'arrière (m) : couché, il ne doit pas passer sous le sol
death = []
for i in range(60):
    t = min(1.0, i / 22)
    ang = -90 * t * t
    if i > 22:
        ang = -90 + 6 * math.sin((i - 22) / 8 * math.pi) * math.exp(-(i - 22) / 8)
    fr = {k_: m.copy() for k_, m in base.items()}
    for s, sg in (('l', 1), ('r', -1)):
        turned(fr, f'upperarm_{s}', E(-70 * min(1.0, i / 14), 0, 0))
    turned(fr, 'root', E(ang, 0, 0), pivot=heel)
    lift = BACK * min(1.0, -ang / 90)
    for n_ in fr:
        fr[n_] = Matrix.Translation((0, 0, lift)) @ fr[n_]
    death.append(fr)
bake('death', death)
bpy.data.actions.remove(bpy.data.actions['idle_src'])

# --- Os renommés comme le jeu les attend
for old, new_name in RENAME.items():
    rig.data.bones[old].name = new_name
    g = body.vertex_groups.get(old)
    if g:
        g.name = new_name
    for a in bpy.data.actions:
        for fc in curves_of(a):
            if f'"{old}"' in fc.data_path:
                fc.data_path = fc.data_path.replace(f'"{old}"', f'"{new_name}"')

rig.name = 'Pilier_rig'
bpy.ops.export_scene.gltf(filepath=args.out, export_format='GLB', export_animation_mode='ACTIONS', export_cameras=False, export_lights=False)
print('PILIER_OK', args.out, 'triangles', sum(len(p.vertices) - 2 for p in body.data.polygons), 'clips', sorted(a.name for a in bpy.data.actions))

if args.render:
    os.makedirs(args.render, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = 500, 600
    w = bpy.data.worlds.new('w'); w.color = (0.9, 0.92, 0.95); sc.world = w
    bpy.ops.object.light_add(type='SUN', rotation=(0.7, 0.2, 2.6)); bpy.context.active_object.data.energy = 6
    cam = bpy.data.cameras.new('c'); cam.type = 'ORTHO'; cam.ortho_scale = 2.4
    co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co
    for name, act_name, frame, loc, scale in (('repos_brut', None, 0, (0.6, -4, 0.95), 2.4), ('face', 'idle', 10, (0.6, -4, 0.95), 2.4),
                                              ('tete', 'idle', 10, (1.2, -3.6, 2.6), 0.8), ('trois_quarts', 'idle', 40, (3, -3, 0.95), 2.4),
                                              ('dos', 'idle', 40, (-2, 4, 0.95), 2.4), ('marche1', 'run', 4, (3, -3, 0.95), 2.4),
                                              ('marche2', 'run', 14, (3, -3, 0.95), 2.4), ('lancer', 'throw', 20, (3, -3, 0.95), 2.4),
                                              ('saut', 'fall', 10, (3, -3, 0.95), 2.4), ('mort', 'death', 40, (4, 0.8, 0.4), 2.8),
                                              ('epaules', 'idle', 10, (1.4, 2.6, 3.0), 1.1), ('epaules_face', 'idle', 30, (-1.2, -2.8, 2.8), 1.1),
                                              ('epaules_marche', 'run', 8, (-1.4, 2.6, 3.0), 1.1), ('epaules_lancer', 'throw', 20, (1.6, -2.4, 2.9), 1.1)):
        rig.animation_data.action = bpy.data.actions.get(act_name) if act_name else None
        if act_name and hasattr(rig.animation_data, 'action_slot') and rig.animation_data.action.slots:
            rig.animation_data.action_slot = rig.animation_data.action.slots[0]
        if not act_name:
            for pb in rig.pose.bones:
                pb.matrix_basis = Matrix()
        sc.frame_set(frame)
        cam.ortho_scale = scale
        co.location = loc
        target = Vector((0, 0.8 if name == 'mort' else 0, 1.6 if name == 'tete' else 1.35 if name.startswith('epaules') else loc[2]))
        co.rotation_euler = (target - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.join(args.render, f'{name}.png')
        bpy.ops.render.render(write_still=True)
