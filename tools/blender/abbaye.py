"""
L'Abbaye en ruine : église (nef au toit à moitié effondré), clocher avec sa cloche, cloître à arcades,
parvis. Style « maquette » : blocs épais aux arêtes arrondies, couleurs unies (pas de texture).

    blender -b --factory-startup -P tools/blender/abbaye.py -- --out src/assets/models/abbaye.glb [--render DIR]

Repère Blender : Z en haut, la façade regarde vers -Y (devient +Z dans le glTF). Origine au sol,
au centre de la nef. Unités : mètres.
"""
import bpy
import bmesh
import math
import os
import random
import sys
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default=None):
    return argv[argv.index(name) + 1] if name in argv else default
OUT = arg('--out', 'abbaye.glb')
RENDER_DIR = arg('--render')
random.seed(7)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

PALETTE = {
    'pierre':       (0.60, 0.62, 0.68),
    'pierre2':      (0.53, 0.56, 0.62),
    'pierre3':      (0.66, 0.67, 0.71),
    'pierre_fonce': (0.40, 0.43, 0.50),
    'dallage':      (0.55, 0.53, 0.50),
    'toit':         (0.28, 0.31, 0.38),
    'bois':         (0.48, 0.32, 0.19),
    'bois_fonce':   (0.33, 0.21, 0.13),
    'bronze':       (0.82, 0.60, 0.26),
    'vitrail':      (0.20, 0.24, 0.42),
    'mousse':       (0.36, 0.52, 0.27),
    'nappe':        (0.82, 0.78, 0.66),
}

def lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

MATS = {}
def mat(name):
    if name not in MATS:
        m = bpy.data.materials.new(name)
        rgb = tuple(lin(c) for c in PALETTE[name]) + (1,)
        m.diffuse_color = rgb
        m.use_nodes = True
        b = m.node_tree.nodes['Principled BSDF']
        b.inputs['Base Color'].default_value = rgb
        b.inputs['Roughness'].default_value = 0.9
        MATS[name] = m
    return MATS[name]

OBJS = []
def _obj(bm, name, material, smooth=False):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    scene.collection.objects.link(o)
    o.data.materials.append(mat(material))
    for p in o.data.polygons:
        p.use_smooth = smooth
    OBJS.append(o)
    return o

def stone():
    return random.choice(['pierre', 'pierre', 'pierre2', 'pierre3'])

def block(name, a, b, material=None, bevel=0.05):
    """Pavé entre les coins a et b (x, y, z), arêtes arrondies."""
    a, b = Vector(a), Vector(b)
    size = b - a
    if min(size) <= 0.001:
        return None
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    # Mise à l'échelle d'abord, arrondi ensuite : l'arrondi est en mètres, pareil sur toutes les arêtes
    bmesh.ops.transform(bm, matrix=Matrix.Translation((a + b) / 2) @ Matrix.Diagonal((*size, 1)), verts=bm.verts)
    bv = min(bevel, min(size) * 0.3)
    if bv > 0.005:
        bmesh.ops.bevel(bm, geom=bm.verts[:] + bm.edges[:], offset=bv, segments=1, affect='EDGES', profile=0.5)
    return _obj(bm, name, material or stone())

def cylinder(name, base, radius, height, material, seg=12, r2=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=radius, radius2=r2 if r2 is not None else radius, depth=height)
    bmesh.ops.transform(bm, matrix=Matrix.Translation(Vector(base) + Vector((0, 0, height / 2))), verts=bm.verts)
    return _obj(bm, name, material, smooth=True)

def prism_y(name, pts_xz, y0, y1, material):
    """Polygone (x, z) extrudé entre y0 et y1 (pignons, toits)."""
    bm = bmesh.new()
    v0 = [bm.verts.new((x, y0, z)) for x, z in pts_xz]
    v1 = [bm.verts.new((x, y1, z)) for x, z in pts_xz]
    n = len(pts_xz)
    bm.faces.new(v0[::-1])
    bm.faces.new(v1)
    for i in range(n):
        bm.faces.new((v0[i], v0[(i + 1) % n], v1[(i + 1) % n], v1[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _obj(bm, name, material)

def slab_roof(name, x_eave, x_ridge, z_eave, z_ridge, y0, y1, thick, material):
    """Pan de toit incliné (prisme) de l'égout au faîtage."""
    dx, dz = x_ridge - x_eave, z_ridge - z_eave
    L = math.hypot(dx, dz)
    nx, nz = -dz / L * thick, dx / L * thick
    if nz < 0:
        nx, nz = -nx, -nz
    pts = [(x_eave, z_eave), (x_ridge, z_ridge), (x_ridge + nx, z_ridge + nz), (x_eave + nx, z_eave + nz)]
    return prism_y(name, pts, y0, y1, material)

def rubble(name, center, radius, count, material='pierre2'):
    for i in range(count):
        a = random.random() * math.tau
        r = random.random() * radius
        s = 0.25 + random.random() * 0.45
        c = Vector(center) + Vector((math.cos(a) * r, math.sin(a) * r, s * 0.35))
        block(f'{name}{i}', c - Vector((s, s * 0.8, s * 0.5)), c + Vector((s, s * 0.8, s * 0.5)), material, bevel=0.08)

# ------------------------------------------------------------------ NEF
W, L, H, T = 6.0, 12.0, 7.0, 0.9  # demi-largeur, demi-longueur, hauteur des murs, épaisseur
WIN_Y = [-7.5, -2.5, 2.5, 7.5]
WIN_W, SILL, WIN_TOP = 1.6, 2.0, 5.0

def side_wall(side, broken):
    """Mur latéral avec 4 fenêtres en ogive (arc en gradins) ; `broken` : hauteurs arrachées par pilier."""
    x0 = side * W - (T if side > 0 else 0)
    x1 = x0 + T
    # Entre la façade et le chevet seulement : pas de faces superposées aux angles (scintillement)
    edges = [-L + T] + sum([[y - WIN_W / 2, y + WIN_W / 2] for y in WIN_Y], []) + [L - T]
    for i in range(0, len(edges) - 1, 2):
        top = H * broken.get(i // 2, 1.0)
        block(f'pile{side}_{i}', (x0, edges[i], 0), (x1, edges[i + 1], top))
    for k, y in enumerate(WIN_Y):
        y0, y1 = y - WIN_W / 2, y + WIN_W / 2
        block(f'allege{side}{k}', (x0, y0, 0), (x1, y1, SILL))
        ok = broken.get(k, 1.0) >= 1.0 and broken.get(k + 1, 1.0) >= 1.0
        if ok:
            # Ogive en gradins puis mur au-dessus
            block(f'arcG{side}{k}', (x0, y0, WIN_TOP), (x1, y0 + 0.5, WIN_TOP + 0.7))
            block(f'arcD{side}{k}', (x0, y1 - 0.5, WIN_TOP), (x1, y1, WIN_TOP + 0.7))
            block(f'arcC{side}{k}', (x0 + 0.03, y0 + 0.25, WIN_TOP + 0.45), (x1 - 0.03, y1 - 0.25, WIN_TOP + 0.75))
            block(f'linteau{side}{k}', (x0, y0, WIN_TOP + 0.7), (x1, y1, H))
        # Contreforts entre les fenêtres
    for k, y in enumerate([-10.0, -5.0, 0.0, 5.0, 10.0]):
        xb = side * (W + 0.5)
        hb = 5.2 if broken.get(min(k, 4), 1.0) >= 1.0 else 3.0
        block(f'contrefort{side}{k}', (xb - 0.5, y - 0.45, 0), (xb + 0.5, y + 0.45, hb), 'pierre_fonce')
        block(f'contrefortH{side}{k}', (xb - 0.35, y - 0.35, hb), (xb + 0.35, y + 0.35, hb + 0.7), 'pierre_fonce')

# Mur gauche effondré à l'avant, mur droit entier (adossé au cloître)
side_wall(-1, {0: 0.45, 1: 0.7})
side_wall(+1, {})

# Façade (y = -L) : grande porte en ogive, rosace, pignon
FY0, FY1 = -L, -L + T
DOOR = 1.7
block('facadeG', (-W, FY0, 0), (-DOOR, FY1, H))
block('facadeD', (DOOR, FY0, 0), (W, FY1, H))
block('porteArcG', (-DOOR, FY0, 4.2), (-DOOR + 0.6, FY1, 5.0))
block('porteArcD', (DOOR - 0.6, FY0, 4.2), (DOOR, FY1, 5.0))
block('porteArcC', (-DOOR + 0.3, FY0 + 0.03, 4.8), (DOOR - 0.3, FY1 - 0.03, 5.3))
block('facadeHaut', (-DOOR, FY0, 5.3), (DOOR, FY1, H))
prism_y('pignonAvant', [(-W, H), (W, H), (0, H + 4.2)], FY0, FY1, 'pierre')
# Rosace : disque sombre en retrait + anneau et rayons
cylinder('rosaceFond', (0, 0, 0), 1.35, 0.2, 'vitrail', seg=20)
OBJS[-1].rotation_euler = (math.radians(90), 0, 0)
OBJS[-1].location = (0, FY0 - 0.02, 8.6)
for i in range(8):
    a = i / 8 * math.tau
    block(f'rayon{i}', (-0.07, FY0 - 0.15, -0.07), (0.07, FY0 + 0.05, 1.3), 'pierre3', bevel=0.02)
    o = OBJS[-1]
    o.data.transform(Matrix.Translation((0, 0, 0)))
    o.rotation_euler = (0, a, 0)
    o.location = (0, 0, 8.6)
bpy.ops.object.select_all(action='DESELECT')
# Anneau de la rosace
bm = bmesh.new()
bmesh.ops.create_circle(bm, cap_ends=False, segments=20, radius=1.45)
geom = bmesh.ops.extrude_edge_only(bm, edges=bm.edges[:])
for v in [e for e in geom['geom'] if isinstance(e, bmesh.types.BMVert)]:
    v.co *= 1.18
bmesh.ops.transform(bm, matrix=Matrix.Translation((0, FY0 - 0.12, 8.6)) @ Matrix.Rotation(math.radians(90), 4, 'X'), verts=bm.verts)
ring = _obj(bm, 'rosaceAnneau', 'pierre3')
sol = ring.modifiers.new('ep', 'SOLIDIFY'); sol.thickness = 0.3
# Portes en bois, une seule restée (entrouverte)
block('vantail', (DOOR - 0.15, FY0 - 0.9, 0.05), (DOOR + 0.05, FY0 + 0.4, 4.0), 'bois', bevel=0.03)

# Chevet (y = +L) : mur plein avec grande baie, pignon
block('chevetG', (-W, L - T, 0), (-1.2, L, H))
block('chevetD', (1.2, L - T, 0), (W, L, H))
block('chevetBas', (-1.2, L - T, 0), (1.2, L, 2.4))
block('baieFond', (-1.2, L - 0.15, 2.4), (1.2, L, 6.2), 'vitrail', bevel=0.0)
block('chevetHaut', (-1.2, L - T, 6.2), (1.2, L, H))
prism_y('pignonArriere', [(-W, H), (W, H), (0, H + 4.2)], L - T, L, 'pierre')

# Toit : arrière entier, avant effondré (quelques chevrons restent)
slab_roof('toitG', -W - 0.5, 0, H - 0.3, H + 4.4, -1.5, L + 0.4, 0.35, 'toit')
slab_roof('toitD', W + 0.5, 0, H - 0.3, H + 4.4, -1.5, L + 0.4, 0.35, 'toit')
block('faitage', (-0.25, -1.5, H + 4.3), (0.25, L + 0.4, H + 4.7), 'bois_fonce', bevel=0.04)
for i, y in enumerate([-3.0, -5.5, -8.0, -10.0]):
    if i == 2:
        continue
    for s in (-1, 1):
        o = block(f'chevron{i}{s}', (-0.12, y - 0.12, 0), (0.12, y + 0.12, 7.4), 'bois_fonce', bevel=0.03)
        o.rotation_euler = (0, s * math.radians(-55), 0)
        o.location = (s * (W + 0.2), 0, H - 0.2)
# Poutre tombée en travers de la nef
o = block('poutreTombee', (-4.5, -0.15, -0.15), (4.5, 0.15, 0.15), 'bois_fonce', bevel=0.03)
o.rotation_euler = (math.radians(5), math.radians(-14), math.radians(28))
o.location = (-0.5, -6.5, 0.9)

# Sol dallé de la nef et parvis
block('dallageNef', (-W + T, -L + T, 0), (W - T, L - T, 0.08), 'dallage', bevel=0.02)
for i in range(16):
    y = -L - 1.2 - i * 1.25
    w = 1.6 + random.random() * 0.5
    off = (random.random() - 0.5) * 0.5
    block(f'parvis{i}', (off - w, y - 0.55, 0), (off + w, y + 0.55, 0.07), 'dallage', bevel=0.03)

# Intérieur : bancs renversés ou cassés, autel, gravats sous la partie effondrée
for row in range(5):
    y = -2.0 + row * 2.2
    for s in (-1, 1):
        if random.random() < 0.2:
            continue
        cx = s * 2.6
        block(f'banc{row}{s}', (cx - 1.6, y - 0.3, 0.45), (cx + 1.6, y + 0.3, 0.55), 'bois', bevel=0.03)
        block(f'dossier{row}{s}', (cx - 1.6, y + 0.22, 0.55), (cx + 1.6, y + 0.32, 1.05), 'bois', bevel=0.02)
        for k, dx in enumerate((-1.4, 1.4)):
            block(f'pied{row}{s}{k}', (cx + dx - 0.08, y - 0.25, 0), (cx + dx + 0.08, y + 0.25, 0.45), 'bois_fonce', bevel=0.02)
block('autel', (-1.4, L - T - 2.4, 0), (1.4, L - T - 1.2, 1.1), 'pierre3')
block('nappe', (-1.3, L - T - 2.35, 1.1), (1.3, L - T - 1.25, 1.16), 'nappe', bevel=0.01)
for i, x in enumerate((-0.9, 0.9)):
    cylinder(f'chandelier{i}', (x, L - T - 1.8, 1.16), 0.08, 0.6, 'bronze', seg=8)
rubble('gravatsNef', (-3.5, -8.5, 0), 2.8, 18)
rubble('gravatsMurG', (-W - 1.5, -9.0, 0), 2.2, 10)

# ------------------------------------------------------------------ CLOCHER (avant gauche)
TX0, TX1, TY0, TY1 = -W - 5.2, -W - 0.2, -L - 2.0, -L + 3.0
block('tourBase', (TX0, TY0, 0), (TX1, TY1, 12.0), 'pierre')
block('tourSocle', (TX0 - 0.3, TY0 - 0.3, 0), (TX1 + 0.3, TY1 + 0.3, 1.2), 'pierre_fonce')
block('tourBandeau', (TX0 - 0.15, TY0 - 0.15, 11.6), (TX1 + 0.15, TY1 + 0.15, 12.2), 'pierre_fonce')
for i, z in enumerate((4.0, 7.5)):  # meurtrières
    block(f'meurtriere{i}', ((TX0 + TX1) / 2 - 0.2, TY0 - 0.05, z), ((TX0 + TX1) / 2 + 0.2, TY0 + 0.1, z + 1.4), 'vitrail', bevel=0.0)
# Beffroi : 4 piliers d'angle, arcs, bandeau
for i, (x, y) in enumerate([(TX0, TY0), (TX1 - 1.0, TY0), (TX0, TY1 - 1.0), (TX1 - 1.0, TY1 - 1.0)]):
    block(f'beffroiPilier{i}', (x, y, 12.2), (x + 1.0, y + 1.0, 16.2))
I = 0.06  # arcs en léger retrait des piliers : pas de faces dans le même plan
for i, (a, b) in enumerate([((TX0 + I, TY0 + I), (TX1 - I, TY0 + 0.9)), ((TX0 + I, TY1 - 0.9), (TX1 - I, TY1 - I)),
                            ((TX0 + I, TY0 + I), (TX0 + 0.9, TY1 - I)), ((TX1 - 0.9, TY0 + I), (TX1 - I, TY1 - I))]):
    block(f'beffroiArc{i}', (a[0], a[1], 15.4), (b[0], b[1], 16.4))
block('beffroiCorniche', (TX0 - 0.3, TY0 - 0.3, 16.4), (TX1 + 0.3, TY1 + 0.3, 16.9), 'pierre_fonce')
# La cloche, suspendue à une poutre
CX, CY = (TX0 + TX1) / 2, (TY0 + TY1) / 2
block('jougCloche', (TX0 + 0.5, CY - 0.18, 15.0), (TX1 - 0.5, CY + 0.18, 15.35), 'bois_fonce', bevel=0.03)
cylinder('cloche', (CX, CY, 13.4), 1.15, 1.5, 'bronze', seg=20, r2=0.7)
cylinder('clocheLevre', (CX, CY, 13.25), 1.25, 0.25, 'bronze', seg=20)
cylinder('clocheTete', (CX, CY, 14.9), 0.55, 0.3, 'bronze', seg=16, r2=0.35)
cylinder('battant', (CX, CY, 13.0), 0.14, 0.8, 'pierre_fonce', seg=8)
# Flèche
bm = bmesh.new()
bmesh.ops.create_cone(bm, cap_ends=True, segments=4, radius1=(TX1 - TX0) * 0.72, radius2=0.05, depth=8.0)
bmesh.ops.transform(bm, matrix=Matrix.Translation((CX, CY, 16.9 + 4.0)) @ Matrix.Rotation(math.radians(45), 4, 'Z'), verts=bm.verts)
_obj(bm, 'fleche', 'toit')
block('croixV', (CX - 0.1, CY - 0.1, 24.8), (CX + 0.1, CY + 0.1, 26.6), 'bronze', bevel=0.02)
block('croixH', (CX - 0.55, CY - 0.1, 25.8), (CX + 0.55, CY + 0.1, 26.0), 'bronze', bevel=0.02)

# ------------------------------------------------------------------ CLOÎTRE (côté droit)
CL_X0, CL_X1, CL_Y0, CL_Y1 = W, W + 16.0, -7.0, 9.0   # emprise extérieure
GAL = 3.2                                            # largeur des galeries
OUT_H, LINT = 3.6, 2.7
# Murs extérieurs (3 côtés), avec une brèche
def wall_run(name, a, b, h, gaps=()):
    a, b = Vector(a), Vector(b)
    horizontal = abs(b.x - a.x) > abs(b.y - a.y)
    n = 8
    for i in range(n):
        t0, t1 = i / n, (i + 1) / n
        if any(g0 <= (t0 + t1) / 2 <= g1 for g0, g1 in gaps):
            continue
        p0, p1 = a.lerp(b, t0), a.lerp(b, t1)
        hh = h * (0.55 + random.random() * 0.3 if random.random() < 0.15 else 1.0)
        if horizontal:
            block(f'{name}{i}', (min(p0.x, p1.x), p0.y - 0.35, 0), (max(p0.x, p1.x), p0.y + 0.35, hh))
        else:
            block(f'{name}{i}', (p0.x - 0.35, min(p0.y, p1.y), 0), (p0.x + 0.35, max(p0.y, p1.y), hh))
wall_run('clMurSud', (CL_X0 + 0.3, CL_Y0), (CL_X1, CL_Y0), OUT_H, gaps=((0.45, 0.62),))
wall_run('clMurNord', (CL_X0 + 0.3, CL_Y1), (CL_X1, CL_Y1), OUT_H)
wall_run('clMurEst', (CL_X1, CL_Y0), (CL_X1, CL_Y1), OUT_H, gaps=((0.3, 0.42),))
# Colonnade intérieure + linteaux + toit en appentis vers le mur extérieur
IX0, IX1, IY0, IY1 = CL_X0 + 1.0, CL_X1 - GAL, CL_Y0 + GAL, CL_Y1 - GAL
def colonnade(name, a, b, roof_to, missing=()):
    a, b = Vector(a), Vector(b)
    n = max(2, round((b - a).length / 2.5))
    for i in range(n + 1):
        p = a.lerp(b, i / n)
        if i in missing:
            block(f'{name}Moignon{i}', (p.x - 0.3, p.y - 0.3, 0), (p.x + 0.3, p.y + 0.3, 0.6 + random.random() * 0.6), 'pierre3')
            continue
        block(f'{name}Base{i}', (p.x - 0.36, p.y - 0.36, 0), (p.x + 0.36, p.y + 0.36, 0.3), 'pierre_fonce')
        cylinder(f'{name}Fut{i}', (p.x, p.y, 0.3), 0.24, LINT - 0.6, 'pierre3', seg=10)
        block(f'{name}Chap{i}', (p.x - 0.36, p.y - 0.36, LINT - 0.3), (p.x + 0.36, p.y + 0.36, LINT), 'pierre_fonce')
    # Linteau
    horizontal = abs(b.x - a.x) > abs(b.y - a.y)
    lo, hi = (min(a.x, b.x), max(a.x, b.x)) if horizontal else (min(a.y, b.y), max(a.y, b.y))
    if horizontal:
        block(f'{name}Linteau', (lo - 0.3, a.y - 0.32, LINT), (hi + 0.3, a.y + 0.32, LINT + 0.45))
    else:
        block(f'{name}Linteau', (a.x - 0.32, lo - 0.3, LINT), (a.x + 0.32, hi + 0.3, LINT + 0.45))
    # Toit en appentis : du linteau au mur extérieur
    if roof_to is not None:
        if horizontal:
            y_in, y_out = a.y, roof_to
            pts = [(LINT + 0.45, y_in), (OUT_H + 0.2, y_out), (OUT_H + 0.45, y_out), (LINT + 0.7, y_in)]
            bm = bmesh.new()
            v0 = [bm.verts.new((lo - 0.3, y, z)) for z, y in pts]
            v1 = [bm.verts.new((hi + 0.3, y, z)) for z, y in pts]
        else:
            x_in, x_out = a.x, roof_to
            pts = [(LINT + 0.45, x_in), (OUT_H + 0.2, x_out), (OUT_H + 0.45, x_out), (LINT + 0.7, x_in)]
            bm = bmesh.new()
            v0 = [bm.verts.new((x, lo - 0.3, z)) for z, x in pts]
            v1 = [bm.verts.new((x, hi + 0.3, z)) for z, x in pts]
        bm.faces.new(v0[::-1]); bm.faces.new(v1)
        for i in range(4):
            bm.faces.new((v0[i], v0[(i + 1) % 4], v1[(i + 1) % 4], v1[i]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        _obj(bm, f'{name}Toit', 'toit')
colonnade('galSud', (IX0, IY0), (IX1, IY0), CL_Y0, missing=(3,))
colonnade('galNord', (IX0, IY1), (IX1, IY1), CL_Y1)
colonnade('galEst', (IX1, IY0), (IX1, IY1), CL_X1, missing=(1,))
# Préau : herbe plus sombre et puits au centre
GX, GY = (IX0 + IX1) / 2, (IY0 + IY1) / 2
bm = bmesh.new()
bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=1.1, radius2=1.1, depth=0.9)
bmesh.ops.transform(bm, matrix=Matrix.Translation((GX, GY, 0.45)), verts=bm.verts)
_obj(bm, 'puits', 'pierre3', smooth=True)
cylinder('puitsEau', (GX, GY, 0.9), 0.85, 0.03, 'vitrail', seg=16)
for s in (-1, 1):
    block(f'puitsMontant{s}', (GX + s * 0.95 - 0.1, GY - 0.1, 0.9), (GX + s * 0.95 + 0.1, GY + 0.1, 2.4), 'bois', bevel=0.02)
block('puitsTraverse', (GX - 1.1, GY - 0.08, 2.3), (GX + 1.1, GY + 0.08, 2.45), 'bois_fonce', bevel=0.02)
prism_y('puitsToit', [(GX - 1.4, 2.4), (GX + 1.4, 2.4), (GX, 3.1)], GY - 0.9, GY + 0.9, 'toit')
rubble('gravatsCloitre', (IX0 + 3, IY0 - 1.4, 0), 1.5, 7)

# ------------------------------------------------------------------ FUSION ET EXPORT
for o in OBJS:
    for m in o.modifiers:
        pass
bpy.ops.object.select_all(action='DESELECT')
for o in OBJS:
    o.select_set(True)
bpy.context.view_layer.objects.active = OBJS[0]
bpy.ops.object.convert(target='MESH')
bpy.ops.object.join()
abbey = bpy.context.view_layer.objects.active
abbey.name = 'Abbaye'
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
tris = sum(len(p.vertices) - 2 for p in abbey.data.polygons)

os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(OUT), export_format='GLB', export_yup=True, export_apply=True)
print(f'ABBAYE_OK triangles={tris} -> {OUT}')

if RENDER_DIR:
    os.makedirs(RENDER_DIR, exist_ok=True)
    r = scene.render
    r.engine = 'BLENDER_WORKBENCH'
    r.resolution_x, r.resolution_y = 1400, 900
    sh = scene.display.shading
    sh.light = 'STUDIO'; sh.color_type = 'MATERIAL'; sh.show_object_outline = True; sh.show_cavity = True
    scene.world = bpy.data.worlds.new('w'); scene.world.color = (0.6, 0.68, 0.78)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    scene.collection.objects.link(cam); scene.camera = cam
    target = Vector((4, -2, 4))
    for name, (yaw, pitch, dist) in {'vue_avant': (-35, 22, 55), 'vue_arriere': (150, 30, 55), 'vue_dessus': (-20, 65, 60)}.items():
        y, p = math.radians(yaw), math.radians(pitch)
        d = Vector((math.sin(y) * math.cos(p), -math.cos(y) * math.cos(p), math.sin(p)))
        cam.location = target + d * dist
        cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
        r.filepath = os.path.join(RENDER_DIR, name + '.png')
        bpy.ops.render.render(write_still=True)
    print('RENDERS_OK')
