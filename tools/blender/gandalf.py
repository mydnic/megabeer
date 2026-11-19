"""
Gandalf (allié, issue #18) : le modèle « Wizard » fourni par l'utilisateur (Wizard.zip : `Wizard Swing3.blend`, avec
squelette et un coup de bâton), préparé pour le jeu :
1. sa texture recollée (le .blend cherche « GandalfDone lightned2.png », l'archive la livre en `lightned2.bmp`) ;
2. le décor de la scène retiré (herbe, sapin, plans), seuls restent le squelette et les pièces du magicien ;
3. le coup de bâton renommé `staff` (le jeu le joue à chaque pétrification) ;
4. mis à la taille (`HEIGHT`), pieds au sol, export en GLB (texture réduite en JPEG).

Usage (Blender 5.2) :
  blender -b --factory-startup -P tools/blender/gandalf.py -- --src DOSSIER_DU_ZIP/Wizard --out src/assets/models/gandalf.glb
      [--render DOSSIER]
"""
import argparse
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

ap = argparse.ArgumentParser()
ap.add_argument('--src', required=True, help='dossier Wizard du zip (avec Wizard Swing3.blend et lightned2.bmp)')
ap.add_argument('--out', required=True)
ap.add_argument('--tex', type=int, default=1024)
ap.add_argument('--render', default='')
args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:])

HEIGHT = 2.0  # taille de Gandalf, chapeau compris (m)
IDLE_FRAME = 16  # image du coup de bâton prise comme pose de repos

bpy.ops.wm.open_mainfile(filepath=os.path.join(args.src, 'Wizard Swing3.blend'))
# 1. Texture : l'image attendue, chargée depuis le fichier livré
tex = bpy.data.images.load(os.path.join(args.src, 'lightned2.bmp'))
# Les matières du magicien (anciennes matières converties, sans nœud de texture) : la texture recâblée sur la couleur
for name in ('Material.000', 'Material.001'):
    mat = bpy.data.materials.get(name)
    if not mat:
        continue
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    img = nt.nodes.new('ShaderNodeTexImage')
    img.image = tex
    bsdf.inputs['Roughness'].default_value = 0.8
    nt.links.new(img.outputs['Color'], bsdf.inputs['Base Color'])
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
# 2. Seuls le squelette et les pièces du magicien
rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
for o in list(bpy.context.scene.objects):
    if o is rig:
        continue
    keep = o.type == 'MESH' and (o.parent is rig or any(m.type == 'ARMATURE' for m in o.modifiers) or o.name.startswith('mesh01'))
    if not keep:
        bpy.data.objects.remove(o)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
# 3. Animation : le coup de bâton
for a in list(bpy.data.actions):
    if a.name == 'ArmatureAction':
        a.name = 'staff'
for a in list(bpy.data.actions):
    if a.name != 'staff':
        bpy.data.actions.remove(a)
# Pose de repos : une image du coup de bâton, bâton planté, épée baissée (la pose de repos du squelette tient le bâton à
# l'horizontale)
staff = bpy.data.actions['staff']
rig.animation_data_create()
rig.animation_data.action = staff
if hasattr(rig.animation_data, 'action_slot') and staff.slots:
    rig.animation_data.action_slot = staff.slots[0]
bpy.context.scene.frame_set(IDLE_FRAME)
idle = bpy.data.actions.new('idle')
rig.animation_data.action = idle
if hasattr(rig.animation_data, 'action_slot') and idle.slots:
    rig.animation_data.action_slot = idle.slots[0]
for f in (0, 1):
    for pb in rig.pose.bones:
        pb.keyframe_insert('location', frame=f)
        pb.keyframe_insert('rotation_quaternion' if pb.rotation_mode == 'QUATERNION' else 'rotation_euler', frame=f)
        pb.keyframe_insert('scale', frame=f)
rig.animation_data.action = None
for pb in rig.pose.bones:
    pb.matrix_basis = Matrix()
bpy.context.view_layer.update()
# 4. À la taille, pieds au sol, centré : une échelle et un décalage sur le squelette (les pièces le suivent)
pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
lo = Vector(map(min, *pts)); hi = Vector(map(max, *pts))
k = HEIGHT / (hi.z - lo.z)
root = bpy.data.objects.new('Gandalf', None)
bpy.context.scene.collection.objects.link(root)
for o in [rig] + [m for m in meshes if m.parent is None]:
    o.parent = root
root.scale = (k, k, k)
root.location = (-(lo.x + hi.x) / 2 * k, -(lo.y + hi.y) / 2 * k, -lo.z * k)
if tex.size[0] > args.tex:
    tex.scale(args.tex, args.tex)
bpy.ops.export_scene.gltf(filepath=args.out, export_format='GLB', export_animation_mode='ACTIONS', export_cameras=False,
                          export_lights=False, export_image_format='JPEG')
print('GANDALF_OK', args.out, 'meshes', len(meshes), 'k', round(k, 3), 'size', tuple(round(x * k, 2) for x in hi - lo), 'clips', [a.name for a in bpy.data.actions])

if args.render:
    os.makedirs(args.render, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.color_type = 'TEXTURE'
    sc.render.resolution_x, sc.render.resolution_y = 400, 500
    cam = bpy.data.objects.new('camx', bpy.data.cameras.new('camx'))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 2.6
    rig.animation_data_create()
    for name, act, frame, loc in (('face', 'idle', 0, (0, -6, 1)), ('cote', 'idle', 0, (6, 0, 1)), ('baton', 'staff', 15, (3, -5, 1))):
        rig.animation_data.action = bpy.data.actions.get(act) if act else None
        if act and hasattr(rig.animation_data, 'action_slot') and rig.animation_data.action.slots:
            rig.animation_data.action_slot = rig.animation_data.action.slots[0]
        sc.frame_set(frame)
        cam.location = loc
        cam.rotation_euler = (Vector((0, 0, 1)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.join(args.render, f'gandalf_{name}.png')
        bpy.ops.render.render(write_still=True)
