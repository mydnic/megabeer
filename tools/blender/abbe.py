"""
L'Abbé (boss final de l'Abbaye, invoqué par la Porte du patron) : un grand abbé zombie maigre et voûté, aube blanche
jusqu'aux pieds, chasuble rouge à galons d'or, mitre, crosse dorée à spirale dans la main droite, calice de vin de
messe dans la gauche. Mêmes outils que le Frère Sonneur (tools/blender/figure_kit.py) : volumes fusionnés en une
seule surface, lissés, allégés, poids des os par distance.

    blender -b --factory-startup -P tools/blender/abbe.py -- --out src/assets/models/abbe.glb [--render DIR]

Repère Blender : Z en haut, il regarde vers -Y (devient +Z dans le glTF). Pose de repos en A. Animations : idle, walk,
cast (il tend le calice et répand le vin, à l'image CAST_POUR), hit, roar (phase 2 : il boit le calice), death.
"""
import bpy
import math
import os
import sys
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import figure_kit as K  # noqa: E402
from figure_kit import (  # noqa: E402
    FINAL, TAU, assemble, basis_from, box, build_armature, bvh_of, cap, cone, ell, fist, hard, lathe, make_clip, merge,
    mx, nail, norm, paint, sculpt, seg_dist, surface_frame, tube, weigh,
)

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default=None):
    return argv[argv.index(name) + 1] if name in argv else default
OUT = arg('--out', 'abbe.glb')
RENDER_DIR = arg('--render')
FPS = 30
# Image où le vin quitte le calice dans le clip cast (le jeu pose les flaques dessus)
CAST_POUR = 26

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = FPS

K.PALETTE = {
    'peau':       (0.62, 0.66, 0.54),
    'peau_fonce': (0.44, 0.48, 0.39),
    'aube':       (0.95, 0.93, 0.86),
    'aube_fonce': (0.76, 0.72, 0.62),
    'chasuble':   (0.56, 0.08, 0.10),
    'chasuble_f': (0.36, 0.04, 0.07),
    'or':         (0.92, 0.70, 0.22),
    'or_fonce':   (0.62, 0.42, 0.10),
    'mitre':      (0.90, 0.86, 0.76),
    'vin':        (0.42, 0.03, 0.10),
    'cheveux':    (0.86, 0.86, 0.82),
    'oeil':       (0.70, 0.95, 1.00),
    'pupille':    (0.05, 0.12, 0.18),
    'ivoire':     (0.88, 0.84, 0.66),
    'ongle':      (0.30, 0.30, 0.24),
    'bouche':     (0.18, 0.04, 0.06),
    'cuir':       (0.42, 0.08, 0.08),
    'rubis':      (0.85, 0.08, 0.15),
}

# ---------------------------------------------------------------- squelette (pose en A) : grand, maigre, voûté
UA = norm((0.70, 0.05, -0.71))
FA = norm((0.62, -0.30, -0.73))
SH = Vector((0.46, 0.04, 2.02))
EL = SH + UA * 0.58
WR = EL + FA * 0.52
HEAD_C = Vector((0, -0.22, 2.40))
B = {
    'hips':       ((0, 0, 1.10), (0, 0, 1.40), None),
    'spine':      ((0, 0, 1.40), (0, 0.02, 1.75), 'hips'),
    'belly':      ((0, -0.10, 1.40), (0, -0.40, 1.40), 'spine'),
    'chest':      ((0, 0.02, 1.75), (0, 0.0, 2.10), 'spine'),
    'head':       ((0, -0.06, 2.10), (0, -0.24, 2.70), 'chest'),
    'thigh.L':    ((0.17, 0, 1.10), (0.19, -0.02, 0.60), 'hips'),
    'shin.L':     ((0.19, -0.02, 0.60), (0.20, 0.02, 0.12), 'thigh.L'),
    'foot.L':     ((0.20, 0.02, 0.12), (0.20, -0.24, 0.04), 'shin.L'),
    'thigh.R':    ((-0.17, 0, 1.10), (-0.19, -0.02, 0.60), 'hips'),
    'shin.R':     ((-0.19, -0.02, 0.60), (-0.20, 0.02, 0.12), 'thigh.R'),
    'foot.R':     ((-0.20, 0.02, 0.12), (-0.20, -0.24, 0.04), 'shin.R'),
}
for s, side in ((1, 'L'), (-1, 'R')):
    B[f'upperarm.{side}'] = (tuple(mx(SH, s)), tuple(mx(EL, s)), 'chest')
    B[f'forearm.{side}'] = (tuple(mx(EL, s)), tuple(mx(WR, s)), f'upperarm.{side}')
    B[f'hand.{side}'] = (tuple(mx(WR, s)), tuple(mx(WR, s) + mx(FA, s) * 0.22), f'forearm.{side}')
# La crosse dans la main droite, debout ; le calice dans la gauche
FAR = mx(FA, -1)
GRIP_R = mx(WR, -1) + FAR * 0.17
STAFF = Vector((0.0, 0.0, 1.0))
GRIP_L = WR + FA * 0.17
B['crozier'] = (tuple(GRIP_R), tuple(GRIP_R + STAFF * 0.5), 'hand.R')
K.B = B
HEM = 0.06

# ---------------------------------------------------------------- la tête : crâne étroit, joues creuses, nez crochu
def build_head():
    C = HEAD_C
    def P(x, y, z):
        return C + Vector((x, y, z))
    parts = [
        ell(P(0, 0.03, 0.08), (0.185, 0.22, 0.25)),                       # crâne étroit et haut
        ell(P(0, -0.135, 0.11), (0.17, 0.07, 0.045)),                     # arcade
        ell(P(0, -0.20, 0.03), (0.038, 0.05, 0.07)),                      # arête du nez
        ell(P(0, -0.245, -0.03), (0.042, 0.07, 0.045), rot=(30, 0, 0)),   # nez crochu, pointe vers le bas
        ell(P(0, -0.22, -0.075), (0.03, 0.035, 0.03)),
        ell(P(0, -0.10, -0.11), (0.145, 0.13, 0.11)),                     # bas du visage
        ell(P(0, -0.15, -0.22), (0.09, 0.09, 0.09)),                      # menton en galoche
        ell(P(0, -0.19, -0.27), (0.06, 0.06, 0.06)),
        cap(P(0, 0.04, -0.34), P(0, -0.02, -0.12), 0.095, 0.10),          # cou décharné
        ell(P(0, -0.04, -0.30), (0.05, 0.05, 0.05)),                      # pomme d'Adam
    ]
    for s in (1, -1):
        parts += [
            ell(P(0.10 * s, -0.12, 0.02), (0.07, 0.07, 0.06)),            # orbite
            ell(P(0.125 * s, -0.08, -0.07), (0.05, 0.06, 0.04)),          # pommette saillante (joue creuse dessous)
            ell(P(0.175 * s, 0.01, 0.0), (0.03, 0.065, 0.11), rot=(-10, 22 * s, 0)),   # oreille longue
            ell(P(0.205 * s, 0.03, 0.10), (0.022, 0.04, 0.06), rot=(-25, 30 * s, 0)),  # pointe de l'oreille
            ell(P(0.05 * s, -0.125, 0.14), (0.06, 0.035, 0.03), rot=(0, -18 * s, 0)),  # sourcil levé
        ]
    first = len(FINAL)
    head = sculpt('tete', parts, voxel=0.009, smooth=5, tris=4200)
    paint(head, 'peau', [('peau_fonce', lambda c, n: abs(c.x) > 0.06 and -0.2 < c.y < -0.05 and C.z - 0.12 < c.z < C.z - 0.03)])
    weigh(head, ['head'])
    FINAL.append(head)
    bvh = bvh_of(head)
    # Yeux pâles enfoncés, pupilles minuscules
    for s in (1, -1):
        hard(ell(P(0.085 * s, -0.165, 0.035), (0.032, 0.03, 0.028), seg=12, rings=8), 'oeil', 'head', smooth=True)
        hard(ell(P(0.083 * s, -0.192, 0.033), (0.01, 0.006, 0.01), seg=8, rings=6), 'pupille', 'head', smooth=True)
    # Bouche fine, quelques dents jaunes qui dépassent
    hard(ell(P(0, -0.205, -0.135), (0.075, 0.03, 0.014)), 'bouche', 'head', smooth=True)
    for x, h in ((-0.04, 0.03), (0.02, 0.022), (0.05, 0.026)):
        hard(box(P(x, -0.222, -0.13 - h / 2 + 0.01), (0.022, 0.016, h), bevel=0.004), 'ivoire', 'head')
    # Couronne de longs cheveux blancs filasses sous la mitre, barbe en pointe
    for i in range(16):
        a = math.radians(70 + i * (220 / 15))
        loc, nrm, _, _ = bvh.ray_cast(P(0, 0.03, 0.0), norm((math.sin(a), -math.cos(a), 0.15)))
        if loc is None:
            continue
        down, sidev, n = surface_frame(nrm, up=(0, 0, -1))
        hard(tube([loc + n * 0.005, loc + n * 0.03 + down * 0.12, loc + n * 0.02 + down * 0.24 + sidev * 0.02],
                  [0.018, 0.014, 0.004], seg=6), 'cheveux', 'head', smooth=True)
    for k in range(7):
        o = (k - 3) * 0.02
        hard(tube([P(o, -0.17, -0.20), P(o * 1.2, -0.22, -0.30), P(o * 0.5, -0.24, -0.42 + abs(o) * 2)],
                  [0.02, 0.016, 0.004], seg=6), 'cheveux', 'head', smooth=True)
    # La mitre : deux pans pointus devant et derrière, bandeau d'or, croix, fanons qui pendent dans le dos
    base_z = C.z + 0.19
    mc = Vector((0, C.y + 0.025, base_z))
    # Flancs presque droits, puis une pointe en arc brisé (vue de face), étroite de profil
    mitre = sculpt('mitre', [cone(mc - Vector((0, 0, 0.01)), mc + Vector((0, 0, 0.30)), 0.205, 0.19, seg=28, scale_y=0.5),
                             cone(mc + Vector((0, 0, 0.29)), mc + Vector((0, 0, 0.50)), 0.19, 0.012, seg=28, scale_y=0.5),
                             ell(mc + Vector((0, 0, 0.30)), (0.19, 0.095, 0.10)),
                             ell(mc + Vector((0, 0, 0.04)), (0.205, 0.105, 0.07))], voxel=0.008, smooth=3, tris=1800)
    paint(mitre, 'mitre')
    weigh(mitre, ['head'])
    FINAL.append(mitre)
    mb = bvh_of(mitre)
    hard(lathe([(0, 0.0), (0.21, 0.0), (0.215, 0.07), (0, 0.07)], mc - Vector((0, 0, 0.015)), (0, 0, 1), seg=28), 'or', 'head')
    for sy in (-1, 1):
        loc, nrm, _, _ = mb.ray_cast(mc + Vector((0, 0, 0.26)), Vector((0, sy, 0)))
        if loc is None:
            continue
        t, b, n = surface_frame(nrm)
        hard(box(loc + n * 0.008, (0.035, 0.22, 0.014), basis=(b, t, n), bevel=0.004), 'or', 'head')
        hard(box(loc + n * 0.008 + t * 0.03, (0.13, 0.035, 0.014), basis=(b, t, n), bevel=0.004), 'or', 'head')
        hard(ell(loc + n * 0.018 + t * 0.03, (0.022, 0.022, 0.012), basis=(b, t, n), seg=8, rings=6), 'rubis', 'head', smooth=True)
    for sx in (-0.07, 0.07):
        hard(tube([Vector((sx, C.y + 0.09, base_z + 0.02)), Vector((sx, C.y + 0.16, base_z - 0.18)), Vector((sx * 1.2, C.y + 0.19, base_z - 0.42))],
                  0.03, seg=6, flat=(1.6, 0.35)), 'mitre', 'head', smooth=True)
        hard(box(Vector((sx * 1.2, C.y + 0.19, base_z - 0.43)), (0.1, 0.02, 0.05), bevel=0.006), 'or', 'head')

# ---------------------------------------------------------------- les mains : longs doigts osseux, griffes
def build_hands():
    # Main droite : poing fermé sur la crosse (manche vertical). Le kit pose le pouce du côté de -h : h vers le bas
    # met le pouce en haut, par-dessus l'index, comme une vraie prise
    h = -STAFF
    u = (-FAR - h * (-FAR).dot(h)).normalized()
    fist('main.R', 'hand.R', mx(WR, -1), FAR, GRIP_R, h, u, h.cross(u))
    # Main gauche : poing fermé sur la tige du calice (vertical, calice au-dessus de la main)
    u = (-FA - h * (-FA).dot(h)).normalized()
    fist('main.L', 'hand.L', WR, FA, GRIP_L, h, u, h.cross(u))
    for base, side in ((GRIP_R, 'R'), (GRIP_L, 'L')):
        for k in range(4):
            tip = base + h * ((k - 1.5) * 0.086) + (-u if side == 'L' else (-FAR - h * (-FAR).dot(h)).normalized() * -1) * 0.0
            del tip

# ---------------------------------------------------------------- la crosse et le calice
def build_props():
    # Crosse : long bâton d'or, noeud ouvragé, volute en spirale au sommet, pied pointu
    g = GRIP_R
    bottom = Vector((g.x, g.y, 0.02))
    top = g + STAFF * 1.15
    hard(tube([bottom, top], 0.035, seg=10), 'or', 'crozier', smooth=True)
    for z, r in ((g.z + 0.25, 0.055), (g.z + 0.6, 0.05), (top.z - 0.02, 0.07)):
        hard(lathe([(0, -0.04), (r, -0.02), (r * 1.1, 0.0), (r, 0.02), (0, 0.04)], Vector((g.x, g.y, z)), (0, 0, 1), seg=12), 'or_fonce', 'crozier', smooth=True)
    hard(lathe([(0, -0.08), (0.03, -0.02), (0.04, 0.0), (0, 0.0)], bottom + Vector((0, 0, 0.06)), (0, 0, 1), seg=10), 'or_fonce', 'crozier', smooth=True)
    # Volute : spirale qui monte puis s'enroule vers l'avant
    pts, radii = [], []
    for i in range(34):
        t = i / 33
        a = t * 1.65 * TAU
        r = 0.20 * (1 - 0.72 * t)
        pts.append(top + Vector((0, -math.sin(a) * r, 0.20 + math.cos(a) * r * 0.95 - 0.2 * (1 - t))) + Vector((0, 0, 0.05)))
        radii.append(0.034 * (1 - 0.5 * t))
    hard(tube(pts, radii, seg=10), 'or', 'crozier', smooth=True)
    # Crochets décoratifs le long de la volute
    for i in range(3, 30, 4):
        hard(ell(pts[i] + Vector((0, 0, 0.03)), (0.018, 0.018, 0.03), seg=8, rings=6), 'or_fonce', 'crozier', smooth=True)
    hard(ell(pts[-1], (0.04, 0.04, 0.04), seg=10, rings=7), 'rubis', 'crozier', smooth=True)

    # Calice : pied, tige à noeud, coupe évasée pleine de vin
    c0 = GRIP_L - STAFF * 0.13
    hard(lathe([(0, 0.0), (0.12, 0.0), (0.12, 0.015), (0.06, 0.04), (0.025, 0.08), (0.022, 0.2), (0.045, 0.24), (0.022, 0.28),
                (0.025, 0.32), (0.07, 0.34), (0.11, 0.40), (0.125, 0.48), (0.118, 0.485), (0.10, 0.42), (0, 0.40)], c0, (0, 0, 1), seg=20),
         'or', 'hand.L', smooth=True)
    hard(lathe([(0, 0.455), (0.112, 0.455), (0.112, 0.465), (0, 0.465)], c0, (0, 0, 1), seg=20), 'vin', 'hand.L', smooth=True)
    for k in range(4):
        a = k / 4 * TAU
        hard(ell(c0 + Vector((math.cos(a) * 0.046, math.sin(a) * 0.046, 0.24)), (0.014, 0.014, 0.014), seg=8, rings=6), 'rubis', 'hand.L', smooth=True)

# ---------------------------------------------------------------- jambes (cachées sous l'aube) et souliers rouges
def build_legs():
    for s, side in ((1, 'L'), (-1, 'R')):
        H, Kn, A = (mx(B['thigh.L'][0], s), mx(B['thigh.L'][1], s), mx(B['shin.L'][1], s))
        leg = sculpt(f'jambe.{side}', [cap(H, Kn, 0.12, 0.09), cap(Kn, A, 0.09, 0.07)], voxel=0.016, smooth=2, tris=700)
        paint(leg, 'peau')
        weigh(leg, [f'thigh.{side}', f'shin.{side}'], power=5)
        FINAL.append(leg)
        fx = 0.20 * s
        shoe = sculpt(f'soulier.{side}', [ell((fx, -0.10, 0.06), (0.10, 0.22, 0.07), cut_z=0.0), ell((fx, -0.30, 0.06), (0.05, 0.08, 0.05), rot=(-20, 0, 0))],
                      voxel=0.012, smooth=2, tris=700)
        paint(shoe, 'cuir')
        weigh(shoe, [f'foot.{side}'])
        FINAL.append(shoe)

# ---------------------------------------------------------------- vêtements : aube, chasuble
def weigh_cloth(obj, skirt_below):
    """Vêtement : bas sur le bassin, tronc par distance aux os du tronc, manches par distance aux os du bras."""
    torso = ['hips', 'spine', 'belly', 'chest']
    groups = {b: obj.vertex_groups.new(name=b) for b in torso + ['upperarm.L', 'forearm.L', 'upperarm.R', 'forearm.R']}
    def by_dist(p, bones, power):
        ws = [(1.0 / (seg_dist(p, Vector(B[b][0]), Vector(B[b][1])) + 1e-4) ** power, b) for b in bones]
        total = sum(w for w, _ in ws)
        return {b: w / total for w, b in ws}
    for vt in obj.data.vertices:
        p = vt.co
        w = {'hips': 1.0} if p.z < skirt_below else by_dist(p, torso, 5)
        for s, side in ((1, 'L'), (-1, 'R')):
            sh, el, wr, ua = mx(SH, s), mx(EL, s), mx(WR, s), mx(UA, s)
            along = (p - sh).dot(ua)
            t = max(0.0, min(1.0, (p - el).dot(wr - el) / (wr - el).length_squared))
            if along <= 0.05 or min(seg_dist(p, sh, el) / 0.2, seg_dist(p, el, wr) / (0.18 + 0.14 * t)) >= 1:
                continue
            r = min(1.0, (along - 0.05) / 0.22)
            r = r * r * (3 - 2 * r)
            wa = by_dist(p, [f'upperarm.{side}', f'forearm.{side}'], 6)
            w = {b: x * (1 - r) for b, x in w.items()}
            for b, x in wa.items():
                w[b] = w.get(b, 0) + x * r
        for b, x in w.items():
            if x > 0.02:
                groups[b].add([vt.index], x, 'REPLACE')


def build_clothes():
    # Aube : longue robe blanche jusqu'aux pieds, manches étroites
    parts = [
        cone((0, 0.02, HEM), (0, 0.02, 1.30), 0.48, 0.30, seg=24),
        ell((0, 0.04, 1.55), (0.34, 0.27, 0.40)),                                  # buste maigre
        ell((0, 0.10, 1.92), (0.44, 0.27, 0.20)),                                  # épaules voûtées
        ell((0, 0.20, 2.0), (0.30, 0.20, 0.16)),                                   # bosse du dos
    ]
    for s in (1, -1):
        sh, el, wr = mx(SH, s), mx(EL, s), mx(WR, s)
        fa = mx(FA, s)
        parts += [ell(sh, (0.15, 0.15, 0.14)), cap(sh, el, 0.12, 0.10), cap(el, wr - fa * 0.18, 0.10, 0.12),
                  cone(wr - fa * 0.22, wr - fa * 0.02, 0.12, 0.19, seg=16)]

    def folds(obj):
        for vt in obj.data.vertices:
            p = vt.co
            if p.z > 1.2 or abs(vt.normal.z) > 0.5:
                continue
            r = math.hypot(p.x, p.y - 0.02)
            if r < 0.2:
                continue
            th = math.atan2(p.y - 0.02, p.x)
            k = max(0.0, min(1.0, (1.2 - p.z) / 0.8))
            amp = 0.025 * k * math.sin(11 * th + 0.8 * math.sin(3 * th))
            p.x += p.x / r * amp
            p.y += (p.y - 0.02) / r * amp
        obj.data.update()

    alb = sculpt('aube', parts, voxel=0.02, smooth=6, tris=6500, post=folds)
    cuffs = [(mx(WR, s) - mx(FA, s) * 0.02, mx(FA, s)) for s in (1, -1)]
    paint(alb, 'aube', [('aube_fonce', lambda c, n: c.z < HEM + 0.12),
                        ('aube_fonce', lambda c, n: any((c - e).length < 0.22 and -0.07 < (c - e).dot(f) for e, f in cuffs))])
    weigh_cloth(alb, 1.0)
    FINAL.append(alb)
    bvh = bvh_of(alb)

    # Chasuble : grand vêtement rouge sans manches, tombant devant et derrière jusqu'aux genoux, galons d'or en Y
    cparts = [
        cone((0, 0.03, 0.95), (0, 0.04, 1.95), 0.64, 0.42, seg=32, scale_y=0.66),
        ell((0, 0.06, 1.97), (0.47, 0.31, 0.15)),
        ell((0, 0.20, 1.99), (0.33, 0.22, 0.17)),
    ]

    def cut_below(obj):
        import bmesh
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, 0.92), plane_no=(0, 0, 1), clear_inner=True)
        bm.to_mesh(obj.data)
        bm.free()
        # Bord ondulé du bas
        for vt in obj.data.vertices:
            if vt.co.z < 0.97:
                th = math.atan2(vt.co.y, vt.co.x)
                vt.co.z += 0.03 * math.sin(6 * th)
        obj.data.update()

    chas = sculpt('chasuble', cparts, voxel=0.02, smooth=5, tris=3500, post=cut_below)
    paint(chas, 'chasuble', [('chasuble_f', lambda c, n: c.z < 1.0)])
    weigh_cloth(chas, 1.0)
    FINAL.append(chas)
    cbvh = bvh_of(chas)

    def on(origin, direction):
        loc, nrm, _, _ = cbvh.ray_cast(Vector(origin), norm(direction))
        return loc, nrm

    # Galons d'or : un Y devant et derrière, et le bord du bas
    for sy in (-1, 1):
        stem, arms_ = [], [[], []]
        for i in range(12):
            z = 0.98 + i * 0.07
            loc, nrm = on((0, 0, z), (0, sy, 0))
            if loc is not None:
                stem.append(loc + nrm * 0.012)
        for j, sx in enumerate((-1, 1)):
            for i in range(7):
                t = i / 6
                loc, nrm = on((0, 0, 1.70 + 0.32 * t), (sx * (0.15 + 0.85 * t), sy, 0.1 * t))
                if loc is not None:
                    arms_[j].append(loc + nrm * 0.012)
        for path in [stem] + arms_:
            if len(path) > 1:
                hard(tube(path, 0.045, seg=6, flat=(1.0, 0.25)), 'or', 'chest', smooth=True)
    hem = []
    for i in range(40):
        th = i / 40 * TAU
        loc, nrm = on((0, 0.02, 1.02 + 0.03 * math.sin(6 * th)), (math.cos(th), math.sin(th), 0))
        if loc is not None:
            hem.append(loc + nrm * 0.01)
    if len(hem) > 3:
        hard(tube(hem, 0.03, seg=6, closed=True), 'or', 'hips', smooth=True)
    # Col d'or (amict) et grosse croix pectorale sur une chaîne
    hard(tube([Vector((0.21 * math.cos(a), 0.05 + 0.17 * math.sin(a) - 0.03, 2.07)) for a in (i / 20 * TAU for i in range(20))], 0.035, seg=8, closed=True),
         'or', 'chest', smooth=True)
    loc, nrm = on((0, 0, 1.70), (0, -1, 0))
    t, b, n = surface_frame(nrm)
    c = loc + n * 0.035
    hard(box(c, (0.07, 0.22, 0.03), basis=(b, t, n), bevel=0.012), 'or', 'chest')
    hard(box(c + t * 0.04, (0.18, 0.06, 0.03), basis=(b, t, n), bevel=0.012), 'or', 'chest')
    hard(ell(c + t * 0.04 + n * 0.02, (0.03, 0.03, 0.02), basis=(b, t, n), seg=10, rings=6), 'rubis', 'chest', smooth=True)
    del bvh

# ---------------------------------------------------------------- animation
def arms(lu, lf, ru, rf):
    return {'upperarm.L': {'dir': lu}, 'forearm.L': {'dir': lf}, 'upperarm.R': {'dir': ru}, 'forearm.R': {'dir': rf}}

def build_clips(arm):
    # Repos : la crosse plantée à sa droite, le calice tenu devant lui à gauche, le dos voûté
    def stand(sw=0.0):
        return arms((0.42, 0.0 - sw, -1), (0.35, -0.75, -0.15), (-0.50, 0.05 + sw * 0.4, -1), (-0.40, -0.55, -0.35))
    base = merge(stand(), {'spine': {'r': (8, 0, 0)}, 'chest': {'r': (6, 0, 0)}, 'head': {'r': (6, 0, 0)}})

    L = 60
    idle = {}
    for i in range(5):
        ph = i / 4 * TAU
        s = math.sin(ph)
        idle[i * L // 4] = merge(base, stand(0.04 * s), {
            'hips': {'r': (0, 1.5 * s, 0)}, 'spine': {'r': (8 + 1.5 * math.sin(ph * 2), -2 * s, 0)},
            'head': {'r': (6 + 3 * math.sin(ph * 2 + 0.5), 4 * math.sin(ph + 0.7), 8 * math.sin(ph + 0.3))},
        })
    make_clip(arm, 'idle', L, idle, loop=True)

    # Marche lente et raide, il s'appuie sur sa crosse
    L = 42
    walk = {}
    for i in range(9):
        a = i / 8 * TAU
        s, c = math.sin(a), math.cos(a)
        walk[i * L // 8] = merge(base, stand(0.1 * s), {
            'hips': {'r': (2, 4 * s, -4 * s), 'l': (0.03 * s, 0, 0.02 * math.cos(2 * a) - 0.02)},
            'spine': {'r': (10, -3 * s, 5 * s)}, 'head': {'r': (4, 3 * c, -5 * s)},
            'thigh.L': {'r': (-24 * s, 0, 0)}, 'shin.L': {'r': (max(0, 35 * math.sin(a + 1.9)) + 4, 0, 0)},
            'thigh.R': {'r': (24 * s, 0, 0)}, 'shin.R': {'r': (max(0, 35 * math.sin(a + math.pi + 1.9)) + 4, 0, 0)},
        })
    make_clip(arm, 'walk', L, walk, loop=True)

    rest = idle[0]
    # Cast : il lève le calice, puis le renverse d'un grand geste vers l'avant ; le vin part à CAST_POUR
    lift = merge(base, arms((0.35, -0.55, 0.75), (0.15, -0.35, 0.95), (-0.50, 0.05, -1), (-0.40, -0.55, -0.35)), {
        'spine': {'r': (-6, 0, -6)}, 'head': {'r': (-14, 0, 0)}})
    pour = merge(base, arms((0.25, -1, 0.15), (0.05, -0.95, -0.35), (-0.50, 0.05, -1), (-0.40, -0.55, -0.35)), {
        'spine': {'r': (18, 0, 8)}, 'chest': {'r': (8, 0, 4)}, 'head': {'r': (10, 0, 0)}, 'hand.L': {'r': (0, 0, 0)}})
    make_clip(arm, 'cast', 48, {0: rest, 16: lift, CAST_POUR: pour, 36: pour, 48: rest}, loop=False)

    hurt = merge(rest, {'spine': {'r': (-6, 0, 6)}, 'head': {'r': (-18, 0, 8)}})
    make_clip(arm, 'hit', 12, {0: rest, 3: hurt, 12: rest}, loop=False)

    # Roar (phase 2) : il porte le calice à sa bouche, renverse la tête et boit d'un trait, puis se cambre
    drink = merge(base, arms((0.30, -0.80, -0.30), (-0.80, -0.55, 0.30), (-0.50, 0.05, -1), (-0.40, -0.55, -0.35)), {
        'spine': {'r': (-10, 0, 0)}, 'chest': {'r': (-8, 0, 0)}, 'head': {'r': (-35, 0, 0)}})
    howl = merge(base, arms((0.9, -0.2, 0.3), (0.6, -0.3, 0.8), (-0.5, 0.05, -1), (-0.4, -0.55, -0.35)), {
        'spine': {'r': (-18, 0, 0)}, 'chest': {'r': (-10, 0, 0)}, 'head': {'r': (-25, 0, 0)}})
    make_clip(arm, 'roar', 45, {0: rest, 10: drink, 26: drink, 34: howl, 45: howl}, loop=False)

    knees = merge(rest, {'hips': {'l': (0, 0, -0.5), 'r': (6, 0, 0)}, 'thigh.L': {'r': (-80, 0, 0)}, 'shin.L': {'r': (95, 0, 0)},
                         'thigh.R': {'r': (-75, 0, 0)}, 'shin.R': {'r': (95, 0, 0)}, 'spine': {'r': (-10, 0, 6)}, 'head': {'r': (-25, 0, 10)}})
    down = merge(knees, {'hips': {'l': (0, 0.45, -0.75), 'r': (-70, 0, 0)}, 'spine': {'r': (-8, 0, 0)}, 'head': {'r': (-10, 0, 25)}})
    make_clip(arm, 'death', 60, {0: rest, 8: hurt, 24: knees, 44: down, 60: down}, loop=False)

# ---------------------------------------------------------------- construction et export
build_head()
build_hands()
build_legs()
build_clothes()
build_props()
arm = build_armature('Abbe_rig')
body = assemble(arm, 'Abbe')
build_clips(arm)
scene.frame_start, scene.frame_end = 0, 60

os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.export_scene.gltf(
    filepath=os.path.abspath(OUT), export_format='GLB', export_animation_mode='NLA_TRACKS', export_skins=True,
    export_morph=False, export_yup=True, export_force_sampling=True, export_optimize_animation_size=False,
)
tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
print(f'ABBE_OK triangles={tris} materiaux={len(body.data.materials)} -> {OUT}')

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
    world = bpy.data.worlds.new('w')
    scene.world = world
    world.color = (0.55, 0.65, 0.75)
    cam_data = bpy.data.cameras.new('cam')
    cam_data.type = 'ORTHO'
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam

    def shoot(fname, yaw_deg, pitch_deg=8, action=None, frame=0, scale=4.0, target=(0, 0, 1.5)):
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

    shoot('face.png', 0, action='idle')
    shoot('trois_quarts.png', -35, 12, action='idle')
    shoot('profil.png', 90, action='idle')
    shoot('dos.png', 160, 15, action='idle')
    shoot('tete.png', -25, 6, action='idle', scale=1.3, target=(0, -0.25, 2.5))
    shoot('cast_haut.png', -40, 5, action='cast', frame=16, scale=4.4)
    shoot('cast_vin.png', 70, 5, action='cast', frame=CAST_POUR, scale=4.4)
    shoot('roar.png', -60, 5, action='roar', frame=20, scale=4.4)
    shoot('death.png', 70, 10, action='death', frame=60, scale=4.4, target=(0, 0, 0.8))
    # Gros plans des mains (pose de repos), de face et de profil extérieur
    for side, yaw in (('R', -60), ('L', 60)):
        scene.frame_set(0)
        pb = arm.pose.bones[f'hand.{side}']
        at = arm.matrix_world @ pb.tail
        shoot(f'main_{side}_face.png', 0, 5, action='idle', scale=0.9, target=tuple(at))
        shoot(f'main_{side}_cote.png', yaw, 5, action='idle', scale=0.9, target=tuple(at))
    print('RENDERS_OK', RENDER_DIR)
