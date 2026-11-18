"""
Le Cop (perso jouable) : le modèle « Mall Cop » (Mixamo, fourni par l'utilisateur, dossier mall-cop-animated) monté sur
le squelette de la Universal Animation Library (Quaternius, CC0), dont il prend les vraies animations (repos, petit trot,
saut, mort...) à la place de celles du Buveur, trop raides sur un corps aux proportions réalistes.

Le modèle et le mannequin sont tous deux en pose T, face à -Y. Le script :
1. aligne chaque segment des membres du Cop sur l'os du mannequin (la peau suit), puis prend cette pose comme repos ;
2. replace les articulations du mannequin sur celles du Cop (chaque os garde son orientation : les animations restent
   valables) et reporte les poids de peau des os Mixamo sur les os du mannequin ;
3. garde les clips utiles, renommés comme le jeu les attend (idle, run, jump, fall, land, death, throw), et renomme les
   os que le jeu cherche (thigh/shin/foot pour le calage des pieds, hand.L d'où partent les bouteilles, hand.R) ;
4. réduit les textures (couleur seulement, `--tex` px) et exporte.

Usage (Blender 5.2) :
  blender -b --factory-startup -P tools/blender/cop.py -- --src "C:/Users/mydnic/Desktop/MODELS/mall-cop-animated/source/mall_cop_sf.glb"
      --ual "C:/Users/mydnic/Desktop/MODELS/animations/quaternius_universal_animation_library/UAL1_Standard.glb"
      --out src/assets/models/cop.glb [--render DOSSIER]
"""
import argparse
import os
import sys

import bpy
from mathutils import Matrix, Vector

ap = argparse.ArgumentParser()
ap.add_argument('--src', required=True)
ap.add_argument('--ual', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--tex', type=int, default=512)
ap.add_argument('--render', default='')
args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:])

HEIGHT = 1.85  # taille du Cop (m)

# Clips du mannequin -> noms attendus par le jeu (player/buveurVisual.ts). Le lancer est joué par-dessus le reste.
CLIPS = {'Idle_Loop': 'idle', 'Jog_Fwd_Loop': 'run', 'Jump_Start': 'jump', 'Jump_Loop': 'fall', 'Jump_Land': 'land',
         'Death01': 'death', 'Punch_Jab': 'throw'}
# Os du mannequin renommés comme ceux que le jeu cherche
RENAME = {'thigh_l': 'thigh.L', 'calf_l': 'shin.L', 'foot_l': 'foot.L', 'hand_l': 'hand.L',
          'thigh_r': 'thigh.R', 'calf_r': 'shin.R', 'foot_r': 'foot.R', 'hand_r': 'hand.R'}

# Os Mixamo (sans préfixe) -> os du mannequin, pour les poids de peau (doigts et bout des orteils : main et pied)
MAP = {'Hips': 'pelvis', 'Spine': 'spine_01', 'Spine1': 'spine_02', 'Spine2': 'spine_03', 'Neck': 'neck_01',
       'Head': 'Head', 'HeadTop_End': 'Head'}
for side, s in (('Left', 'l'), ('Right', 'r')):
    MAP.update({f'{side}Shoulder': f'clavicle_{s}', f'{side}Arm': f'upperarm_{s}', f'{side}ForeArm': f'lowerarm_{s}',
                f'{side}Hand': f'hand_{s}', f'{side}UpLeg': f'thigh_{s}', f'{side}Leg': f'calf_{s}',
                f'{side}Foot': f'foot_{s}', f'{side}ToeBase': f'ball_{s}', f'{side}Toe_End': f'ball_{s}'})
    for i in range(1, 5):
        MAP[f'{side}HandIndex{i}'] = f'hand_{s}'
        MAP[f'{side}HandThumb{i}'] = f'hand_{s}'

# Segments des membres du Cop alignés sur ceux du mannequin avant de figer la pose de repos (Mixamo -> mannequin)
ALIGN = [(f'{side}{m}', f'{u}_{s}') for side, s in (('Left', 'l'), ('Right', 'r'))
         for m, u in (('Arm', 'upperarm'), ('ForeArm', 'lowerarm'), ('Hand', 'hand'), ('UpLeg', 'thigh'), ('Leg', 'calf'), ('Foot', 'foot'))]


def short(name):
    return name.split(':')[-1]


def curves_of(action):
    """F-courbes d'une action (actions à calques de Blender 5, ou anciennes actions)."""
    try:
        return action.fcurves
    except AttributeError:
        return action.layers[0].strips[0].channelbags[0].fcurves


bpy.ops.wm.read_factory_settings(use_empty=True)

# --- Le mannequin : son squelette et ses animations
bpy.ops.import_scene.gltf(filepath=args.ual)
rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
for o in [o for o in bpy.context.scene.objects if o.type == 'MESH']:
    bpy.data.objects.remove(o)
for a in list(bpy.data.actions):
    if a.name in CLIPS:
        a.name = CLIPS[a.name]
    else:
        bpy.data.actions.remove(a)
if rig.animation_data:
    rig.animation_data.action = None
ual = {b.name: (rig.matrix_world @ b.head_local, rig.matrix_world @ b.tail_local) for b in rig.data.bones}
keep_actions = set(bpy.data.actions)

# --- Le Cop
before = set(bpy.context.scene.objects)
bpy.ops.import_scene.gltf(filepath=args.src)
new = [o for o in bpy.context.scene.objects if o not in before]
mix = next(o for o in new if o.type == 'ARMATURE')
for o in [o for o in new if o.type == 'MESH' and not o.vertex_groups]:
    bpy.data.objects.remove(o)  # la sphère qui traîne dans le fichier
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.parent == mix]
for a in set(bpy.data.actions) - keep_actions:
    bpy.data.actions.remove(a)
if mix.animation_data:
    mix.animation_data.action = None

# --- Membres alignés sur ceux du mannequin (pose), puis cette pose devient la forme du maillage
bpy.context.view_layer.objects.active = mix
bpy.ops.object.mode_set(mode='POSE')
for pb in mix.pose.bones:
    pb.rotation_mode = 'QUATERNION'
    pb.rotation_quaternion = (1, 0, 0, 0)
bpy.context.view_layer.update()
inv = mix.matrix_world.inverted().to_3x3()
for mx_name, u_name in ALIGN:
    pb = mix.pose.bones[f'mixamorig:{mx_name}']
    h0, t0 = ual[u_name]
    want = (inv @ (t0 - h0)).normalized()
    cur = (pb.tail - pb.head).normalized()
    q = cur.rotation_difference(want)
    m = pb.matrix.copy()
    head = m.translation.copy()
    pb.matrix = Matrix.Translation(head) @ q.to_matrix().to_4x4() @ Matrix.Translation(-head) @ m
    bpy.context.view_layer.update()
bpy.ops.object.mode_set(mode='OBJECT')
for o in meshes:
    bpy.context.view_layer.objects.active = o
    for mod in list(o.modifiers):
        if mod.type == 'ARMATURE':
            bpy.ops.object.modifier_apply(modifier=mod.name)
    mw = o.matrix_world.copy()
    o.parent = None
    o.data.transform(mw)
    o.matrix_world = Matrix()
joints = {short(pb.name): (mix.matrix_world @ pb.head, mix.matrix_world @ pb.tail) for pb in mix.pose.bones}
bpy.data.objects.remove(mix)

# Mise à la taille voulue, pieds au sol, centré
allv = [v.co for o in meshes for v in o.data.vertices]
lo = Vector(map(min, *allv)); hi = Vector(map(max, *allv))
T = Matrix.Scale(HEIGHT / (hi.z - lo.z), 4) @ Matrix.Translation(Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z)))
for o in meshes:
    o.data.transform(T)
joints = {n: (T @ h, T @ t) for n, (h, t) in joints.items()}
J = lambda n: joints[n][0]

# --- Articulations du mannequin replacées sur celles du Cop (orientation des os gardée)
k = (J('Head') - J('Hips')).length / (ual['Head'][0] - ual['pelvis'][0]).length  # rapport de taille Cop / mannequin
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
eb = rig.data.edit_bones
for b in eb:
    b.use_connect = False
moved = {}


def place(name, head, tail=None):
    b = eb[name]
    h0, t0 = ual[name]
    d = t0 - h0
    L = (tail - head).length if tail is not None else d.length * k
    b.head = head
    b.tail = head + d.normalized() * L
    moved[name] = True


place('pelvis', J('Hips'), J('Spine'))
place('spine_01', J('Spine'), J('Spine1'))
place('spine_02', J('Spine1'), J('Spine2'))
place('spine_03', J('Spine2'), J('Neck'))
place('neck_01', J('Neck'), J('Head'))
place('Head', J('Head'), J('HeadTop_End'))
for side, s in (('Left', 'l'), ('Right', 'r')):
    place(f'clavicle_{s}', J(f'{side}Shoulder'), J(f'{side}Arm'))
    place(f'upperarm_{s}', J(f'{side}Arm'), J(f'{side}ForeArm'))
    place(f'lowerarm_{s}', J(f'{side}ForeArm'), J(f'{side}Hand'))
    place(f'hand_{s}', J(f'{side}Hand'))
    place(f'thigh_{s}', J(f'{side}UpLeg'), J(f'{side}Leg'))
    place(f'calf_{s}', J(f'{side}Leg'), J(f'{side}Foot'))
    place(f'foot_{s}', J(f'{side}Foot'), J(f'{side}ToeBase'))
    place(f'ball_{s}', J(f'{side}ToeBase'), J(f'{side}Toe_End'))
# Les doigts (sans poids de peau) et les bouts d'os suivent l'os replacé dont ils dépendent
for b in eb:
    if b.name in moved or b.name == 'root':
        continue
    p = b.parent
    while p is not None and p.name not in moved:
        p = p.parent
    if p is not None:
        h0, t0 = ual[b.name]
        b.head = p.head + (h0 - ual[p.name][0]) * k
        b.tail = b.head + (t0 - h0) * k
bpy.ops.object.mode_set(mode='OBJECT')

# Les déplacements du bassin dans les clips (rebond de la course, chute de la mort) à l'échelle du Cop
for a in bpy.data.actions:
    for fc in curves_of(a):
        if fc.data_path.endswith('location') and ('"pelvis"' in fc.data_path or '"root"' in fc.data_path):
            for kp in fc.keyframe_points:
                kp.co.y *= k
                kp.handle_left.y *= k
                kp.handle_right.y *= k

# --- Poids de peau : groupes Mixamo fusionnés dans les groupes du mannequin
for o in meshes:
    sums = {}
    for v in o.data.vertices:
        acc = {}
        for g in v.groups:
            t = MAP.get(short(o.vertex_groups[g.group].name))
            if t and g.weight > 0:
                acc[t] = acc.get(t, 0) + g.weight
        sums[v.index] = acc
    for g in list(o.vertex_groups):
        o.vertex_groups.remove(g)
    groups = {}
    for i, acc in sums.items():
        for t, w in acc.items():
            if t not in groups:
                groups[t] = o.vertex_groups.new(name=t)
            groups[t].add([i], min(1.0, w), 'REPLACE')
    mod = o.modifiers.new('rig', 'ARMATURE')
    mod.object = rig
    o.parent = rig

# --- Os renommés comme le jeu les attend (et les chemins des clips avec eux)
for old_name, new_name in RENAME.items():
    rig.data.bones[old_name].name = new_name
    for o in meshes:
        g = o.vertex_groups.get(old_name)
        if g:
            g.name = new_name
    for a in bpy.data.actions:
        for fc in curves_of(a):
            if f'"{old_name}"' in fc.data_path:
                fc.data_path = fc.data_path.replace(f'"{old_name}"', f'"{new_name}"')

# --- Textures réduites, sans carte de relief (le cel-shading n'en a pas besoin)
for mat in bpy.data.materials:
    if not mat.use_nodes:
        continue
    for n in list(mat.node_tree.nodes):
        if n.type == 'NORMAL_MAP':
            mat.node_tree.nodes.remove(n)
for img in bpy.data.images:
    if img.size[0] > args.tex:
        img.scale(args.tex, args.tex)
rig.name = 'Cop_rig'

bpy.ops.export_scene.gltf(filepath=args.out, export_format='GLB', export_animation_mode='ACTIONS', export_cameras=False, export_lights=False,
                          export_image_format='JPEG')
print('OK', args.out, 'triangles', sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes),
      'clips', sorted(a.name for a in bpy.data.actions))

if args.render:
    os.makedirs(args.render, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = 500, 600
    w = bpy.data.worlds.new('w'); w.color = (0.6, 0.65, 0.7); sc.world = w
    bpy.ops.object.light_add(type='SUN', rotation=(0.7, 0.2, 2.6)); bpy.context.active_object.data.energy = 4
    cam = bpy.data.cameras.new('c'); cam.type = 'ORTHO'; cam.ortho_scale = 2.4
    co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co
    rig.animation_data_create()
    for name, act, frame, loc in (('face', 'idle', 1, (0.6, -4, 1.1)), ('profil', 'idle', 30, (4, 0, 1.1)), ('course', 'run', 6, (3, -3, 1.1)),
                                  ('course2', 'run', 14, (3, -3, 1.1)), ('lancer', 'throw', 10, (3, -3, 1.1)), ('saut', 'fall', 10, (3, -3, 1.1)),
                                  ('mort', 'death', 55, (3, -3, 1.1))):
        rig.animation_data.action = bpy.data.actions.get(act)
        if rig.animation_data.action and hasattr(rig.animation_data, 'action_slot') and rig.animation_data.action.slots:
            rig.animation_data.action_slot = rig.animation_data.action.slots[0]
        sc.frame_set(frame)
        co.location = loc
        co.rotation_euler = (Vector((0, 0, 0.95)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.join(args.render, f'{name}.png')
        bpy.ops.render.render(write_still=True)
