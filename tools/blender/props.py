"""
Prépare un objet du décor (KayKit, Kenney : couleurs tirées d'une texture atlas) pour le jeu : ses faces sont rangées en
quelques matériaux nommés, à couleur unie, que le jeu colore depuis sa config (bottleView.ts lit
une couleur par nom de matériau, comme pour la bouteille de la Stout).

Une face va dans un matériau selon la couleur de la texture sous elle (saturation) et sa hauteur.

Variantes (--variant) :
- stout : la bouteille trapue étiquetée du KayKit Dungeon (Verre, Etiquette, Bouchon), pour la Stout.
- canette : la canette de soda du Kenney Food Kit (Metal, Corps), pour la Canette.
- fut : le grand tonneau du KayKit Dungeon (Bois, Cerclage), pour le Fût qui roule.
- gueuze : la bouteille fine du Fantasy Props MegaKit (Verre, Bouchon), pour la Gueuze.

Usage (Blender 5.2) :
  blender -b --factory-startup --disable-autoexec -P tools/blender/props.py -- --lib C:/Users/mydnic/Desktop/MODELS
      --variant stout --out src/assets/models/bouteille_stout.glb
"""
import argparse
import colorsys
import os
import sys

import bpy

ap = argparse.ArgumentParser()
ap.add_argument('--lib', required=True)
ap.add_argument('--variant', required=True)
ap.add_argument('--out', required=True)
args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:])

VARIANTS = {
    'stout': {
        'src': 'decor/kaykit_dungeon/gltf/bottle_A_labeled_brown.gltf',
        # Règles dans l'ordre (la première qui colle gagne) : saturation maxi de la texture, hauteur
        # mini (part de la hauteur de l'objet) ; le dernier matériau prend le reste
        'rules': [
            ('Etiquette', {'max_sat': 0.2}),
            ('Bouchon', {'min_height': 0.93}),
            ('Verre', {}),
        ],
    },
    'canette': {
        'src': 'decor/kenney_food_kit/glb/soda-can.glb',
        # Couvercle, fond et rebords gris (peu saturés) : le métal ; le reste, le corps peint (une seule
        # bande de triangles : on ne peut pas la couper en deux couleurs sans motif en zigzag)
        'rules': [
            ('Metal', {'max_sat': 0.35}),
            ('Corps', {}),
        ],
    },
    'fut': {
        'src': 'decor/kaykit_dungeon/gltf/barrel_large.gltf',
        # Cerclages gris (peu saturés) ; le reste, les douelles en bois
        'rules': [
            ('Cerclage', {'max_sat': 0.3}),
            ('Bois', {}),
        ],
    },
    'gueuze': {
        'src': 'decor/quaternius_fantasy_props/glTF/Bottle_1.gltf',
        # Une seule texture grise : le bouchon est le haut de la bouteille, le reste le verre
        'rules': [
            ('Bouchon', {'min_height': 0.93}),
            ('Verre', {}),
        ],
    },
}
variant = VARIANTS[args.variant]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(args.lib, variant['src']))
obj = next(o for o in bpy.data.objects if o.type == 'MESH')
mesh = obj.data
img = next(n.image for n in mesh.materials[0].node_tree.nodes if n.type == 'TEX_IMAGE' and n.image)
W, H = img.size
px = img.pixels[:]
uv = mesh.uv_layers.active.data
zs = [v.co.z for v in mesh.vertices]
z0, z1 = min(zs), max(zs)

names = [name for name, _ in variant['rules']]
mesh.materials.clear()
for name in names:
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    mesh.materials.append(m)


def saturation(poly):
    u = sum(uv[i].uv[0] for i in poly.loop_indices) / poly.loop_total
    v = sum(uv[i].uv[1] for i in poly.loop_indices) / poly.loop_total
    x, y = min(W - 1, int(u % 1 * W)), min(H - 1, int(v % 1 * H))
    k = (y * W + x) * 4
    return colorsys.rgb_to_hsv(*px[k:k + 3])[1]


for p in mesh.polygons:
    height = (p.center.z - z0) / (z1 - z0)
    s = saturation(p)
    for i, (_, rule) in enumerate(variant['rules']):
        if s <= rule.get('max_sat', 1) and height >= rule.get('min_height', 0):
            p.material_index = i
            break

counts = {n: sum(1 for p in mesh.polygons if p.material_index == i) for i, n in enumerate(names)}
bpy.ops.export_scene.gltf(filepath=args.out, export_format='GLB', export_cameras=False, export_lights=False)
print('Objet exporté :', args.variant, args.out, '| faces par matériau :', counts)
