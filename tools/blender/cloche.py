"""
Cloche du bar (« Dernier service ») : une cloche en laiton, sonnée pour la dernière tournée. Avec `--potence`,
elle pend sous un bras de bois planté dans un socle de pierre (la grande cloche posée sur la planète) ; sans,
la cloche seule avec sa poignée (la clochette lâchée par les ennemis).

Matériaux nommés (Laiton, Bois, Pierre) : le jeu les colore depuis sa config. La cloche est un objet à part
(nommé `cloche`) pour que le jeu la fasse balancer.

Usage (Blender 5.2) :
  blender -b --factory-startup -P tools/blender/cloche.py -- --out src/assets/models/cloche.glb --potence
  blender -b --factory-startup -P tools/blender/cloche.py -- --out src/assets/models/clochette.glb
"""
import argparse
import math
import sys

import bmesh
import bpy

ap = argparse.ArgumentParser()
ap.add_argument('--out', required=True)
ap.add_argument('--potence', action='store_true')
args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:])

bpy.ops.wm.read_factory_settings(use_empty=True)
SEG = 20

# Profil de la cloche (rayon, hauteur) du bas vers le haut, en m : lèvre évasée, flanc, épaule, couronne
BELL = [(0.0, 0.08), (0.36, 0.0), (0.42, 0.04), (0.38, 0.10), (0.30, 0.22), (0.26, 0.40), (0.25, 0.52),
        (0.20, 0.60), (0.10, 0.64), (0.0, 0.645)]
# Potence : poteau, bras, socle (m)
POST_H, POST_W, ARM_L, BASE_W, BASE_H = 2.6, 0.22, 1.05, 0.95, 0.32


def material(name, rgb):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*rgb, 1)
    return m


BRASS, WOOD, STONE = material('Laiton', (0.85, 0.62, 0.2)), material('Bois', (0.45, 0.28, 0.15)), material('Pierre', (0.5, 0.48, 0.45))


def new_object(name, mats):
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    for m in mats:
        mesh.materials.append(m)
    return obj, bmesh.new()


def lathe(bm, profile, mat, z=0.0):
    """Révolution du profil autour de Z ; faces vers l'extérieur."""
    rings = []
    for r, h in profile:
        if r == 0:
            rings.append([bm.verts.new((0, 0, z + h))])
        else:
            rings.append([bm.verts.new((r * math.cos(2 * math.pi * i / SEG), r * math.sin(2 * math.pi * i / SEG), z + h)) for i in range(SEG)])
    for a, b in zip(rings, rings[1:]):
        for i in range(SEG):
            if len(a) == 1:
                f = bm.faces.new((a[0], b[(i + 1) % SEG], b[i]))
            elif len(b) == 1:
                f = bm.faces.new((a[i], a[(i + 1) % SEG], b[0]))
            else:
                f = bm.faces.new((a[i], a[(i + 1) % SEG], b[(i + 1) % SEG], b[i]))
            f.material_index = mat


def box(bm, x0, y0, z0, x1, y1, z1, mat, taper=1.0):
    """Pavé (haut rétréci de `taper`)."""
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    bot = [bm.verts.new((x, y, z0)) for x, y in ((x0, y0), (x1, y0), (x1, y1), (x0, y1))]
    top = [bm.verts.new((cx + (x - cx) * taper, cy + (y - cy) * taper, z1)) for x, y in ((x0, y0), (x1, y0), (x1, y1), (x0, y1))]
    for i in range(4):
        bm.faces.new((bot[i], bot[(i + 1) % 4], top[(i + 1) % 4], top[i])).material_index = mat
    bm.faces.new(list(reversed(bot))).material_index = mat
    bm.faces.new(top).material_index = mat


def finish(obj, bm):
    bm.normal_update()
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()


# --- La cloche (origine au point d'accroche, en haut) : profil, battant, anneau / poignée
bell, bm = new_object('cloche', [BRASS, WOOD])
top = BELL[-1][1]
lathe(bm, BELL, 0, z=-top)
# Battant : une boule qui dépasse sous la lèvre
lathe(bm, [(0.0, -0.13), (0.07, -0.09), (0.08, -0.04), (0.05, 0.0), (0.0, 0.02)], 0, z=-top)
if args.potence:
    # Anneau d'accroche
    box(bm, -0.05, -0.02, -0.02, 0.05, 0.02, 0.1, 0)
else:
    # Poignée en bois de la clochette
    lathe(bm, [(0.0, 0.0), (0.06, 0.0), (0.05, 0.18), (0.08, 0.26), (0.06, 0.34), (0.0, 0.35)], 1, z=-0.02)
finish(bell, bm)

if args.potence:
    stand, bm = new_object('potence', [BRASS, WOOD, STONE])
    w = POST_W / 2
    box(bm, -BASE_W / 2, -BASE_W / 2, 0, BASE_W / 2, BASE_W / 2, BASE_H, 2, taper=0.8)
    box(bm, -w, -w, BASE_H, w, w, POST_H, 1)
    box(bm, -w, -w * 0.8, POST_H - POST_W, ARM_L, w * 0.8, POST_H, 1)
    # Jambe de force en biais entre le poteau et le bras (un prisme : face avant, face arrière, dessous)
    d = w * 0.6
    f0 = [bm.verts.new((x, -d, z)) for x, z in ((w, POST_H - 0.75), (0.55, POST_H - POST_W), (w, POST_H - POST_W))]
    f1 = [bm.verts.new((x, d, z)) for x, z in ((w, POST_H - 0.75), (0.55, POST_H - POST_W), (w, POST_H - POST_W))]
    bm.faces.new(f0).material_index = 1
    bm.faces.new(list(reversed(f1))).material_index = 1
    bm.faces.new((f0[0], f1[0], f1[1], f0[1])).material_index = 1
    finish(stand, bm)
    # La cloche pend au bout du bras
    bell.location = (ARM_L - 0.2, 0, POST_H - POST_W - 0.08)

bpy.ops.export_scene.gltf(filepath=args.out, export_format='GLB', export_cameras=False, export_lights=False)
print('Cloche exportée :', args.out)
