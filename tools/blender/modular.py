"""
Persos jouables tirés du pack « Ultimate Modular Men » de Quaternius (CC0, dossier personnages/quaternius_modular_men) :
pièces mélangées (tête, torse, jambes, pieds), couleurs à part, silhouette retouchée et accessoires modélisés ici, pour
qu'ils ne se ressemblent pas. Ils gardent les clips du pack (différents de ceux du Cop et du Buveur), avec des retouches
propres à chacun, et des clips faits main pour ce que le pack n'a pas (saut, chute, atterrissage).

Le squelette du pack pilote les jambes par IK (pieds rattachés à la racine) : chaque clip est recalculé image par image
(IK compris), puis les pieds sont rattachés aux tibias, comme le jeu l'attend (calage des pieds sur le relief). Les os
que le jeu cherche sont renommés (thigh/shin/foot, hand.L d'où partent les bouteilles, hand.R).

Variantes (--variant) :
- barman : le Barman : tête barbue, chemise blanche, tablier de cuir long, torchon sur l épaule, nœud papillon ; il essuie
  le comptoir au repos et court coudes serrés.
- marie : le Futur Marié (enterrement de vie de garçon) : masque de cheval, tee-shirt rose, short, tongs, petit ventre
  de bière, écharpe « FUTUR MARIÉ » ; il tangue en marchant.

Usage (Blender 5.2) :
  blender -b --factory-startup --disable-autoexec -P tools/blender/modular.py -- --lib C:/Users/mydnic/Desktop/MODELS
      --variant marie --out src/assets/models/marie.glb [--render DOSSIER]
"""
import argparse
import math
import os
import sys

import bpy
import bmesh
from mathutils import Euler, Matrix, Vector

ap = argparse.ArgumentParser()
ap.add_argument('--lib', required=True)
ap.add_argument('--variant', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--render', default='')
args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:])

MASTER = os.path.join(args.lib, 'personnages/quaternius_modular_men/Ultimate Modular Men- Feb 2022/All together/Blends/Humans_Master.blend')

# Os renommés comme ceux que le jeu cherche
RENAME = {'UpperLeg.L': 'thigh.L', 'LowerLeg.L': 'shin.L', 'Foot.L': 'foot.L', 'Wrist.L': 'hand.L',
          'UpperLeg.R': 'thigh.R', 'LowerLeg.R': 'shin.R', 'Foot.R': 'foot.R', 'Wrist.R': 'hand.R'}

VARIANTS = {
    'marie': {
        'parts': ['Horse_Head', 'Casual2_Body', 'Beach_Legs', 'Beach_Feet'],
        'height': 1.82,
        # Couleurs (matériau du pack -> RVB)
        'colors': {'Skin': (0.86, 0.62, 0.48), 'LightBrown': (0.95, 0.42, 0.62), 'Red_Dark': (0.10, 0.45, 0.62),
                   'White': (0.92, 0.92, 0.90), 'Brown': (0.45, 0.30, 0.17), 'Brown2': (0.30, 0.19, 0.10),
                   'Muzzle': (0.20, 0.13, 0.08), 'Black': (0.04, 0.04, 0.04), 'Eye': (0.03, 0.02, 0.02),
                   'Eyebrows': (0.12, 0.08, 0.05)},
        # Petit ventre de bière : centre, rayons de la zone (x, profondeur, hauteur), poussée vers l'avant (m)
        'belly': {'center': (0, -0.10, 1.10), 'radius': (0.24, 0.30, 0.24), 'push': 0.17},
        'sash': {'text': 'FUTUR MARIÉ', 'color': (0.97, 0.97, 0.97), 'text_color': (0.80, 0.05, 0.12)},
        # Clips du pack -> clips du jeu ; le lancer (additif dans le jeu) est le coup de poing gauche
        'clips': {'Idle': 'idle', 'Run': 'run', 'Death': 'death', 'Punch_Left': 'throw'},
        # Tangage d'ivrogne ajouté aux clips (degrés : bassin, buste, tête), un aller-retour par boucle
        'sway': {'idle': (4, 6, 8), 'run': (3, 7, 6)},
    },
    'barman': {
        'parts': ['Adventurer_Head', 'Farmer_Body', 'Suit_Legs', 'Suit_Feet'],
        'height': 1.84,
        'colors': {'Skin': (0.84, 0.60, 0.46), 'Beige': (0.84, 0.60, 0.46), 'LightBlue': (0.20, 0.12, 0.07),
                   'Brown': (0.93, 0.93, 0.90), 'Suit': (0.05, 0.05, 0.06), 'Black': (0.03, 0.03, 0.03),
                   'Hair': (0.16, 0.09, 0.05), 'Eyebrows': (0.14, 0.08, 0.04), 'Eye': (0.03, 0.02, 0.02)},
        # Long tablier de cuir (taille -> genoux), torchon sur l'épaule gauche, nœud papillon
        'apron': {'top': 0.98, 'bottom': 0.48, 'radius': (0.20, 0.235), 'span': 75, 'color': (0.20, 0.12, 0.07)},
        'towel': {'path': [(0.11, -0.17, 1.27), (0.15, -0.09, 1.43), (0.16, 0.0, 1.48), (0.15, 0.09, 1.42), (0.11, 0.15, 1.26)],
                  'width': 0.075, 'color': (0.30, 0.47, 0.72)},
        # Les gants du fermier (même matériau que sa chemise) deviennent des mains nues
        'bare_hands': 'Brown',
        'bowtie': {'at': (0, -0.168, 1.462), 'size': 0.05, 'color': (0.55, 0.05, 0.08)},
        'clips': {'Idle_Neutral': 'idle', 'Run': 'run', 'Death': 'death', 'Interact': 'throw'},
        # Retouches de pose par clip (degrés, dans le repère du perso) : (x, y, z) fixes, ou (x, y, z, ax, ay, az) qui
        # oscillent une fois par boucle. Au repos, il essuie le comptoir de la main droite ; il court coudes serrés.
        'pose': {
            'idle': {'UpperArm.R': (-22, 0, -8, 0, 0, 6), 'LowerArm.R': (-48, 0, 0, 0, 0, 14), 'Wrist.R': (0, 0, 0, 0, 0, 20),
                     'Torso': (4, 0, 0, 0, 0, 0)},
            'run': {'LowerArm.L': (-30, 0, 0), 'LowerArm.R': (-30, 0, 0), 'Torso': (-4, 0, 0)},
        },
    },
}
V = VARIANTS[args.variant]

bpy.ops.wm.open_mainfile(filepath=MASTER, load_ui=False)
scene = bpy.context.scene
arm = bpy.data.objects['CharacterArmature']
for o in list(bpy.data.objects):
    if o.type == 'MESH' and o.name not in V['parts']:
        bpy.data.objects.remove(o)
    elif o.type not in ('MESH', 'ARMATURE'):
        bpy.data.objects.remove(o)
meshes = [bpy.data.objects[n] for n in V['parts']]
# Les pièces du pack sont des moitiés (modificateur miroir) passées dans des nœuds : on les fige avant toute retouche
for o in meshes:
    bpy.context.view_layer.objects.active = o
    for mod in list(o.modifiers):
        if mod.type != 'ARMATURE':
            bpy.ops.object.modifier_apply(modifier=mod.name)


def frame_range(a):
    s, e = a.frame_range
    return int(round(s)), int(round(e))


# --- 1. Clips recalculés image par image (IK compris), en matrices de chaque os dans l'armature
if arm.animation_data is None:
    arm.animation_data_create()
baked = {}
for src, dst in V['clips'].items():
    action = bpy.data.actions[src]
    arm.animation_data.action = action
    if hasattr(arm.animation_data, 'action_slot') and action.slots:
        arm.animation_data.action_slot = action.slots[0]
    s, e = frame_range(action)
    frames = []
    for f in range(s, e + 1):
        scene.frame_set(f)
        frames.append({pb.name: pb.matrix.copy() for pb in arm.pose.bones})
    baked[dst] = frames
arm.animation_data.action = None
for a in list(bpy.data.actions):
    bpy.data.actions.remove(a)

# Plus de contraintes (IK) : la pose vient des clips recalculés
for pb in arm.pose.bones:
    for c in list(pb.constraints):
        pb.constraints.remove(c)
    pb.rotation_mode = 'QUATERNION'
    pb.rotation_quaternion = (1, 0, 0, 0)
    pb.location = (0, 0, 0)
    pb.scale = (1, 1, 1)

# --- 2. Pieds rattachés aux tibias ; cibles d'IK retirées
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='EDIT')
eb = arm.data.edit_bones
for s in ('L', 'R'):
    eb[f'Foot.{s}'].parent = eb[f'LowerLeg.{s}']
    for n in (f'PT.{s}',):
        if n in eb:
            eb.remove(eb[n])
bpy.ops.object.mode_set(mode='OBJECT')
for frames in baked.values():
    for fr in frames:
        for s in ('L', 'R'):
            fr.pop(f'PT.{s}', None)

# --- 3. Couleurs propres au perso (copies des matériaux du pack)
for o in meshes:
    for i, m in enumerate(o.data.materials):
        if m is None:
            continue
        c = V['colors'].get(m.name)
        if c is None:
            continue
        nm = m.copy()
        nm.name = m.name
        b = next((n for n in nm.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None) if nm.use_nodes else None
        if b:
            b.inputs['Base Color'].default_value = (*c, 1)
        nm.diffuse_color = (*c, 1)
        o.data.materials[i] = nm


def new_mat(name, color):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = 0.8
    m.diffuse_color = (*color, 1)
    return m


# Mains nues : les faces d'un matériau portées surtout par les poignets et les doigts prennent la peau
if 'bare_hands' in V:
    for o in meshes:
        names = [m.name.split('.')[0] if m else '' for m in o.data.materials]
        if V['bare_hands'] not in names or 'Skin' not in names:
            continue
        src, skin = names.index(V['bare_hands']), names.index('Skin')
        hand_groups = {g.index for g in o.vertex_groups if g.name.startswith(('Wrist', 'Index', 'Middle', 'Ring', 'Pinky', 'Thumb'))}
        def hand_w(vi):
            return sum(g.weight for g in o.data.vertices[vi].groups if g.group in hand_groups)
        for poly in o.data.polygons:
            if poly.material_index == src and sum(hand_w(vi) for vi in poly.vertices) / len(poly.vertices) > 0.5:
                poly.material_index = skin

# --- 4. Silhouette : petit ventre de bière (le torse est poussé vers l'avant, en douceur)
body = next(o for o in meshes if o.name.endswith('_Body'))
if 'belly' in V:
    B = V['belly']
    c = Vector(B['center']); r = Vector(B['radius'])
    inv = body.matrix_world.inverted()
    for v in body.data.vertices:
        w = body.matrix_world @ v.co
        d = Vector(((w.x - c.x) / r.x, (w.y - c.y) / r.y, (w.z - c.z) / r.z))
        k = math.exp(-2.2 * d.length_squared)
        if k < 0.01 or w.y > c.y + 0.12:
            continue  # rien dans le dos
        front = min(1.0, max(0.0, (c.y + 0.12 - w.y) / 0.2))
        w2 = w + Vector((0.25 * (w.x - c.x), -1.0, -0.15)).normalized() * B['push'] * k * front
        v.co = inv @ w2


def bind_like(obj, target):
    """Poids de peau de `obj` copiés sur la surface la plus proche de `target`, puis attaché au squelette."""
    mod = obj.modifiers.new('poids', 'DATA_TRANSFER')
    mod.object = target
    mod.use_vert_data = True
    mod.data_types_verts = {'VGROUP_WEIGHTS'}
    mod.vert_mapping = 'POLYINTERP_NEAREST'
    for g in target.vertex_groups:
        if g.name not in obj.vertex_groups:
            obj.vertex_groups.new(name=g.name)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.parent = arm
    obj.matrix_parent_inverse = arm.matrix_world.inverted()
    a = obj.modifiers.new('rig', 'ARMATURE')
    a.object = arm


def wrap(obj, target, offset):
    """Plaque `obj` sur la surface de `target` (décalé de `offset` m vers l'extérieur)."""
    mod = obj.modifiers.new('plaque', 'SHRINKWRAP')
    mod.target = target
    mod.wrap_method = 'NEAREST_SURFACEPOINT'
    mod.wrap_mode = 'OUTSIDE_SURFACE'
    mod.offset = offset
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)


# --- 5. Écharpe en bandoulière (épaule gauche -> hanche droite) et son texte
if 'sash' in V:
    S = V['sash']
    chest = Vector((0, -0.04, 1.22))
    tilt = Matrix.Rotation(math.radians(-38), 4, 'Y')
    bm = bmesh.new()
    seg, rx, ry, h = 48, 0.24, 0.17, 0.10
    rings = []
    for k in range(seg):
        a = k / seg * math.tau
        p = Vector((rx * math.cos(a), ry * math.sin(a), 0))
        rings.append((bm.verts.new(p + Vector((0, 0, -h / 2))), bm.verts.new(p + Vector((0, 0, h / 2)))))
    for k in range(seg):
        a0, a1 = rings[k], rings[(k + 1) % seg]
        bm.faces.new((a0[0], a1[0], a1[1], a0[1]))
    me = bpy.data.meshes.new('Sash')
    bm.to_mesh(me); bm.free()
    sash = bpy.data.objects.new('Sash', me)
    scene.collection.objects.link(sash)
    sash.data.transform(Matrix.Translation(chest) @ tilt)
    sub = sash.modifiers.new('fin', 'SUBSURF'); sub.levels = 1
    bpy.context.view_layer.objects.active = sash
    bpy.ops.object.modifier_apply(modifier=sub.name)
    wrap(sash, body, 0.012)
    sol = sash.modifiers.new('epaisseur', 'SOLIDIFY'); sol.thickness = 0.006
    bpy.ops.object.modifier_apply(modifier=sol.name)
    sash.data.materials.append(new_mat('Echarpe', S['color']))
    bind_like(sash, body)
    meshes.append(sash)
    # Le texte, posé sur le devant de l'écharpe, dans son sens
    cu = bpy.data.curves.new('SashText', 'FONT')
    cu.body = S['text']
    cu.size = 0.062
    cu.align_x = 'CENTER'; cu.align_y = 'CENTER'
    cu.extrude = 0.002
    txt = bpy.data.objects.new('SashText', cu)
    scene.collection.objects.link(txt)
    bpy.context.view_layer.objects.active = txt
    txt.select_set(True)
    bpy.ops.object.convert(target='MESH')
    txt = bpy.context.view_layer.objects.active
    txt.data.transform(Matrix.Rotation(math.radians(90), 4, 'X'))       # debout, face à -Y
    txt.data.transform(Matrix.Rotation(math.radians(-38 + 90 - 90), 4, 'Y'))
    txt.data.transform(Matrix.Translation(chest + Vector((0, -ry - 0.06, 0))))
    wrap(txt, sash, 0.003)
    txt.data.materials.clear()
    txt.data.materials.append(new_mat('EcharpeTexte', S['text_color']))
    bind_like(txt, body)
    meshes.append(txt)



def ribbon(points, width):
    """Bande plate qui suit une suite de points (largeur `width` le long de l'axe X), en un nouvel objet."""
    bm = bmesh.new()
    side = Vector((1, 0, 0))
    rows = [(bm.verts.new(Vector(p) - side * width / 2), bm.verts.new(Vector(p) + side * width / 2)) for p in points]
    for a, b in zip(rows, rows[1:]):
        bm.faces.new((a[0], b[0], b[1], a[1]))
    me = bpy.data.meshes.new('Ruban'); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('Ruban', me); scene.collection.objects.link(o)
    return o


def finish(obj, target, offset, thickness, color, name, subdiv=1):
    """Lissage, placage sur `target`, épaisseur, matériau."""
    bpy.context.view_layer.objects.active = obj
    if subdiv:
        sub = obj.modifiers.new('fin', 'SUBSURF'); sub.levels = subdiv
        bpy.ops.object.modifier_apply(modifier=sub.name)
    if target is not None:
        wrap(obj, target, offset)
    sol = obj.modifiers.new('epaisseur', 'SOLIDIFY'); sol.thickness = thickness
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=sol.name)
    obj.name = name
    obj.data.materials.clear()
    obj.data.materials.append(new_mat(name, color))


legs = next((o for o in meshes if o.name.endswith('_Legs') or o.name.endswith('_Pants')), None)
if 'apron' in V:
    A = V['apron']
    bm = bmesh.new()
    cols, rows_n = 14, 6
    grid = []
    for j in range(rows_n + 1):
        t = j / rows_n
        z = A['top'] + (A['bottom'] - A['top']) * t
        r = A['radius'][0] + (A['radius'][1] - A['radius'][0]) * t
        row = []
        for i in range(cols + 1):
            a = math.radians(-A['span'] + 2 * A['span'] * i / cols) - math.pi / 2
            row.append(bm.verts.new((r * math.cos(a), -0.02 + r * math.sin(a), z)))
        grid.append(row)
    for j in range(rows_n):
        for i in range(cols):
            bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
    me = bpy.data.meshes.new('Tablier'); bm.to_mesh(me); bm.free()
    apron = bpy.data.objects.new('Tablier', me); scene.collection.objects.link(apron)
    finish(apron, None, 0, 0.008, A['color'], 'Tablier', subdiv=0)
    bind_like(apron, legs)
    hips = apron.vertex_groups.get('Hips') or apron.vertex_groups.new(name='Hips')
    for v in apron.data.vertices:
        t = max(0.0, min(1.0, (A['top'] - v.co.z) / (A['top'] - A['bottom'])))
        follow = 0.8 * t
        ws = {apron.vertex_groups[g.group].name: g.weight for g in v.groups}
        tot = sum(ws.values()) or 1.0
        for name, w in ws.items():
            g = apron.vertex_groups[name]
            target = name.replace('LowerLeg', 'UpperLeg') if name.startswith('LowerLeg') else name
            if target != name:
                g.remove([v.index])
                apron.vertex_groups.get(target, apron.vertex_groups.new(name=target)).add([v.index], w / tot * follow, 'ADD')
            elif name != 'Hips':
                g.add([v.index], w / tot * follow, 'REPLACE')
        hips.add([v.index], 1.0 - follow, 'REPLACE')
    meshes.append(apron)
if 'towel' in V:
    T = V['towel']
    towel = ribbon(T['path'], T['width'])
    finish(towel, body, 0.014, 0.008, T['color'], 'Torchon')
    bind_like(towel, body)
    meshes.append(towel)
if 'bowtie' in V:
    W = V['bowtie']
    c = Vector(W['at']); sz = W['size']
    bm = bmesh.new()
    for sd in (-1, 1):
        # Une aile : un coin plat, pointe vers le centre
        a = bm.verts.new(c + Vector((sd * sz, -0.004, -sz * 0.45)))
        b = bm.verts.new(c + Vector((sd * sz, -0.004, sz * 0.45)))
        m = bm.verts.new(c + Vector((0, -0.012, 0)))
        bm.faces.new((a, b, m) if sd > 0 else (b, a, m))
    bmesh.ops.create_cube(bm, size=sz * 0.3, matrix=Matrix.Translation(c + Vector((0, -0.008, 0))))
    me = bpy.data.meshes.new('Noeud'); bm.to_mesh(me); bm.free()
    bow = bpy.data.objects.new('Noeud', me); scene.collection.objects.link(bow)
    sol = bow.modifiers.new('epaisseur', 'SOLIDIFY'); sol.thickness = 0.01
    bpy.context.view_layer.objects.active = bow
    bpy.ops.object.modifier_apply(modifier=sol.name)
    bow.data.materials.append(new_mat('Noeud', W['color']))
    bind_like(bow, body)
    meshes.append(bow)

# --- 6. Os renommés ; clips réécrits (avec les retouches du perso) et clips faits main


def key_pose(action_name, frames, sway=None):
    act = bpy.data.actions.new(action_name)
    arm.animation_data.action = act
    if hasattr(arm.animation_data, 'action_slot') and act.slots:
        arm.animation_data.action_slot = act.slots[0]
    order = [pb for pb in arm.pose.bones]  # parents avant les enfants
    n = len(frames)
    for i, fr in enumerate(frames):
        for pb in order:
            name = pb.name
            src = next((k for k, v in RENAME.items() if v == name), name)
            if src in fr:
                pb.matrix = fr[src]
                bpy.context.view_layer.update()
        if sway:
            ph = i / max(1, n - 1) * math.tau
            for bone, deg in (('Hips', sway[0]), ('Torso', sway[1]), ('Head', sway[2])):
                pb = arm.pose.bones[bone]
                R = Euler((0, math.radians(deg * math.sin(ph)), math.radians(deg * 0.5 * math.sin(ph + 1.1))), 'XYZ').to_quaternion()
                Mq = pb.bone.matrix_local.to_quaternion()
                pb.rotation_quaternion = (Mq.inverted() @ R @ Mq) @ pb.rotation_quaternion
                bpy.context.view_layer.update()
        for pb in order:
            pb.keyframe_insert('rotation_quaternion', frame=i)
            pb.keyframe_insert('location', frame=i)
            pb.keyframe_insert('scale', frame=i)
    arm.animation_data.action = None
    track = arm.animation_data.nla_tracks.new()
    track.name = action_name
    strip = track.strips.new(action_name, 0, act)
    track.mute = True
    return act


for old, new in RENAME.items():
    arm.data.bones[old].name = new
    for o in meshes:
        g = o.vertex_groups.get(old)
        if g:
            g.name = new

def pose_from(base, extra):
    """Pose = `base` (matrices d'un clip recalculé) + rotations dans le repère du perso (degrés, autour de la tête de l'os)."""
    out = {}
    for k, m in base.items():
        out[k] = m.copy()
    for bone, (rx, ry, rz) in extra.items():
        R = Euler((math.radians(rx), math.radians(ry), math.radians(rz)), 'XYZ').to_matrix().to_4x4()
        m = out[bone]
        head = m.translation.copy()
        rot = Matrix.Translation(head) @ R @ Matrix.Translation(-head)
        # L'os et tous ses enfants tournent ensemble
        kids = [bone] + [b.name for b in arm.data.bones[RENAME.get(bone, bone)].children_recursive]
        for kname in kids:
            src = next((k for k, v in RENAME.items() if v == kname), kname)
            if src in out:
                out[src] = rot @ out[src]
    return out


def retouch(name, frames):
    """Retouches de pose du perso pour le clip `name` (voir 'pose' dans VARIANTS)."""
    P = V.get('pose', {}).get(name)
    if not P:
        return frames
    out = []
    n = len(frames)
    for i, fr in enumerate(frames):
        ph = math.sin(i / max(1, n - 1) * math.tau)
        out.append(pose_from(fr, {b: tuple(v[k] + (v[k + 3] * ph if len(v) > 3 else 0) for k in range(3)) for b, v in P.items()}))
    return out


for name in list(baked):
    baked[name] = retouch(name, baked[name])
    key_pose(name, baked[name], V.get('sway', {}).get(name))

idle0 = baked['idle'][0]
crouch = pose_from(idle0, {'Hips': (12, 0, 0), 'UpperLeg.L': (-40, 0, 0), 'UpperLeg.R': (-40, 0, 0), 'LowerLeg.L': (75, 0, 0), 'LowerLeg.R': (75, 0, 0)})
air = pose_from(idle0, {'UpperArm.L': (0, -35, 0), 'UpperArm.R': (0, 35, 0), 'UpperLeg.L': (-50, 0, 0), 'LowerLeg.L': (80, 0, 0),
                        'UpperLeg.R': (-10, 0, 0), 'LowerLeg.R': (35, 0, 0), 'Head': (-10, 0, 0)})
flail = [pose_from(idle0, {'UpperArm.L': (40 * math.sin(a), -50, 0), 'UpperArm.R': (-40 * math.sin(a), 50, 0),
                           'UpperLeg.L': (-35 - 15 * math.sin(a), 0, 0), 'LowerLeg.L': (60, 0, 0),
                           'UpperLeg.R': (-15 + 15 * math.sin(a), 0, 0), 'LowerLeg.R': (45, 0, 0)})
         for a in [i / 8 * math.tau for i in range(9)]]


def blend(a, b, t):
    out = {}
    for k in a:
        ma, mb = a[k], b.get(k, a[k])
        la, ra, sa = ma.decompose(); lb, rb, sb = mb.decompose()
        out[k] = Matrix.LocRotScale(la.lerp(lb, t), ra.slerp(rb, t), sa.lerp(sb, t))
    return out


key_pose('jump', [blend(crouch, air, t / 6) for t in range(7)])
key_pose('fall', flail)
key_pose('land', [blend(crouch, idle0, max(0, t - 2) / 7) for t in range(10)])

# --- 7. Taille, pieds au sol
bpy.context.view_layer.update()
allv = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
lo = min(v.z for v in allv); hi = max(v.z for v in allv)
k = V['height'] / (hi - lo)
arm.scale = (k, k, k)
arm.location.z = -lo * k
bpy.context.view_layer.update()
bpy.ops.object.select_all(action='SELECT')
bpy.context.view_layer.objects.active = arm
bpy.ops.object.transform_apply(location=True, rotation=False, scale=True)

arm.name = f'{args.variant}_rig'
os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(args.out), export_format='GLB', export_animation_mode='NLA_TRACKS',
                          export_cameras=False, export_lights=False, export_skins=True, export_morph=False)
print('MODULAR_OK', args.variant, 'triangles', sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes))

if args.render:
    os.makedirs(args.render, exist_ok=True)
    sc = scene
    sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = 500, 600
    w = bpy.data.worlds.new('w'); w.color = (0.6, 0.65, 0.7); sc.world = w
    bpy.ops.object.light_add(type='SUN', rotation=(0.7, 0.2, 2.6)); bpy.context.active_object.data.energy = 4
    cam = bpy.data.cameras.new('c'); cam.type = 'ORTHO'; cam.ortho_scale = 2.4
    co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co
    for name, act, frame, loc in (('face', 'idle', 0, (0.6, -4, 1.0)), ('trois_quarts', 'idle', 10, (3, -3, 1.0)), ('profil', 'idle', 0, (4, 0, 1.0)),
                                  ('course', 'run', 4, (3, -3, 1.0)), ('saut', 'jump', 6, (3, -3, 1.0)), ('chute', 'fall', 3, (3, -3, 1.0)),
                                  ('mort', 'death', 40, (3, -3, 1.0)), ('buste', 'idle', 0, (0.8, -3, 1.4))):
        for t in arm.animation_data.nla_tracks:
            t.mute = t.name != act
        sc.frame_set(frame)
        co.location = loc
        cam.ortho_scale = 1.0 if name == 'buste' else 2.4
        co.rotation_euler = (Vector((0, 0, 1.35 if name == 'buste' else 0.95)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.join(args.render, f'{name}.png')
        bpy.ops.render.render(write_still=True)
