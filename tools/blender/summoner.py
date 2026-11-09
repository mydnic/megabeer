"""
Prépare un personnage statique (sans squelette) pour la foule du jeu : il est habillé du squelette
du mannequin de la Universal Animation Library (Quaternius, 65 os), dont il reprend les animations.

Le maillage est tourné face à -Y comme le mannequin, mis à l'échelle de son envergure (bras en T),
posé au sol, puis attaché au squelette avec des poids calculés par Blender. Les animations du
mannequin sont renommées comme celles des zombies (Idle, Walk, Punch, HitReact, Death), plus Cast
(geste d'invocation).

Variantes (--variant) :
- prieur : l'Eye Summoner de Polygonal Mind (100 Avatars), robe noire et coiffe à l'oeil.

Usage (Blender 5.2) :
  blender -b --factory-startup --disable-autoexec -P tools/blender/summoner.py -- --lib C:/Users/mydnic/Desktop/MODELS
      --variant prieur --out src/assets/models/prieur.glb [--render DOSSIER]
"""
import argparse
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

ap = argparse.ArgumentParser()
ap.add_argument('--lib', required=True)
ap.add_argument('--variant', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--render')
args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:])

UAL = 'animations/quaternius_universal_animation_library/UAL1_Standard.glb'

VARIANTS = {
    'prieur': {
        'src': 'personnages/polygonal_mind_eye_summoner/EYESummoner.fbx',
        # Rotation (degrés, autour de Z) qui le tourne face à -Y comme le mannequin
        'turn': -90,
        # Hauteur de ses bras en T dans le fichier : le modèle est mis à l'échelle pour qu'ils
        # tombent à la hauteur de ceux du mannequin
        'arm_height': 3.02,
        # Squelette du mannequin ajusté au corps (m, une fois le modèle à l'échelle) : hauteur
        # mannequin -> hauteur du modèle (par morceaux), bout des doigts et épaules, écart des jambes
        'height_map': [(0.0, 0.0), (0.932, 0.75), (1.441, 1.441), (1.569, 1.70), (1.83, 1.95)],
        'arm_map': [(0.0, 0.0), (0.192, 0.25), (0.972, 1.13)],
        'leg_x': 0.22,
        # Distance (m) sous laquelle un sommet se partage entre ses deux os les plus proches
        'weight_blend': 0.06,
        # Animation du mannequin -> noms attendus par le jeu
        'clips': {
            'Idle_Loop': 'Idle',
            'Walk_Formal_Loop': 'Walk',
            'Punch_Jab': 'Punch',
            'Hit_Chest': 'HitReact',
            'Death01': 'Death',
            'Spell_Simple_Shoot': 'Cast',
        },
    },
}
variant = VARIANTS[args.variant]


def select(objs, active):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active


def bounds(points):
    lo = Vector([min(p[i] for p in points) for i in range(3)])
    hi = Vector([max(p[i] for p in points) for i in range(3)])
    return lo, hi


def world_verts(o):
    return [o.matrix_world @ v.co for v in o.data.vertices]


bpy.ops.wm.read_factory_settings(use_empty=True)

# Le mannequin : son squelette et ses animations ; son maillage sert de référence de taille
bpy.ops.import_scene.gltf(filepath=os.path.join(args.lib, UAL))
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
mannequin = next(o for o in bpy.data.objects if o.type == 'MESH' and o.name.startswith('Mannequin'))
for o in [o for o in bpy.data.objects if o.type == 'MESH' and o is not mannequin]:
    bpy.data.objects.remove(o)
arm.animation_data.action = None
bpy.context.view_layer.update()
m_lo, m_hi = bounds(world_verts(mannequin))

# Le personnage : un seul maillage, transformations appliquées, face à -Y
before = set(bpy.data.objects)
bpy.ops.import_scene.fbx(filepath=os.path.join(args.lib, variant['src']))
new = [o for o in bpy.data.objects if o not in before]
body = max((o for o in new if o.type == 'MESH'), key=lambda o: len(o.data.polygons))
for o in new:
    if o is not body:
        bpy.data.objects.remove(o)
body.parent = None
# Les avatars ont des formes de bouche (shape keys) : elles figeraient les sommets dans leur forme
# de base, et la foule n'en veut pas
if body.data.shape_keys:
    body.shape_key_clear()
body.rotation_euler.z += math.radians(variant['turn'])
select([body], body)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# Bras à la hauteur de ceux du mannequin, pieds au sol, centré en X ; le buste aligné sur la colonne
lo, hi = bounds([v.co for v in body.data.vertices])
k = arm.data.bones['upperarm_l'].head_local.z / (variant['arm_height'] - lo.z)
for v in body.data.vertices:
    v.co = Vector(((v.co.x - (lo.x + hi.x) / 2) * k, v.co.y * k, (v.co.z - lo.z) * k))
spine = arm.data.bones['spine_02'].head_local
chest = [v.co.y for v in body.data.vertices if abs(v.co.z - spine.z) < 0.15]
dy = spine.y - (min(chest) + max(chest)) / 2
for v in body.data.vertices:
    v.co.y += dy
body.data.update()
bpy.data.objects.remove(mannequin)


def piecewise(x, knots):
    """Interpolation linéaire par morceaux (prolongée au-delà des bouts)."""
    for (a, fa), (b, fb) in zip(knots, knots[1:]):
        if x <= b or (b, fb) == knots[-1]:
            return fa + (fb - fa) * (x - a) / (b - a)


# Le squelette ajusté au corps : hauteurs par morceaux, bras allongés, jambes écartées
ARM_BONES = ('clavicle', 'upperarm', 'lowerarm', 'hand', 'index', 'middle', 'pinky', 'ring', 'thumb')
LEG_BONES = ('thigh', 'calf', 'foot', 'ball')
LEG_X = arm.data.bones['thigh_l'].head_local.x


def fit(name, p):
    x, y, z = p
    s = 1 if x >= 0 else -1
    if name.startswith(ARM_BONES):
        x = s * piecewise(abs(x), variant['arm_map'])
    elif name.startswith(LEG_BONES):
        x = x + s * (variant['leg_x'] - LEG_X)
    return Vector((x, y, piecewise(z, variant['height_map'])))


select([arm], arm)
bpy.ops.object.mode_set(mode='EDIT')
# Positions d'origine lues d'abord : les os reliés partagent leurs bouts
rest = {eb.name: (eb.head.copy(), eb.tail.copy(), eb.roll) for eb in arm.data.edit_bones}
for eb in arm.data.edit_bones:
    head, tail, roll = rest[eb.name]
    eb.head, eb.tail = fit(eb.name, head), fit(eb.name, tail)
    eb.roll = roll
bpy.ops.object.mode_set(mode='OBJECT')

# Attaché au squelette. Les poids automatiques de Blender accrochent la coiffe et les encensoirs aux
# mains (pointes étirées) : le modèle étant fait de blocs, chaque sommet suit l'os le plus proche,
# avec un fondu vers le second quand ils sont presque à égale distance ; au-dessus du cou, la tête.
select([body, arm], arm)
bpy.ops.object.parent_set(type='ARMATURE_NAME')
for g in list(body.vertex_groups):
    body.vertex_groups.remove(g)
SKIP = ('index', 'middle', 'pinky', 'ring', 'thumb', 'ball_leaf', 'root')
bones = [b for b in arm.data.bones if not b.name.startswith(SKIP) and not b.name.endswith('leaf')]
groups = {b.name: body.vertex_groups.new(name=b.name) for b in bones}
neck = arm.data.bones['Head'].head_local.z
blend = variant['weight_blend']


def seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
    return (p - (a + ab * t)).length


for v in body.data.vertices:
    p = v.co
    if p.z > neck:
        groups['Head'].add([v.index], 1.0, 'REPLACE')
        continue
    near = sorted((seg_dist(p, b.head_local, b.tail_local), b.name) for b in bones if b.name != 'Head')
    (d1, n1), (d2, n2) = near[0], near[1]
    w2 = max(0.0, 1 - (d2 - d1) / blend) * 0.5
    groups[n1].add([v.index], 1 - w2, 'REPLACE')
    if w2 > 0:
        groups[n2].add([v.index], w2, 'ADD')

# Animations : seules celles du jeu, renommées. L'import du mannequin a posé ses propres pistes NLA
# (une par animation) : retirées, sinon l'export les mélange et sort des animations figées.
arm.animation_data_create()
for track in list(arm.animation_data.nla_tracks):
    arm.animation_data.nla_tracks.remove(track)
for a in list(bpy.data.actions):
    name = variant['clips'].get(a.name)
    if not name:
        bpy.data.actions.remove(a)
        continue
    a.name = name
    a.use_fake_user = True

if args.render:
    # Vues de contrôle : de face au repos, puis une image de chaque animation, de 3/4
    os.makedirs(args.render, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.color_type = 'TEXTURE'
    sc.render.resolution_x, sc.render.resolution_y = 360, 480
    sc.world = bpy.data.worlds.new('fond')
    sc.world.color = (0.8, 0.8, 0.8)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    sc.collection.objects.link(cam)
    sc.camera = cam
    h = max(v.co.z for v in body.data.vertices)
    ev = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
    pts = [ev.matrix_world @ v.co for v in ev.data.vertices]
    print('Taille rendue :', bounds(pts), '| matrice :', body.matrix_world.to_scale(), arm.matrix_world.to_scale())
    target = Vector((0, 0, h * 0.5))

    def shot(name, direction):
        cam.location = target + Vector(direction).normalized() * h * 2.4
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.join(args.render, name + '.png')
        bpy.ops.render.render(write_still=True)

    shot('repos_face', (0, -1, 0.15))
    for a in bpy.data.actions:
        arm.animation_data.action = a
        f0, f1 = a.frame_range
        for t in (0.0, 0.5):
            sc.frame_set(int(f0 + (f1 - f0) * t))
            shot(f'{a.name}_{int(t * 100)}', (0.7, -1, 0.25))
    arm.animation_data.action = None
    sc.frame_set(0)

select([body], body)
bpy.ops.export_scene.gltf(
    filepath=args.out, export_format='GLB', export_animations=True, export_animation_mode='ACTIONS',
    export_apply=False, export_cameras=False, export_lights=False,
)
print('Personnage exporté :', args.variant, args.out, '| animations :', sorted(a.name for a in bpy.data.actions))
