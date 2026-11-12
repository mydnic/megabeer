"""
Prépare la Mort de la fermeture (« Stylized Death » de Gizart, Fab, licence standard, ajouté à la bibliothèque Epic de
l'utilisateur) pour le jeu.

Le modèle est livré pour Unreal : ses fichiers ont été exportés en FBX depuis l'éditeur Unreal 5.8 (maillage, faux,
animations, textures), rangés dans `Desktop/MODELS/personnages/gizart_stylized_death`. Ce script assemble le maillage
et ses animations utiles (renommées idle, walk, attack, spawn, roar), accroche la faux à la main droite (prise
`hand_rSocket_Scythe` du modèle Unreal), réduit les textures et exporte un GLB.

Usage (Blender 5.2) :
  blender -b --factory-startup -P tools/blender/mort.py -- --lib C:/Users/mydnic/Desktop/MODELS
      --out src/assets/models/mort.glb [--render DOSSIER]
"""
import argparse
import math
import os
import sys

import bpy
from mathutils import Euler, Matrix, Vector

ap = argparse.ArgumentParser()
ap.add_argument('--lib', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--render')
args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:])
SRC = os.path.join(args.lib, 'personnages', 'gizart_stylized_death')

# Animation Unreal gardée -> nom attendu par le jeu
CLIPS = {
    'idle_B': 'idle',
    'Walk': 'walk',
    'Staff_Attack_A': 'attack',
    'spawn': 'spawn',
    'Roar': 'roar',
}
# Prise de la faux dans la main droite (relevée dans l'éditeur Unreal : os, position en cm, rotation en degrés)
SOCKET = {'bone': 'hand_r', 'loc': (-3.790501, 4.556397, 0.997124), 'pitch': 20.000221, 'yaw': 0.0, 'roll': 10.000584}
TEX_SIZE = 1024

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30


def import_fbx(name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=os.path.join(SRC, name))
    return [o for o in bpy.data.objects if o not in before]


# ---------------------------------------------------------------- le corps
objs = import_fbx('SK_Stylized_Death.fbx')
arm = next(o for o in objs if o.type == 'ARMATURE')
body = next(o for o in objs if o.type == 'MESH')
arm.name = 'Mort'
body.name = 'MortCorps'

# ---------------------------------------------------------------- les animations
def fcurves_of(action, obj):
    try:
        from bpy_extras import anim_utils
        return anim_utils.action_get_channelbag_for_slot(action, obj.animation_data.action_slot).fcurves
    except Exception:
        return action.fcurves


arm.animation_data_create()
for src, clip in CLIPS.items():
    new = import_fbx(f'Anim_Stylized_Death_{src}.fbx')
    other = next(o for o in new if o.type == 'ARMATURE')
    action = other.animation_data.action
    action.name = clip
    # Seuls les os bougent : l'export Unreal anime aussi l'objet entier (échelle 0,01), à retirer
    curves = fcurves_of(action, other)
    for fc in [fc for fc in curves if not fc.data_path.startswith('pose.bones')]:
        curves.remove(fc)
    # Translations des os : celles du squelette d'origine (le mannequin Unreal, plus grand), qu'Unreal ignore à
    # l'affichage (reciblage « Skeleton ») ; on fait pareil, bassin compris (le jeu fait flotter et sortir de terre)
    for fc in [fc for fc in curves if fc.data_path.endswith('.location')]:
        curves.remove(fc)
    track = arm.animation_data.nla_tracks.new()
    track.name = clip
    strip = track.strips.new(clip, int(action.frame_range[0]), action)
    strip.name = clip
    for o in new:
        bpy.data.objects.remove(o, do_unlink=True)
for a in list(bpy.data.actions):
    if a.name not in CLIPS.values():
        bpy.data.actions.remove(a)
arm.animation_data.action = None

# ---------------------------------------------------------------- la faux, dans la main droite
scythe = next(o for o in import_fbx('SM_Stylized_Scythe.fbx') if o.type == 'MESH')
scythe.name = 'Faux'
for o in [o for o in bpy.data.objects if o.type == 'EMPTY' and not o.children]:
    bpy.data.objects.remove(o, do_unlink=True)
bpy.context.view_layer.update()
bone = arm.data.bones[SOCKET['bone']]
# Repère de l'os en monde ; la prise Unreal est en cm, axe Y retourné par l'export FBX (repère main gauche -> droite)
bone_world = arm.matrix_world @ bone.matrix_local
lx, ly, lz = SOCKET['loc']
rot = Euler((math.radians(-SOCKET['roll']), math.radians(SOCKET['pitch']), math.radians(-SOCKET['yaw'])), 'XYZ').to_matrix().to_4x4()
socket_local = Matrix.Translation(Vector((lx, -ly, lz)) * 0.01 / arm.matrix_world.to_scale()[0]) @ rot
# La faux a été importée à l'échelle du monde : on la place dans le repère de la prise, puis on la lie à l'os
scythe_scale = scythe.matrix_world.to_scale()
scythe.parent = arm
scythe.parent_type = 'BONE'
scythe.parent_bone = SOCKET['bone']
# Le repère de parenté d'un os part de sa queue : on le ramène à sa tête
tail_off = Matrix.Translation(Vector((0, bone.length, 0)))
scythe.matrix_parent_inverse = tail_off.inverted()
scythe.matrix_basis = socket_local @ Matrix.Diagonal(scythe_scale / arm.matrix_world.to_scale()[0]).to_4x4()

# ---------------------------------------------------------------- matériau : couleur et lueur (yeux, reflets)
# L'export FBX d'Unreal ne garde que la carte de relief : on refait un matériau simple, partagé par le corps et la faux
mat = bpy.data.materials.new('Mort')
mat.use_nodes = True
nt = mat.node_tree
bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
def tex(name):
    img = bpy.data.images.load(os.path.join(SRC, name))
    if img.size[0] > TEX_SIZE:
        img.scale(TEX_SIZE, TEX_SIZE)
    n = nt.nodes.new('ShaderNodeTexImage')
    n.image = img
    return n
nt.links.new(tex('T_Stylized_Death_D.png').outputs['Color'], bsdf.inputs['Base Color'])
nt.links.new(tex('T_Stylized_Death_E.png').outputs['Color'], bsdf.inputs['Emission Color'])
bsdf.inputs['Emission Strength'].default_value = 1.0
bsdf.inputs['Roughness'].default_value = 0.8
for o in (body, scythe):
    o.data.materials.clear()
    o.data.materials.append(mat)
for m in [m for m in bpy.data.materials if m is not mat]:
    bpy.data.materials.remove(m)
for img in [i for i in bpy.data.images if i.users == 0]:
    bpy.data.images.remove(img)

print('MORT_INFO armature', tuple(round(v, 3) for v in arm.matrix_world.to_scale()), 'faux', tuple(round(v, 3) for v in scythe_scale))

bpy.ops.export_scene.gltf(
    filepath=args.out, export_format='GLB', export_animations=True, export_animation_mode='NLA_TRACKS',
    export_apply=False, export_cameras=False, export_lights=False, export_image_format='JPEG',
)
tris = sum(len(p.vertices) - 2 for p in body.data.polygons) + sum(len(p.vertices) - 2 for p in scythe.data.polygons)
print(f'MORT_OK triangles={tris} -> {args.out}')

if args.render:
    os.makedirs(args.render, exist_ok=True)
    r = scene.render
    r.engine = 'BLENDER_WORKBENCH'
    r.resolution_x, r.resolution_y = 700, 800
    sh = scene.display.shading
    sh.light = 'STUDIO'
    sh.color_type = 'TEXTURE'
    sh.show_object_outline = True
    world = bpy.data.worlds.new('w')
    scene.world = world
    world.color = (0.55, 0.65, 0.75)
    cam_data = bpy.data.cameras.new('cam')
    cam_data.type = 'ORTHO'
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    bpy.context.view_layer.update()
    corners = [body.matrix_world @ Vector(c) for c in body.bound_box]
    lo = Vector((min(c.x for c in corners), min(c.y for c in corners), min(c.z for c in corners)))
    hi = Vector((max(c.x for c in corners), max(c.y for c in corners), max(c.z for c in corners)))
    center = (lo + hi) / 2
    size = max(hi - lo) * 1.5
    print('MORT_INFO boite', tuple(round(v, 3) for v in lo), tuple(round(v, 3) for v in hi))

    def shoot(fname, yaw_deg, clip=None, frame=1, pitch_deg=8):
        ad = arm.animation_data
        for t in ad.nla_tracks:
            t.mute = clip is not None and t.name != clip
            t.is_solo = False
        if clip:
            ad.nla_tracks[clip].is_solo = True
        scene.frame_set(frame)
        cam_data.ortho_scale = size
        yaw, pitch = math.radians(yaw_deg), math.radians(pitch_deg)
        d = Vector((math.sin(yaw) * math.cos(pitch), -math.cos(yaw) * math.cos(pitch), math.sin(pitch)))
        cam.location = center + d * 20
        cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
        r.filepath = os.path.join(args.render, fname)
        bpy.ops.render.render(write_still=True)

    for yaw, name in ((0, 'face'), (90, 'profil'), (180, 'dos'), (-35, 'trois_quarts')):
        shoot(f'{name}.png', yaw, 'idle')
    shoot('marche.png', -35, 'walk', 8)
    shoot('attaque_1.png', -35, 'attack', 20)
    shoot('attaque_2.png', -35, 'attack', 36)
    shoot('apparition.png', -35, 'spawn', 30)
    shoot('cri.png', -35, 'roar', 50)
    print('RENDERS_OK', args.render)
