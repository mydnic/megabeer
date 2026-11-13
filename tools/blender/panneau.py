"""
Panneau « MORTEHAN » façon Hollywood : grandes lettres blanches plantées sur une colline, chacune tenue par son
échafaudage de poutres sombres derrière elle.

Une lettre par objet (nommé par sa lettre : M, O, R, ...), origine au pied de la lettre, face vers +z : le jeu pose
chaque lettre sur le sol à sa place, ce qui suit le relief et la courbure de la planète. Les poteaux descendent sous
le sol pour que la lettre reste plantée sur une pente. Matériaux nommés Lettre et Structure.

Police : celle fournie avec Blender (libre), épaissie et resserrée.

Usage (Blender 5.2) :
  blender -b --factory-startup -P tools/blender/panneau.py -- --out src/assets/models/mortehan.glb [--render DOSSIER]
"""
import argparse
import math
import os
import sys

import bpy

ap = argparse.ArgumentParser()
ap.add_argument('--out', required=True)
ap.add_argument('--text', default='MORTEHAN')
ap.add_argument('--render', default='')
args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:])

bpy.ops.wm.read_factory_settings(use_empty=True)

# Dimensions (m) : hauteur des lettres, épaisseur, graisse ajoutée au trait, resserrement horizontal,
# lettre posée à LIFT au-dessus du pied, poteaux enfoncés de SINK sous le pied
HEIGHT, DEPTH, BOLD, NARROW, LIFT, SINK = 7.0, 0.35, 0.05, 0.82, 0.9, 3.0
POST = 0.22          # section d'un poteau
BACK = 0.9           # recul de l'échafaudage derrière la lettre


def material(name, rgb):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*rgb, 1)
    return m


WHITE = material('Lettre', (0.93, 0.92, 0.88))
DARK = material('Structure', (0.22, 0.2, 0.18))


def box(name, x0, x1, y0, y1, z0, z1, mat):
    """Pavé aligné sur les axes de Blender (z en haut), de (x0, y0, z0) à (x1, y1, z1)."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    o = bpy.context.active_object
    o.scale = (x1 - x0, y1 - y0, z1 - z0)
    bpy.ops.object.transform_apply(scale=True)
    o.name = name
    o.data.materials.append(mat)
    return o


def beam(name, a, b, s, mat):
    """Poutre de section s entre les points a et b (pour les jambes de force en diagonale)."""
    ax, ay, az = a
    bx, by, bz = b
    L = math.dist(a, b)
    bpy.ops.mesh.primitive_cube_add(size=1, location=((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2))
    o = bpy.context.active_object
    o.scale = (s, s, L)
    d = (bx - ax, by - ay, bz - az)
    o.rotation_mode = 'QUATERNION'
    from mathutils import Vector
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(Vector(d).normalized())
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    o.name = name
    o.data.materials.append(mat)
    return o


def letter(ch):
    """Une lettre debout (plan xz de Blender), pied en (0, 0, 0), face vers -y (devient +z dans le glTF)."""
    curve = bpy.data.curves.new(f'txt_{ch}', 'FONT')
    curve.body = ch
    curve.size = 1
    curve.extrude = DEPTH / 2
    curve.offset = BOLD
    curve.align_x = 'CENTER'
    o = bpy.data.objects.new(f'txt_{ch}', curve)
    bpy.context.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.convert(target='MESH')
    o = bpy.context.active_object
    # Mise à l'échelle : hauteur des capitales = HEIGHT, puis debout face à -y
    zs = [v.co.y for v in o.data.vertices]
    h = max(zs) - min(zs)
    k = HEIGHT / h
    o.scale = (k * NARROW, k, 1)
    bpy.ops.object.transform_apply(scale=True)
    o.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(rotation=True)
    zmin = min(v.co.z for v in o.data.vertices)
    for v in o.data.vertices:
        v.co.z += LIFT - zmin
    o.data.materials.clear()
    o.data.materials.append(WHITE)
    xs = [v.co.x for v in o.data.vertices]
    return o, min(xs), max(xs)


objects = []
for i, ch in enumerate(args.text):
    o, x0, x1 = letter(ch)
    parts = [o]
    # Échafaudage : deux poteaux derrière la lettre, une traverse, deux jambes de force vers l'arrière
    w = x1 - x0
    px = [x0 + w * 0.22, x1 - w * 0.22]
    top = LIFT + HEIGHT * 0.86
    y = DEPTH / 2 + BACK  # derrière (la face visible est en -y)
    for n, x in enumerate(px):
        parts.append(box(f'{ch}_poteau{n}', x - POST / 2, x + POST / 2, y - POST / 2, y + POST / 2, -SINK, top, DARK))
        parts.append(beam(f'{ch}_jambe{n}', (x, y, top * 0.62), (x, y + 3.2, -SINK * 0.6), POST * 0.8, DARK))
    for z in (LIFT + HEIGHT * 0.25, LIFT + HEIGHT * 0.7):
        parts.append(box(f'{ch}_traverse', px[0] - 0.3, px[1] + 0.3, y - POST * 0.4, y + POST * 0.4, z - 0.09, z + 0.09, DARK))
    # Pattes qui relient la lettre aux poteaux
    for x in px:
        for z in (LIFT + HEIGHT * 0.25, LIFT + HEIGHT * 0.7):
            parts.append(box(f'{ch}_patte', x - 0.08, x + 0.08, DEPTH / 2 - 0.02, y, z - 0.08, z + 0.08, DARK))
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.join()
    o.name = ch
    o.data.name = ch
    objects.append((o, w))

# Rangée de contrôle (pour les rendus) : lettres côte à côte ; le jeu les replace une par une
x = 0.0
for o, w in objects:
    o.location.x = x + w / 2
    x += w + 0.8
os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
# Export : chaque lettre à l'origine (le jeu fait la mise en place)
saved = [o.location.x for o, _ in objects]
for o, _ in objects:
    o.location.x = 0
bpy.ops.export_scene.gltf(filepath=args.out, export_format='GLB', export_cameras=False, export_lights=False)
for (o, _), sx in zip(objects, saved):
    o.location.x = sx

if args.render:
    os.makedirs(args.render, exist_ok=True)
    total = x
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
    scene.render.resolution_x, scene.render.resolution_y = 1400, 600
    world = bpy.data.worlds.new('w')
    world.color = (0.55, 0.7, 0.9)
    scene.world = world
    bpy.ops.object.light_add(type='SUN', rotation=(0.8, 0.2, 0.6))
    bpy.context.active_object.data.energy = 4
    for name, loc in (('face', (total / 2, -38, 6)), ('trois_quarts', (total + 10, -26, 12)), ('dos', (total / 2, 30, 8))):
        cam = bpy.data.cameras.new(name)
        cam.lens = 30
        co = bpy.data.objects.new(name, cam)
        scene.collection.objects.link(co)
        co.location = loc
        from mathutils import Vector
        d = Vector((total / 2, 0, LIFT + HEIGHT / 2)) - Vector(loc)
        co.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        scene.camera = co
        scene.render.filepath = os.path.join(args.render, f'{name}.png')
        bpy.ops.render.render(write_still=True)
print('OK', args.out)
