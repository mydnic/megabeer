"""
Le Frère Sonneur (boss de 5:00 de l'Abbaye) : un ogre moine zombie, énorme ventre sous la bure, tonsure, mâchoire
prognathe, un maillet de bois cerclé de fer à la main. Modèle, squelette et animations générés par script, dans le
style du Buveur (pièces rigides attachées à un os, look « figurine »).

    blender -b --factory-startup -P tools/blender/sonneur.py -- --out src/assets/models/sonneur.glb [--render DIR]

Repère Blender : Z en haut, il regarde vers -Y (devient +Z dans le glTF). Le maillet est dans sa main droite (-X).
Animations : idle, walk, strike (frappe la cloche géante, impact à l'image STRIKE_HIT), push (pousse la cloche pour
qu'elle roule), hit, roar (passage en phase 2), death.
"""
import bpy
import bmesh
import math
import sys
import os
from mathutils import Vector, Matrix, Euler

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default=None):
    return argv[argv.index(name) + 1] if name in argv else default
OUT = arg('--out', 'sonneur.glb')
RENDER_DIR = arg('--render')
FPS = 30
# Image où le maillet touche la cloche dans le clip strike (le jeu cale l'onde dessus)
STRIKE_HIT = 30

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = FPS

# ---------------------------------------------------------------- palette
PALETTE = {
    'peau':       (0.60, 0.70, 0.50),
    'peau_fonce': (0.46, 0.55, 0.38),
    'bure':       (0.43, 0.29, 0.18),
    'bure_fonce': (0.30, 0.20, 0.13),
    'corde':      (0.82, 0.70, 0.45),
    'cuir':       (0.36, 0.22, 0.12),
    'cheveux':    (0.24, 0.19, 0.16),
    'oeil':       (1.00, 0.85, 0.20),
    'dent':       (0.95, 0.91, 0.78),
    'bouche':     (0.30, 0.08, 0.10),
    'bois':       (0.56, 0.36, 0.20),
    'fer':        (0.46, 0.48, 0.52),
}

def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

MATS = {}
def mat(name):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    lin = tuple(srgb_to_lin(c) for c in PALETTE[name]) + (1.0,)
    m.diffuse_color = lin
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = lin
    bsdf.inputs['Roughness'].default_value = 1.0
    MATS[name] = m
    return m

# ---------------------------------------------------------------- pièces (mêmes briques que buveur.py)
PARTS = []

def _finish(obj, material, bone, smooth=True):
    obj.data.materials.append(mat(material))
    for p in obj.data.polygons:
        p.use_smooth = smooth
    PARTS.append((obj, bone))
    return obj

def _obj_from_bm(bm, name):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    scene.collection.objects.link(obj)
    return obj

def ellipsoid(name, center, size, material, bone, seg=14, rings=9, rot=(0, 0, 0), smooth=True, cut_z=None):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0)
    m = Matrix.Translation(center) @ Euler([math.radians(a) for a in rot]).to_matrix().to_4x4() @ Matrix.Diagonal((*size, 1))
    bmesh.ops.transform(bm, matrix=m, verts=bm.verts)
    if cut_z is not None:
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        res = bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, cut_z), plane_no=(0, 0, 1), clear_inner=True)
        edges = [e for e in res['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
        bmesh.ops.edgeloop_fill(bm, edges=edges)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _finish(_obj_from_bm(bm, name), material, bone, smooth)

def limb(name, a, b, r1, r2, material, bone, seg=12, smooth=True):
    a, b = Vector(a), Vector(b)
    d = b - a
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r1, radius2=r2, depth=d.length)
    rot = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=Matrix.Translation((a + b) / 2) @ rot, verts=bm.verts)
    return _finish(_obj_from_bm(bm, name), material, bone, smooth)

def box(name, center, size, material, bone, bevel=0.0, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=bm.verts[:] + bm.edges[:], offset=bevel, segments=2, affect='EDGES', profile=0.5)
    m = Matrix.Translation(center) @ Euler([math.radians(a) for a in rot]).to_matrix().to_4x4() @ Matrix.Diagonal((*size, 1))
    bmesh.ops.transform(bm, matrix=m, verts=bm.verts)
    return _finish(_obj_from_bm(bm, name), material, bone, smooth=False)

def _smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)

def tube_chain(name, pts, radii, bones, material, seg=12, blend=0.1, dome_start=False):
    """Membre continu en deux segments, poids qui passent en douceur d'un os à l'autre (voir buveur.py)."""
    p0, p1, p2 = (Vector(p) for p in pts)
    d1, d2 = (p1 - p0), (p2 - p1)
    L1, L2 = d1.length, d2.length
    d1.normalize(); d2.normalize()
    L = L1 + L2
    stations = sorted(set([0.0, L1 * 0.33, L1 * 0.66, L1 - blend, L1 - blend * 0.5, L1, L1 + blend * 0.5,
                           L1 + blend, L1 + L2 * 0.4, L1 + L2 * 0.75, L]))
    if dome_start:
        stations = [-radii[0] * math.sin(math.radians(a)) for a in (80, 65, 48, 30, 14)] + stations
    bm = bmesh.new()
    rings, weights = [], []
    n_prev = None
    for st in stations:
        if st < 0:
            c = p0 + d1 * st
            r = radii[0] * math.cos(math.asin(min(1.0, -st / radii[0])))
        elif st <= L1:
            c = p0 + d1 * st
            r = radii[0] + (radii[1] - radii[0]) * (st / L1)
        else:
            c = p1 + d2 * (st - L1)
            r = radii[1] + (radii[2] - radii[1]) * ((st - L1) / L2)
        w2 = _smoothstep(L1 - blend, L1 + blend, st)
        t = (d1 * (1 - w2) + d2 * w2).normalized()
        if n_prev is None:
            ref = Vector((1, 0, 0)) if abs(t.x) < 0.9 else Vector((0, 1, 0))
            n = (ref - t * ref.dot(t)).normalized()
        else:
            n = (n_prev - t * n_prev.dot(t)).normalized()
        n_prev = n
        b = t.cross(n)
        rings.append([bm.verts.new(c + (n * math.cos(k / seg * math.tau) + b * math.sin(k / seg * math.tau)) * r) for k in range(seg)])
        weights.append(w2)
    for i in range(len(rings) - 1):
        for k in range(seg):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % seg], rings[i + 1][(k + 1) % seg], rings[i + 1][k]))
    if dome_start:
        pole = bm.verts.new(p0 - d1 * radii[0])
        for k in range(seg):
            bm.faces.new((pole, rings[0][(k + 1) % seg], rings[0][k]))
    else:
        bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = _obj_from_bm(bm, name)
    g1 = obj.vertex_groups.new(name=bones[0])
    g2 = obj.vertex_groups.new(name=bones[1])
    for i, w2 in enumerate(weights):
        idx = list(range(i * seg, (i + 1) * seg))
        if w2 < 1:
            g1.add(idx, 1 - w2, 'REPLACE')
        if w2 > 0:
            g2.add(idx, w2, 'REPLACE')
    if dome_start:
        g1.add([len(rings) * seg], 1.0, 'REPLACE')
    return _finish(obj, material, None)

# ---------------------------------------------------------------- squelette (repos : bras ballants, maillet tenu vers le bas)
B = {
    'hips':       ((0, 0, 0.92), (0, 0, 1.18), None),
    'spine':      ((0, 0, 1.18), (0, 0, 1.55), 'hips'),
    'belly':      ((0, -0.18, 1.18), (0, -0.62, 1.18), 'spine'),
    'chest':      ((0, 0, 1.55), (0, 0, 1.88), 'spine'),
    'head':       ((0, 0, 1.88), (0, 0, 2.45), 'chest'),
    'upperarm.L': ((0.62, 0, 1.78), (0.80, 0, 1.25), 'chest'),
    'forearm.L':  ((0.80, 0, 1.25), (0.86, -0.06, 0.82), 'upperarm.L'),
    'hand.L':     ((0.86, -0.06, 0.82), (0.87, -0.08, 0.62), 'forearm.L'),
    'upperarm.R': ((-0.62, 0, 1.78), (-0.80, 0, 1.25), 'chest'),
    'forearm.R':  ((-0.80, 0, 1.25), (-0.86, -0.06, 0.82), 'upperarm.R'),
    'hand.R':     ((-0.86, -0.06, 0.82), (-0.87, -0.08, 0.62), 'forearm.R'),
    'mallet':     ((-0.87, -0.12, 0.66), (-0.87, -0.12, 0.10), 'hand.R'),
    'thigh.L':    ((0.27, 0, 0.92), (0.29, 0, 0.52), 'hips'),
    'shin.L':     ((0.29, 0, 0.52), (0.30, 0.01, 0.14), 'thigh.L'),
    'foot.L':     ((0.30, 0.01, 0.14), (0.30, -0.22, 0.05), 'shin.L'),
    'thigh.R':    ((-0.27, 0, 0.92), (-0.29, 0, 0.52), 'hips'),
    'shin.R':     ((-0.29, 0, 0.52), (-0.30, 0.01, 0.14), 'thigh.R'),
    'foot.R':     ((-0.30, 0.01, 0.14), (-0.30, -0.22, 0.05), 'shin.R'),
}

# ---------------------------------------------------------------- modèle
def build_body():
    for s, side in ((1, 'L'), (-1, 'R')):
        x = 0.28 * s
        # Jambes courtes et épaisses (le bas des tibias dépasse de la bure), sandales, gros orteils
        tube_chain(f'jambe.{side}', [(x, 0, 0.95), (x + 0.01 * s, 0, 0.52), (x + 0.02 * s, 0.01, 0.16)],
                   [0.19, 0.17, 0.16], [f'thigh.{side}', f'shin.{side}'], 'peau', seg=12)
        fx = x + 0.02 * s
        ellipsoid(f'sandale.{side}', (fx, -0.10, 0.04), (0.16, 0.27, 0.06), 'cuir', f'foot.{side}', seg=12, rings=8, cut_z=0.0)
        ellipsoid(f'pied.{side}', (fx, -0.12, 0.10), (0.14, 0.22, 0.08), 'peau', f'foot.{side}', seg=12, rings=8)
        for k, ox in enumerate((-0.07, 0.0, 0.07)):
            ellipsoid(f'orteil.{side}{k}', (fx + ox * s, -0.31, 0.08), (0.045, 0.05, 0.045), 'peau_fonce', f'foot.{side}', seg=8, rings=6)
        limb(f'lanière.{side}', (fx, -0.16, 0.13), (fx, -0.16, 0.16), 0.15, 0.15, 'cuir', f'foot.{side}', seg=12)

    # Bure : jupe évasée jusqu'aux mollets, ourlet plus foncé
    limb('jupe', (0, 0.03, 0.30), (0, 0.03, 1.08), 0.74, 0.62, 'bure', 'hips', seg=18)
    limb('ourlet', (0, 0.03, 0.26), (0, 0.03, 0.36), 0.76, 0.75, 'bure_fonce', 'hips', seg=18)
    # Énorme ventre, poitrail, bosse dans le dos
    ellipsoid('ventre', (0, -0.22, 1.22), (0.74, 0.70, 0.58), 'bure', 'belly', seg=18, rings=12)
    ellipsoid('torse', (0, 0.06, 1.66), (0.70, 0.50, 0.44), 'bure', 'chest', seg=16, rings=10)
    ellipsoid('bosse', (0, 0.32, 1.82), (0.48, 0.32, 0.32), 'bure', 'chest', seg=14, rings=9)
    # Capuche rabattue en col épais sur les épaules
    ellipsoid('capuche', (0, 0.10, 1.95), (0.50, 0.44, 0.18), 'bure_fonce', 'chest', seg=16, rings=9)
    ellipsoid('capuche_dos', (0, 0.36, 2.02), (0.30, 0.18, 0.22), 'bure_fonce', 'chest', seg=12, rings=8)
    # Cordelière : tour de taille sous le ventre, gros noeud, deux bouts qui pendent
    ellipsoid('cordeliere', (0, -0.10, 0.98), (0.76, 0.72, 0.065), 'corde', 'hips', seg=20, rings=6)
    ellipsoid('noeud', (0.30, -0.70, 0.97), (0.10, 0.08, 0.09), 'corde', 'hips', seg=10, rings=7)
    limb('bout1', (0.28, -0.72, 0.95), (0.27, -0.74, 0.55), 0.045, 0.04, 'corde', 'hips', seg=8)
    limb('bout2', (0.34, -0.70, 0.95), (0.38, -0.71, 0.62), 0.045, 0.04, 'corde', 'hips', seg=8)
    ellipsoid('pompon1', (0.27, -0.74, 0.53), (0.065, 0.065, 0.08), 'corde', 'hips', seg=8, rings=6)
    ellipsoid('pompon2', (0.38, -0.71, 0.60), (0.065, 0.065, 0.08), 'corde', 'hips', seg=8, rings=6)

    # Bras : longues manches de bure, poignets larges, grosses mains
    for s, side in ((1, 'L'), (-1, 'R')):
        tube_chain(f'bras.{side}', [(0.60 * s, 0, 1.80), (0.80 * s, 0, 1.25), (0.86 * s, -0.06, 0.86)],
                   [0.22, 0.19, 0.18], [f'upperarm.{side}', f'forearm.{side}'], 'bure', seg=12, dome_start=True)
        limb(f'manche.{side}', (0.85 * s, -0.05, 0.98), (0.86 * s, -0.06, 0.80), 0.24, 0.27, 'bure_fonce', f'forearm.{side}', seg=14)
        ellipsoid(f'main.{side}', (0.87 * s, -0.09, 0.68), (0.17, 0.16, 0.19), 'peau', f'hand.{side}', seg=12, rings=8)
        ellipsoid(f'pouce.{side}', (0.80 * s, -0.20, 0.72), (0.06, 0.07, 0.08), 'peau', f'hand.{side}', seg=8, rings=6)

    # Maillet de sonneur : long manche, tête de bois cerclée de fer, tenu tête en bas
    mx, my = -0.87, -0.12
    limb('manche_maillet', (mx, my, 0.95), (mx, my, 0.22), 0.05, 0.05, 'bois', 'mallet', seg=10)
    box('tete_maillet', (mx, my, 0.12), (0.30, 0.62, 0.30), 'bois', 'mallet', bevel=0.04)
    for k, oy in enumerate((-0.22, 0.22)):
        box(f'cercle{k}', (mx, my + oy, 0.12), (0.33, 0.07, 0.33), 'fer', 'mallet', bevel=0.015)

    # Tête : petit crâne pour un corps pareil, tonsure, mâchoire prognathe, crocs, petits yeux jaunes
    hz = 2.12
    limb('cou', (0, -0.04, 1.86), (0, -0.06, 2.0), 0.20, 0.19, 'peau', 'head', seg=12)
    ellipsoid('crane', (0, -0.10, hz + 0.04), (0.25, 0.25, 0.27), 'peau', 'head', seg=16, rings=11)
    ellipsoid('tonsure', (0, -0.08, hz + 0.06), (0.27, 0.27, 0.10), 'cheveux', 'head', seg=16, rings=7)
    ellipsoid('machoire', (0, -0.24, hz - 0.13), (0.26, 0.20, 0.14), 'peau', 'head', seg=14, rings=8)
    ellipsoid('bouche', (0, -0.41, hz - 0.08), (0.15, 0.03, 0.03), 'bouche', 'head', seg=10, rings=6)
    for s, side in ((1, 'L'), (-1, 'R')):
        box(f'croc.{side}', (0.10 * s, -0.42, hz - 0.03), (0.045, 0.035, 0.08), 'dent', 'head', bevel=0.01, rot=(0, 8 * s, 0))
        ellipsoid(f'oeil.{side}', (0.09 * s, -0.33, hz + 0.07), (0.045, 0.02, 0.035), 'oeil', 'head', seg=10, rings=6)
        box(f'sourcil.{side}', (0.10 * s, -0.34, hz + 0.13), (0.12, 0.04, 0.04), 'cheveux', 'head', bevel=0.012, rot=(0, -18 * s, 0))
        ellipsoid(f'oreille.{side}', (0.25 * s, -0.10, hz + 0.02), (0.045, 0.08, 0.10), 'peau', 'head', seg=10, rings=6)
    ellipsoid('nez', (0, -0.38, hz + 0.01), (0.08, 0.08, 0.09), 'peau_fonce', 'head', seg=12, rings=8)

# ---------------------------------------------------------------- armature, peau
def build_armature():
    arm_data = bpy.data.armatures.new('Sonneur_rig')
    arm = bpy.data.objects.new('Sonneur_rig', arm_data)
    scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    for name, (h, t, parent) in B.items():
        eb = arm_data.edit_bones.new(name)
        eb.head, eb.tail = h, t
        eb.roll = 0
    for name, (h, t, parent) in B.items():
        if parent:
            eb = arm_data.edit_bones[name]
            eb.parent = arm_data.edit_bones[parent]
            eb.use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    return arm

def skin(arm):
    for obj, bone in PARTS:
        if bone is None:
            continue
        vg = obj.vertex_groups.new(name=bone)
        vg.add(range(len(obj.data.vertices)), 1.0, 'REPLACE')
    bpy.ops.object.select_all(action='DESELECT')
    for obj, _ in PARTS:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = PARTS[0][0]
    bpy.ops.object.join()
    body = bpy.context.view_layer.objects.active
    body.name = body.data.name = 'Sonneur'
    body.parent = arm
    body.modifiers.new('Armature', 'ARMATURE').object = arm
    return body

# ---------------------------------------------------------------- animation (conventions de buveur.py)
#   x > 0 : penche vers l'avant (os qui monte) / recule (os qui descend : bras levé vers l'avant = x < 0)
#   y > 0 : le haut bascule vers sa gauche ; z > 0 : tourne vers sa gauche
def q_arm_to_local(bone, rx, ry, rz):
    R = Euler((math.radians(rx), math.radians(ry), math.radians(rz)), 'XYZ').to_quaternion()
    M = bone.matrix_local.to_3x3().to_quaternion()
    return M.inverted() @ R @ M

def loc_arm_to_local(bone, v):
    return bone.matrix_local.to_3x3().inverted() @ Vector(v)

def make_clip(arm, name, length, keys, loop):
    action = bpy.data.actions.new(name)
    arm.animation_data_create()
    arm.animation_data.action = action
    prev = {}
    for f in sorted(keys):
        pose = keys[f]
        for pb in arm.pose.bones:
            d = pose.get(pb.name, {})
            q = q_arm_to_local(pb.bone, *d.get('r', (0, 0, 0)))
            if pb.name in prev and prev[pb.name].dot(q) < 0:
                q.negate()
            prev[pb.name] = q.copy()
            pb.rotation_mode = 'QUATERNION'
            pb.rotation_quaternion = q
            pb.location = loc_arm_to_local(pb.bone, d.get('l', (0, 0, 0)))
            pb.scale = d.get('s', (1, 1, 1))
            for path in ('rotation_quaternion', 'location', 'scale'):
                pb.keyframe_insert(path, frame=f)
    try:
        from bpy_extras import anim_utils
        cb = anim_utils.action_get_channelbag_for_slot(action, arm.animation_data.action_slot)
        fcurves = cb.fcurves
    except Exception:
        fcurves = getattr(action, 'fcurves', [])
    for fc in fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = 'BEZIER'
            kp.handle_left_type = kp.handle_right_type = 'AUTO_CLAMPED'
        if loop:
            fc.modifiers.new('CYCLES')
        fc.update()
    arm.animation_data.action = None
    track = arm.animation_data.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, 0, action)
    strip.frame_end = length
    track.mute = True
    return action

def merge(*poses):
    out = {}
    for p in poses:
        for b, d in p.items():
            out.setdefault(b, {}).update(d)
    return out

def build_clips(arm):
    # Bras un peu écartés du ventre, épaules voûtées
    base = {
        'upperarm.L': {'r': (-6, -10, 0)}, 'forearm.L': {'r': (-14, 0, 0)},
        'upperarm.R': {'r': (-6, 10, 0)}, 'forearm.R': {'r': (-14, 0, 0)},
        'spine': {'r': (6, 0, 0)}, 'head': {'r': (-4, 0, 0)},
    }

    # ---- IDLE : il souffle, le ventre gonfle, la tête dodeline (2 s)
    L = 60
    idle = {}
    for i in range(5):
        ph = i / 4 * math.tau
        s, br = math.sin(ph), math.sin(ph * 2)
        idle[i * L // 4] = merge(base, {
            'hips': {'r': (0, 2 * s, 0), 'l': (0, 0, -0.01 * abs(s))},
            'spine': {'r': (6 + 2 * br, -3 * s, 0)},
            'belly': {'s': (1 + 0.03 * br, 1 + 0.035 * br, 1 + 0.02 * br)},
            'head': {'r': (-4 + 3 * math.sin(ph * 2 + 0.5), 5 * math.sin(ph + 0.7), 6 * math.sin(ph + 0.3))},
            'upperarm.L': {'r': (-6 + 3 * s, -10, 0)}, 'upperarm.R': {'r': (-6 - 3 * s, 10, 0)},
        })
    make_clip(arm, 'idle', L, idle, loop=True)

    # ---- WALK : pas lourds, tout le corps roule d'un pied sur l'autre (1,2 s)
    L = 36
    walk = {}
    for i in range(9):
        a = i / 8 * math.tau
        s, c, b = math.sin(a), math.cos(a), math.cos(2 * a)
        walk[i * L // 8] = merge(base, {
            'hips': {'r': (4, 7 * s, -6 * s), 'l': (0.05 * s, 0, 0.04 * b - 0.03)},
            'spine': {'r': (10, -6 * s, 8 * s)},
            'chest': {'r': (2, -3 * s, 4 * s)},
            'belly': {'l': (0, 0, -0.03 * math.cos(2 * a - 0.8)), 's': (1 + 0.04 * math.cos(2 * a - 0.8), 1, 1 - 0.04 * math.cos(2 * a - 0.8))},
            'head': {'r': (-8 + 3 * b, 4 * c, -8 * s)},
            'thigh.L': {'r': (-30 * s, 0, 0)}, 'shin.L': {'r': (max(0, 45 * math.sin(a + 1.9)) + 6, 0, 0)},
            'thigh.R': {'r': (30 * s, 0, 0)}, 'shin.R': {'r': (max(0, 45 * math.sin(a + math.pi + 1.9)) + 6, 0, 0)},
            'foot.L': {'r': (-10 * math.sin(a + 0.5), 0, 0)}, 'foot.R': {'r': (10 * math.sin(a + 0.5), 0, 0)},
            'upperarm.L': {'r': (-6 + 22 * s, -12, 0)}, 'forearm.L': {'r': (-20 + 8 * s, 0, 0)},
            'upperarm.R': {'r': (-6 - 14 * s, 12, 0)}, 'forearm.R': {'r': (-18, 0, 0)},
        })
    make_clip(arm, 'walk', L, walk, loop=True)

    rest = idle[0]
    # ---- STRIKE : il lève le maillet à deux mains au-dessus de la tête, tient, et l'abat devant lui (1,6 s)
    raised = merge(base, {
        'hips': {'r': (-4, 0, 0)},
        'spine': {'r': (-16, 0, -10)}, 'chest': {'r': (-8, 0, -6)}, 'head': {'r': (-14, 0, 0)},
        'upperarm.R': {'r': (-165, 10, 10)}, 'forearm.R': {'r': (-55, 0, 0)}, 'hand.R': {'r': (-20, 0, 0)},
        'upperarm.L': {'r': (-160, -25, -10)}, 'forearm.L': {'r': (-60, 0, 0)},
        'belly': {'s': (0.97, 0.97, 1.05)},
        'thigh.L': {'r': (-10, 0, 0)}, 'thigh.R': {'r': (8, 0, 0)},
    })
    slam = merge(base, {
        'hips': {'r': (14, 0, 0), 'l': (0, -0.05, -0.16)},
        'spine': {'r': (34, 0, 6)}, 'chest': {'r': (10, 0, 0)}, 'head': {'r': (14, 0, 0)},
        'upperarm.R': {'r': (-75, 14, 8)}, 'forearm.R': {'r': (-6, 0, 0)}, 'hand.R': {'r': (-55, 0, 0)},
        'upperarm.L': {'r': (-72, -22, -8)}, 'forearm.L': {'r': (-10, 0, 0)},
        'belly': {'s': (1.06, 1.06, 0.93)},
        'thigh.L': {'r': (-38, 0, 0)}, 'shin.L': {'r': (40, 0, 0)}, 'foot.L': {'r': (-4, 0, 0)},
        'thigh.R': {'r': (-14, 0, 0)}, 'shin.R': {'r': (32, 0, 0)},
    })
    make_clip(arm, 'strike', 48, {0: rest, 14: raised, 22: raised, STRIKE_HIT: slam, 36: slam, 48: rest}, loop=False)

    # ---- PUSH : il s'arc-boute et pousse la cloche à deux mains (1 s)
    shove = merge(base, {
        'hips': {'r': (16, 0, 0), 'l': (0, -0.12, -0.08)},
        'spine': {'r': (24, 0, 0)}, 'head': {'r': (-10, 0, 0)},
        'upperarm.L': {'r': (-85, -8, 0)}, 'forearm.L': {'r': (-6, 0, 0)},
        'upperarm.R': {'r': (-85, 8, 0)}, 'forearm.R': {'r': (-6, 0, 0)},
        'thigh.L': {'r': (-40, 0, 0)}, 'shin.L': {'r': (35, 0, 0)},
        'thigh.R': {'r': (30, 0, 0)}, 'shin.R': {'r': (10, 0, 0)},
    })
    windup = merge(shove, {'upperarm.L': {'r': (-60, -8, 0)}, 'forearm.L': {'r': (-60, 0, 0)},
                           'upperarm.R': {'r': (-60, 8, 0)}, 'forearm.R': {'r': (-60, 0, 0)}, 'spine': {'r': (14, 0, 0)}})
    make_clip(arm, 'push', 30, {0: rest, 10: windup, 16: shove, 24: shove, 30: rest}, loop=False)

    # ---- HIT : il encaisse, la tête part en arrière, le ventre tremble (0,4 s)
    hurt = merge(rest, {'spine': {'r': (-8, 0, 6)}, 'head': {'r': (-20, 0, 8)}, 'belly': {'s': (1.06, 1.06, 0.95)}})
    make_clip(arm, 'hit', 12, {0: rest, 3: hurt, 12: rest}, loop=False)

    # ---- ROAR : passage en phase 2, il se cambre, bras écartés, rugit (1,5 s)
    roar = merge(base, {
        'hips': {'r': (-6, 0, 0)},
        'spine': {'r': (-22, 0, 0)}, 'chest': {'r': (-10, 0, 0)}, 'head': {'r': (-30, 0, 0)},
        'upperarm.L': {'r': (-40, -80, 0)}, 'forearm.L': {'r': (-50, 0, 0)},
        'upperarm.R': {'r': (-40, 80, 0)}, 'forearm.R': {'r': (-50, 0, 0)},
        'belly': {'s': (1.08, 1.08, 1.0)},
    })
    shake = merge(roar, {'head': {'r': (-26, 0, 6)}, 'chest': {'r': (-10, 0, 4)}})
    make_clip(arm, 'roar', 45, {0: rest, 10: roar, 16: shake, 22: roar, 28: shake, 34: roar, 45: rest}, loop=False)

    # ---- DEATH : il tangue, tombe à genoux, puis s'effondre en avant sur son ventre (2 s)
    knees = merge(base, {
        'hips': {'l': (0, 0, -0.45), 'r': (10, 0, 0)},
        'thigh.L': {'r': (-80, 0, 0)}, 'shin.L': {'r': (95, 0, 0)},
        'thigh.R': {'r': (-75, 0, 0)}, 'shin.R': {'r': (95, 0, 0)},
        'spine': {'r': (-6, 0, 6)}, 'head': {'r': (-18, 0, 10)},
        'upperarm.L': {'r': (0, -30, 0)}, 'upperarm.R': {'r': (0, 30, 0)},
    })
    down = merge(knees, {
        'hips': {'l': (0, -0.55, -0.55), 'r': (70, 0, 0)},
        'spine': {'r': (12, 0, 0)}, 'head': {'r': (-30, 0, 20)},
        'upperarm.L': {'r': (-150, -30, 0)}, 'upperarm.R': {'r': (-150, 30, 0)},
        'belly': {'s': (1.1, 1.1, 0.88)},
    })
    make_clip(arm, 'death', 60, {0: rest, 8: hurt, 24: knees, 40: down, 46: merge(down, {'belly': {'s': (0.95, 0.95, 1.05)}}), 60: down}, loop=False)

# ---------------------------------------------------------------- export
build_body()
arm = build_armature()
body = skin(arm)
build_clips(arm)
scene.frame_start, scene.frame_end = 0, 60

os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.export_scene.gltf(
    filepath=os.path.abspath(OUT), export_format='GLB', export_animation_mode='NLA_TRACKS', export_skins=True,
    export_morph=False, export_yup=True, export_force_sampling=True, export_optimize_animation_size=False,
)
tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
print(f'SONNEUR_OK triangles={tris} -> {OUT}')

# ---------------------------------------------------------------- aperçus (Workbench)
if RENDER_DIR:
    os.makedirs(RENDER_DIR, exist_ok=True)
    r = scene.render
    r.engine = 'BLENDER_WORKBENCH'
    r.resolution_x, r.resolution_y = 640, 720
    sh = scene.display.shading
    sh.light = 'STUDIO'
    sh.color_type = 'MATERIAL'
    sh.show_object_outline = True
    world = bpy.data.worlds.new('w')
    scene.world = world
    world.color = (0.55, 0.65, 0.75)
    cam_data = bpy.data.cameras.new('cam')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = 3.3
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    target = Vector((0, 0, 1.3))

    def shoot(fname, yaw_deg, pitch_deg=8, action=None, frame=0):
        ad = arm.animation_data
        for t in ad.nla_tracks:
            t.mute = True
        if action:
            ad.nla_tracks[action].mute = False
            ad.nla_tracks[action].is_solo = True
        scene.frame_set(frame)
        yaw, pitch = math.radians(yaw_deg), math.radians(pitch_deg)
        d = Vector((math.sin(yaw) * math.cos(pitch), -math.cos(yaw) * math.cos(pitch), math.sin(pitch)))
        cam.location = target + d * 8
        cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
        r.filepath = os.path.join(RENDER_DIR, fname)
        bpy.ops.render.render(write_still=True)
        if action:
            ad.nla_tracks[action].is_solo = False

    shoot('face.png', 0, action='idle')
    shoot('trois_quarts.png', -35, 12, action='idle')
    shoot('profil.png', 90, action='idle')
    shoot('dos.png', 180, 15, action='idle')
    for f in (0, 9, 18, 27):
        shoot(f'walk_{f:02d}.png', 70, 5, action='walk', frame=f)
    for f in (14, STRIKE_HIT):
        shoot(f'strike_{f:02d}.png', 70, 5, action='strike', frame=f)
    shoot('push.png', 70, 5, action='push', frame=16)
    shoot('roar.png', -25, 5, action='roar', frame=10)
    shoot('death.png', 70, 10, action='death', frame=60)
    print('RENDERS_OK', RENDER_DIR)
