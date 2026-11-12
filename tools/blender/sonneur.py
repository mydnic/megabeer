"""
Le Frère Sonneur (boss de 5:00 de l'Abbaye) : un ogre moine zombie, énorme ventre sous la bure, tonsure, mâchoire
prognathe et défenses, une cloche à la main gauche et un grand maillet de sonneur dans la droite. Modèle, squelette et animations générés par script.

    blender -b --factory-startup -P tools/blender/sonneur.py -- --out src/assets/models/sonneur.glb [--render DIR]

Méthode : chaque partie organique (tête, mains, jambes, bure) est d'abord ébauchée en volumes simples, puis
FUSIONNÉE en une seule surface par remaillage en voxels, lissée (les jonctions se fondent comme sur une sculpture)
et allégée. La bure reçoit ensuite ses plis et son ourlet déchiré, les couleurs sont posées par zone, et les
poids des os sont calculés par distance (membres souples). Les accessoires (corde, chapelet, clochettes, pièces
cousues, maillet riveté, sandales) sont posés sur la surface obtenue par lancer de rayons.

Repère Blender : Z en haut, il regarde vers -Y (devient +Z dans le glTF). Pose de repos : bras écartés (pose en A),
le maillet dans la main droite (-X), une cloche à main dans la gauche. Animations : idle, walk, strike (le maillet
frappe la cloche à l'image STRIKE_HIT), hit, roar, death.
"""
import bpy
import bmesh
import math
import sys
import os
from mathutils import Vector, Matrix, Euler, Quaternion
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default=None):
    return argv[argv.index(name) + 1] if name in argv else default
OUT = arg('--out', 'sonneur.glb')
RENDER_DIR = arg('--render')
FPS = 30
# Image où le maillet frappe la cloche dans le clip strike (le jeu cale l'onde dessus)
STRIKE_HIT = 30
TAU = math.tau

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = FPS

# ---------------------------------------------------------------- palette
PALETTE = {
    'peau':       (0.56, 0.68, 0.46),
    'peau_fonce': (0.40, 0.50, 0.34),
    'levre':      (0.43, 0.47, 0.36),
    'bure':       (0.45, 0.30, 0.19),
    'bure_fonce': (0.32, 0.21, 0.13),
    'ombre':      (0.12, 0.08, 0.06),
    'piece':      (0.58, 0.44, 0.26),
    'fil':        (0.16, 0.12, 0.10),
    'corde':      (0.84, 0.72, 0.46),
    'cuir':       (0.34, 0.20, 0.11),
    'cheveux':    (0.30, 0.25, 0.21),
    'oeil':       (1.00, 0.82, 0.15),
    'pupille':    (0.10, 0.04, 0.03),
    'ivoire':     (0.94, 0.90, 0.76),
    'ongle':      (0.25, 0.27, 0.20),
    'bouche':     (0.25, 0.06, 0.08),
    'bois':       (0.58, 0.37, 0.20),
    'bois_fonce': (0.38, 0.23, 0.12),
    'fer':        (0.44, 0.46, 0.50),
    'laiton':     (0.88, 0.66, 0.22),
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

V = Vector
def norm(v):
    return Vector(v).normalized()
def mx(v, s):
    """Symétrie gauche (s = 1) / droite (s = -1)."""
    return Vector((v[0] * s, v[1], v[2]))

# ---------------------------------------------------------------- points clés du squelette (pose en A)
UA = norm((0.788, 0, -0.616))          # haut du bras gauche
FA = norm((0.752, -0.15, -0.642))      # avant-bras gauche
SH = V((0.66, 0, 1.80))
EL = SH + UA * 0.52
WR = EL + FA * 0.50
HEAD_C = V((0, -0.16, 2.14))
HEAD_SCALE = 1.2           # centre de la tête (cou tendu vers l'avant : il est voûté)
# Poigne du maillet (main droite) : le manche part vers l'avant, un peu dans l'axe de l'avant-bras
FAR = mx(FA, -1)
GRIP = mx(WR, -1) + FAR * 0.20
HANDLE = norm(V((0, -0.85, 0)) + FAR * 0.45)

B = {
    'hips':       ((0, 0, 0.92), (0, 0, 1.18), None),
    'spine':      ((0, 0, 1.18), (0, 0, 1.55), 'hips'),
    'belly':      ((0, -0.18, 1.20), (0, -0.62, 1.20), 'spine'),
    'chest':      ((0, 0, 1.55), (0, 0, 1.88), 'spine'),
    'head':       ((0, -0.04, 1.88), (0, -0.16, 2.42), 'chest'),
    'thigh.L':    ((0.28, 0, 0.92), (0.30, -0.02, 0.52), 'hips'),
    'shin.L':     ((0.30, -0.02, 0.52), (0.31, 0.02, 0.17), 'thigh.L'),
    'foot.L':     ((0.31, 0.02, 0.17), (0.31, -0.25, 0.06), 'shin.L'),
    'thigh.R':    ((-0.28, 0, 0.92), (-0.30, -0.02, 0.52), 'hips'),
    'shin.R':     ((-0.30, -0.02, 0.52), (-0.31, 0.02, 0.17), 'thigh.R'),
    'foot.R':     ((-0.31, 0.02, 0.17), (-0.31, -0.25, 0.06), 'shin.R'),
}
for s, side in ((1, 'L'), (-1, 'R')):
    B[f'upperarm.{side}'] = (tuple(mx(SH, s)), tuple(mx(EL, s)), 'chest')
    B[f'forearm.{side}'] = (tuple(mx(EL, s)), tuple(mx(WR, s)), f'upperarm.{side}')
    B[f'hand.{side}'] = (tuple(mx(WR, s)), tuple(mx(WR, s) + mx(FA, s) * 0.24), f'forearm.{side}')
B['mallet'] = (tuple(GRIP), tuple(GRIP + HANDLE * 0.5), 'hand.R')

# ---------------------------------------------------------------- volumes de base (objets fermés)
def _obj(bm, name='p'):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    scene.collection.objects.link(obj)
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

# ---------------------------------------------------------------- sculpture : fusion, lissage, allègement, couleurs, poids
FINAL = []   # objets prêts (matériaux et poids posés)

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

def weigh_robe(obj):
    """Bure : jupe sur le bassin, tronc par distance aux os du tronc, manches par distance aux os du bras (fondu à l'épaule)."""
    torso = ['hips', 'spine', 'belly', 'chest']
    groups = {b: obj.vertex_groups.new(name=b) for b in torso + ['upperarm.L', 'forearm.L', 'upperarm.R', 'forearm.R']}
    def by_dist(p, bones, power):
        ws = [(1.0 / (seg_dist(p, Vector(B[b][0]), Vector(B[b][1])) + 1e-4) ** power, b) for b in bones]
        total = sum(w for w, _ in ws)
        return {b: w / total for w, b in ws}
    for vt in obj.data.vertices:
        p = vt.co
        w = {'hips': 1.0} if p.z < 0.82 and abs(p.x) < 0.95 else by_dist(p, torso, 5)
        for s, side in ((1, 'L'), (-1, 'R')):
            sh, el, wr, ua = mx(SH, s), mx(EL, s), mx(WR, s) + mx(FA, s) * 0.05, mx(UA, s)
            along = (p - sh).dot(ua)
            # Manche : un tube étroit autour du bras, qui s'élargit vers le poignet (la manche évasée qui pend)
            t = max(0.0, min(1.0, (p - el).dot(wr - el) / (wr - el).length_squared))
            if along <= 0.08 or min(seg_dist(p, sh, el) / 0.29, seg_dist(p, el, wr) / (0.27 + 0.2 * t)) >= 1:
                continue
            r = min(1.0, (along - 0.08) / 0.3)
            r = r * r * (3 - 2 * r)
            wa = by_dist(p, [f'upperarm.{side}', f'forearm.{side}'], 6)
            w = {b: x * (1 - r) for b, x in w.items()}
            for b, x in wa.items():
                w[b] = w.get(b, 0) + x * r
        for b, x in w.items():
            if x > 0.02:
                groups[b].add([vt.index], x, 'REPLACE')

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

# ---------------------------------------------------------------- la tête
def build_head():
    C = HEAD_C
    def P(x, y, z):
        return C + Vector((x, y, z))
    parts = [
        ell(P(0, 0.02, 0.06), (0.25, 0.27, 0.24)),                       # crâne
        ell(P(0, 0.19, -0.10), (0.22, 0.17, 0.15)),                      # nuque
        ell(P(0, 0.25, -0.20), (0.25, 0.12, 0.07)),                      # bourrelets de la nuque
        ell(P(0, 0.22, -0.31), (0.24, 0.12, 0.07)),
        ell(P(0, -0.20, 0.075), (0.235, 0.09, 0.05)),                    # arcade sourcilière, lourde
        ell(P(0, -0.25, 0.0), (0.05, 0.06, 0.075)),                      # arête du nez
        ell(P(0, -0.315, -0.045), (0.075, 0.07, 0.062)),                 # bout du nez, en patate
        ell(P(0, -0.235, -0.125), (0.175, 0.10, 0.06)),                  # lèvre du haut
        ell(P(0, -0.16, -0.225), (0.275, 0.225, 0.135)),                 # mâchoire massive
        ell(P(0, -0.335, -0.19), (0.165, 0.062, 0.05)),                  # lèvre du bas, en avant (prognathe)
        ell(P(0, -0.305, -0.29), (0.125, 0.08, 0.07)),                   # menton
        ell(P(0, -0.12, -0.33), (0.20, 0.17, 0.08)),                     # double menton
        cap(P(0, 0.08, -0.36), P(0, 0.02, -0.16), 0.23, 0.21),           # cou de taureau
        ell(P(0.07, -0.305, 0.045), (0.018, 0.018, 0.018), seg=8, rings=6),   # verrues
        ell(P(-0.13, -0.26, -0.085), (0.02, 0.02, 0.02), seg=8, rings=6),
        ell(P(-0.035, -0.375, -0.04), (0.017, 0.017, 0.017), seg=8, rings=6),
    ]
    for s in (1, -1):
        parts += [
            ell(P(0.115 * s, -0.238, 0.092), (0.092, 0.05, 0.042), rot=(0, 16 * s, 0)),   # bosse du sourcil, froncée
            ell(P(0.155 * s, -0.185, -0.055), (0.092, 0.092, 0.072)),                     # pommette
            ell(P(0.105 * s, -0.235, -0.028), (0.052, 0.035, 0.02)),                      # poche sous l'oeil
            ell(P(0.105 * s, -0.238, 0.05), (0.062, 0.04, 0.028)),                        # paupière tombante
            ell(P(0.058 * s, -0.28, -0.062), (0.042, 0.042, 0.036)),                      # aile du nez
            ell(P(0.20 * s, -0.09, -0.175), (0.10, 0.135, 0.125)),                        # bajoue
            ell(P(0.262 * s, 0.01, 0.02), (0.042, 0.075, 0.125), rot=(-12, 26 * s, 0)),   # oreille
        ]
    # Oreille en pointe à gauche, déchirée (plus courte) à droite
    parts.append(ell(P(0.325, 0.045, 0.15), (0.026, 0.045, 0.085), rot=(-18, 30, 0)))
    parts.append(ell(P(-0.305, 0.03, 0.10), (0.03, 0.045, 0.045), rot=(-18, -30, 0)))
    first = len(FINAL)
    head = sculpt('tete', parts, voxel=0.011, smooth=5, tris=5200)
    paint(head, 'peau')
    weigh(head, ['head'])
    FINAL.append(head)
    bvh = bvh_of(head)
    # Grosse lèvre du bas, plus sombre : une pièce à part (bord net)
    lip = sculpt('levre', [ell(P(0, -0.34, -0.188), (0.168, 0.064, 0.05)), ell(P(0.15, -0.30, -0.18), (0.05, 0.05, 0.04)), ell(P(-0.15, -0.30, -0.18), (0.05, 0.05, 0.04))],
                 voxel=0.011, smooth=3, tris=500)
    paint(lip, 'levre')
    weigh(lip, ['head'])
    FINAL.append(lip)

    # Tonsure : couronne de mèches plaquées sur le crâne, d'une oreille à l'autre par la nuque ; le dessus est nu
    for row, (zdir, a0, a1, count) in enumerate(((0.34, 64, 296, 26), (0.12, 70, 290, 24), (-0.08, 84, 276, 20), (-0.26, 100, 260, 14))):
        for i in range(count):
            a = math.radians(a0 + (a1 - a0) * i / (count - 1) + (4 if row % 2 else 0))
            loc, nrm, _, _ = bvh.ray_cast(P(0, 0.04, 0.02), norm((math.sin(a), -math.cos(a), zdir)))
            if loc is None:
                continue
            down, sidev, n = surface_frame(nrm, up=(0, 0, -1))
            lean = norm(down + sidev * (0.35 * math.sin(i * 2.1 + row)))
            hard(ell(loc + n * 0.004 + lean * 0.03, (0.034, 0.017, 0.075 + 0.02 * math.sin(i * 1.3)), basis=(n.cross(lean), n, lean), seg=6, rings=5), 'cheveux', 'head', smooth=True)
    # Sourcils broussailleux : une mèche épaisse qui s'affine vers la tempe
    for s in (1, -1):
        hard(tube([P(0.035 * s, -0.292, 0.118), P(0.09 * s, -0.296, 0.128), P(0.15 * s, -0.276, 0.118), P(0.205 * s, -0.235, 0.092)], [0.02, 0.03, 0.026, 0.01], seg=8), 'cheveux', 'head', smooth=True)

    # Yeux jaunes enfoncés sous l'arcade, pupilles en tête d'épingle
    for s in (1, -1):
        hard(ell(P(0.105 * s, -0.228, 0.014), (0.04, 0.04, 0.04), seg=12, rings=8), 'oeil', 'head', smooth=True)
        hard(ell(P(0.10 * s, -0.264, 0.008), (0.014, 0.008, 0.014), seg=8, rings=6), 'pupille', 'head', smooth=True)
    # Bouche : fente sombre, deux défenses qui montent de la mâchoire (une cassée), chicots
    hard(ell(P(0, -0.285, -0.15), (0.14, 0.05, 0.02)), 'bouche', 'head', smooth=True)
    hard(tube([P(0.118, -0.335, -0.185), P(0.128, -0.36, -0.12), P(0.132, -0.365, -0.055), P(0.125, -0.355, -0.005)], [0.034, 0.03, 0.02, 0.006], seg=8), 'ivoire', 'head', smooth=True)
    hard(tube([P(-0.118, -0.335, -0.185), P(-0.128, -0.36, -0.125), P(-0.13, -0.362, -0.085)], [0.034, 0.03, 0.024], seg=8), 'ivoire', 'head', smooth=True)
    for x, h in ((-0.055, 0.03), (0.0, 0.022), (0.05, 0.034)):
        hard(box(P(x, -0.372, -0.165 + h / 2), (0.034, 0.022, h), bevel=0.006), 'ivoire', 'head')
    # Cicatrice recousue en travers du crâne
    prev = None
    for i in range(6):
        d = norm((0.25 + 0.09 * i, -0.55 + 0.12 * i, 1.0))
        loc, nrm, _, _ = bvh.ray_cast(P(0, 0.02, 0.0), d)
        if loc is None:
            continue
        if prev is not None:
            along = norm(loc - prev)
            mid = (loc + prev) / 2
            hard(box(mid + nrm * 0.004, ((loc - prev).length + 0.01, 0.012, 0.012), basis=(along, nrm.cross(along), nrm)), 'peau_fonce', 'head')
            across = nrm.cross(along)
            hard(box(mid + nrm * 0.008, (0.011, 0.058, 0.011), basis=(along, across, nrm)), 'fil', 'head')
        prev = loc
    # La tête est grossie d'un bloc (elle doit se lire de loin, en vue de dessus)
    pivot = Vector((0, -0.06, 1.90))
    for o in FINAL[first:]:
        for vt in o.data.vertices:
            vt.co = pivot + (vt.co - pivot) * HEAD_SCALE

# ---------------------------------------------------------------- les mains
def nail(tip, d, back, bone):
    hard(ell(tip - d * 0.012 + back * 0.022, (0.03, 0.026, 0.012), basis=(d, d.cross(back), back), seg=8, rings=6), 'ongle', bone, smooth=True)

def build_hands():
    # Main gauche : poing fermé sur le manche de sa cloche à main, qui prolonge l'avant-bras
    h = FA
    up0 = Vector((0, 0, 1))
    u = (up0 - h * up0.dot(h)).normalized()      # dos de la main, vers le haut
    v = h.cross(u)
    grip = WR + h * 0.20
    fist('main.L', 'hand.L', WR, h, grip, h, u, v)
    # La cloche à main : manche de bois, couronne, robe de bronze, lèvre évasée, cordon
    hard(tube([grip - h * 0.13, grip + h * 0.26], 0.042, seg=10), 'bois', 'hand.L', smooth=True)
    hard(ell(grip - h * 0.15, (0.055, 0.055, 0.05), basis=(u, v, h), seg=10, rings=7), 'bois_fonce', 'hand.L', smooth=True)
    c0 = grip + h * 0.26
    body = [(0.0, -0.01), (0.07, 0.0), (0.12, 0.025), (0.155, 0.08), (0.165, 0.16), (0.172, 0.24), (0.20, 0.31),
            (0.255, 0.36), (0.30, 0.395), (0.31, 0.42), (0.27, 0.425), (0.22, 0.40), (0.0, 0.38)]
    hard(lathe(body, c0, h, seg=24), 'laiton', 'hand.L', smooth=True)
    hard(lathe([(0.0, 0.17), (0.176, 0.17), (0.18, 0.2), (0.0, 0.2)], c0, h, seg=24), 'bois_fonce', 'hand.L')
    hard(lathe([(0.0, 0.33), (0.252, 0.335), (0.262, 0.36), (0.0, 0.36)], c0, h, seg=24), 'bois_fonce', 'hand.L')

    # Main droite : poing fermé sur le manche du maillet
    h = HANDLE
    u = (-FAR - h * (-FAR).dot(h)).normalized()   # du manche vers le poignet
    fist('main.R', 'hand.R', mx(WR, -1), FAR, GRIP, h, u, h.cross(u))


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

# ---------------------------------------------------------------- les jambes et les sandales
def build_legs():
    for s, side in ((1, 'L'), (-1, 'R')):
        H, K, A = (mx(B['thigh.L'][0], s), mx(B['thigh.L'][1], s), mx(B['shin.L'][1], s))
        fx = 0.31 * s
        parts = [
            cap(H, K, 0.21, 0.175), cap(K, A, 0.175, 0.135),
            ell((fx, 0.075, 0.37), (0.15, 0.165, 0.2)),                       # mollet
            ell((fx, 0.02, 0.15), (0.135, 0.14, 0.12)),                       # cheville
            ell((fx, -0.13, 0.105), (0.158, 0.275, 0.09), cut_z=0.045),       # pied
            ell((fx, 0.10, 0.09), (0.12, 0.12, 0.07), cut_z=0.045),           # talon
        ]
        toes = []
        for k, (ox, sz) in enumerate(((-0.1 * s, 1.25), (0.012 * s, 1.0), (0.105 * s, 0.9))):   # gros orteil à l'intérieur
            c = Vector((fx + ox, -0.375 + 0.02 * k, 0.085))
            parts.append(ell(c, (0.058 * sz, 0.08 * sz, 0.052 * sz), cut_z=0.045))
            toes.append((c, sz))
        leg = sculpt(f'jambe.{side}', parts, voxel=0.014, smooth=3, tris=1900)
        paint(leg, 'peau')
        weigh(leg, [f'thigh.{side}', f'shin.{side}', f'foot.{side}'], power=5)
        FINAL.append(leg)
        foot = f'foot.{side}'
        for c, sz in toes:
            hard(ell(c + Vector((0, -0.045 * sz, 0.028 * sz)), (0.038 * sz, 0.032 * sz, 0.016), rot=(-25, 0, 0), seg=8, rings=6), 'ongle', foot, smooth=True)
        # Sandale : semelle épaisse, deux brides et un tour de cheville
        hard(box((fx, -0.14, 0.022), (0.37, 0.70, 0.045), bevel=0.018), 'cuir', foot)
        for y, top, half in ((-0.29, 0.205, 0.19), (-0.07, 0.265, 0.19)):
            arc = [Vector((fx + half * math.cos(a), y, 0.03 + (top - 0.03) * math.sin(a))) for a in (math.radians(i * 180 / 10) for i in range(11))]
            hard(tube(arc, 0.03, seg=8, flat=(0.4, 1.7)), 'cuir', foot, smooth=True)
        ring = [Vector((fx + 0.15 * math.cos(a), 0.03 + 0.155 * math.sin(a), 0.235)) for a in (i * TAU / 14 for i in range(14))]
        hard(tube(ring, 0.028, seg=8, closed=True, flat=(1.5, 0.45)), 'cuir', foot, smooth=True)
        hard(ell((fx + 0.15 * s, 0.03, 0.235), (0.02, 0.035, 0.035), seg=8, rings=6), 'laiton', foot, smooth=True)   # boucle

# ---------------------------------------------------------------- la bure
HOOD = [((0, 0.07, 1.975), (0.47, 0.45, 0.15)), ((0, 0.45, 1.93), (0.35, 0.25, 0.30)), ((0, 0.60, 1.74), (0.17, 0.13, 0.20))]
HEM = 0.30

def sleeve_end(s):
    return mx(WR, s) + mx(FA, s) * 0.03

def build_robe():
    parts = [
        cone((0, 0.03, HEM), (0, 0.03, 1.08), 0.84, 0.69, seg=28, scale_y=0.92),   # jupe
        ell((0, -0.31, 1.22), (0.70, 0.79, 0.58), seg=24, rings=16),              # panse, qui retombe sur la corde
        ell((0, 0.30, 1.00), (0.54, 0.34, 0.38)),                                  # fessier
        ell((0, 0.02, 1.62), (0.69, 0.49, 0.43), seg=20, rings=14),               # poitrail
        ell((0, 0.31, 1.80), (0.53, 0.35, 0.31)),                                  # bosse du dos
        ell((0, 0.10, 1.30), (0.66, 0.50, 0.40)),                                  # flancs, dos
        ell((0, 0.02, 1.34), (0.705, 0.52, 0.045)),                                # pli de tissu à la taille
    ]
    for s in (1, -1):
        sh, el, wr, ua, fa = mx(SH, s), mx(EL, s), mx(WR, s), mx(UA, s), mx(FA, s)
        end = sleeve_end(s)
        parts += [
            ell((0.46 * s, 0.07, 1.12), (0.31, 0.38, 0.27)),                       # poignée d'amour
            ell((0.27 * s, -0.30, 1.63), (0.27, 0.21, 0.21)),                      # pectoral flasque
            ell(sh + Vector((0, 0.04, 0.02)), (0.28, 0.26, 0.25)),                 # épaule
            ell((0.31 * s, 0.09, 1.94), (0.26, 0.23, 0.15)),                       # trapèze
            cap(sh, el, 0.235, 0.205), cap(el, wr - fa * 0.14, 0.205, 0.215),      # manche
            cone(wr - fa * 0.2, end, 0.21, 0.305, seg=18),                         # qui s'évase
            ell(end - fa * 0.13 + Vector((0, 0, -0.11)), (0.2, 0.2, 0.21)),        # et pend sous le poignet
            ell(el - ua * 0.09, (0.04, 0.228, 0.228), basis=basis_from(ua)),       # plis au coude
            ell(el + fa * 0.10, (0.04, 0.232, 0.232), basis=basis_from(fa)),
            ell(el + fa * 0.22, (0.035, 0.228, 0.228), basis=basis_from(fa)),
        ]

    def folds(obj):
        """Plis verticaux de la jupe (de plus en plus marqués vers le bas) et ourlet déchiré."""
        me = obj.data
        me.calc_loop_triangles()
        for vt in me.vertices:
            p = vt.co
            if p.z > 0.95 or abs(vt.normal.z) > 0.55:
                continue
            x, y = p.x, p.y - 0.03
            r = math.hypot(x, y)
            if r < 0.3:
                continue
            th = math.atan2(y, x)
            k = max(0.0, min(1.0, (0.95 - p.z) / 0.45))
            k = k * k * (3 - 2 * k)
            amp = 0.05 * k * (math.sin(9 * th + 1.3 * math.sin(2 * th)) + 0.2 * math.sin(4 * th + 1.0))
            p.x += x / r * amp
            p.y += y / r * amp
            if p.z < HEM + 0.07:
                p.z += 0.035 * math.sin(9 * th + 2.0) * min(1.0, (HEM + 0.07 - p.z) / 0.06)
        me.update()

    robe = sculpt('bure', parts, voxel=0.024, smooth=7, tris=9500, post=folds)
    ends = {s: (sleeve_end(s), mx(FA, s)) for s in (1, -1)}
    paint(robe, 'bure', [
        ('ombre', lambda c, n: n.z < -0.6 and c.z < HEM + 0.12 and math.hypot(c.x, c.y) < 0.95),
        ('ombre', lambda c, n: any((c - e).length < 0.31 and n.dot(f) > 0.5 for e, f in ends.values())),
    ])
    weigh_robe(robe)
    FINAL.append(robe)
    # Capuche rabattue (col épais, poche qui pend dans le dos) et revers des manches : pièces à part, plus sombres
    hood = sculpt('capuche', [ell(c, size) for c, size in HOOD], voxel=0.022, smooth=4, tris=1400)
    paint(hood, 'bure_fonce')
    weigh(hood, ['chest'])
    FINAL.append(hood)
    for s, side in ((1, 'L'), (-1, 'R')):
        end, fa = ends[s]
        a, u, v = basis_from(fa)
        hard(tube([end + (u * math.cos(t) + v * math.sin(t)) * 0.30 for t in (i * TAU / 18 for i in range(18))], 0.045, seg=8, closed=True), 'bure_fonce', f'forearm.{side}', smooth=True)
    return bvh_of(robe)

# ---------------------------------------------------------------- accessoires posés sur la bure
def build_trimmings(bvh):
    def hit(origin, direction):
        loc, nrm, _, _ = bvh.ray_cast(Vector(origin), norm(direction))
        return loc, nrm

    # Cordelière : elle fait le tour de la taille et passe sous la panse ; noeud, deux bouts à pompon
    pts = []
    N = 40
    for i in range(N):
        th = i * TAU / N
        front = max(0.0, math.cos(th + math.pi / 2)) ** 2
        loc, nrm = hit((0, 0.05, 1.0 - 0.13 * front), (math.cos(th), math.sin(th), 0))
        pts.append(loc + nrm * 0.03)
    hard(tube(pts, 0.05, seg=8, closed=True), 'corde', 'hips', smooth=True)
    # Torons : petites bagues sombres le long de la corde
    for i in range(0, N, 2):
        t = norm(pts[(i + 1) % N] - pts[i - 1])
        hard(ell(pts[i], (0.012, 0.056, 0.056), basis=basis_from(t), seg=8, rings=6), 'piece', 'hips', smooth=True)
    knot = pts[int(N * 0.83)]          # devant, sur sa gauche
    out = norm((knot.x, knot.y, 0))
    hard(ell(knot + out * 0.04, (0.11, 0.09, 0.10), basis=(out.cross(Vector((0, 0, 1))), out, Vector((0, 0, 1)))), 'corde', 'hips', smooth=True)
    for dx, length in ((-0.05, 0.50), (0.06, 0.36)):
        sidev = out.cross(Vector((0, 0, 1)))
        p0 = knot + out * 0.07 + sidev * dx
        path = [p0, p0 + out * 0.05 + Vector((0, 0, -length * 0.4)), p0 + out * 0.03 + sidev * dx * 0.5 + Vector((0, 0, -length))]
        hard(tube(path, 0.036, seg=8), 'corde', 'hips', smooth=True)
        end = path[-1]
        hard(ell(end, (0.055, 0.055, 0.045), seg=10, rings=7), 'piece', 'hips', smooth=True)
        hard(lathe([(0, 0.0), (0.05, -0.01), (0.075, -0.16), (0, -0.165)], end, (0, 0, 1), seg=10), 'corde', 'hips', smooth=True)
    # Deux clochettes de sonneur pendues à la corde, sur sa droite
    for idx, size in ((int(N * 0.60), 1.0), (int(N * 0.66), 0.72)):
        p = pts[idx]
        o = norm((p.x, p.y, 0))
        top = p + o * 0.06 + Vector((0, 0, -0.07))
        hard(tube([p + o * 0.04, top], 0.014, seg=6), 'cuir', 'hips')
        prof = [(0, 0.0), (0.035, -0.005), (0.06, -0.04), (0.066, -0.10), (0.085, -0.135), (0.092, -0.15), (0.0, -0.145)]
        hard(lathe([(r * size, t * size) for r, t in prof], top, (0, 0, 1), seg=12), 'laiton', 'hips', smooth=True)
        hard(ell(top + Vector((0, 0, -0.155 * size)), (0.022 * size,) * 3, seg=8, rings=6), 'fer', 'hips', smooth=True)

    # Chapelet de grosses perles de bois autour du cou, petite croix sur le poitrail
    for i in range(13):
        a = math.radians(-84 + i * 14)
        x, z = 0.37 * math.sin(a), 1.925 - 0.36 * math.cos(a)
        loc, nrm = hit((0, 0.1, z), (x, -0.5, 0))
        if loc is None:
            continue
        hard(ell(loc + nrm * 0.028, (0.043,) * 3, seg=8, rings=6), 'bois' if i % 2 else 'bois_fonce', 'chest', smooth=True)
    loc, nrm = hit((0, 0.1, 1.45), (0, -1, 0))
    t, b, n = surface_frame(nrm)
    c = loc + n * 0.03
    hard(box(c, (0.24, 0.055, 0.035), basis=(t, b, n), bevel=0.01), 'bois', 'chest')
    hard(box(c + t * 0.045, (0.055, 0.16, 0.036), basis=(t, b, n), bevel=0.01), 'bois', 'chest')
    hard(tube([loc + n * 0.02 + t * 0.21, c + t * 0.11], 0.012, seg=6), 'fil', 'chest')

    # Pièces cousues à gros points
    for origin, direction, size in (((0, -0.2, 1.22), (0.66, -0.72, 0.05), (0.15, 0.12)), ((0, -0.2, 1.3), (-0.5, -0.8, 0.3), (0.11, 0.13)),
                                    ((0, 0.2, 1.5), (-0.5, 0.85, 0.1), (0.14, 0.12))):
        loc, nrm = hit(origin, direction)
        if loc is None:
            continue
        t, b, n = surface_frame(nrm)
        bone = 'hips' if loc.z < 0.82 else ('belly' if loc.y < -0.5 else 'spine')
        hard(ell(loc - n * 0.012, (size[0], size[1], 0.04), basis=(t, b, n), seg=12, rings=8), 'piece', bone, smooth=True)
        for k in range(8):
            a = k * TAU / 8 + 0.3
            radial = t * math.cos(a) + b * math.sin(a)
            q = loc + t * (math.cos(a) * size[0] * 0.82) + b * (math.sin(a) * size[1] * 0.82)
            l2, n2 = hit(origin, q - Vector(origin))
            if l2 is None:
                continue
            r2 = (radial - n2 * radial.dot(n2)).normalized()
            hard(box(l2 + n2 * 0.024, (0.04, 0.012, 0.008), basis=(r2, n2.cross(r2), n2)), 'fil', bone)

# ---------------------------------------------------------------- le maillet
def build_mallet():
    h = HANDLE
    hard(tube([GRIP - h * 0.42, GRIP + h * 1.16], 0.047, seg=10), 'bois', 'mallet', smooth=True)
    # Bandes de cuir sous la poigne, pommeau de fer
    for k in range(7):
        c = GRIP + h * (-0.30 + k * 0.1)
        hard(lathe([(0, -0.045), (0.056, -0.04), (0.058, 0.0), (0.056, 0.04), (0, 0.045)], c, h, seg=10), 'cuir', 'mallet', smooth=True)
    hard(ell(GRIP - h * 0.45, (0.075, 0.075, 0.06), basis=(basis_from(h)[1], basis_from(h)[2], h), seg=12, rings=8), 'fer', 'mallet', smooth=True)
    hard(lathe([(0, 1.13), (0.075, 1.135), (0.075, 1.17), (0, 1.175)], GRIP, h, seg=10), 'fer', 'mallet')
    # Tête : gros fût de bois couché en travers du manche, cerclé de fer à chaque bout, rivets, faces ferrées
    m = h.cross(Vector((0, 0, 1))).normalized()
    hc = GRIP + h * 0.98
    barrel = [(0, -0.34), (0.20, -0.34), (0.228, -0.26), (0.252, -0.10), (0.252, 0.10), (0.228, 0.26), (0.20, 0.34), (0, 0.34)]
    hard(lathe(barrel, hc, m, seg=20), 'bois', 'mallet', smooth=True)
    a, u, v = basis_from(m)
    for sgn in (1, -1):
        t0, t1 = 0.17 * sgn, 0.30 * sgn
        lo, hi = min(t0, t1), max(t0, t1)
        hard(lathe([(0, lo), (0.262, lo), (0.262, hi), (0, hi)], hc, m, seg=20), 'fer', 'mallet')
        hard(lathe([(0, 0.335 * sgn), (0.165, 0.335 * sgn), (0.15, 0.365 * sgn), (0, 0.37 * sgn)] if sgn > 0 else
                   [(0, -0.37), (0.15, -0.365), (0.165, -0.335), (0, -0.335)], hc, m, seg=16), 'fer', 'mallet')
        for k in range(8):
            ang = k * TAU / 8
            hard(ell(hc + m * (0.235 * sgn) + (u * math.cos(ang) + v * math.sin(ang)) * 0.262, (0.026,) * 3, seg=8, rings=6), 'laiton', 'mallet', smooth=True)
    # Douelles : traits sombres le long du fût
    for k in range(10):
        ang = k * TAU / 10 + 0.3
        hard(box(hc + (u * math.cos(ang) + v * math.sin(ang)) * 0.249, (0.33, 0.012, 0.012),
                 basis=(m, (u * -math.sin(ang) + v * math.cos(ang)), (u * math.cos(ang) + v * math.sin(ang)))), 'bois_fonce', 'mallet')

# ---------------------------------------------------------------- armature, assemblage
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

def assemble(arm):
    body = join(FINAL, 'Sonneur')
    body.data.name = 'Sonneur'
    body.parent = arm
    body.modifiers.new('Armature', 'ARMATURE').object = arm
    return body

# ---------------------------------------------------------------- animation
# Tronc, tête, jambes : angles d'Euler dans le repère du personnage (degrés), comme buveur.py :
#   x > 0 : penche vers l'avant (os qui monte) / recule (os qui descend) ; y > 0 : le haut bascule vers sa gauche ;
#   z > 0 : tourne vers sa gauche.
# Bras : 'dir' = direction voulue de l'os dans le repère du buste (x : sa gauche, -y : devant, z : haut). Le bras
# part de sa pose de repos par le plus court chemin ; l'avant-bras et la main suivent le bras s'ils n'ont pas de 'dir'.
ARM_CHAIN = [('upperarm.L', None), ('forearm.L', 'upperarm.L'), ('hand.L', 'forearm.L'),
             ('upperarm.R', None), ('forearm.R', 'upperarm.R'), ('hand.R', 'forearm.R')]
REST_DIR = {n: (Vector(B[n][1]) - Vector(B[n][0])).normalized() for n in B}

def pose_quats(pose):
    """Rotation de chaque os (dans les axes de l'armature au repos) pour une pose."""
    out, acc = {}, {}
    for name, parent in ARM_CHAIN:
        d = pose.get(name, {})
        pq = acc.get(parent, Quaternion())
        if 'dir' in d:
            target = pq.inverted() @ norm(d['dir'])
            q = REST_DIR[name].rotation_difference(target)
            if 'roll' in d:
                q = q @ Quaternion(REST_DIR[name], math.radians(d['roll']))
        else:
            q = Euler([math.radians(a) for a in d.get('r', (0, 0, 0))], 'XYZ').to_quaternion()
        out[name] = q
        acc[name] = pq @ q
    for name in B:
        if name not in out:
            out[name] = Euler([math.radians(a) for a in pose.get(name, {}).get('r', (0, 0, 0))], 'XYZ').to_quaternion()
    return out

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

def arms(lu, lf, ru, rf, mallet=(0, 0, 0)):
    return {'upperarm.L': {'dir': lu}, 'forearm.L': {'dir': lf}, 'upperarm.R': {'dir': ru}, 'forearm.R': {'dir': rf}, 'mallet': {'r': mallet}}

def build_clips(arm):
    # Bras ballants, lourds ; le maillet pend au bout du bras droit, la tête en avant, près du sol
    def hang(sw=0.0):
        return arms((0.34, 0.06 - sw, -1), (0.22, -0.28 - sw, -1), (-0.36, 0.10 + sw * 0.5, -1), (-0.30, -0.30 + sw * 0.5, -1))
    base = merge(hang(), {'spine': {'r': (5, 0, 0)}})

    # ---- IDLE : il souffle, la panse gonfle, la tête dodeline (2 s)
    L = 60
    idle = {}
    for i in range(5):
        ph = i / 4 * TAU
        s, br = math.sin(ph), math.sin(ph * 2)
        idle[i * L // 4] = merge(hang(0.03 * s), {
            'hips': {'r': (0, 2 * s, 0), 'l': (0, 0, -0.012 * abs(s))},
            'spine': {'r': (5 + 2 * br, -3 * s, 0)},
            'belly': {'s': (1 + 0.03 * br, 1 + 0.035 * br, 1 + 0.02 * br)},
            'head': {'r': (3 * math.sin(ph * 2 + 0.5), 5 * math.sin(ph + 0.7), 7 * math.sin(ph + 0.3))},
        })
    make_clip(arm, 'idle', L, idle, loop=True)

    # ---- WALK : pas lourds, tout le corps roule d'un pied sur l'autre, le maillet traîne (1,2 s)
    L = 36
    walk = {}
    for i in range(9):
        a = i / 8 * TAU
        s, c, b = math.sin(a), math.cos(a), math.cos(2 * a)
        walk[i * L // 8] = merge(arms((0.34, 0.06 + 0.32 * s, -1), (0.22, -0.3 + 0.3 * s, -1), (-0.36, 0.10 - 0.14 * s, -1), (-0.30, -0.30 - 0.12 * s, -1)), {
            'hips': {'r': (4, 7 * s, -6 * s), 'l': (0.05 * s, 0, 0.04 * b - 0.03)},
            'spine': {'r': (9, -6 * s, 8 * s)},
            'chest': {'r': (2, -3 * s, 4 * s)},
            'belly': {'l': (0, 0, -0.03 * math.cos(2 * a - 0.8)), 's': (1 + 0.04 * math.cos(2 * a - 0.8), 1, 1 - 0.04 * math.cos(2 * a - 0.8))},
            'head': {'r': (-4 + 3 * b, 4 * c, -8 * s)},
            'thigh.L': {'r': (-30 * s, 0, 0)}, 'shin.L': {'r': (max(0, 45 * math.sin(a + 1.9)) + 6, 0, 0)},
            'thigh.R': {'r': (30 * s, 0, 0)}, 'shin.R': {'r': (max(0, 45 * math.sin(a + math.pi + 1.9)) + 6, 0, 0)},
            'foot.L': {'r': (-10 * math.sin(a + 0.5), 0, 0)}, 'foot.R': {'r': (10 * math.sin(a + 0.5), 0, 0)},
        })
    make_clip(arm, 'walk', L, walk, loop=True)

    rest = idle[0]
    # ---- STRIKE : il tend sa cloche devant lui, lève le maillet au-dessus de sa tête et l'abat sur la cloche (1,6 s)
    hold_l = ((0.30, -0.85, -0.25), (-0.30, -0.95, 0.30))
    raised = merge(arms(*hold_l, (-0.30, -0.15, 1), (0.05, 0.45, 0.85)), {
        'hips': {'r': (-4, 0, 0)},
        'spine': {'r': (-12, 0, -10)}, 'chest': {'r': (-8, 0, -6)}, 'head': {'r': (-6, 0, 8)},
        'belly': {'s': (0.97, 0.97, 1.05)},
        'thigh.L': {'r': (-10, 0, 0)}, 'thigh.R': {'r': (8, 0, 0)},
    })
    slam = merge(arms(*hold_l, (-0.10, -1, 0.05), (0.55, -0.80, -0.15)), {
        'hips': {'r': (8, 0, 0), 'l': (0, -0.03, -0.08)},
        'spine': {'r': (18, 0, 12)}, 'chest': {'r': (6, 0, 8)}, 'head': {'r': (4, 0, 14)},
        'belly': {'s': (1.05, 1.05, 0.95)},
        'thigh.L': {'r': (-24, 0, 0)}, 'shin.L': {'r': (26, 0, 0)},
        'thigh.R': {'r': (-8, 0, 0)}, 'shin.R': {'r': (18, 0, 0)},
    })
    ring = merge(slam, arms(*hold_l, (-0.12, -1, 0.15), (0.45, -0.85, 0.0)))
    make_clip(arm, 'strike', 48, {0: rest, 14: raised, 22: raised, STRIKE_HIT: slam, 36: ring, 48: rest}, loop=False)

    # ---- HIT : il encaisse, la tête part en arrière, la panse tremble (0,4 s)
    hurt = merge(rest, {'spine': {'r': (-8, 0, 6)}, 'head': {'r': (-20, 0, 8)}, 'belly': {'s': (1.06, 1.06, 0.95)}})
    make_clip(arm, 'hit', 12, {0: rest, 3: hurt, 12: rest}, loop=False)

    # ---- ROAR : passage en phase 2, il se cambre, bras écartés, maillet brandi, et rugit (1,5 s)
    roar = merge(arms((1, -0.2, -0.05), (0.55, -0.4, 0.9), (-1, -0.15, 0.0), (-0.45, -0.25, 1)), {
        'hips': {'r': (-6, 0, 0)}, 'spine': {'r': (-20, 0, 0)}, 'chest': {'r': (-10, 0, 0)}, 'head': {'r': (-28, 0, 0)},
        'belly': {'s': (1.08, 1.08, 1.0)},
    })
    shake = merge(roar, {'head': {'r': (-24, 0, 7)}, 'chest': {'r': (-10, 0, 4)}})
    make_clip(arm, 'roar', 45, {0: rest, 10: roar, 16: shake, 22: roar, 28: shake, 34: roar, 45: rest}, loop=False)

    # ---- DEATH : il tangue, tombe à genoux, puis s'effondre en avant sur sa panse (2 s)
    knees = merge(hang(), {
        'hips': {'l': (0, 0, -0.45), 'r': (10, 0, 0)},
        'thigh.L': {'r': (-80, 0, 0)}, 'shin.L': {'r': (95, 0, 0)}, 'thigh.R': {'r': (-75, 0, 0)}, 'shin.R': {'r': (95, 0, 0)},
        'spine': {'r': (-6, 0, 6)}, 'head': {'r': (-18, 0, 10)},
    })
    down = merge(knees, arms((0.8, -0.7, 0.1), (0.5, -1, 0.0), (-0.8, -0.6, 0.0), (-0.5, -1, -0.1)), {
        'hips': {'l': (0, -0.55, -0.55), 'r': (70, 0, 0)}, 'spine': {'r': (12, 0, 0)}, 'head': {'r': (-30, 0, 20)},
        'belly': {'s': (1.1, 1.1, 0.88)},
    })
    make_clip(arm, 'death', 60, {0: rest, 8: hurt, 24: knees, 40: down, 46: merge(down, {'belly': {'s': (0.95, 0.95, 1.05)}}), 60: down}, loop=False)

# ---------------------------------------------------------------- construction et export
build_head()
build_hands()
build_legs()
build_trimmings(build_robe())
build_mallet()
arm = build_armature()
body = assemble(arm)
build_clips(arm)
scene.frame_start, scene.frame_end = 0, 60

os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.export_scene.gltf(
    filepath=os.path.abspath(OUT), export_format='GLB', export_animation_mode='NLA_TRACKS', export_skins=True,
    export_morph=False, export_yup=True, export_force_sampling=True, export_optimize_animation_size=False,
)
tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
print(f'SONNEUR_OK triangles={tris} materiaux={len(body.data.materials)} -> {OUT}')

# ---------------------------------------------------------------- aperçus (Workbench)
if RENDER_DIR:
    os.makedirs(RENDER_DIR, exist_ok=True)
    r = scene.render
    r.engine = 'BLENDER_WORKBENCH'
    r.resolution_x, r.resolution_y = 800, 900
    sh = scene.display.shading
    sh.light = 'STUDIO'
    sh.color_type = 'MATERIAL'
    sh.show_object_outline = True
    sh.show_cavity = True
    sh.cavity_type = 'BOTH'
    sh.show_shadows = True
    scene.display.shadow_shift = 0.2
    world = bpy.data.worlds.new('w')
    scene.world = world
    world.color = (0.55, 0.65, 0.75)
    cam_data = bpy.data.cameras.new('cam')
    cam_data.type = 'ORTHO'
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam

    def shoot(fname, yaw_deg, pitch_deg=8, action=None, frame=0, scale=4.0, target=(0, 0, 1.3)):
        ad = arm.animation_data
        for t in ad.nla_tracks:
            t.mute = True
            t.is_solo = False
        if action:
            ad.nla_tracks[action].mute = False
            ad.nla_tracks[action].is_solo = True
        scene.frame_set(frame)
        cam_data.ortho_scale = scale
        yaw, pitch = math.radians(yaw_deg), math.radians(pitch_deg)
        d = Vector((math.sin(yaw) * math.cos(pitch), -math.cos(yaw) * math.cos(pitch), math.sin(pitch)))
        cam.location = Vector(target) + d * 12
        cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
        r.filepath = os.path.join(RENDER_DIR, fname)
        bpy.ops.render.render(write_still=True)

    for pb in arm.pose.bones:
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
        pb.scale = (1, 1, 1)
    shoot('repos.png', -30, 12, scale=4.6)
    shoot('face.png', 0, action='idle')
    shoot('trois_quarts.png', -35, 12, action='idle')
    shoot('profil.png', 90, action='idle')
    shoot('dos.png', 160, 15, action='idle')
    shoot('tete.png', -28, 6, action='idle', scale=1.25, target=(0, -0.2, 2.1))
    shoot('tete_face.png', 0, 0, action='idle', scale=1.25, target=(0, -0.2, 2.1))
    shoot('main.png', -60, 20, action='idle', scale=1.6, target=(-0.9, -0.5, 0.7))
    shoot('walk.png', 70, 5, action='walk', frame=9)
    shoot('strike_haut.png', 70, 5, action='strike', frame=18, scale=5.2, target=(0, -0.3, 1.8))
    shoot('strike_bas.png', 70, 5, action='strike', frame=STRIKE_HIT, scale=5.2, target=(0, -0.6, 1.3))
    shoot('strike_face.png', -20, 5, action='strike', frame=STRIKE_HIT, scale=5.2, target=(0, -0.4, 1.6))
    shoot('roar.png', -25, 5, action='roar', frame=10, scale=5.0, target=(0, 0, 1.5))
    shoot('death.png', 70, 10, action='death', frame=60, scale=4.6, target=(0, -0.6, 1.0))
    print('RENDERS_OK', RENDER_DIR)
