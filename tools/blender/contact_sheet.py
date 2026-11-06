"""
Planche contact d'un dossier de modèles GLB (aperçu pour choisir les assets).

    blender -b --factory-startup -P tools/blender/contact_sheet.py -- --dir <dossier glb> --out <png> [--cols 10]
"""
import bpy
import sys
import os
import math
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
def arg(n, d=None):
    return argv[argv.index(n) + 1] if n in argv else d
SRC, OUT, COLS = arg('--dir'), arg('--out'), int(arg('--cols', '10'))

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
files = sorted(f for f in os.listdir(SRC) if f.lower().endswith('.glb'))
CELL = 4.0
for i, f in enumerate(files):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, f))
    objs = [o for o in bpy.data.objects if o not in before]
    roots = [o for o in objs if o.parent is None]
    # Boîte englobante pour normaliser la taille
    mn, mx = Vector((1e9,) * 3), Vector((-1e9,) * 3)
    for o in objs:
        if o.type != 'MESH':
            continue
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            mn = Vector(map(min, mn, w)); mx = Vector(map(max, mx, w))
    size = max((mx - mn).length, 1e-3)
    k = 3.0 / size
    col, row = i % COLS, i // COLS
    for r in roots:
        r.scale *= k
        r.location = (r.location - (mn + mx) / 2 * 1) * k + Vector((col * CELL, -row * CELL * 1.25, 0))
        r.location.z += (mx.z - mn.z) / 2 * k
    txt = bpy.data.curves.new(f'label{i}', 'FONT')
    txt.body = os.path.splitext(f)[0][:22]
    txt.size = 0.32
    to = bpy.data.objects.new(f'label{i}', txt)
    to.location = (col * CELL - 1.8, -row * CELL * 1.25 - 1.9, 0)
    scene.collection.objects.link(to)

rows = math.ceil(len(files) / COLS)
cam_data = bpy.data.cameras.new('cam')
cam_data.type = 'ORTHO'
cam_data.ortho_scale = max(COLS * CELL, rows * CELL * 1.25) + 2
cam = bpy.data.objects.new('cam', cam_data)
scene.collection.objects.link(cam)
cx, cy = (COLS - 1) * CELL / 2, -(rows - 1) * CELL * 1.25 / 2
cam.location = (cx, cy - 30, 40)
cam.rotation_euler = (math.radians(53), 0, 0)
cam.location = (cx, cy - 32, 42)
scene.camera = cam
r = scene.render
r.engine = 'BLENDER_WORKBENCH'
r.resolution_x = 2400
r.resolution_y = int(2400 * (rows * 1.25 * CELL + 2) / (COLS * CELL + 2) * 1.0) + 200
sh = scene.display.shading
sh.light = 'STUDIO'
sh.color_type = 'TEXTURE'
sh.show_object_outline = True
world = bpy.data.worlds.new('w'); scene.world = world; world.color = (0.75, 0.78, 0.8)
r.filepath = OUT
bpy.ops.render.render(write_still=True)
print('SHEET_OK', len(files), OUT)
