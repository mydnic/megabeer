"""
Le Buveur : modèle low-poly, squelette et animations, généré entièrement par script.

    blender -b --factory-startup -P tools/blender/buveur.py -- --out src/assets/models/buveur.glb [--render DIR]
    blender -b --factory-startup -P tools/blender/buveur.py -- --variant videur --out src/assets/models/videur.glb [--render DIR]

`--variant videur` : le Videur (perso jouable), même squelette et mêmes animations que le Buveur, corps à part
(carrure de frigo, crâne rasé, lunettes noires, oreillette, tee-shirt « SÉCURITÉ », pantalon cargo, rangers), SCULPTÉ
comme le Frère Sonneur (tools/blender/figure_kit.py) : une pièce fermée par matière, fondue par remaillage, poids des os
par distance. Ses os au repos sont plus écartés que ceux du Buveur (épaules, hanches).

Repère Blender : Z en haut, le personnage regarde vers -Y (devient +Z dans le glTF).
Sa main droite (la pinte) est du côté -X.
Chaque pièce est rigide et attachée à un seul os : look « figurine », pas de déformation molle.
"""
import bpy
import bmesh
import math
import sys
import os
from mathutils import Vector, Matrix, Euler, Quaternion

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # figure_kit (variante videur)

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default=None):
    return argv[argv.index(name) + 1] if name in argv else default
OUT = arg('--out', 'buveur.glb')
VARIANT = arg('--variant', 'buveur')
RENDER_DIR = arg('--render')
FPS = 30

# ---------------------------------------------------------------- scène vide
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = FPS

# ---------------------------------------------------------------- palette
PALETTE = {
    'peau':      (0.95, 0.70, 0.55),
    'joues':     (0.95, 0.45, 0.50),
    'nez':       (0.85, 0.18, 0.20),
    'barbe':     (0.62, 0.52, 0.50),
    'cheveux':   (0.30, 0.20, 0.14),
    'oeil':      (0.97, 0.97, 0.95),
    'pupille':   (0.08, 0.07, 0.07),
    'bouche':    (0.40, 0.10, 0.12),
    'marcel':    (0.95, 0.93, 0.87),
    'tache':     (0.80, 0.58, 0.20),
    'tache2':    (0.62, 0.42, 0.22),
    'jean':      (0.22, 0.34, 0.56),
    'jean_fonce':(0.16, 0.25, 0.42),
    'basket':    (0.96, 0.96, 0.96),
    'biere':     (0.93, 0.60, 0.08),
    'mousse':    (1.00, 0.97, 0.88),
    'verre':     (0.80, 0.92, 0.95),
    # Le Videur
    'tee':       (0.11, 0.11, 0.13),
    'tee_bord':  (0.20, 0.20, 0.23),
    'pantalon':  (0.15, 0.15, 0.18),
    'ranger':    (0.08, 0.07, 0.07),
    'semelle':   (0.20, 0.18, 0.16),
    'lunettes':  (0.04, 0.04, 0.06),
    'reflet':    (0.45, 0.55, 0.70),
    'badge':     (0.97, 0.80, 0.18),
    'boucle':    (0.80, 0.72, 0.40),
    'peau_v':    (0.86, 0.62, 0.48),
    'crane':     (0.80, 0.56, 0.44),
}

def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

MATS = {}
def mat(name):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    rgb = PALETTE[name]
    lin = tuple(srgb_to_lin(c) for c in rgb) + (1.0,)
    m.diffuse_color = lin                      # Workbench (aperçus)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = lin
    bsdf.inputs['Roughness'].default_value = 1.0
    MATS[name] = m
    return m

# ---------------------------------------------------------------- pièces
PARTS = []  # (objet, os)

def _finish(obj, material, bone, smooth=True):
    """bone=None : les groupes de sommets (poids) sont déjà posés sur l'objet."""
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
    """cut_z : coupe tout ce qui est sous cette hauteur et bouche par une face plate (semelle)."""
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
    obj = _finish(_obj_from_bm(bm, name), material, bone, smooth)
    if cut_z is not None:
        for p in obj.data.polygons:
            if p.normal.z < -0.99:
                p.use_smooth = False
    return obj

def limb(name, a, b, r1, r2, material, bone, seg=10, smooth=True):
    """Cylindre conique de a vers b."""
    a, b = Vector(a), Vector(b)
    d = b - a
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r1, radius2=r2, depth=d.length)
    rot = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=Matrix.Translation((a + b) / 2) @ rot, verts=bm.verts)
    return _finish(_obj_from_bm(bm, name), material, bone, smooth)

def _smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)

def tube_chain(name, pts, radii, bones, material, seg=12, blend=0.07, dome_start=False):
    """
    Membre continu en deux segments (épaule-coude-poignet, hanche-genou-cheville) : un seul tube
    dont les poids passent en douceur d'un os à l'autre autour de l'articulation (pas de boule).
    dome_start : le début du tube se termine en dôme (épaule), dans la même maille que le bras.
    """
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
        # Repère du cercle transporté d'un anneau à l'autre (pas de torsion)
        if n_prev is None:
            ref = Vector((1, 0, 0)) if abs(t.x) < 0.9 else Vector((0, 1, 0))
            n = (ref - t * ref.dot(t)).normalized()
        else:
            n = (n_prev - t * n_prev.dot(t)).normalized()
        n_prev = n
        b = t.cross(n)
        ring = [bm.verts.new(c + (n * math.cos(k / seg * math.tau) + b * math.sin(k / seg * math.tau)) * r) for k in range(seg)]
        rings.append(ring)
        weights.append(w2)
    for i in range(len(rings) - 1):
        for k in range(seg):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % seg], rings[i + 1][(k + 1) % seg], rings[i + 1][k]))
    if dome_start:
        # Pôle du dôme : éventail de triangles autour d'un sommet
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

def box(name, center, size, material, bone, bevel=0.0, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=bm.verts[:] + bm.edges[:], offset=bevel, segments=2, affect='EDGES', profile=0.5)
    m = Matrix.Translation(center) @ Euler([math.radians(a) for a in rot]).to_matrix().to_4x4() @ Matrix.Diagonal((*size, 1))
    bmesh.ops.transform(bm, matrix=m, verts=bm.verts)
    return _finish(_obj_from_bm(bm, name), material, bone, smooth=False)

def tube_arc(name, center, radius, thick, a0, a1, material, bone, plane='XZ', seg=10):
    """Arc épais (sourire, sourcils) dans le plan frontal."""
    bm = bmesh.new()
    prev = None
    rings = []
    for i in range(seg + 1):
        t = a0 + (a1 - a0) * i / seg
        p = Vector((math.cos(t) * radius, 0, math.sin(t) * radius))
        rings.append(p)
    verts_rings = []
    for i, p in enumerate(rings):
        tangent = (rings[min(i + 1, seg)] - rings[max(i - 1, 0)]).normalized()
        n1 = Vector((0, 1, 0))
        n2 = tangent.cross(n1).normalized()
        ring = []
        for k in range(6):
            ang = k / 6 * math.tau
            ring.append(bm.verts.new(p + (n1 * math.cos(ang) + n2 * math.sin(ang)) * thick))
        verts_rings.append(ring)
    for i in range(seg):
        for k in range(6):
            bm.faces.new((verts_rings[i][k], verts_rings[i][(k + 1) % 6], verts_rings[i + 1][(k + 1) % 6], verts_rings[i + 1][k]))
    bm.faces.new(list(reversed(verts_rings[0])))
    bm.faces.new(verts_rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.transform(bm, matrix=Matrix.Translation(center), verts=bm.verts)
    return _finish(_obj_from_bm(bm, name), material, bone)

# ---------------------------------------------------------------- squelette (positions de repos)
# Bras droit (pinte) modélisé déjà plié : avant-bras horizontal vers l'avant.
B = {
    'hips':      ((0, 0, 0.80), (0, 0, 0.98), None),
    'spine':     ((0, 0, 0.98), (0, 0, 1.25), 'hips'),
    'belly':     ((0, -0.12, 1.00), (0, -0.40, 1.00), 'spine'),
    'chest':     ((0, 0, 1.25), (0, 0, 1.42), 'spine'),
    'head':      ((0, 0, 1.42), (0, 0, 1.90), 'chest'),
    'upperarm.L':((0.31, 0, 1.36), (0.37, 0.01, 1.08), 'chest'),
    'forearm.L': ((0.37, 0.01, 1.08), (0.40, -0.03, 0.83), 'upperarm.L'),
    'hand.L':    ((0.40, -0.03, 0.83), (0.41, -0.04, 0.72), 'forearm.L'),
    'upperarm.R':((-0.31, 0, 1.36), (-0.36, 0.03, 1.10), 'chest'),
    'forearm.R': ((-0.36, 0.03, 1.10), (-0.36, -0.25, 1.08), 'upperarm.R'),
    'hand.R':    ((-0.36, -0.25, 1.08), (-0.36, -0.36, 1.08), 'forearm.R'),
    # La pinte a son propre os : le jeu la cache et lance une vraie pinte quand le Buveur meurt
    'pint':      ((-0.31, -0.39, 0.96), (-0.31, -0.39, 1.20), 'hand.R'),
    'thigh.L':   ((0.15, 0, 0.82), (0.16, 0, 0.46), 'hips'),
    'shin.L':    ((0.16, 0, 0.46), (0.17, 0.01, 0.12), 'thigh.L'),
    'foot.L':    ((0.17, 0.01, 0.12), (0.17, -0.16, 0.05), 'shin.L'),
    'thigh.R':   ((-0.15, 0, 0.82), (-0.16, 0, 0.46), 'hips'),
    'shin.R':    ((-0.16, 0, 0.46), (-0.17, 0.01, 0.12), 'thigh.R'),
    'foot.R':    ((-0.17, 0.01, 0.12), (-0.17, -0.16, 0.05), 'shin.R'),
}

# ---------------------------------------------------------------- modèle
def build_body():
    # Jambes (jean) et baskets, symétriques
    for s, side in ((1, 'L'), (-1, 'R')):
        x = 0.15 * s
        tube_chain(f'jambe.{side}', [(x, 0, 0.86), (x + 0.01 * s, 0, 0.46), (x + 0.02 * s, 0.01, 0.17)],
                   [0.135, 0.118, 0.124], [f'thigh.{side}', f'shin.{side}'], 'jean', seg=14, blend=0.08)
        # Ourlet du jean un peu évasé
        limb(f'ourlet.{side}', (x + 0.02 * s, 0.01, 0.20), (x + 0.02 * s, 0.01, 0.15), 0.135, 0.135, 'jean_fonce', f'shin.{side}')
        fx = x + 0.02 * s
        # Basket : dôme arrondi dessus, dessous bien à plat
        ellipsoid(f'basket.{side}', (fx, -0.07, 0.035), (0.098, 0.19, 0.115), 'basket', f'foot.{side}', seg=14, rings=10, cut_z=0.0)
        ellipsoid(f'cheville.{side}', (fx, 0.0, 0.13), (0.09, 0.09, 0.06), 'basket', f'foot.{side}', seg=10, rings=6)

    # Bassin (jean)
    ellipsoid('bassin', (0, 0.01, 0.86), (0.30, 0.24, 0.17), 'jean', 'hips')
    # Bide : marcel trop court, la peau dépasse dessous
    ellipsoid('bide_peau', (0, -0.11, 0.93), (0.33, 0.31, 0.19), 'peau', 'belly')
    ellipsoid('bide', (0, -0.10, 1.04), (0.37, 0.35, 0.29), 'marcel', 'belly')
    ellipsoid('nombril', (0, -0.395, 0.90), (0.025, 0.012, 0.02), 'bouche', 'belly', seg=8, rings=5)
    # Taches de bière sur le marcel
    ellipsoid('tache1', (0.09, -0.37, 1.10), (0.075, 0.05, 0.06), 'tache', 'belly', seg=10, rings=6, rot=(15, 0, 20))
    ellipsoid('tache2', (-0.12, -0.355, 0.99), (0.05, 0.05, 0.04), 'tache2', 'belly', seg=10, rings=6)
    ellipsoid('tache3', (0.15, -0.33, 0.96), (0.03, 0.04, 0.03), 'tache', 'belly', seg=8, rings=5)
    # Haut du torse
    ellipsoid('torse', (0, 0.02, 1.25), (0.32, 0.25, 0.22), 'marcel', 'chest')
    ellipsoid('poitrail', (0, -0.08, 1.33), (0.16, 0.12, 0.10), 'peau', 'chest')
    # Épaules : pas de pièce séparée, le haut des bras se termine en dôme (dome_start)
    limb('cou', (0, 0.0, 1.36), (0, 0.0, 1.50), 0.10, 0.10, 'peau', 'head')

    # Bras gauche, ballant
    tube_chain('bras.L', [(0.30, 0, 1.37), (0.37, 0.01, 1.08), (0.40, -0.03, 0.82)],
               [0.086, 0.073, 0.064], ['upperarm.L', 'forearm.L'], 'peau', seg=12, blend=0.06, dome_start=True)
    ellipsoid('main.L', (0.405, -0.035, 0.78), (0.075, 0.07, 0.09), 'peau', 'hand.L', seg=10, rings=7)

    # Bras droit, plié, tient la pinte
    tube_chain('bras.R', [(-0.30, 0, 1.37), (-0.36, 0.03, 1.10), (-0.36, -0.27, 1.08)],
               [0.086, 0.073, 0.064], ['upperarm.R', 'forearm.R'], 'peau', seg=12, blend=0.05, dome_start=True)
    ellipsoid('main.R', (-0.35, -0.31, 1.07), (0.075, 0.085, 0.07), 'peau', 'hand.R', seg=10, rings=7)

    # Pinte (nonic) : verre, bière, mousse qui déborde
    px, py, pz = -0.31, -0.39, 0.96
    limb('verre', (px, py, pz), (px, py, pz + 0.24), 0.068, 0.082, 'verre', 'pint', seg=12)
    limb('biere', (px, py, pz + 0.012), (px, py, pz + 0.205), 0.072, 0.085, 'biere', 'pint', seg=12)
    limb('mousse', (px, py, pz + 0.20), (px, py, pz + 0.245), 0.088, 0.09, 'mousse', 'pint', seg=12)
    ellipsoid('mousse_dome', (px, py, pz + 0.245), (0.09, 0.09, 0.04), 'mousse', 'pint', seg=12, rings=6)
    ellipsoid('coulure', (px + 0.02, py - 0.075, pz + 0.18), (0.03, 0.025, 0.06), 'mousse', 'pint', seg=8, rings=6)

    # Tête
    hz = 1.64
    ellipsoid('tete', (0, -0.01, hz), (0.255, 0.245, 0.27), 'peau', 'head', seg=16, rings=11)
    # Barbe de trois jours, bas du visage
    ellipsoid('barbe', (0, -0.075, hz - 0.12), (0.225, 0.19, 0.15), 'barbe', 'head', seg=14, rings=8)
    ellipsoid('menton', (0, -0.04, hz - 0.03), (0.232, 0.22, 0.17), 'peau', 'head', seg=14, rings=8)
    ellipsoid('nez', (0, -0.275, hz - 0.01), (0.075, 0.07, 0.065), 'nez', 'head', seg=12, rings=8)
    for s, side in ((1, 'L'), (-1, 'R')):
        ellipsoid(f'joue.{side}', (0.135 * s, -0.205, hz - 0.04), (0.065, 0.04, 0.045), 'joues', 'head', seg=10, rings=6)
        ellipsoid(f'oreille.{side}', (0.255 * s, 0.0, hz + 0.0), (0.035, 0.06, 0.075), 'peau', 'head', seg=10, rings=6)
        # Oeil mi-clos : globe, pupille, paupière lourde
        ex = 0.088 * s
        ellipsoid(f'oeil.{side}', (ex, -0.215, hz + 0.065), (0.048, 0.03, 0.05), 'oeil', 'head', seg=10, rings=7)
        ellipsoid(f'pupille.{side}', (ex - 0.005 * s, -0.24, hz + 0.055), (0.022, 0.012, 0.024), 'pupille', 'head', seg=8, rings=6)
        ellipsoid(f'paupiere.{side}', (ex, -0.212, hz + 0.088), (0.056, 0.036, 0.036), 'peau', 'head', seg=10, rings=6, rot=(0, -10 * s, 0))
        box(f'sourcil.{side}', (ex + 0.005 * s, -0.225, hz + 0.145), (0.08, 0.02, 0.022), 'cheveux', 'head', bevel=0.008, rot=(0, 12 * s, 0))
        # Couronne de cheveux sur les côtés, sommet dégarni
        ellipsoid(f'tempe.{side}', (0.215 * s, 0.05, hz + 0.08), (0.06, 0.13, 0.10), 'cheveux', 'head', seg=10, rings=7)
    ellipsoid('nuque', (0, 0.17, hz + 0.05), (0.20, 0.11, 0.14), 'cheveux', 'head', seg=12, rings=7)
    # La mèche rabattue sur le crâne
    # Grand sourire béat
    tube_arc('sourire', (0, -0.262, hz - 0.035), 0.085, 0.016, math.radians(205), math.radians(335), 'bouche', 'head')

def build_body_videur():
    """
    Le Videur, sculpté avec les outils du Frère Sonneur (tools/blender/figure_kit.py). Chaque matière est une pièce à
    part, fermée et fondue par remaillage : le tee-shirt (torse, épaules, manches courtes), les bras nus qui sortent
    des manches, les poings (avec leurs doigts), le pantalon cargo, les rangers, la tête. Aucune couleur n'est peinte à
    cheval sur deux matières : les limites sont de vrais bords (ourlets, col, ceinture). Poids des os par distance (les
    membres plient en douceur). Mêmes os que le Buveur, donc mêmes animations.
    """
    import figure_kit as K
    from figure_kit import cap, cone, ell, box as kbox, tube, sculpt, paint, weigh, seg_dist, hard, in_ell, fist, bvh_of
    from mathutils.kdtree import KDTree
    PALETTE.update({
        'peau': (0.80, 0.58, 0.45), 'peau_fonce': (0.75, 0.535, 0.41),
        'tee': (0.17, 0.17, 0.19), 'tee_bord': (0.25, 0.25, 0.28),
        'pantalon': (0.10, 0.105, 0.13), 'ranger': (0.06, 0.055, 0.055), 'semelle': (0.16, 0.14, 0.13),
        'lunettes': (0.03, 0.03, 0.05), 'reflet': (0.50, 0.62, 0.80), 'jaune': (0.98, 0.80, 0.15),
        'barbe_v': (0.22, 0.16, 0.13), 'levre': (0.62, 0.38, 0.32), 'metal': (0.72, 0.74, 0.78),
    })
    # Carrure de frigo : mêmes os que le Buveur, mais épaules et hanches plus écartées au repos (les animations, faites de
    # rotations, s'appliquent telles quelles)
    for name, (h, t, parent) in list(B.items()):
        sd = 1 if name.endswith('.L') else -1
        dx = 0.075 * sd if name.split('.')[0] in ('upperarm', 'forearm', 'hand') else -0.075 if name == 'pint' else 0.025 * sd if name.split('.')[0] in ('thigh', 'shin', 'foot') else 0.0
        B[name] = ((h[0] + dx, h[1], h[2]), (t[0] + dx, t[1], t[2]), parent)
    K.PALETTE = PALETTE
    K.MATS = MATS
    K.B = B
    K.FINAL.clear()
    V3 = Vector

    def keep(o):
        if o in K.FINAL:
            K.FINAL.remove(o)
        PARTS.append((o, None))
        return o
    def acc(obj, material, bone, smooth=True):
        return keep(hard(obj, material, bone, smooth=smooth))
    def by_dist(p, bones, power):
        ws = [(1.0 / (seg_dist(p, V3(B[b][0]), V3(B[b][1])) + 1e-4) ** power, b) for b in bones]
        tot = sum(w for w, _ in ws)
        return {b: w / tot for w, b in ws}
    def set_weights(obj, fn):
        names = set()
        ws = []
        for vt in obj.data.vertices:
            w = fn(vt.co)
            ws.append(w)
            names.update(w)
        groups = {b: obj.vertex_groups.new(name=b) for b in sorted(names)}
        for vt, w in zip(obj.data.vertices, ws):
            for b, x in w.items():
                if x > 0.02:
                    groups[b].add([vt.index], x, 'REPLACE')
    def stick(obj, target):
        """Accessoire souple posé sur une pièce : chaque sommet reprend les poids du sommet le plus proche."""
        kd = KDTree(len(target.data.vertices))
        for vt in target.data.vertices:
            kd.insert(vt.co, vt.index)
        kd.balance()
        groups = {}
        for vt in obj.data.vertices:
            _, idx, _ = kd.find(vt.co)
            for g in target.data.vertices[idx].groups:
                name = target.vertex_groups[g.group].name
                if name not in groups:
                    groups[name] = obj.vertex_groups.new(name=name)
                groups[name].add([vt.index], g.weight, 'REPLACE')

    SH = {1: V3(B['upperarm.L'][0]), -1: V3(B['upperarm.R'][0])}
    EL = {1: V3(B['upperarm.L'][1]), -1: V3(B['upperarm.R'][1])}
    WR = {1: V3(B['forearm.L'][1]), -1: V3(B['forearm.R'][1])}
    SLEEVE = 0.52   # la manche courte couvre 52 % du haut du bras

    # ------------------------------------------------------------ tee-shirt : torse en V, épaules, manches courtes
    parts = [
        ell((0, -0.01, 1.275), (0.405, 0.24, 0.19), seg=24, rings=14),       # cage thoracique
        ell((0, 0.085, 1.27), (0.365, 0.155, 0.17)),                              # haut du dos
        ell((0, 0.0, 1.10), (0.31, 0.215, 0.17)),                              # taille
        cone((0, 0.0, 0.93), (0, 0.0, 1.08), 0.28, 0.30, seg=24, scale_y=0.73),   # ventre plat, rentré dans le pantalon
        ell((0, 0.014, 1.425), (0.16, 0.135, 0.035)),                          # base du col
    ]
    for sd in (1, -1):
        ab = EL[sd] - SH[sd]
        parts += [
            ell((0.155 * sd, -0.13, 1.295), (0.175, 0.11, 0.105)),             # pectoral
            ell((0.245 * sd, 0.03, 1.20), (0.12, 0.13, 0.16)),                 # grand dorsal
            ell((0.19 * sd, 0.04, 1.385), (0.18, 0.125, 0.075)),                  # trapèze
            ell(SH[sd] + V3((0.015 * sd, 0.0, -0.015)), (0.135, 0.14, 0.145)),  # deltoïde
            ell((0.29 * sd, 0.01, 1.365), (0.15, 0.135, 0.085)),                # épaule fondue dans le trapèze
            cone(SH[sd], SH[sd] + ab * SLEEVE, 0.142, 0.138, seg=18),           # manche
        ]
    tee = sculpt('tee', parts, voxel=0.010, smooth=7, tris=5000)
    paint(tee, 'tee')
    def torso_w(p):
        w = by_dist(p, ['hips', 'spine', 'chest'], 5)
        for sd, side in ((1, 'L'), (-1, 'R')):
            ab = EL[sd] - SH[sd]
            t = (p - SH[sd]).dot(ab) / ab.length_squared
            d = min(seg_dist(p, SH[sd], EL[sd]), seg_dist(p, EL[sd], WR[sd]))
            if t < 0.05 or d > 0.2:
                continue
            axis_x = abs((SH[sd] + ab * max(0.0, min(1.0, t))).x)
            # Côté extérieur : suit le bras. La manche entière (jusqu'à son ourlet) aussi, même côté aisselle, pour ne pas
            # se déchirer quand le bras se lève ; le flanc du torse, plus bas, reste au torse
            side_k = max(_smoothstep(-0.115, -0.05, abs(p.x) - axis_x), _smoothstep(0.22, 0.42, t) * (1 - _smoothstep(SLEEVE + 0.02, SLEEVE + 0.12, t)))
            r = _smoothstep(0.05, 0.35, t) * side_k * (1 - _smoothstep(0.15, 0.2, d))
            wa = by_dist(p, [f'upperarm.{side}', f'forearm.{side}'], 6)
            w = {b: x * (1 - r) for b, x in w.items()}
            for b, x in wa.items():
                w[b] = w.get(b, 0) + x * r
        return w
    set_weights(tee, torso_w)
    PARTS.append((tee, None))
    tee_bvh = bvh_of(tee)

    # Ourlets des manches et col côtelé
    for sd, side in ((1, 'L'), (-1, 'R')):
        ab = EL[sd] - SH[sd]
        c0 = SH[sd] + ab * (SLEEVE - 0.015)
        ax = ab.normalized()
        u = ax.cross(V3((0, 1, 0))).normalized()
        v = ax.cross(u)
        acc(cone(c0 - ax * 0.05, c0 + ax * 0.012, 0.134, 0.13, seg=20), 'tee', f'upperarm.{side}')
        ring = [c0 + ax * 0.012 + (u * math.cos(a) + v * math.sin(a)) * 0.126 for a in (i * math.tau / 20 for i in range(20))]
        acc(tube(ring, 0.008, seg=6, closed=True), 'tee_bord', f'upperarm.{side}')
    collar = [V3((0.155 * math.cos(a), 0.014 + 0.132 * math.sin(a), 1.44 - 0.022 * max(0.0, -math.sin(a)))) for a in (i * math.tau / 22 for i in range(22))]
    acc(tube(collar, 0.019, seg=6, closed=True), 'tee_bord', 'chest')

    # Inscriptions : texte posé sur le tissu par lancer de rayons, souple comme lui
    def label(text, size, x, z, back):
        cu = bpy.data.curves.new('txt', 'FONT')
        cu.body = text
        cu.size = size
        cu.align_x = 'CENTER'
        cu.align_y = 'CENTER'
        cu.offset = size * 0.035                      # trait un peu gras
        o = bpy.data.objects.new('txt', cu)
        scene.collection.objects.link(o)
        o.rotation_euler = (math.pi / 2, 0, math.pi if back else 0)
        o.location = (x, 0, z)
        bpy.context.view_layer.update()
        me = bpy.data.meshes.new_from_object(o.evaluated_get(bpy.context.evaluated_depsgraph_get()))
        me.transform(o.matrix_world)
        bpy.data.objects.remove(o)
        obj = bpy.data.objects.new('label', me)
        scene.collection.objects.link(obj)
        sy = 1.0 if back else -1.0
        for vt in me.vertices:
            hit = tee_bvh.ray_cast(V3((vt.co.x, sy, vt.co.z)), V3((0, -sy, 0)))
            if hit[0] is not None:
                vt.co.y = hit[0].y + sy * 0.004
        me.materials.append(K.mat('jaune'))
        stick(obj, tee)
        PARTS.append((obj, None))
    label('SÉCURITÉ', 0.105, 0.0, 1.275, back=True)
    label('SÉCURITÉ', 0.03, 0.165, 1.325, back=False)

    # ------------------------------------------------------------ bras nus, qui sortent des manches
    for sd, side in ((1, 'L'), (-1, 'R')):
        ab = EL[sd] - SH[sd]
        fa = WR[sd] - EL[sd]
        mid = SH[sd] + ab * 0.6
        parts = [
            *cap(SH[sd] + ab * 0.42, EL[sd], 0.118, 0.10),
            ell(mid + V3((0, -0.028, 0.0)), (0.112, 0.118, 0.125)),        # biceps
            ell(mid + V3((0, 0.032, 0.01)), (0.104, 0.10, 0.115)),         # triceps
            *cap(EL[sd], WR[sd], 0.10, 0.074),
            ell(EL[sd] + fa * 0.3, (0.108, 0.108, 0.105)),                 # muscles de l'avant-bras
        ]
        arm = sculpt(f'bras.{side}', parts, voxel=0.009, smooth=3, tris=1500)
        paint(arm, 'peau')
        weigh(arm, [f'upperarm.{side}', f'forearm.{side}', f'hand.{side}'], power=6)
        PARTS.append((arm, None))

    # ------------------------------------------------------------ poings fermés (doigts, pouce, jointures)
    FIST_K = 0.62
    def make_fist(side, sd, handle):
        wr = WR[sd]
        fa = (WR[sd] - EL[sd]).normalized()
        h = (V3(handle) - fa * V3(handle).dot(fa)).normalized()
        u = -fa
        fist(f'main.{side}', f'hand.{side}', wr, fa, wr + fa * 0.20, h, u, h.cross(u))
        o = K.FINAL[-1]
        for vt in o.data.vertices:
            vt.co = wr + (vt.co - wr) * FIST_K
        keep(o)
    make_fist('L', 1, (0, 1, 0))
    make_fist('R', -1, (0, 0, -1))    # poing droit autour d'un manche vertical : il y tiendra son tabouret

    # Montre au poignet gauche
    fa = (WR[1] - EL[1]).normalized()
    c0 = WR[1] - fa * 0.035
    u = fa.cross(V3((0, 1, 0))).normalized()
    v = fa.cross(u)
    acc(tube([c0 + (u * math.cos(a) + v * math.sin(a)) * 0.079 for a in (i * math.tau / 16 for i in range(16))], 0.011, seg=6, closed=True), 'ranger', 'forearm.L')
    acc(ell(c0 + V3((0.082, 0, 0)), (0.012, 0.032, 0.032), seg=12, rings=6), 'metal', 'forearm.L')
    acc(ell(c0 + V3((0.088, 0, 0)), (0.008, 0.023, 0.023), seg=12, rings=6), 'lunettes', 'forearm.L')

    # ------------------------------------------------------------ pantalon cargo
    parts = [ell((0, 0.01, 0.87), (0.31, 0.24, 0.155)), ell((0, 0.0, 0.80), (0.22, 0.18, 0.12))]
    for sd in (1, -1):
        x = 0.175 * sd
        hip, knee, ank = V3((x, 0, 0.84)), V3((x + 0.01 * sd, 0, 0.46)), V3((x + 0.02 * sd, 0.008, 0.25))
        parts += [
            *cap(hip, knee, 0.165, 0.13), *cap(knee, ank, 0.13, 0.122),
            ell((0.14 * sd, 0.115, 0.845), (0.16, 0.13, 0.135)),                    # fessier
            ell((x, -0.035, 0.66), (0.142, 0.14, 0.17)),                              # cuisse
            ell((x + 0.012 * sd, -0.06, 0.46), (0.085, 0.075, 0.07)),                  # genou
            ell((x + 0.015 * sd, 0.045, 0.36), (0.105, 0.105, 0.11)),                  # mollet
            ell((x + 0.02 * sd, 0.005, 0.255), (0.14, 0.145, 0.055)),                  # bas de pantalon bouffant sur la ranger
            kbox((x + 0.15 * sd, 0.01, 0.63), (0.07, 0.17, 0.17), bevel=0.02),        # poche cargo
            kbox((x + 0.155 * sd, 0.01, 0.70), (0.075, 0.18, 0.045), bevel=0.012),      # rabat de la poche
        ]
    low = sculpt('pantalon', parts, voxel=0.010, smooth=3, tris=4200)
    paint(low, 'pantalon')
    weigh(low, ['hips', 'thigh.L', 'shin.L', 'thigh.R', 'shin.R'], power=5, override=lambda p: 'hips' if p.z > 0.85 else None)
    PARTS.append((low, None))

    # Ceinture, boucle, passants, talkie-walkie
    BX, BY, BZ = 0.283, 0.208, 0.945
    ring = [V3((BX * math.cos(a), 0.004 + BY * math.sin(a), BZ)) for a in (i * math.tau / 28 for i in range(28))]
    acc(tube(ring, 0.03, seg=8, closed=True, flat=(1.15, 0.5)), 'ranger', 'hips')
    acc(kbox((0, -BY - 0.012, BZ), (0.085, 0.02, 0.07), bevel=0.008), 'metal', 'hips', smooth=False)
    acc(kbox((0, -BY - 0.02, BZ), (0.05, 0.012, 0.036), bevel=0.005), 'ranger', 'hips', smooth=False)
    for a in (-50, 50, 130, -130):
        ca, sa = math.cos(math.radians(a - 90)), math.sin(math.radians(a - 90))
        acc(kbox(((BX + 0.012) * ca, 0.004 + (BY + 0.012) * sa, BZ), (0.03, 0.012, 0.085), rot=(0, 0, a), bevel=0.004), 'pantalon', 'hips', smooth=False)
    # Talkie-walkie à la ceinture, côté droit
    acc(kbox((-0.285, 0.085, 0.965), (0.05, 0.075, 0.13), rot=(0, 0, -12), bevel=0.01), 'lunettes', 'hips', smooth=False)
    acc(tube([(-0.291, 0.105, 1.02), (-0.295, 0.11, 1.12)], [0.009, 0.005], seg=6), 'lunettes', 'hips')
    acc(ell((-0.313, 0.07, 1.0), (0.008, 0.012, 0.012), seg=8, rings=6), 'jaune', 'hips')

    # ------------------------------------------------------------ rangers : tige, bout renforcé, lacets, semelle crantée
    for sd, side in ((1, 'L'), (-1, 'R')):
        fx = 0.195 * sd
        shin, foot = f'shin.{side}', f'foot.{side}'
        parts = [
            *cap(V3((fx, 0.008, 0.25)), V3((fx, 0.005, 0.11)), 0.108, 0.10),              # tige
            ell((fx, -0.075, 0.075), (0.105, 0.20, 0.085), cut_z=0.02),                   # pied
            ell((fx, -0.205, 0.068), (0.098, 0.09, 0.075), cut_z=0.02),                   # bout renforcé
            ell((fx, 0.075, 0.075), (0.092, 0.08, 0.085), cut_z=0.02),                    # talon
            ell((fx, -0.07, 0.15), (0.075, 0.09, 0.06)),                                  # languette
        ]
        boot = sculpt(f'ranger.{side}', parts, voxel=0.009, smooth=2, tris=1500)
        paint(boot, 'ranger')
        weigh(boot, [shin, foot], power=6, override=lambda p, foot=foot: foot if p.z < 0.12 else None)
        PARTS.append((boot, None))
        acc(ell((fx, -0.075, 0.0), (0.112, 0.215, 0.034), seg=18, rings=8, cut_z=0.0), 'semelle', foot)
        acc(ell((fx, -0.205, 0.0), (0.104, 0.1, 0.04), seg=14, rings=8, cut_z=0.0), 'semelle', foot)
        for k in range(4):   # lacets croisés
            y, z = -0.115 + 0.03 * k, 0.142 + 0.022 * k
            acc(tube([(fx - 0.05, y, z - 0.012), (fx, y - 0.012, z + 0.008), (fx + 0.05, y, z - 0.012)], 0.008, seg=5), 'semelle', foot)

    # ------------------------------------------------------------ tête : crâne rasé, mâchoire carrée, bouc
    hz = 1.63
    def Q(x, y, z):
        return V3((x, y, hz + z))
    parts = [
        ell(Q(0, 0.012, 0.05), (0.205, 0.225, 0.215), seg=20, rings=14),    # crâne
        ell(Q(0, -0.04, -0.06), (0.188, 0.19, 0.15)),                        # bas du visage
        ell(Q(0, -0.06, -0.135), (0.17, 0.155, 0.085)),                      # mâchoire
        ell(Q(0, -0.172, -0.168), (0.08, 0.055, 0.05)),                      # menton
        ell(Q(0, -0.186, 0.066), (0.165, 0.05, 0.034)),                      # arcade sourcilière
        ell(Q(0, -0.212, 0.005), (0.03, 0.04, 0.06)),                        # arête du nez
        ell(Q(0, -0.24, -0.04), (0.04, 0.04, 0.033)),                        # bout du nez
        ell(Q(0, -0.205, -0.092), (0.08, 0.036, 0.028)),                     # lèvre du haut
        ell(Q(0, -0.20, -0.126), (0.066, 0.034, 0.022)),                     # lèvre du bas
        *cap(Q(0, 0.03, -0.27), Q(0, 0.018, -0.12), 0.14, 0.142),           # cou de taureau
        ell(Q(0, 0.155, -0.115), (0.135, 0.065, 0.032)),                     # bourrelets de la nuque
        ell(Q(0, 0.15, -0.165), (0.125, 0.06, 0.028)),
    ]
    for sd in (1, -1):
        parts += [
            ell(Q(0.125 * sd, -0.03, -0.13), (0.065, 0.085, 0.06)),                       # angle de la mâchoire
            ell(Q(0.105 * sd, -0.15, -0.045), (0.068, 0.058, 0.048)),                     # pommette
            ell(Q(0.03 * sd, -0.224, -0.05), (0.023, 0.025, 0.019)),                      # aile du nez
            ell(Q(0.212 * sd, 0.0, 0.0), (0.026, 0.05, 0.066), rot=(-8, 18 * sd, 0)),     # oreille
            ell(Q(0.205 * sd, -0.005, -0.055), (0.02, 0.026, 0.024)),                     # lobe
        ]
    head = sculpt('tete', parts, voxel=0.0075, smooth=3, tris=5200)
    paint(head, 'peau')
    weigh(head, ['head'])
    PARTS.append((head, None))
    beard = sculpt('bouc', [
        ell(Q(0, -0.176, -0.172), (0.07, 0.05, 0.045)),
        tube([Q(-0.066, -0.19, -0.175), Q(-0.07, -0.205, -0.125), Q(-0.045, -0.228, -0.092), Q(0, -0.238, -0.085),
              Q(0.045, -0.228, -0.092), Q(0.07, -0.205, -0.125), Q(0.066, -0.19, -0.175)], [0.016, 0.018, 0.018, 0.017, 0.018, 0.018, 0.016], seg=10),
    ], voxel=0.006, smooth=2, tris=900)
    paint(beard, 'barbe_v')
    weigh(beard, ['head'])
    PARTS.append((beard, None))
    # Bouche serrée, coins tombants
    acc(tube([Q(-0.042, -0.228, -0.118), Q(-0.02, -0.237, -0.112), Q(0.02, -0.237, -0.112), Q(0.042, -0.228, -0.118)], 0.0055, seg=6), 'lunettes', 'head')
    # Lunettes noires enveloppantes : verres bombés, monture, branches jusqu'aux oreilles
    for sd in (1, -1):
        acc(ell(Q(0.083 * sd, -0.218, 0.028), (0.066, 0.022, 0.04), rot=(0, 0, -14 * sd), seg=16, rings=8), 'lunettes', 'head')
        acc(kbox(Q(0.062 * sd, -0.242, 0.04), (0.03, 0.004, 0.012), rot=(0, 28, -14 * sd)), 'reflet', 'head', smooth=False)
        acc(tube([Q(0.15 * sd, -0.195, 0.045), Q(0.197 * sd, -0.11, 0.042), Q(0.217 * sd, -0.005, 0.035), Q(0.212 * sd, 0.03, 0.012)], [0.011, 0.009, 0.008, 0.006], seg=6), 'lunettes', 'head')
        # Sourcils épais et froncés, au-dessus de la monture
        acc(tube([Q(0.03 * sd, -0.226, 0.078), Q(0.085 * sd, -0.224, 0.098), Q(0.145 * sd, -0.2, 0.1)], [0.013, 0.016, 0.009], seg=8), 'barbe_v', 'head')
    acc(tube([Q(-0.152, -0.198, 0.05), Q(-0.085, -0.236, 0.062), Q(0, -0.243, 0.052), Q(0.085, -0.236, 0.062), Q(0.152, -0.198, 0.05)], 0.0105, seg=6), 'lunettes', 'head')
    # Oreillette et son fil torsadé, de l'oreille au col
    acc(ell(Q(-0.232, -0.012, 0.0), (0.016, 0.022, 0.026), seg=8, rings=6), 'lunettes', 'head')
    a0, a1 = Q(-0.228, 0.01, -0.03), V3((-0.125, 0.105, 1.445))
    ax = (a1 - a0).normalized()
    u = ax.cross(V3((1, 0, 0))).normalized()
    v = ax.cross(u)
    turns, n = 9, 72
    coil = [a0 + (a1 - a0) * (i / n) + (u * math.cos(i / n * turns * math.tau) + v * math.sin(i / n * turns * math.tau)) * 0.011 for i in range(n + 1)]
    acc(tube(coil, 0.0045, seg=5), 'tee_bord', 'head')

# ---------------------------------------------------------------- armature
def build_armature():
    arm_data = bpy.data.armatures.new('Buveur_rig')
    arm = bpy.data.objects.new('Buveur_rig', arm_data)
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
    # Un groupe de sommets par os, poids 1 : pièces rigides
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
    body.name = 'Buveur'
    body.data.name = 'Buveur'
    body.parent = arm
    mod = body.modifiers.new('Armature', 'ARMATURE')
    mod.object = arm
    return body

# ---------------------------------------------------------------- animation
# Les angles sont donnés dans le repère du personnage (degrés) :
#   x > 0 : penche vers l'avant (pour un os qui monte) / recule (pour un os qui descend)
#   y > 0 : le haut bascule vers sa gauche (+X), donc le bout d'un os qui descend part vers sa DROITE
#           (bras gauche écarté : y < 0, bras droit écarté : y > 0)
#   z > 0 : tourne vers sa gauche
def q_arm_to_local(bone, rx, ry, rz):
    R = Euler((math.radians(rx), math.radians(ry), math.radians(rz)), 'XYZ').to_quaternion()
    M = bone.matrix_local.to_3x3().to_quaternion()
    return M.inverted() @ R @ M

def loc_arm_to_local(bone, v):
    return bone.matrix_local.to_3x3().inverted() @ Vector(v)

def make_clip(arm, name, length, keys, loop):
    """keys : {frame: {bone: {'r': (x,y,z), 'l': (x,y,z), 's': (x,y,z)}}}"""
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
    # Boucles sans à-coup : modificateur Cycles + poignées calculées en boucle
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

def mirror(pose):
    """Symétrie gauche/droite d'une pose (sauf le bras à la pinte qu'on laisse tel quel)."""
    out = {}
    for b, d in pose.items():
        nb = b.replace('.L', '.TMP').replace('.R', '.L').replace('.TMP', '.R')
        nd = {}
        if 'r' in d:
            x, y, z = d['r']
            nd['r'] = (x, -y, -z)
        if 'l' in d:
            x, y, z = d['l']
            nd['l'] = (-x, y, z)
        if 's' in d:
            nd['s'] = d['s']
        out[nb] = nd
    return out

def build_clips(arm):
    # Pose de base des bras : la pinte à hauteur de bide, l'autre bras un peu écarté
    def arms(swingL=0.0, pint=0.0, extra=None):
        p = {
            'upperarm.L': {'r': (-swingL, -6, 4)},
            'forearm.L': {'r': (-12 - max(0, swingL) * 0.6, 0, 0)},
            'upperarm.R': {'r': (pint, 4, 0)},
            'forearm.R': {'r': (-pint, 0, 0)},
        }
        if extra:
            for k, v in extra.items():
                p.setdefault(k, {}).update(v)
        return p

    def merge(*poses):
        out = {}
        for p in poses:
            for b, d in p.items():
                out.setdefault(b, {}).update(d)
        return out

    # ---- IDLE : il tangue, le bide respire, la pinte suit le mouvement (2 s)
    L = 60
    idle = {}
    for i in range(0, 5):
        f = i * L // 4
        ph = i / 4 * math.tau
        sway = math.sin(ph)
        breath = math.sin(ph * 2)
        idle[f] = merge(arms(swingL=4 * sway, pint=3 * math.sin(ph + 1.0)), {
            'hips': {'r': (0, 4 * sway, 2 * sway), 'l': (0.025 * sway, 0, -0.01 * abs(sway))},
            'spine': {'r': (2, -5 * sway, -2 * sway)},
            'chest': {'r': (1, -1.5 * sway, 0)},
            'belly': {'s': (1 + 0.025 * breath, 1 + 0.03 * breath, 1 + 0.025 * breath)},
            'head': {'r': (4 + 3 * math.sin(ph * 2 + 0.6), 6 * math.sin(ph + 0.8), 4 * math.sin(ph + 0.4))},
            'thigh.L': {'r': (0, -4 * sway, 0)}, 'thigh.R': {'r': (0, -4 * sway, 0)},
            'shin.L': {'r': (0, 0, 0)}, 'shin.R': {'r': (0, 0, 0)},
            'foot.L': {'r': (0, 4 * sway, 0)}, 'foot.R': {'r': (0, 4 * sway, 0)},
        })
    make_clip(arm, 'idle', L, idle, loop=True)

    # ---- RUN : course pataude, penché en avant, le bide rebondit, la pinte reste droite (0,6 s)
    L = 18
    run = {}
    def run_pose(t):
        a = t * math.tau           # 0 : jambe gauche devant
        s = math.sin(a)
        c = math.cos(a)
        bounce = math.cos(2 * a)   # deux appuis par cycle
        p = merge(arms(swingL=-38 * s, pint=-6 - 4 * bounce), {
            'hips': {'r': (6, 0, -10 * s), 'l': (0, 0, 0.05 * bounce - 0.03)},
            'spine': {'r': (10, -4 * c, 8 * s)},
            'chest': {'r': (4, 0, 6 * s)},
            'belly': {'l': (0, 0, -0.025 * math.cos(2 * a - 0.9)), 's': (1 + 0.04 * math.cos(2 * a - 0.9), 1, 1 - 0.05 * math.cos(2 * a - 0.9))},
            'head': {'r': (-10 + 4 * bounce, 5 * c, -10 * s)},
            # jambes : cuisse avant/arrière, genou plié au passage
            'thigh.L': {'r': (-42 * s, 0, 0)},
            'shin.L': {'r': (max(0, 70 * math.sin(a + 1.9)) + 10, 0, 0)},
            'foot.L': {'r': (-15 * math.sin(a + 0.5), 0, 0)},
            'thigh.R': {'r': (42 * s, 0, 0)},
            'shin.R': {'r': (max(0, 70 * math.sin(a + math.pi + 1.9)) + 10, 0, 0)},
            'foot.R': {'r': (15 * math.sin(a + 0.5), 0, 0)},
            'hand.R': {'r': (4 * bounce, 0, 0)},
        })
        p['upperarm.L']['r'] = (-38 * s, -10, 4)
        p['forearm.L']['r'] = (-45 - 15 * s, 0, 0)
        return p
    for i in range(0, 9):
        run[i * L // 8] = run_pose(i / 8)
    make_clip(arm, 'run', L, run, loop=True)

    # ---- JUMP : impulsion, bras écartés, la pinte levée bien haut pour ne rien renverser (0,25 s)
    jump_pose = merge(arms(), {
        'hips': {'r': (-4, 0, 0)},
        'spine': {'r': (-6, 0, 0)},
        'head': {'r': (-12, 0, 0)},
        'upperarm.L': {'r': (-30, -70, 0)}, 'forearm.L': {'r': (-30, 0, 0)},
        'upperarm.R': {'r': (-60, 30, 0)}, 'forearm.R': {'r': (60, 0, 0)},
        'thigh.L': {'r': (-55, 0, 0)}, 'shin.L': {'r': (85, 0, 0)}, 'foot.L': {'r': (10, 0, 0)},
        'thigh.R': {'r': (10, 0, 0)}, 'shin.R': {'r': (30, 0, 0)}, 'foot.R': {'r': (20, 0, 0)},
        'belly': {'l': (0, 0, -0.04)},
    })
    make_clip(arm, 'jump', 8, {0: run_pose(0.1), 8: jump_pose}, loop=False)

    # ---- FALL : il mouline du bras libre et pédale (0,5 s)
    L = 15
    fall = {}
    for i in range(0, 5):
        f = i * L // 4
        a = i / 4 * math.tau
        fall[f] = merge(jump_pose, {
            'upperarm.L': {'r': (-60 * math.sin(a) - 20, -80, 30 * math.cos(a))},
            'forearm.L': {'r': (-40, 0, 0)},
            'thigh.L': {'r': (-35 - 20 * math.sin(a), 0, 0)}, 'shin.L': {'r': (60 + 20 * math.sin(a), 0, 0)},
            'thigh.R': {'r': (-5 + 20 * math.sin(a), 0, 0)}, 'shin.R': {'r': (50 - 20 * math.sin(a), 0, 0)},
            'belly': {'l': (0, 0, 0.03), 's': (0.97, 0.97, 1.05)},
            'head': {'r': (-14, 0, 6 * math.sin(a))},
        })
    make_clip(arm, 'fall', L, fall, loop=True)

    # ---- LAND : il s'écrase sur ses genoux, le bide continue sa course, puis se redresse (0,4 s)
    crouch = merge(arms(pint=-10), {
        'hips': {'r': (12, 0, 0), 'l': (0, 0, -0.16)},
        'spine': {'r': (14, 0, 0)},
        'head': {'r': (8, 0, 0)},
        'thigh.L': {'r': (-45, 0, 0)}, 'shin.L': {'r': (80, 0, 0)}, 'foot.L': {'r': (-35, 0, 0)},
        'thigh.R': {'r': (-45, 0, 0)}, 'shin.R': {'r': (80, 0, 0)}, 'foot.R': {'r': (-35, 0, 0)},
        'belly': {'l': (0, 0, -0.05), 's': (1.08, 1.08, 0.9)},
        'upperarm.L': {'r': (-10, -40, 0)},
    })
    rest = idle[0]
    make_clip(arm, 'land', 12, {0: crouch, 3: crouch, 12: rest}, loop=False)

    # ---- THROW : lancer de la main gauche, joué par-dessus les autres animations (additif dans le jeu).
    # Seuls le bras gauche et un peu le buste bougent ; image 0 = référence du mélange additif (0,6 s)
    base = arms()
    def throw_pose(ua, fa, spine_z=0.0):
        return merge(base, {
            'upperarm.L': {'r': ua}, 'forearm.L': {'r': fa}, 'hand.L': {'r': (0, 0, 0)},
            'spine': {'r': (0, 0, spine_z)},
        })
    make_clip(arm, 'throw', 18, {
        0: throw_pose((0, -6, 4), (-12, 0, 0)),
        4: throw_pose((70, -35, 10), (-95, 0, 0), spine_z=12),     # armé : bras en arrière, coude plié
        7: throw_pose((-125, -20, 0), (-15, 0, 0), spine_z=-14),   # lâcher : bras tendu vers l'avant et le haut
        11: throw_pose((-55, -10, 0), (-35, 0, 0), spine_z=-8),    # accompagnement
        18: throw_pose((0, -6, 4), (-12, 0, 0)),
    }, loop=False)

    # ---- DEATH : il encaisse, la pinte lui échappe, les genoux lâchent, il tombe sur le dos (1,4 s)
    recoil = merge(arms(), {
        'hips': {'r': (-8, 0, 0)},
        'spine': {'r': (-15, 0, 4)},
        'head': {'r': (-25, 0, 6)},
        'upperarm.L': {'r': (-40, -60, 0)}, 'forearm.L': {'r': (-30, 0, 0)},
        'upperarm.R': {'r': (-75, 45, 0)}, 'forearm.R': {'r': (25, 0, 0)},
        'shin.L': {'r': (15, 0, 0)}, 'shin.R': {'r': (15, 0, 0)},
        'belly': {'s': (1.04, 1.04, 0.97)},
    })
    buckle = merge(recoil, {
        'hips': {'r': (-22, 0, 0), 'l': (0, 0.05, -0.2)},
        'spine': {'r': (-18, 0, 0)},
        'head': {'r': (-15, 0, 0)},
        'thigh.L': {'r': (-35, 0, 0)}, 'shin.L': {'r': (65, 0, 0)}, 'foot.L': {'r': (-25, 0, 0)},
        'thigh.R': {'r': (-30, 0, 0)}, 'shin.R': {'r': (60, 0, 0)}, 'foot.R': {'r': (-25, 0, 0)},
        'upperarm.L': {'r': (-30, -75, 0)}, 'upperarm.R': {'r': (-40, 70, 0)},
        'belly': {'l': (0, 0, 0.03)},
    })
    falling = merge(buckle, {
        'hips': {'r': (-62, 0, 0), 'l': (0, 0.2, -0.42)},
        'spine': {'r': (-10, 0, 0)},
        'head': {'r': (-10, 0, 0)},
        'thigh.L': {'r': (-45, 0, 0)}, 'shin.L': {'r': (35, 0, 0)},
        'thigh.R': {'r': (-40, 0, 0)}, 'shin.R': {'r': (40, 0, 0)},
        'upperarm.L': {'r': (-15, -88, 0)}, 'forearm.L': {'r': (-15, 0, 0)},
        'upperarm.R': {'r': (-15, 88, 0)}, 'forearm.R': {'r': (-15, 0, 0)},
    })
    flat = merge(falling, {
        'hips': {'r': (-92, 0, 0), 'l': (0, 0.32, -0.55)},
        'spine': {'r': (0, 0, 0)},
        'chest': {'r': (0, 0, 0)},
        'head': {'r': (8, 0, 0)},
        'thigh.L': {'r': (-28, 0, 0)}, 'shin.L': {'r': (30, 0, 0)}, 'foot.L': {'r': (0, 0, 0)},
        'thigh.R': {'r': (-22, 0, 0)}, 'shin.R': {'r': (25, 0, 0)}, 'foot.R': {'r': (0, 0, 0)},
        'upperarm.L': {'r': (0, -92, 0)}, 'forearm.L': {'r': (-8, 0, 0)},
        'upperarm.R': {'r': (0, 92, 0)}, 'forearm.R': {'r': (-8, 0, 0)},
        'belly': {'l': (0, 0, 0), 's': (1.1, 1.1, 0.88)},
    })
    bounce = merge(flat, {
        'hips': {'r': (-90, 0, 0), 'l': (0, 0.32, -0.5)},
        'belly': {'s': (0.94, 0.94, 1.08)},
        'thigh.L': {'r': (-38, 0, 0)}, 'thigh.R': {'r': (-30, 0, 0)},
        'head': {'r': (0, 0, 0)},
    })
    settled = merge(flat, {
        'belly': {'s': (1.02, 1.02, 0.98)},
        'head': {'r': (10, 0, 28)},
    })
    make_clip(arm, 'death', 42, {0: rest, 5: recoil, 14: buckle, 24: falling, 30: flat, 34: bounce, 42: settled}, loop=False)

# ---------------------------------------------------------------- export
if VARIANT == 'videur':
    build_body_videur()
else:
    build_body()
arm = build_armature()
body = skin(arm)
build_clips(arm)
scene.frame_start, scene.frame_end = 0, 60

os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.export_scene.gltf(
    filepath=os.path.abspath(OUT),
    export_format='GLB',
    export_animation_mode='NLA_TRACKS',
    export_skins=True,
    export_morph=False,
    export_yup=True,
    export_force_sampling=True,
    export_optimize_animation_size=False,
)
tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
print(f'BUVEUR_OK variant={VARIANT} triangles={tris} -> {OUT}')

# ---------------------------------------------------------------- aperçus (Workbench)
if RENDER_DIR:
    os.makedirs(RENDER_DIR, exist_ok=True)
    r = scene.render
    r.engine = 'BLENDER_WORKBENCH'
    r.resolution_x, r.resolution_y = 640, 720
    r.film_transparent = False
    sh = scene.display.shading
    sh.light = 'STUDIO'
    sh.color_type = 'MATERIAL'
    sh.show_object_outline = True
    sh.show_cavity = False
    sh.show_shadows = False
    world = bpy.data.worlds.new('w')
    scene.world = world
    world.color = (0.55, 0.65, 0.75)
    cam_data = bpy.data.cameras.new('cam')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = 2.3
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    target = Vector((0, 0, 0.98))

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
        cam.location = target + d * 6
        cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
        r.filepath = os.path.join(RENDER_DIR, fname)
        bpy.ops.render.render(write_still=True)
        if action:
            ad.nla_tracks[action].is_solo = False

    shoot('face.png', 0, action='idle', frame=0)
    shoot('trois_quarts.png', -35, 12, action='idle', frame=0)
    shoot('profil.png', 90, action='idle', frame=0)
    shoot('dos.png', 180, 15, action='idle', frame=0)
    for f in (0, 4, 9, 13):
        shoot(f'run_{f:02d}.png', 70, 5, action='run', frame=f)
    shoot('jump.png', 60, 5, action='jump', frame=8)
    shoot('fall.png', 60, 5, action='fall', frame=4)
    shoot('land.png', 60, 5, action='land', frame=2)
    shoot('jump_face.png', -25, 5, action='jump', frame=8)
    shoot('fall_face.png', -25, 5, action='fall', frame=4)
    shoot('idle_dos.png', 200, 5, action='idle', frame=15)
    for f in (4, 7, 11):
        shoot(f'throw_{f:02d}.png', 60, 5, action='throw', frame=f)
    for f in (5, 14, 24, 30, 42):
        shoot(f'death_{f:02d}.png', 70, 10, action='death', frame=f)
    if VARIANT == 'videur':
        cam_data.ortho_scale = 1.05
        target = Vector((0, 0, 1.42))
        shoot('gros_plan.png', -28, 6, action='idle', frame=0)
        shoot('gros_plan_face.png', 0, 4, action='idle', frame=0)
        shoot('gros_plan_dos.png', 165, 12, action='idle', frame=0)
        shoot('gros_plan_profil.png', -90, 4, action='idle', frame=0)
        target = Vector((0, 0, 0.45))
        shoot('gros_plan_bas.png', -30, 14, action='idle', frame=0)
    print('RENDERS_OK', RENDER_DIR)
