"""
Cheveux du Super Saiyan : la coiffure de Goku tirée de deux modèles fournis par l'utilisateur, une pièce par fichier,
posée sur le perso pendant la transformation (fx/hairView.ts).

- `--ssj` : « dbxv2_goku_damaged2_ssj.glb » (Xenoverse 2), la coiffure SSJ (mèches dressées), pièce `--ssj-hair`, visage
  `--ssj-face` ;
- `--ssj3` : « goku_super_saiyan_3.glb », les cheveux longs du SSJ3, pièce `--ssj3-hair`, visage `--ssj3-face`.

Pour chaque coiffure : la pièce prise telle qu'affichée (modificateurs appliqués, poids retirés), recalée sur le visage
du modèle (son centre à l'origine, sa hauteur ramenée à 1 : le jeu met la coiffure à l'échelle de la tête du perso), sa
texture passée en niveaux de gris éclaircis (le jeu la teinte de la couleur du palier : doré, noir, argent), un seul
matériau, export en GLB.

Usage (Blender 5.2) :
  blender -b --factory-startup -P tools/blender/cheveux.py -- --ssj "C:/Users/mydnic/Desktop/MODELS/dbxv2_goku_damaged2_ssj.glb"
      --ssj3 "C:/Users/mydnic/Desktop/MODELS/goku_super_saiyan_3.glb" --out src/assets/models [--render DOSSIER]
"""
import argparse
import os
import sys

import bpy
from mathutils import Matrix, Vector

ap = argparse.ArgumentParser()
ap.add_argument('--ssj', required=True)
ap.add_argument('--ssj3', required=True)
ap.add_argument('--ssj-hair', default='Object_11')
ap.add_argument('--ssj-face', default='Object_5')
ap.add_argument('--ssj3-hair', default='Object_6')
ap.add_argument('--ssj3-face', default='Object_5')
ap.add_argument('--out', required=True)
ap.add_argument('--tex', type=int, default=512)
ap.add_argument('--render', default='')
args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:])

# Niveaux de gris : la mèche la plus sombre ressort à `floor`, la plus claire à 1 (le jeu teinte par-dessus)
GREY = {'floor': 0.45}


def hairdo(src, hair_name, face_name, out_name):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)
    dg = bpy.context.evaluated_depsgraph_get()
    hair_src, face_src = bpy.data.objects[hair_name], bpy.data.objects[face_name]

    def baked(o):
        """La pièce telle qu'affichée (pose, modificateurs), dans le repère du monde."""
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
        me.transform(o.matrix_world)
        return me

    face = baked(face_src)
    fl = Vector(map(min, *[v.co for v in face.vertices])); fh = Vector(map(max, *[v.co for v in face.vertices]))
    centre, size = (fl + fh) / 2, fh.z - fl.z
    me = baked(hair_src)
    me.transform(Matrix.Scale(1 / size, 4) @ Matrix.Translation(-centre))
    hair = bpy.data.objects.new(out_name, me)
    for o in list(bpy.data.objects):
        if o is not hair:
            bpy.data.objects.remove(o)
    bpy.context.scene.collection.objects.link(hair)
    # Texture en niveaux de gris éclaircis, un seul matériau
    mat = me.materials[0]
    img = next((n.image for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image), None) if mat and mat.use_nodes else None
    if img:
        if img.size[0] > args.tex:
            img.scale(args.tex, int(args.tex * img.size[1] / img.size[0]))
        px = list(img.pixels)
        lum = [0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2] for i in range(0, len(px), 4)]
        lo, hi = min(lum), max(lum)
        for k, i in enumerate(range(0, len(px), 4)):
            g = GREY['floor'] + (1 - GREY['floor']) * (lum[k] - lo) / max(1e-6, hi - lo)
            px[i] = px[i + 1] = px[i + 2] = g
        img.pixels[:] = px
        img.update()
    me.materials.clear()
    me.materials.append(mat)
    for p in me.polygons:
        p.material_index = 0
    path = os.path.join(args.out, f'{out_name}.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_cameras=False, export_lights=False, export_animations=False,
                              export_skins=False, export_image_format='JPEG')
    vs = [v.co for v in me.vertices]
    lo_, hi_ = Vector(map(min, *vs)), Vector(map(max, *vs))
    print('HAIR_OK', path, 'verts', len(me.vertices), 'size', tuple(round(x, 2) for x in hi_ - lo_), 'min', tuple(round(x, 2) for x in lo_))
    if args.render:
        os.makedirs(args.render, exist_ok=True)
        sc = bpy.context.scene
        sc.render.engine = 'BLENDER_WORKBENCH'
        sc.display.shading.color_type = 'TEXTURE'
        sc.render.resolution_x = sc.render.resolution_y = 400
        cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
        sc.collection.objects.link(cam)
        sc.camera = cam
        cam.data.type = 'ORTHO'
        cam.data.ortho_scale = (hi_ - lo_).length * 0.9
        c = (lo_ + hi_) / 2
        for name, d in (('face', (0, -1, 0.1)), ('cote', (1, 0, 0.1))):
            cam.location = c + Vector(d) * 10
            cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
            sc.render.filepath = os.path.join(args.render, f'{out_name}_{name}.png')
            bpy.ops.render.render(write_still=True)


hairdo(args.ssj, args.ssj_hair, args.ssj_face, 'cheveux_ssj')
hairdo(args.ssj3, args.ssj3_hair, args.ssj3_face, 'cheveux_ssj3')
