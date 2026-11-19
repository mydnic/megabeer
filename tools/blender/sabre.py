"""
Le sabre laser (arme, issue #17) : le modèle « Light saber » d'April Lewer (fourni par l'utilisateur), redressé pour le
rendu des armes (axe de l'arme = axe Y de three.js, lame vers le haut, poignée en bas), les matières renommées par pièce
(`lame` : la pièce la plus longue, le reste `poignee`) pour que le jeu les colore.

Usage (Blender 5.2) :
  blender -b --factory-startup -P tools/blender/sabre.py -- --src "C:/Users/mydnic/Desktop/MODELS/Light saber by April Lewer - fJr5YcNJ0Wf.glb"
      --out src/assets/models/sabre.glb
"""
import argparse
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

ap = argparse.ArgumentParser()
ap.add_argument('--src', required=True)
ap.add_argument('--out', required=True)
args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:])

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=args.src)
obj = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
me = obj.data
me.transform(obj.matrix_world)
obj.matrix_world = Matrix()
# Lame vers +Z dans Blender (+Y dans three.js) : le modèle est couché le long de +Y, poignée vers -Y
me.transform(Matrix.Rotation(1.5707963, 4, 'X'))
# La pièce la plus longue (le long de l'axe) est la lame
spans = {}
for poly in me.polygons:
    zs = [me.vertices[i].co.z for i in poly.vertices]
    lo, hi = spans.get(poly.material_index, (1e9, -1e9))
    spans[poly.material_index] = (min(lo, *zs), max(hi, *zs))
blade = max(spans, key=lambda i: spans[i][1] - spans[i][0])
for i, m in enumerate(me.materials):
    if m:
        m.name = 'lame' if i == blade else f'poignee_{i}'
print('SABRE spans', {me.materials[i].name: tuple(round(x, 2) for x in v) for i, v in spans.items()})
bpy.ops.export_scene.gltf(filepath=args.out, export_format='GLB', export_cameras=False, export_lights=False, export_animations=False)
print('SABRE_OK', args.out)
