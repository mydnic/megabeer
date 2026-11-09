"""
Prépare un monstre du pack Animated Monsters (Quaternius, FBX à couleurs unies) pour la foule du jeu.

La foule demande un seul maillage et une seule texture (enemies/zombieLibrary.ts) : les pièces
accrochées à un os (yeux) sont fusionnées au maillage et rattachées à cet os ; chaque matériau devient
une case d'une petite palette (couleur choisie par variante), où pointent les UV de ses faces. Les
animations sont renommées comme celles des zombies Quaternius (Idle, Walk, Punch, HitReact, Death).

Variantes (--variant) :
- gargouille : le Dragon en pierre grise, aux yeux rougeoyants.

Usage (Blender 5.2) :
  blender -b --factory-startup --disable-autoexec -P tools/blender/monsters.py -- --lib C:/Users/mydnic/Desktop/MODELS
      --variant gargouille --out src/assets/models/gargouille.glb
"""
import argparse
import os
import sys

import bpy

ap = argparse.ArgumentParser()
ap.add_argument('--lib', required=True)
ap.add_argument('--variant', required=True)
ap.add_argument('--out', required=True)
args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:])

VARIANTS = {
    'gargouille': {
        'src': 'personnages/quaternius_animated_monsters/FBX/Dragon.fbx',
        # Couleur de chaque matériau (RVB 0 à 1) : pierre grise, ventre plus clair, yeux rougeoyants
        'colors': {
            'Main': (0.62, 0.62, 0.66),
            'Wings': (0.47, 0.47, 0.52),
            'Belly': (0.78, 0.75, 0.70),
            'Claws': (0.28, 0.28, 0.30),
            'Eyes': (1.0, 0.32, 0.05),
        },
        # Animation du pack -> noms attendus par le jeu (une même animation peut servir deux fois)
        'clips': {
            'Dragon_Flying': ['Walk', 'Idle'],
            # Dragon_Attack est une toupie (coup de queue en vrille) : on prend le coup de tête
            'Dragon_Attack2': ['Punch'],
            'Dragon_Hit': ['HitReact'],
            'Dragon_Death': ['Death'],
        },
        # Images gardées d'une animation : le coup de tête plonge à l'image 11, on coupe le retour
        # au repos pour qu'il porte vers 45 % du clip (ZOMBIE_ATTACK.hitAt)
        'crops': {'Dragon_Attack2': (1, 24)},
    },
}
variant = VARIANTS[args.variant]
# Palette : une case de CELL px par couleur, sur une ligne
CELL = 4

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=os.path.join(args.lib, variant['src']))
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
body = next(o for o in meshes if o.modifiers)


def select(objs, active):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active


# Pièces accrochées à un os : posées à leur place, puis portées par cet os
for o in meshes:
    if o.parent_type != 'BONE':
        continue
    bone = o.parent_bone
    world = o.matrix_world.copy()
    o.parent = None
    o.matrix_world = world
    select([o], o)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    o.vertex_groups.new(name=bone).add(range(len(o.data.vertices)), 1.0, 'REPLACE')
select(meshes, body)
bpy.ops.object.join()
body.data.validate()

# Palette : chaque matériau devient une case de couleur, ses faces y pointent
names = [m.name for m in body.data.materials]
w = CELL * len(names)
img = bpy.data.images.new('palette', w, CELL)
px = [0.0] * (w * CELL * 4)
for i, name in enumerate(names):
    r, g, b = variant['colors'].get(name, (1, 0, 1))
    for y in range(CELL):
        for x in range(i * CELL, (i + 1) * CELL):
            px[(y * w + x) * 4:(y * w + x) * 4 + 4] = [r, g, b, 1]
img.pixels[:] = px
img.file_format = 'PNG'
img.pack()
uv = body.data.uv_layers.active or body.data.uv_layers.new()
for poly in body.data.polygons:
    for li in poly.loop_indices:
        uv.data[li].uv = ((poly.material_index + 0.5) / len(names), 0.5)
mat = bpy.data.materials.new('Palette')
mat.use_nodes = True
tex = mat.node_tree.nodes.new('ShaderNodeTexImage')
tex.image = img
tex.interpolation = 'Closest'
bsdf = mat.node_tree.nodes['Principled BSDF']
mat.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
bsdf.inputs['Roughness'].default_value = 1
body.data.materials.clear()
body.data.materials.append(mat)
for p in body.data.polygons:
    p.material_index = 0

# Animations : renommées (préfixes du pack retirés), dupliquées si une sert deux fois
for a in list(bpy.data.actions):
    short = a.name.split('|')[-1]
    targets = variant['clips'].get(short)
    if not targets:
        bpy.data.actions.remove(a)
        continue
    crop = variant.get('crops', {}).get(short)
    if crop:
        a.use_frame_range = True
        a.frame_start, a.frame_end = crop
    a.name = targets[0]
    for extra in targets[1:]:
        a.copy().name = extra

select([body], body)
bpy.ops.export_scene.gltf(
    filepath=args.out, export_format='GLB', export_animations=True, export_animation_mode='ACTIONS',
    export_apply=False, export_cameras=False, export_lights=False,
)
print('Monstre exporté :', args.variant, args.out, '| animations :', sorted(a.name for a in bpy.data.actions))
