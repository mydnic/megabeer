"""
Le Xénomorphe (boss optionnel d'un cimetière, issue #19) : le modèle « Xenomorph » de poly.pizza (sans squelette, figé
dans une pose de reptation asymétrique, 61 pièces) monté sur un squelette de quadrupède fait ici, avec des clips à lui.

Le script :
1. joint les pièces, pose le squelette sur les articulations relevées en coupant les pièces en tranches (`J`), donne les
   poids : chaque pièce rejoint le membre dont elle est le plus proche, puis chaque sommet suit l'os le plus proche de ce
   membre (fondu court aux articulations) ;
2. remet les membres en posture symétrique (les pattes droites copient les gauches, posées au sol par IK à deux os),
   applique cette pose au maillage : c'est la pose de repos ;
3. fait les clips à la main, pattes posées au sol par la même IK (idle, run, crouch, leap, tail, roar, hit, death) ;
4. met à la taille, face vers -Y, pattes au sol, et exporte.

Usage (Blender 5.2) :
  blender -b --factory-startup -P tools/blender/xeno.py -- --src "C:/Users/mydnic/Desktop/MODELS/personnages/polypizza/slaan_xenomorph.glb"
      --out src/assets/models/xeno.glb [--render DOSSIER]
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
ap.add_argument('--render', default='')
args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:])

HEIGHT = 3.2  # hauteur du modèle au repos, queue comprise (m)
FLOOR = -1.1  # sol du fichier source
BODY = (0.07, 0.075, 0.09)  # carapace : noir bleuté (un noir pur se perd en cel-shading)
TEETH = (0.8, 0.8, 0.72)

# --- Articulations du fichier source (Z en haut, la tête vers +Y ; relevées en coupant les pièces en tranches)
J = {
    'hips': (0, -1.35, 0.22), 'chest': (0, -0.55, 0.5), 'neck': (0, 0.35, 0.3), 'skull': (-0.05, 0.8, 0.55), 'mouth': (-0.2, 2.05, 0.25),
    'shoulder.L': (-0.4, 0.55, -0.02), 'elbow.L': (-1.0, 1.05, -0.5), 'wrist.L': (-1.45, 2.15, -0.88), 'claw.L': (-1.65, 2.45, -1.0),
    'shoulder.R': (0.25, 0.5, 0.15), 'elbow.R': (0.95, 0.02, 0.66), 'wrist.R': (1.33, 0.06, -0.05), 'claw.R': (1.55, 0.2, -0.3),
    'hip.L': (-0.22, -1.2, 0.0), 'knee.L': (-0.4, -0.12, -0.78), 'ankle.L': (-0.18, -1.0, -0.5), 'ball.L': (-0.16, -1.08, -0.92), 'toe.L': (-0.15, -1.2, -1.1),
    'hip.R': (0.4, -1.2, 0.25), 'knee.R': (0.75, -2.34, -0.24), 'ankle.R': (1.12, -3.38, 0.05), 'ball.R': (1.2, -3.7, 0.04), 'toe.R': (1.28, -3.98, 0.06),
}
TAIL = [(0, -1.45, 0.12), (0.3, -2.25, -0.08), (0.68, -2.86, 0.3), (0.62, -2.9, 0.9), (0.25, -2.88, 1.45), (-0.3, -2.9, 1.75),
        (-0.9, -3.05, 1.81), (-1.35, -3.35, 1.25), (-1.05, -3.6, 0.0)]
J = {k: Vector(v) for k, v in J.items()}
TAIL = [Vector(v) for v in TAIL]

# Os : nom -> (tête, queue, parent)
BONES = {'hips': ('hips', 'chest', None), 'spine': ('chest', 'neck', 'hips'), 'neck': ('neck', 'skull', 'spine'), 'head': ('skull', 'mouth', 'neck')}
for s in ('L', 'R'):
    BONES.update({f'upperarm.{s}': (f'shoulder.{s}', f'elbow.{s}', 'spine'), f'forearm.{s}': (f'elbow.{s}', f'wrist.{s}', f'upperarm.{s}'),
                  f'hand.{s}': (f'wrist.{s}', f'claw.{s}', f'forearm.{s}'), f'thigh.{s}': (f'hip.{s}', f'knee.{s}', 'hips'),
                  f'shin.{s}': (f'knee.{s}', f'ankle.{s}', f'thigh.{s}'), f'foot.{s}': (f'ankle.{s}', f'ball.{s}', f'shin.{s}'),
                  f'toe.{s}': (f'ball.{s}', f'toe.{s}', f'foot.{s}')})
TAILS = [f'tail{i}' for i in range(len(TAIL) - 1)]
SEG = {n: (J[a], J[b]) for n, (a, b, _) in BONES.items()}
for i, n in enumerate(TAILS):
    SEG[n] = (TAIL[i], TAIL[i + 1])
PARENT = {n: p for n, (_, _, p) in BONES.items()}
for i, n in enumerate(TAILS):
    PARENT[n] = 'hips' if i == 0 else TAILS[i - 1]
# Membres : une pièce entière rejoint un seul membre
LIMBS = {'body': ['hips', 'spine', 'neck'], 'head': ['head'], 'tail': TAILS}
for s in ('L', 'R'):
    LIMBS[f'arm.{s}'] = [f'upperarm.{s}', f'forearm.{s}', f'hand.{s}']
    LIMBS[f'leg.{s}'] = [f'thigh.{s}', f'shin.{s}', f'foot.{s}', f'toe.{s}']


def seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
    return (a + ab * t - p).length


def curves_of(action):
    try:
        return action.fcurves
    except AttributeError:
        return action.layers[0].strips[0].channelbags[0].fcurves


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=args.src)
parts = [o for o in bpy.context.scene.objects if o.type == 'MESH']
for o in parts:
    mw = o.matrix_world.copy()
    o.parent = None
    o.data.transform(mw)
    o.matrix_world = Matrix()
for o in [o for o in bpy.context.scene.objects if o.type != 'MESH']:
    bpy.data.objects.remove(o)

# --- 1. Poids : la pièce rejoint le membre le plus proche (à la majorité de ses sommets), le sommet l'os le plus proche
limb_of_bone = {b: l for l, bs in LIMBS.items() for b in bs}
assign = {}
for o in parts:
    votes = {}
    for v in o.data.vertices:
        b = min(SEG, key=lambda n: seg_dist(v.co, *SEG[n]))
        votes[limb_of_bone[b]] = votes.get(limb_of_bone[b], 0) + 1
    limb = max(votes, key=votes.get)
    # Les dents vont avec la tête
    if o.data.materials and o.data.materials[0].name == 'mat21' and limb != 'body':
        limb = 'head'
    assign[o.name] = limb
    groups = {n: o.vertex_groups.get(n) or o.vertex_groups.new(name=n) for n in LIMBS[limb]}
    for v in o.data.vertices:
        ds = sorted((seg_dist(v.co, *SEG[n]), n) for n in LIMBS[limb])
        (d0, n0) = ds[0]
        w1 = 0.0
        if len(ds) > 1 and ds[1][0] - d0 < 0.08:
            n1 = ds[1][1]
            w1 = 0.5 - (ds[1][0] - d0) / 0.16
        groups[n0].add([v.index], 1.0 - w1, 'REPLACE')
        if w1 > 0:
            groups[n1].add([v.index], w1, 'REPLACE')
print('ASSIGN', {l: sum(1 for v in assign.values() if v == l) for l in LIMBS})

# Matières : carapace et dents
body_mat = bpy.data.materials.new('xeno_corps')
teeth_mat = bpy.data.materials.new('xeno_dents')
for m, c in ((body_mat, BODY), (teeth_mat, TEETH)):
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*c, 1)
    b.inputs['Roughness'].default_value = 0.35
    m.diffuse_color = (*c, 1)
for o in parts:
    white = o.data.materials and o.data.materials[0].name == 'mat21'
    o.data.materials.clear()
    o.data.materials.append(teeth_mat if white else body_mat)
bpy.ops.object.select_all(action='DESELECT')
for o in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
mesh = bpy.context.view_layer.objects.active
mesh.name = 'Xeno'

# Le squelette
arm_data = bpy.data.armatures.new('Xeno_rig')
rig = bpy.data.objects.new('Xeno_rig', arm_data)
bpy.context.scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
for n, (a, b) in SEG.items():
    eb = arm_data.edit_bones.new(n)
    eb.head, eb.tail = a, b
for n, p in PARENT.items():
    if p:
        arm_data.edit_bones[n].parent = arm_data.edit_bones[p]
bpy.ops.object.mode_set(mode='OBJECT')
mod = mesh.modifiers.new('rig', 'ARMATURE')
mod.object = rig
mesh.parent = rig
for pb in rig.pose.bones:
    pb.rotation_mode = 'QUATERNION'

LEN = {n: (b - a).length for n, (a, b) in SEG.items()}


def P(name):
    return rig.pose.bones[name]


def upd():
    bpy.context.view_layer.update()


def aim(name, target_dir):
    """Tourne l'os `name` autour de sa tête pour qu'il pointe dans `target_dir` (repère du squelette)."""
    pb = P(name)
    cur = (pb.tail - pb.head).normalized()
    q = cur.rotation_difference(Vector(target_dir).normalized())
    h = pb.head.copy()
    pb.matrix = Matrix.Translation(h) @ q.to_matrix().to_4x4() @ Matrix.Translation(-h) @ pb.matrix
    upd()


def rot(name, axis, deg, pivot=None):
    """Tourne l'os `name` de `deg` degrés autour d'un axe du squelette (autour de sa tête ; ses enfants suivent)."""
    pb = P(name)
    h = pb.head.copy() if pivot is None else Vector(pivot)
    pb.matrix = Matrix.Translation(h) @ Matrix.Rotation(math.radians(deg), 4, Vector(axis)) @ Matrix.Translation(-h) @ pb.matrix
    upd()


def move(name, d):
    pb = P(name)
    pb.matrix = Matrix.Translation(Vector(d)) @ pb.matrix
    upd()


def ik2(root, target, l1, l2, pole):
    """Le coude (ou genou) d'une chaîne à deux os de `root` vers `target`, plié du côté de `pole`."""
    d = target - root
    L = min(max(d.length, 1e-4), (l1 + l2) * 0.999)
    u = d.normalized()
    a = (l1 * l1 - l2 * l2 + L * L) / (2 * L)
    h = math.sqrt(max(l1 * l1 - a * a, 0.0))
    p = Vector(pole) - u * Vector(pole).dot(u)
    p = p.normalized() if p.length > 1e-6 else Vector((0, 0, 1))
    return root + u * a + p * h


def limb(upper, lower, target, pole, ends=()):
    """Pose une chaîne : `upper` et `lower` posent le bout de `lower` sur `target` (IK), puis les os de `ends` pointent dans
    leurs directions (pied, orteils, main)."""
    root = P(upper).head.copy()
    knee = ik2(root, Vector(target), LEN[upper], LEN[lower], pole)
    aim(upper, knee - root)
    aim(lower, Vector(target) - P(lower).head)
    for n, d in ends:
        aim(n, d)


X, Y, Z = (1, 0, 0), (0, 1, 0), (0, 0, 1)
M = lambda v, s: Vector((v[0] if s == 'L' else -v[0], v[1], v[2]))  # côté gauche -> côté demandé

# --- 2. Posture symétrique : les pattes droites copient les gauches (en miroir), posées au sol
# Cibles (côté gauche ; le droit en miroir) : poignet, coude vers l'extérieur ; cheville, genou vers l'avant
WRIST = Vector((-0.95, 1.75, FLOOR + 0.3))
ANKLE = Vector((-0.42, -1.0, -0.45))
HAND_DIR = Vector((-0.3, 1.0, -0.55))
# La main droite du modèle est tenue autrement : moins penchée, sinon ses griffes passent sous le sol
HAND_DIR_R = Vector((0.3, 1.0, -0.1))
FOOT_DIR = Vector((0.0, -0.15, -1.0))
TOE_DIR = Vector((0.0, -0.75, -0.65))
TAIL_REST = [(0.15, -1, -0.25), (0.1, -1, -0.05), (0.05, -1, 0.25), (0, -0.8, 0.6), (0, -0.4, 0.9), (0, 0.2, 1), (0, 0.6, 0.7), (0, 0.3, -1)]


def stance(s, wrist=None, ankle=None):
    """Pose les pattes du côté `s` : poignet et cheville sur leurs cibles (par défaut celles du repos)."""
    w = wrist if wrist is not None else M(WRIST, s)
    a = ankle if ankle is not None else M(ANKLE, s)
    limb(f'upperarm.{s}', f'forearm.{s}', w, M((-1, -0.4, 0.6), s), ((f'hand.{s}', M(HAND_DIR, s) if s == 'L' else HAND_DIR_R),))
    limb(f'thigh.{s}', f'shin.{s}', a, M((-0.25, 1, 0.1), s), ((f'foot.{s}', M(FOOT_DIR, s)), (f'toe.{s}', M(TOE_DIR, s))))


bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='POSE')
aim('head', (-0.05, 1, -0.2))
for s in ('L', 'R'):
    stance(s)
for n, d in zip(TAILS, TAIL_REST):
    aim(n, d)
bpy.ops.object.mode_set(mode='OBJECT')
# La pose devient la forme du maillage et la pose de repos du squelette
bpy.context.view_layer.objects.active = mesh
bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='POSE')
bpy.ops.pose.armature_apply(selected=False)
bpy.ops.object.mode_set(mode='OBJECT')
mod = mesh.modifiers.new('rig', 'ARMATURE')
mod.object = rig
for pb in rig.pose.bones:
    pb.rotation_mode = 'QUATERNION'
REST = {pb.name: (pb.head.copy(), pb.tail.copy()) for pb in rig.pose.bones}
W0 = {s: REST[f'forearm.{s}'][1] for s in ('L', 'R')}  # poignets au repos
A0 = {s: REST[f'shin.{s}'][1] for s in ('L', 'R')}  # chevilles au repos
lo_v = min((mesh.matrix_world @ v.co for v in mesh.data.vertices), key=lambda w: w.z)
lo_z = lo_v.z
print('LOWEST', tuple(round(c, 2) for c in lo_v), 'shinR', [tuple(round(c,2) for c in x) for x in REST['shin.R']], 'thighR', [tuple(round(c,2) for c in x) for x in REST['thigh.R']])
print('REST floor', round(lo_z, 3), 'wrists', [tuple(round(c, 2) for c in W0[s]) for s in 'LR'], 'ankles', [tuple(round(c, 2) for c in A0[s]) for s in 'LR'])

# --- 3. Les clips
FPS = bpy.context.scene.render.fps
rig.animation_data_create()


def reset():
    for pb in rig.pose.bones:
        pb.matrix_basis = Matrix()
    upd()


def body(dz=0.0, pitch=0.0, yaw=0.0, roll=0.0, dy=0.0):
    """Le corps entier (bassin) : levé de `dz`, avancé de `dy`, tangage, lacet et roulis en degrés autour du bassin."""
    c = REST['hips'][1]
    if pitch:
        rot('hips', X, pitch, c)
    if yaw:
        rot('hips', Z, yaw, c)
    if roll:
        rot('hips', Y, roll, c)
    if dz or dy:
        move('hips', (0, dy, dz))


def tail_wave(ph, amp, lag=0.6, lift=0.0):
    for i, n in enumerate(TAILS):
        rot(n, Z, amp * math.sin(ph - i * lag))
        if lift:
            rot(n, X, lift)


def bake(name, frames, pose, loop=True):
    """Un clip `name` de `frames` images : `pose(u)` pose le squelette (u de 0 à 1) depuis la pose de repos."""
    act = bpy.data.actions.new(name)
    n = frames if loop else frames
    for f in range(n + 1):
        rig.animation_data.action = None
        reset()
        pose(f / frames)
        rig.animation_data.action = act
        if hasattr(rig.animation_data, 'action_slot') and act.slots:
            rig.animation_data.action_slot = act.slots[0]
        for pb in rig.pose.bones:
            pb.keyframe_insert('location', frame=f)
            pb.keyframe_insert('rotation_quaternion', frame=f)
    rig.animation_data.action = None
    print('CLIP', name, round(frames / FPS, 3))


def plant(s, wrist_off=(0, 0, 0), ankle_off=(0, 0, 0)):
    stance(s, W0[s] + Vector(wrist_off), A0[s] + Vector(ankle_off))


def idle(u):
    ph = 2 * math.pi * u
    # Il respire, la tête ondule, la queue se balance lentement ; pattes posées
    body(dz=0.04 * math.sin(ph), pitch=1.5 * math.sin(ph))
    rot('spine', X, 2 * math.sin(ph - 0.5))
    rot('neck', Z, 6 * math.sin(ph))
    rot('head', X, -4 * math.sin(ph - 1))
    tail_wave(ph, 7)
    for s in ('L', 'R'):
        plant(s)


STRIDE = 1.3  # longueur d'une foulée (m du fichier source)


def gait(u, phase, lift):
    """Une patte au trot : posée au sol, elle glisse vers l'arrière (le corps avance), puis revient en l'air."""
    t = (u + phase) % 1.0
    if t < 0.55:  # appui
        k = t / 0.55
        return Vector((0, STRIDE * (0.5 - k), 0))
    k = (t - 0.55) / 0.45
    return Vector((0, STRIDE * (k - 0.5), lift * math.sin(math.pi * k)))


def run(u):
    ph = 2 * math.pi * u
    # Course à quatre pattes : diagonales ensemble, le corps rebondit et ondule, la queue fouette, la tête reste fixe
    body(dz=0.08 * math.cos(2 * ph) - 0.05, pitch=-3 + 3 * math.sin(2 * ph), yaw=5 * math.sin(ph))
    rot('spine', Z, -8 * math.sin(ph))
    rot('neck', Z, 3 * math.sin(ph))
    rot('head', X, -6)
    tail_wave(ph + 1, 14, 0.5, lift=-2)
    plant('L', wrist_off=gait(u, 0.0, 0.55), ankle_off=gait(u, 0.5, 0.45))
    plant('R', wrist_off=gait(u, 0.5, 0.55), ankle_off=gait(u, 0.0, 0.45))


def crouch(u):
    ph = 2 * math.pi * u
    # Ramassé avant de bondir : le corps au ras du sol, la tête basse en avant, la queue dressée qui tremble
    body(dz=-0.38 + 0.02 * math.sin(4 * ph), pitch=-6, dy=-0.15)
    rot('neck', X, -10)
    rot('head', X, 8 + 2 * math.sin(6 * ph))
    tail_wave(ph * 2, 5, 0.9, lift=-6)
    for s in ('L', 'R'):
        plant(s)


def leap(u):
    ph = 2 * math.pi * u
    # En plein bond : tout étiré, pattes avant tendues devant, pattes arrière tendues derrière, queue droite
    body(dz=0.25, pitch=8)
    rot('neck', X, -5)
    rot('head', X, -15)
    for i, n in enumerate(TAILS):
        rot(n, X, (14 if i < 4 else 10) + 2 * math.sin(ph - i))
    for s in ('L', 'R'):
        wr = REST['upperarm.' + s][0] + M((-0.35, 2.0, -0.35), s)
        an = REST['thigh.' + s][0] + M((-0.3, -1.7, -0.45), s)
        limb(f'upperarm.{s}', f'forearm.{s}', wr, M((-1, -0.5, 0.3), s), ((f'hand.{s}', M((-0.1, 1, -0.2), s)),))
        limb(f'thigh.{s}', f'shin.{s}', an, M((-0.2, 0.3, -1), s), ((f'foot.{s}', M((0, -1, -0.3), s)), (f'toe.{s}', M((0, -1, -0.5), s))))


TAIL_AT = 0.42  # moment du coup de queue dans le clip


TAIL_STRIKE = [(0, -1, 0.35), (0, -0.55, 0.85), (0, 0.05, 1), (0, 0.55, 0.85), (0, 0.9, 0.45), (0, 1, 0.05), (0, 1, -0.4), (0, 0.9, -0.7)]


def tail(u):
    # Coup de queue : il se ramasse, la queue passe par-dessus son dos et pique devant lui, puis revient
    if u < TAIL_AT:
        k = u / TAIL_AT
        e = k * k * (3 - 2 * k)
    else:
        k = (u - TAIL_AT) / (1 - TAIL_AT)
        e = 1 - k * k
    body(dz=-0.15 * e, pitch=-5 * e)
    rot('neck', X, -8 * e)
    for n, a, b in zip(TAILS, TAIL_REST, TAIL_STRIKE):
        aim(n, Vector(a).normalized().lerp(Vector(b).normalized(), e))
    for s in ('L', 'R'):
        plant(s)


def roar(u):
    # Il se cabre sur ses pattes arrière, tête levée, gueule vers le ciel, puis retombe
    e = math.sin(math.pi * min(1.0, u * 1.15))
    body(dz=0.2 * e, pitch=24 * e)
    rot('neck', X, 20 * e)
    rot('head', X, 25 * e + 4 * math.sin(30 * u) * e)
    tail_wave(2 * math.pi * u * 3, 10 * e, 0.6, lift=-8 * e)
    for s in ('L', 'R'):
        plant(s, ankle_off=(0, 0, 0))
        if e > 0.05:
            w = P(f'upperarm.{s}').head + M((-0.5, 0.9, -0.9 + 0.6 * e), s)
            limb(f'upperarm.{s}', f'forearm.{s}', w, M((-1, -0.6, 0.2), s), ((f'hand.{s}', M((-0.2, 1, 0.4), s)),))


def hit(u):
    e = math.sin(math.pi * u)
    body(dz=-0.1 * e, pitch=-6 * e, dy=-0.15 * e)
    rot('head', X, 15 * e)
    tail_wave(0, 0)
    for s in ('L', 'R'):
        plant(s)


def death(u):
    # Il se cabre, se tord et roule sur le flanc, pattes repliées
    e = min(1.0, u / 0.7)
    e = e * e * (3 - 2 * e)
    body(dz=-0.55 * e, roll=95 * e, pitch=6 * math.sin(math.pi * min(1, u * 2)))
    rot('neck', X, -20 * e)
    rot('head', X, 30 * e)
    for i, n in enumerate(TAILS):
        rot(n, Z, -12 * e)
    for s in ('L', 'R'):
        sh = P(f'upperarm.{s}').head
        hp = P(f'thigh.{s}').head
        up = (P('spine').tail - P('hips').head).normalized()
        down = Vector((0, 0, -1))
        limb(f'upperarm.{s}', f'forearm.{s}', sh.lerp(W0[s], 1 - 0.5 * e) + up * 0.3 * e, M((-1, -0.4, 0.6), s), ((f'hand.{s}', M(HAND_DIR, s)),))
        limb(f'thigh.{s}', f'shin.{s}', hp.lerp(A0[s], 1 - 0.4 * e), M((-0.25, 1, 0.1), s), ((f'foot.{s}', M(FOOT_DIR, s)),))


bake('idle', round(FPS * 2.4), idle)
bake('walk', round(FPS * 0.5), run)
bake('crouch', FPS, crouch)
bake('leap', round(FPS * 0.6), leap)
bake('tail', round(FPS * 0.7), tail, loop=False)
bake('roar', round(FPS * 1.2), roar, loop=False)
bake('hit', round(FPS * 0.3), hit, loop=False)
bake('death', round(FPS * 1.5), death, loop=False)
reset()

# --- 4. À la taille, face vers -Y, pattes au sol, centré sur le corps
vs = [mesh.matrix_world @ v.co for v in mesh.data.vertices]
lo = Vector(map(min, *vs)); hi = Vector(map(max, *vs))
k = HEIGHT / (hi.z - lo.z)
cx = (REST['hips'][0] + REST['spine'][1]) / 2
root = bpy.data.objects.new('Xenomorphe', None)
bpy.context.scene.collection.objects.link(root)
rig.parent = root
root.rotation_euler = (0, 0, math.pi)
root.scale = (k, k, k)
root.location = (cx.x * k, cx.y * k, -lo.z * k)
bpy.ops.export_scene.gltf(filepath=args.out, export_format='GLB', export_animation_mode='ACTIONS', export_cameras=False, export_lights=False)
print('XENO_OK', args.out, 'k', round(k, 3), 'size', tuple(round(x * k, 2) for x in hi - lo), 'clips', [a.name for a in bpy.data.actions])

if args.render:
    os.makedirs(args.render, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'STUDIO'
    sc.display.shading.color_type = 'MATERIAL'
    sc.display.shading.show_cavity = True
    sc.render.resolution_x, sc.render.resolution_y = 560, 420
    body_mat.diffuse_color = (0.35, 0.37, 0.42, 1)
    cam = bpy.data.objects.new('camx', bpy.data.cameras.new('camx'))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 9
    aim_at = Vector((0, 0, 1.3))
    shots = [('repos_cote', None, 0, (12, 0, 1.5)), ('repos_face', None, 0, (0, -12, 2)), ('repos_34', None, 0, (8, -8, 5)),
             ('idle', 'idle', 30, (8, -8, 5))]
    for clip, fr in (('walk', [0, 4, 8]), ('crouch', [0]), ('leap', [0]), ('tail', [0, 9, 14]), ('roar', [14]), ('death', [45])):
        for f in fr:
            shots.append((f'{clip}{f}', clip, f, (12, 0, 1.5)))
            shots.append((f'{clip}{f}_34', clip, f, (8, -8, 5)))
    for name, act, frame, loc in shots:
        rig.animation_data.action = bpy.data.actions.get(act) if act else None
        if act and hasattr(rig.animation_data, 'action_slot') and rig.animation_data.action.slots:
            rig.animation_data.action_slot = rig.animation_data.action.slots[0]
        sc.frame_set(frame)
        cam.location = loc
        cam.rotation_euler = (aim_at - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.join(args.render, f'xeno_{name}.png')
        bpy.ops.render.render(write_still=True)
