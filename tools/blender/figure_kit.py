"""
Outils communs des modèles « sculptés » (tools/blender/sonneur.py, tools/blender/abbe.py) : volumes de base, fusion en
une seule surface (remaillage en voxels, lissage, allègement), couleurs par zone, poids des os par distance, accessoires
rigides, poings, animation par directions des os.

Le script qui l'importe donne sa palette et son squelette : `figure_kit.PALETTE = {...}` et `figure_kit.B = {...}`
(nom de l'os : (tête, queue, parent)), avant de construire. Les objets prêts s'accumulent dans `FINAL`.
"""
import math

import bmesh
import bpy
from mathutils import Euler, Matrix, Quaternion, Vector
from mathutils.bvhtree import BVHTree

TAU = math.tau
V = Vector
PALETTE = {}
B = {}
MATS = {}
FINAL = []

# Bras animés par directions (pose_quats) : chaîne des os, du buste à la main
ARM_CHAIN = [('upperarm.L', None), ('forearm.L', 'upperarm.L'), ('hand.L', 'forearm.L'),
             ('upperarm.R', None), ('forearm.R', 'upperarm.R'), ('hand.R', 'forearm.R')]


def rest_dir(name):
    return (Vector(B[name][1]) - Vector(B[name][0])).normalized()


def pose_quats(pose):
    """Rotation de chaque os (dans les axes de l'armature au repos) pour une pose (voir make_clip)."""
    out, acc = {}, {}
    for name, parent in ARM_CHAIN:
        d = pose.get(name, {})
        pq = acc.get(parent, Quaternion())
        if 'dir' in d:
            target = pq.inverted() @ norm(d['dir'])
            q = rest_dir(name).rotation_difference(target)
            if 'roll' in d:
                q = q @ Quaternion(rest_dir(name), math.radians(d['roll']))
        else:
            q = Euler([math.radians(a) for a in d.get('r', (0, 0, 0))], 'XYZ').to_quaternion()
        out[name] = q
        acc[name] = pq @ q
    for name in B:
        if name not in out:
            out[name] = Euler([math.radians(a) for a in pose.get(name, {}).get('r', (0, 0, 0))], 'XYZ').to_quaternion()
    return out


def build_armature(name):
    arm_data = bpy.data.armatures.new(name)
    arm = bpy.data.objects.new(name, arm_data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    for bname, (h, t, parent) in B.items():
        eb = arm_data.edit_bones.new(bname)
        eb.head, eb.tail = h, t
        eb.roll = 0
    for bname, (h, t, parent) in B.items():
        if parent:
            eb = arm_data.edit_bones[bname]
            eb.parent = arm_data.edit_bones[parent]
            eb.use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    return arm


def assemble(arm, name):
    body = join(FINAL, name)
    body.data.name = name
    body.parent = arm
    body.modifiers.new('Armature', 'ARMATURE').object = arm
    return body


def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


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


def norm(v):
    return Vector(v).normalized()


def mx(v, s):
    """Symétrie gauche (s = 1) / droite (s = -1)."""
    return Vector((v[0] * s, v[1], v[2]))


def _obj(bm, name='p'):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def rot_of(basis):
    """Matrice de rotation dont les colonnes sont les trois axes donnés."""
    ex, ey, ez = (Vector(a) for a in basis)
    return Matrix((ex, ey, ez)).transposed().to_4x4()


def basis_from(axis):
    """Repère (axe, u, v) autour d'un axe."""
    a = norm(axis)
    ref = Vector((0, 0, 1)) if abs(a.z) < 0.9 else Vector((1, 0, 0))
    u = (ref - a * ref.dot(a)).normalized()
    return a, u, a.cross(u)


def ell(center, size, rot=(0, 0, 0), basis=None, seg=16, rings=10, cut_z=None):
    """Ellipsoïde ; `basis` : ses trois axes ; `cut_z` : coupé à plat sous cette hauteur."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0)
    R = rot_of(basis) if basis else Euler([math.radians(a) for a in rot]).to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=Matrix.Translation(center) @ R @ Matrix.Diagonal((*size, 1)), verts=bm.verts)
    if cut_z is not None:
        res = bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, cut_z), plane_no=(0, 0, 1), clear_inner=True)
        bmesh.ops.edgeloop_fill(bm, edges=[e for e in res['geom_cut'] if isinstance(e, bmesh.types.BMEdge)])
    return _obj(bm)


def cone(a, b, r1, r2, seg=14, scale_y=1.0):
    a, b = Vector(a), Vector(b)
    d = b - a
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r1, radius2=r2, depth=d.length)
    R = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=Matrix.Translation((a + b) / 2) @ R @ Matrix.Diagonal((1, scale_y, 1, 1)), verts=bm.verts)
    return _obj(bm)


def cap(a, b, r1, r2):
    """Capsule (cône fermé par deux boules) : une liste de volumes."""
    return [cone(a, b, r1, r2), ell(a, (r1, r1, r1), seg=12, rings=8), ell(b, (r2, r2, r2), seg=12, rings=8)]


def tube(pts, radii, seg=8, closed=False, flat=(1.0, 1.0)):
    """Tube le long d'une ligne brisée (repère transporté, sans torsion) ; `flat` : écrase la section."""
    pts = [Vector(p) for p in pts]
    n = len(pts)
    if isinstance(radii, (int, float)):
        radii = [radii] * n
    bm = bmesh.new()
    rings, nprev = [], None
    for i, p in enumerate(pts):
        t = (pts[(i + 1) % n] - pts[i - 1]).normalized() if closed else (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
        if nprev is None:
            ref = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
            nn = (ref - t * ref.dot(t)).normalized()
        else:
            nn = (nprev - t * nprev.dot(t)).normalized()
        nprev = nn
        b = t.cross(nn)
        rings.append([bm.verts.new(p + (nn * math.cos(k / seg * TAU) * flat[0] + b * math.sin(k / seg * TAU) * flat[1]) * radii[i]) for k in range(seg)])
    for i in range(n if closed else n - 1):
        j = (i + 1) % n
        for k in range(seg):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % seg], rings[j][(k + 1) % seg], rings[j][k]))
    if not closed:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])
    return _obj(bm)


def lathe(profile, origin, axis, seg=16):
    """Révolution d'un profil [(rayon, position le long de l'axe)] autour de `axis` ; rayon 0 : pôle."""
    a, u, v = basis_from(axis)
    o = Vector(origin)
    bm = bmesh.new()
    rings = []
    for r, t in profile:
        c = o + a * t
        rings.append([bm.verts.new(c)] if r == 0 else [bm.verts.new(c + (u * math.cos(k / seg * TAU) + v * math.sin(k / seg * TAU)) * r) for k in range(seg)])
    for ra, rb in zip(rings, rings[1:]):
        for k in range(seg):
            if len(ra) == 1 and len(rb) == 1:
                continue
            if len(ra) == 1:
                bm.faces.new((ra[0], rb[(k + 1) % seg], rb[k]))
            elif len(rb) == 1:
                bm.faces.new((ra[k], ra[(k + 1) % seg], rb[0]))
            else:
                bm.faces.new((ra[k], ra[(k + 1) % seg], rb[(k + 1) % seg], rb[k]))
    return _obj(bm)


def box(center, size, basis=None, rot=(0, 0, 0), bevel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    if bevel > 0:
        bmesh.ops.transform(bm, matrix=Matrix.Diagonal((*size, 1)), verts=bm.verts)
        bmesh.ops.bevel(bm, geom=bm.verts[:] + bm.edges[:], offset=bevel, segments=2, affect='EDGES', profile=0.5)
        S = Matrix.Identity(4)
    else:
        S = Matrix.Diagonal((*size, 1))
    R = rot_of(basis) if basis else Euler([math.radians(a) for a in rot]).to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=Matrix.Translation(center) @ R @ S, verts=bm.verts)
    return _obj(bm)


def flat(*items):
    out = []
    for it in items:
        out.extend(flat(*it) if isinstance(it, (list, tuple)) else [it])
    return out


def join(objs, name):
    objs = flat(objs)
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    return o


def in_ell(p, c, size, k=1.0):
    return ((p.x - c[0]) / size[0]) ** 2 + ((p.y - c[1]) / size[1]) ** 2 + ((p.z - c[2]) / size[2]) ** 2 < k * k


def seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
    return (p - (a + ab * t)).length


def weigh(obj, bones, power=6.0, override=None):
    """Poids par distance aux os permis (les 3 plus proches) ; un seul os : pièce rigide."""
    me = obj.data
    groups = {b: obj.vertex_groups.new(name=b) for b in bones}
    if len(bones) == 1:
        groups[bones[0]].add(range(len(me.vertices)), 1.0, 'REPLACE')
        return
    segs = [(b, Vector(B[b][0]), Vector(B[b][1])) for b in bones]
    for v in me.vertices:
        forced = override(v.co) if override else None
        if forced:
            groups[forced].add([v.index], 1.0, 'REPLACE')
            continue
        ws = sorted(((1.0 / (seg_dist(v.co, a, b) + 1e-4) ** power, n) for n, a, b in segs), reverse=True)[:3]
        total = sum(w for w, _ in ws)
        for w, n in ws:
            if w / total > 0.02:
                groups[n].add([v.index], w / total, 'REPLACE')


def paint(obj, default, rules=()):
    """Matériau de chaque face : la première règle (matériau, test(centre, normale)) qui colle, sinon `default`."""
    me = obj.data
    me.materials.clear()
    names = [default] + [m for m, _ in rules if m != default]
    names = list(dict.fromkeys(names))
    for n in names:
        me.materials.append(mat(n))
    for p in me.polygons:
        p.use_smooth = True
        p.material_index = 0
        for m, test in rules:
            if test(p.center, p.normal):
                p.material_index = names.index(m)
                break


def evaluated(obj):
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    me = bpy.data.meshes.new_from_object(obj.evaluated_get(dg))
    obj.modifiers.clear()
    old = obj.data
    obj.data = me
    bpy.data.meshes.remove(old)


def sculpt(name, parts, voxel, smooth, tris, post=None):
    """Fusionne les volumes en une seule surface, la lisse et l'allège à environ `tris` triangles."""
    obj = join(parts, name)
    m = obj.modifiers.new('remesh', 'REMESH')
    m.mode = 'VOXEL'
    m.voxel_size = voxel
    m.adaptivity = 0
    if smooth:
        s = obj.modifiers.new('smooth', 'SMOOTH')
        s.factor = 0.5
        s.iterations = smooth
    evaluated(obj)
    n = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    if n > tris:
        d = obj.modifiers.new('decimate', 'DECIMATE')
        d.ratio = tris / n
        evaluated(obj)
    if post:
        post(obj)
    return obj


def bvh_of(obj):
    me = obj.data
    return BVHTree.FromPolygons([v.co.copy() for v in me.vertices], [tuple(p.vertices) for p in me.polygons])


def hard(obj, material, bone, smooth=False):
    """Accessoire rigide : un matériau, un os."""
    obj = join(obj, 'acc')
    obj.data.materials.clear()
    obj.data.materials.append(mat(material))
    for p in obj.data.polygons:
        p.use_smooth = smooth
    weigh(obj, [bone])
    FINAL.append(obj)
    return obj


def surface_frame(n, up=(0, 0, 1)):
    """Repère posé sur une surface de normale `n` : (tangente vers `up`, côté, normale)."""
    n = norm(n)
    t = Vector(up) - n * Vector(up).dot(n)
    t = t.normalized() if t.length > 1e-4 else basis_from(n)[1]
    return t, n.cross(t), n


def nail(tip, d, back, bone):
    hard(ell(tip - d * 0.012 + back * 0.022, (0.03, 0.026, 0.012), basis=(d, d.cross(back), back), seg=8, rings=6), 'ongle', bone, smooth=True)


def fist(name, bone, wr, fa, grip, h, u, v):
    """Poing fermé sur un manche d'axe `h` en `grip` ; `u` : côté de la paume (vers le poignet ou le dos de la main)."""
    parts = [cap(wr - fa * 0.10, grip + u * 0.06, 0.115, 0.125), ell(grip + u * 0.07, (0.125, 0.135, 0.185), basis=(u, v, h))]
    for k in range(4):
        c = grip + h * ((k - 1.5) * 0.086)
        pts = [c + (u * math.cos(a) + v * math.sin(a)) * 0.098 for a in (math.radians(60 + i * 30) for i in range(9))]
        parts.append(tube(pts, 0.05, seg=10))
        parts += [ell(pts[0], (0.05,) * 3, seg=10, rings=7), ell(pts[-1], (0.05,) * 3, seg=10, rings=7)]
    parts += cap(grip + u * 0.11 - h * 0.12, grip - u * 0.05 + v * 0.095 - h * 0.215, 0.058, 0.045)   # pouce par-dessus
    obj = sculpt(name, parts, voxel=0.011, smooth=2, tris=2400)
    paint(obj, 'peau', [('peau_fonce', lambda c, nn: (c - grip).dot(u) < -0.105)])   # jointures
    weigh(obj, [bone])
    FINAL.append(obj)


def make_clip(arm, name, length, keys, loop):
    action = bpy.data.actions.new(name)
    arm.animation_data_create()
    arm.animation_data.action = action
    prev = {}
    for f in sorted(keys):
        pose = keys[f]
        quats = pose_quats(pose)
        for pb in arm.pose.bones:
            d = pose.get(pb.name, {})
            M = pb.bone.matrix_local.to_3x3().to_quaternion()
            q = M.inverted() @ quats[pb.name] @ M
            if pb.name in prev and prev[pb.name].dot(q) < 0:
                q.negate()
            prev[pb.name] = q.copy()
            pb.rotation_mode = 'QUATERNION'
            pb.rotation_quaternion = q
            pb.location = pb.bone.matrix_local.to_3x3().inverted() @ Vector(d.get('l', (0, 0, 0)))
            pb.scale = d.get('s', (1, 1, 1))
            for path in ('rotation_quaternion', 'location', 'scale'):
                pb.keyframe_insert(path, frame=f)
    try:
        from bpy_extras import anim_utils
        fcurves = anim_utils.action_get_channelbag_for_slot(action, arm.animation_data.action_slot).fcurves
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
