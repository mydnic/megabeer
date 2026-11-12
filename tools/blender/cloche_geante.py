"""
La cloche géante du Frère Sonneur (boss de 5:00 de l'Abbaye) : grosse cloche de bronze d'église, profil lisse,
cordons en relief, bande d'inscription, couronne à anses, battant de fer, patine verte aux creux.

    blender -b --factory-startup -P tools/blender/cloche_geante.py -- --out src/assets/models/cloche_geante.glb [--render FICHIER]

Origine au centre de la lèvre (le bord du bas), axe vers le haut ; hauteur 1 (le jeu la met à l'échelle). Le battant
est un objet à part nommé `battant`, accroché sous la couronne (le jeu le fait balancer quand elle sonne).
Matériaux nommés (Bronze, BronzeFonce, Patine, Fer) : le jeu les colore depuis sa config.
"""
import argparse
import math
import sys

import bmesh
import bpy
from mathutils import Vector

ap = argparse.ArgumentParser()
ap.add_argument('--out', required=True)
ap.add_argument('--render')
args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:])

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
SEG = 48
TAU = math.tau


def material(name, rgb):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.diffuse_color = (*rgb, 1)
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*rgb, 1)
    return m


BRONZE = material('Bronze', (0.72, 0.48, 0.18))
DARK = material('BronzeFonce', (0.40, 0.25, 0.10))
PATINA = material('Patine', (0.28, 0.52, 0.42))
IRON = material('Fer', (0.30, 0.31, 0.34))


def new_object(name, mats):
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    for m in mats:
        mesh.materials.append(m)
    return obj, bmesh.new()


def finish(obj, bm, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()
    for p in obj.data.polygons:
        p.use_smooth = smooth


def lathe(bm, profile, mats, seg=SEG, z0=0.0):
    """Révolution d'un profil [(rayon, hauteur)] ; `mats(i)` : matériau de la bande i ; rayon 0 : pôle."""
    rings = []
    for r, h in profile:
        if r == 0:
            rings.append([bm.verts.new((0, 0, z0 + h))])
        else:
            rings.append([bm.verts.new((r * math.cos(k / seg * TAU), r * math.sin(k / seg * TAU), z0 + h)) for k in range(seg)])
    for i, (a, b) in enumerate(zip(rings, rings[1:])):
        for k in range(seg):
            if len(a) == 1 and len(b) == 1:
                continue
            if len(a) == 1:
                f = bm.faces.new((a[0], b[(k + 1) % seg], b[k]))
            elif len(b) == 1:
                f = bm.faces.new((a[k], a[(k + 1) % seg], b[0]))
            else:
                f = bm.faces.new((a[k], a[(k + 1) % seg], b[(k + 1) % seg], b[k]))
            f.material_index = mats(i)
    return rings


def torus(bm, center, axis_u, axis_v, R, r, mat, seg=20, rseg=10, arc=TAU):
    """Anneau (ou arc) de rayon R et d'épaisseur r dans le plan (u, v)."""
    c = Vector(center)
    u, v = Vector(axis_u).normalized(), Vector(axis_v).normalized()
    n = u.cross(v)
    full = abs(arc - TAU) < 1e-6
    count = seg if full else seg + 1
    rings = []
    for i in range(count):
        t = arc * i / seg
        d = u * math.cos(t) + v * math.sin(t)
        p = c + d * R
        rings.append([bm.verts.new(p + (d * math.cos(k / rseg * TAU) + n * math.sin(k / rseg * TAU)) * r) for k in range(rseg)])
    for i in range(seg if full else seg):
        a, b = rings[i], rings[(i + 1) % count]
        for k in range(rseg):
            bm.faces.new((a[k], a[(k + 1) % rseg], b[(k + 1) % rseg], b[k])).material_index = mat
    if not full:
        bm.faces.new(list(reversed(rings[0]))).material_index = mat
        bm.faces.new(rings[-1]).material_index = mat


# --- Corps : profil extérieur (lèvre épaisse, pince, flanc, cerveau), puis intérieur (paroi épaisse)
OUT = [(0.500, 0.000), (0.505, 0.020), (0.492, 0.045), (0.462, 0.090), (0.420, 0.150), (0.385, 0.220), (0.360, 0.300),
       (0.345, 0.390), (0.338, 0.480), (0.335, 0.560), (0.330, 0.640), (0.318, 0.720), (0.295, 0.790), (0.255, 0.850),
       (0.195, 0.895), (0.120, 0.922), (0.040, 0.932), (0.0, 0.933)]
INNER = [(0.0, 0.85), (0.10, 0.84), (0.20, 0.80), (0.26, 0.73), (0.285, 0.62), (0.292, 0.48), (0.300, 0.34), (0.330, 0.21),
         (0.380, 0.11), (0.430, 0.045), (0.462, 0.0)]
# Bandes peintes : patine dans le bas de la lèvre, bande sombre de l'inscription, cordons de bronze clair
def band(i):
    h = OUT[i][1]
    if h < 0.03:
        return 2
    if 0.56 <= h < 0.72:
        return 1
    return 0
body, bm = new_object('cloche', [BRONZE, DARK, PATINA, IRON])
outer = lathe(bm, OUT, band)
inner = lathe(bm, INNER, lambda i: 1)
# Fond de lèvre : rejoint le bord extérieur et le bord intérieur
for k in range(SEG):
    bm.faces.new((outer[0][(k + 1) % SEG], outer[0][k], inner[-1][k], inner[-1][(k + 1) % SEG])).material_index = 2
# Cordons en relief (anneaux) : un gros au-dessus de la pince, deux fins de part et d'autre de l'inscription, un au cerveau
for h, r_minor, mat in ((0.11, 0.016, 0), (0.30, 0.010, 0), (0.555, 0.010, 0), (0.725, 0.010, 0), (0.85, 0.012, 0)):
    R = next(r for r, hh in reversed(OUT) if hh <= h + 1e-6)
    lo = max((p for p in OUT if p[1] <= h), key=lambda p: p[1])
    hi = min((p for p in OUT if p[1] >= h), key=lambda p: p[1])
    t = (h - lo[1]) / max(1e-6, hi[1] - lo[1])
    R = lo[0] + (hi[0] - lo[0]) * t
    torus(bm, (0, 0, h), (1, 0, 0), (0, 1, 0), R + r_minor * 0.3, r_minor, mat, seg=SEG, rseg=8)
# Inscription : petits reliefs en creux dans la bande sombre (des « lettres » carrées), et une croix en relief
for k in range(28):
    a = k / 28 * TAU + 0.05
    if 0.0 < (a % TAU) < 0.55:
        continue  # place de la croix
    h = 0.64 + 0.012 * math.sin(k * 2.7)
    R = 0.333
    w, hh, d = 0.022, 0.045 + 0.01 * ((k * 7) % 3), 0.008
    c = Vector((math.cos(a) * (R + d / 2), math.sin(a) * (R + d / 2), h))
    n = Vector((math.cos(a), math.sin(a), 0))
    t = Vector((-math.sin(a), math.cos(a), 0))
    vs = [bm.verts.new(c + t * sx * w / 2 + Vector((0, 0, sz * hh / 2)) + n * sd * d / 2) for sx, sz, sd in
          ((-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1), (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1))]
    for f in ((0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)):
        bm.faces.new([vs[i] for i in f]).material_index = 0
a = 0.28
n = Vector((math.cos(a), math.sin(a), 0))
t = Vector((-math.sin(a), math.cos(a), 0))
for (w, h, cz) in ((0.03, 0.16, 0.42), (0.11, 0.03, 0.45)):
    R = 0.343 if cz < 0.5 else 0.335
    c = n * (R + 0.008) + Vector((0, 0, cz))
    vs = [bm.verts.new(c + t * sx * w / 2 + Vector((0, 0, sz * h / 2)) + n * sd * 0.012) for sx, sz, sd in
          ((-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1), (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1))]
    for f in ((0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)):
        bm.faces.new([vs[i] for i in f]).material_index = 0
# Couronne : six anses en demi-anneaux sur le sommet, autour d'une anse centrale
for k in range(6):
    a = k / 6 * TAU
    d = Vector((math.cos(a), math.sin(a), 0))
    torus(bm, d * 0.085 + Vector((0, 0, 0.93)), d, (0, 0, 1), 0.055, 0.018, 3, seg=10, rseg=8, arc=math.pi)
torus(bm, (0, 0, 0.93), (1, 0, 0), (0, 0, 1), 0.07, 0.022, 3, seg=12, rseg=8, arc=math.pi)
finish(body, bm)

# --- Battant : tige de fer et boule, accroché sous la couronne (origine au point d'accroche)
clapper, bm = new_object('battant', [IRON])
lathe(bm, [(0.0, -0.66), (0.045, -0.64), (0.07, -0.60), (0.075, -0.55), (0.06, -0.51), (0.022, -0.48), (0.018, -0.04),
           (0.03, -0.02), (0.03, 0.0), (0.0, 0.005)], lambda i: 0, seg=16)
finish(clapper, bm)
clapper.location = (0, 0, 0.84)

bpy.ops.export_scene.gltf(filepath=args.out, export_format='GLB', export_cameras=False, export_lights=False)
tris = sum(len(p.vertices) - 2 for o in (body, clapper) for p in o.data.polygons)
print(f'CLOCHE_GEANTE_OK triangles={tris} -> {args.out}')

if args.render:
    r = scene.render
    r.engine = 'BLENDER_WORKBENCH'
    r.resolution_x, r.resolution_y = 700, 700
    sh = scene.display.shading
    sh.light = 'STUDIO'
    sh.color_type = 'MATERIAL'
    sh.show_object_outline = True
    sh.show_cavity = True
    world = bpy.data.worlds.new('w')
    scene.world = world
    world.color = (0.55, 0.65, 0.75)
    cam_data = bpy.data.cameras.new('cam')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = 1.35
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    d = Vector((0.35, -0.9, 0.35)).normalized()
    cam.location = Vector((0, 0, 0.45)) + d * 6
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    r.filepath = args.render
    bpy.ops.render.render(write_still=True)
