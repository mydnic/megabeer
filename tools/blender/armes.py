"""
Petits objets lancés par les armes (GDD section 6), modelés ici en formes simples low-poly, un matériau nommé par
couleur : le jeu les recolore depuis sa config (bottleView.ts lit une couleur par nom de matériau). Axe long de
l'objet sur Y (bottleView le met à la longueur voulue le long de cet axe).

Variantes (--variant) :
- decapsuleur : décapsuleur de comptoir, manche (Manche) et tête en métal ajourée (Metal).
- sousbock : dessous de verre rond, carton (Carton) et cercle imprimé (Impression).
- flechette : fléchette, pointe (Metal), fût (Corps), ailettes (Ailettes).
- bouchon : bouchon de champagne, liège (Liege) et capsule (Capsule).
- boule : boule de pétanque (Metal) striée (Stries).
- bac : bac de bière en plastique (Bac) rempli de goulots (Verre, Capsule).
- plateau : plateau de serveur rond (Plateau) et son rebord (Rebord).

Usage (Blender 5.2) :
  blender -b --factory-startup -P tools/blender/armes.py -- --variant decapsuleur --out src/assets/models/decapsuleur.glb
"""
import argparse
import math
import sys

import bpy

ap = argparse.ArgumentParser()
ap.add_argument('--variant', required=True)
ap.add_argument('--out', required=True)
args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:])

bpy.ops.wm.read_factory_settings(use_empty=True)
MATS = {}


def mat(name, rgb):
    if name not in MATS:
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*rgb, 1)
        MATS[name] = m
    return MATS[name]


def tag(o, m):
    o.data.materials.clear()
    o.data.materials.append(m)
    return o


def last():
    return bpy.context.active_object


def apply(o):
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    o.select_set(False)
    return o


def cyl(r, depth, loc, m, verts=16, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, vertices=verts, rotation=rot)
    return tag(apply(last()), m)


def box(size, loc, m, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = last()
    o.scale = size
    return tag(apply(o), m)


def sphere(r, loc, m, seg=16, rings=10, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=seg, ring_count=rings)
    o = last()
    o.scale = scale
    return tag(apply(o), m)


def cone(r1, r2, depth, loc, m, verts=12, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=depth, location=loc, vertices=verts, rotation=rot)
    return tag(apply(last()), m)


def torus(R, r, loc, m, rot=(0, 0, 0), major=20, minor=8):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, location=loc, rotation=rot, major_segments=major, minor_segments=minor)
    return tag(apply(last()), m)


v = args.variant
H = math.pi / 2
if v == 'decapsuleur':
    # Manche plat et arrondi, tête en anneau ouvert (le bec qui accroche la capsule)
    metal, wood = mat('Metal', (0.75, 0.77, 0.8)), mat('Manche', (0.75, 0.12, 0.1))
    box((0.05, 0.11, 0.016), (0, -0.03, 0), wood)
    cyl(0.025, 0.016, (0, -0.085, 0), wood, rot=(H, 0, 0))
    torus(0.028, 0.009, (0, 0.05, 0), metal, rot=(0, 0, 0))
    box((0.05, 0.03, 0.01), (0, 0.022, 0), metal)
    box((0.018, 0.012, 0.012), (0, 0.072, 0), metal)
elif v == 'sousbock':
    card, ink = mat('Carton', (0.95, 0.92, 0.84)), mat('Impression', (0.78, 0.1, 0.12))
    cyl(0.05, 0.005, (0, 0, 0), card, verts=24, rot=(H, 0, 0))
    torus(0.034, 0.005, (0, 0, 0.0028), ink, rot=(0, 0, 0), major=24, minor=4)
elif v == 'flechette':
    steel, body, fins = mat('Metal', (0.8, 0.8, 0.82)), mat('Corps', (0.15, 0.15, 0.17)), mat('Ailettes', (0.85, 0.1, 0.15))
    cone(0.004, 0.0, 0.04, (0, 0.07, 0), steel, verts=8)
    cyl(0.006, 0.07, (0, 0.015, 0), body, verts=10)
    for a in range(4):
        box((0.002, 0.04, 0.028), (0, -0.04, 0), fins, rot=(0, a * math.pi / 4, 0))
elif v == 'bouchon':
    cork, cap = mat('Liege', (0.78, 0.6, 0.38)), mat('Capsule', (0.85, 0.7, 0.25))
    cyl(0.012, 0.022, (0, -0.012, 0), cork, verts=14)
    sphere(0.018, (0, 0.008, 0), cork, scale=(1, 0.8, 1))
    cyl(0.019, 0.004, (0, 0.022, 0), cap, verts=14)
elif v == 'boule':
    steel, groove = mat('Metal', (0.7, 0.72, 0.76)), mat('Stries', (0.3, 0.32, 0.36))
    sphere(0.05, (0, 0, 0), steel, seg=20, rings=12)
    for a in (0, H):
        torus(0.0502, 0.003, (0, 0, 0), groove, rot=(a, 0, 0), major=24, minor=4)
elif v == 'bac':
    crate, glass, cap = mat('Bac', (0.85, 0.65, 0.1)), mat('Verre', (0.3, 0.18, 0.08)), mat('Capsule', (0.85, 0.75, 0.3))
    box((0.3, 0.16, 0.2), (0, 0, 0), crate)
    for i in range(3):
        for j in range(2):
            x, z = -0.09 + i * 0.09, -0.045 + j * 0.09
            cyl(0.022, 0.07, (x, 0.11, z), glass, verts=10)
            cyl(0.012, 0.03, (x, 0.155, z), glass, verts=8)
            cyl(0.014, 0.006, (x, 0.172, z), cap, verts=8)
elif v == 'plateau':
    tray, rim = mat('Plateau', (0.72, 0.74, 0.78)), mat('Rebord', (0.55, 0.57, 0.62))
    cyl(0.18, 0.008, (0, 0, 0), tray, verts=28, rot=(H, 0, 0))
    torus(0.18, 0.008, (0, 0, 0.004), rim, rot=(0, 0, 0), major=28, minor=6)
else:
    raise SystemExit(f'variante inconnue : {v}')

# Modelés avec l'axe long sur Y : couchés d'un quart de tour pour que cet axe devienne la verticale de Blender (Z), qui
# devient Y dans le glTF (l'axe que bottleView met à la longueur voulue). Les objets plats ont ainsi leur face vers Y.
for o in bpy.context.scene.objects:
    o.select_set(True)
bpy.context.view_layer.objects.active = bpy.context.scene.objects[0]
bpy.ops.transform.rotate(value=H, orient_axis='X', center_override=(0, 0, 0))
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

bpy.ops.export_scene.gltf(filepath=args.out, export_format='GLB', export_cameras=False, export_lights=False)
print('OK', v, args.out)
