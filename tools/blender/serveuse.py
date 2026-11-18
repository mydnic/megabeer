"""
La Serveuse (perso jouable) : « Debbie the Roller Waitress » de SAB64 (Sketchfab, CC-BY 4.0, fourni par l'utilisateur),
serveuse de diner sur patins à roulettes, montée sur le squelette de la Universal Animation Library (Quaternius, CC0).

Le modèle a un squelette MikuMikuDance en pose A (noms japonais ; chaque os finit par un numéro unique, `_N`, qui sert
ici à les reconnaître). Le script :
1. retire le plateau de nourriture et les pièces cachées sous les vêtements, allège les plus lourdes ;
2. aligne bras et jambes sur les os du mannequin (pose en T), prend cette pose comme repos ;
3. replace les articulations du mannequin sur les siennes (orientation des os gardée) et reporte les poids des os
   MikuMikuDance sur ceux du mannequin (jupe : bassin et cuisses ; visage, cheveux, casquette : tête) ;
4. garde des clips à elle : repos un bras levé (le plateau), course faite main en patineuse (poussées de jambe en
   diagonale, buste penché, le bras du plateau toujours levé) ; renomme les os que le jeu cherche ; exporte.

Usage (Blender 5.2) :
  blender -b --factory-startup -P tools/blender/serveuse.py -- --src "C:/Users/mydnic/Desktop/MODELS/debbie_the_roller_waitress.glb"
      --ual "C:/Users/mydnic/Desktop/MODELS/animations/quaternius_universal_animation_library/UAL1_Standard.glb"
      --out src/assets/models/serveuse.glb [--render DOSSIER]
"""
import argparse
import math
import os
import sys

import bpy
from mathutils import Euler, Matrix, Vector

ap = argparse.ArgumentParser()
ap.add_argument('--src', required=True)
ap.add_argument('--ual', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--tex', type=int, default=512)
ap.add_argument('--render', default='')
args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:])

HEIGHT = 1.72  # taille de la Serveuse, casquette et patins compris (m)

# Os MikuMikuDance (numéro final) -> os du mannequin
MAP = {}
for n in (174, 169, 168, 56, 10, 19, 20, 21):
    MAP[n] = 'pelvis'
MAP.update({7: 'thigh_l', 22: 'thigh_l', 4: 'calf_l', 3: 'foot_l', 171: 'foot_l', 2: 'ball_l', 170: 'ball_l',
            16: 'thigh_r', 23: 'thigh_r', 13: 'calf_r', 12: 'foot_r', 173: 'foot_r', 11: 'ball_r', 172: 'ball_r',
            167: 'spine_01', 166: 'spine_02', 165: 'spine_03', 162: 'spine_03', 161: 'spine_03', 164: 'spine_03', 163: 'spine_03',
            120: 'neck_01', 119: 'Head',
            140: 'clavicle_l', 139: 'upperarm_l', 138: 'lowerarm_l', 137: 'hand_l', 136: 'hand_l',
            160: 'clavicle_r', 159: 'upperarm_r', 158: 'lowerarm_r', 157: 'hand_r', 156: 'hand_r'})
for n in range(57, 117):          # visage, yeux, bouche, cheveux, casquette
    MAP[n] = 'Head'
for n in range(121, 136):
    MAP[n] = 'hand_l'
for n in range(141, 156):
    MAP[n] = 'hand_r'
# Jupe : 8 chaînes de 4 os (_niveau_chaîne_N), du haut (0) au bas (3). Chaînes 0 et 4 : devant et dos (bassin) ; 1 à 3 :
# côté gauche ; 5 à 7 : côté droit. Le haut suit le bassin, le bas la cuisse de son côté.
SKIRT = {}
for chain in range(8):
    for level in range(4):
        SKIRT[(level, chain)] = 'pelvis' if chain in (0, 4) or level == 0 else ('thigh_l' if chain in (1, 2, 3) else 'thigh_r')

# Pièces retirées (cachées sous les vêtements, ou dans la bouche) et pièces allégées (part des triangles gardés)
DROP = {'Tongue', 'Upper_Teeth', 'Lower_Teeth', 'Tears', 'Bubblegum', 'Underwear', 'Bikini_Top', 'Notepad', 'Pencil', 'Straws'}
DECIMATE = {'Hair': 0.14, 'Body': 0.4, 'Shoes': 0.14, 'Skates': 0.3, 'Cap_Text': 0.15, 'Nametag': 0.2, 'Skirt': 0.6, 'Shirt': 0.6,
            'Shirt_Buttons': 0.2, 'Eyes': 0.4}
# Bras et jambes alignés sur le mannequin (numéro MMD -> os du mannequin)
ALIGN = {139: 'upperarm_l', 138: 'lowerarm_l', 137: 'hand_l', 159: 'upperarm_r', 158: 'lowerarm_r', 157: 'hand_r',
         7: 'thigh_l', 4: 'calf_l', 16: 'thigh_r', 13: 'calf_r'}

CLIPS = {'Idle_Torch_Loop': 'idle', 'Jump_Start': 'jump', 'Jump_Loop': 'fall', 'Jump_Land': 'land', 'Death01': 'death',
         'Punch_Cross': 'throw'}
RENAME = {'thigh_l': 'thigh.L', 'calf_l': 'shin.L', 'foot_l': 'foot.L', 'hand_l': 'hand.L',
          'thigh_r': 'thigh.R', 'calf_r': 'shin.R', 'foot_r': 'foot.R', 'hand_r': 'hand.R'}


def num(name):
    """Numéro final d'un os MMD (`..._N`), ou None."""
    tail = name.rsplit('_', 1)[-1]
    return int(tail) if tail.isdigit() else None


def skirt_key(name):
    parts = name.rsplit('_', 3)
    if len(parts) == 4 and all(p.isdigit() for p in parts[1:]):
        return int(parts[1]), int(parts[2])
    return None


def curves_of(action):
    try:
        return action.fcurves
    except AttributeError:
        return action.layers[0].strips[0].channelbags[0].fcurves


bpy.ops.wm.read_factory_settings(use_empty=True)

# --- Le mannequin
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

# --- Debbie : seulement le corps (le plateau de nourriture a ses propres squelettes)
before = set(bpy.context.scene.objects)
bpy.ops.import_scene.gltf(filepath=args.src)
new = [o for o in bpy.context.scene.objects if o not in before]
src = max((o for o in new if o.type == 'ARMATURE'), key=lambda o: len(o.data.bones))
meshes = []
for o in new:
    if o.type == 'MESH':
        a = next((m.object for m in o.modifiers if m.type == 'ARMATURE'), None)
        mat = o.data.materials[0].name if o.data.materials else ''
        if a is src and mat not in DROP:
            meshes.append(o)
drop = [o for o in new if (o.type == 'MESH' and o not in meshes) or (o.type == 'ARMATURE' and o is not src)]
for o in drop:
    bpy.data.objects.remove(o)
for a in set(bpy.data.actions) - keep_actions:
    bpy.data.actions.remove(a)
if src.animation_data:
    src.animation_data.action = None
for o in meshes:
    if o.data.shape_keys:
        o.shape_key_clear()
by_num = {num(b.name): b.name for b in src.data.bones if num(b.name) is not None}

# --- Pose de repos (le fichier la montre sur une jambe), bras et jambes alignés sur le mannequin
bpy.context.view_layer.objects.active = src
bpy.ops.object.mode_set(mode='POSE')
for pb in src.pose.bones:
    pb.rotation_mode = 'QUATERNION'
    pb.rotation_quaternion = (1, 0, 0, 0)
    pb.location = (0, 0, 0)
    pb.scale = (1, 1, 1)
bpy.context.view_layer.update()
inv = src.matrix_world.inverted().to_3x3()
for n, u in ALIGN.items():
    pb = src.pose.bones[by_num[n]]
    h0, t0 = ual[u]
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
J = {num(pb.name): (src.matrix_world @ pb.head, src.matrix_world @ pb.tail) for pb in src.pose.bones if num(pb.name) is not None}
bone_names = {g.name for o in meshes for g in o.vertex_groups}
bpy.data.objects.remove(src)
for o in [o for o in bpy.context.scene.objects if o.type == 'EMPTY']:
    bpy.data.objects.remove(o)

# Mise à la taille, pieds au sol, centrée
allv = [v.co for o in meshes for v in o.data.vertices]
lo = Vector(map(min, *allv)); hi = Vector(map(max, *allv))
T = Matrix.Scale(HEIGHT / (hi.z - lo.z), 4) @ Matrix.Translation(Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z)))
for o in meshes:
    o.data.transform(T)
J = {n: (T @ h, T @ t) for n, (h, t) in J.items()}
H = lambda n: J[n][0]

# --- Articulations du mannequin replacées sur les siennes
k = (H(119) - H(7).lerp(H(16), 0.5)).length / (ual['Head'][0] - ual['pelvis'][0]).length
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
eb = rig.data.edit_bones
for b in eb:
    b.use_connect = False
moved = set()


def place(name, head, tail=None):
    b = eb[name]
    h0, t0 = ual[name]
    d = t0 - h0
    L = (tail - head).length if tail is not None else d.length * k
    b.head = head
    b.tail = head + d.normalized() * L
    moved.add(name)


hips = H(7).lerp(H(16), 0.5) + Vector((0, 0, 0.03))
place('pelvis', hips, H(167))
place('spine_01', H(167), H(166))
place('spine_02', H(166), H(165))
place('spine_03', H(165), H(120))
place('neck_01', H(120), H(119))
place('Head', H(119), H(119) + Vector((0, 0, 0.22)))
for s, sh, ua, el, wr, hip, kn, an, toe in (('l', 140, 139, 138, 137, 7, 4, 3, 2), ('r', 160, 159, 158, 157, 16, 13, 12, 11)):
    place(f'clavicle_{s}', H(sh), H(ua))
    place(f'upperarm_{s}', H(ua), H(el))
    place(f'lowerarm_{s}', H(el), H(wr))
    place(f'hand_{s}', H(wr))
    place(f'thigh_{s}', H(hip), H(kn))
    place(f'calf_{s}', H(kn), H(an))
    place(f'foot_{s}', H(an), H(toe))
    place(f'ball_{s}', H(toe))
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
for a in bpy.data.actions:
    for fc in curves_of(a):
        if fc.data_path.endswith('location') and ('"pelvis"' in fc.data_path or '"root"' in fc.data_path):
            for kp in fc.keyframe_points:
                kp.co.y *= k
                kp.handle_left.y *= k
                kp.handle_right.y *= k

# --- Poids : groupes MMD fusionnés dans les groupes du mannequin, puis pièces allégées et réunies
for o in meshes:
    sums = {}
    for v in o.data.vertices:
        acc = {}
        for g in v.groups:
            name = o.vertex_groups[g.group].name
            sk = skirt_key(name)
            t = SKIRT.get(sk) if sk else MAP.get(num(name))
            if t and g.weight > 0:
                acc[t] = acc.get(t, 0) + g.weight
        if not acc:
            acc = {'pelvis': 1.0}
        sums[v.index] = acc
    for g in list(o.vertex_groups):
        o.vertex_groups.remove(g)
    groups = {}
    for i, acc in sums.items():
        tot = sum(acc.values())
        for t, w in acc.items():
            if t not in groups:
                groups[t] = o.vertex_groups.new(name=t)
            groups[t].add([i], w / tot, 'REPLACE')
    mat = o.data.materials[0].name if o.data.materials else ''
    ratio = DECIMATE.get(mat)
    if ratio:
        d = o.modifiers.new('allege', 'DECIMATE'); d.ratio = ratio
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=d.name)
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.join()
body = bpy.context.view_layer.objects.active
body.name = 'Serveuse'
mod = body.modifiers.new('rig', 'ARMATURE'); mod.object = rig
body.parent = rig


# --- Course de patineuse, faite main : le haut du corps reprend le repos (le plateau levé), les jambes poussent en
# diagonale vers l'arrière tour à tour, la jambe d'appui fléchie, le buste penché en avant, le bassin qui balance.
def frames_of(action):
    rig.animation_data_create()
    rig.animation_data.action = action
    if hasattr(rig.animation_data, 'action_slot') and action.slots:
        rig.animation_data.action_slot = action.slots[0]
    s, e = (int(round(x)) for x in action.frame_range)
    out = []
    for f in range(s, e + 1):
        bpy.context.scene.frame_set(f)
        out.append({pb.name: pb.matrix.copy() for pb in rig.pose.bones})
    rig.animation_data.action = None
    return out


def turned(fr, bone, rot):
    """Tourne `bone` et ses enfants (matrices dans l'armature) autour de la tête de l'os."""
    head = fr[bone].translation.copy()
    R = Matrix.Translation(head) @ rot.to_matrix().to_4x4() @ Matrix.Translation(-head)
    for n in [bone] + [c.name for c in rig.data.bones[bone].children_recursive]:
        fr[n] = R @ fr[n]


def E(x, y, z):
    return Euler((math.radians(x), math.radians(y), math.radians(z)), 'XYZ').to_quaternion()


idle = frames_of(bpy.data.actions['idle'])
L = 36                                   # 1,2 s par cycle (deux poussées)
skate = []
for i in range(L + 1):
    a = i / L * math.tau
    fr = {k_: m.copy() for k_, m in idle[i % len(idle)].items()}
    s_ = math.sin(a)
    turned(fr, 'pelvis', E(10, 0, 8 * s_))                              # penchée en avant, le bassin balance
    for side, sg, ph in (('l', 1, 0.0), ('r', -1, math.pi)):
        push = max(0.0, math.sin(a + ph))                                # 0 : jambe d'appui ; 1 : poussée
        turned(fr, f'thigh_{side}', E(-18 + 38 * push, -sg * 22 * push, 0))  # en arrière et vers l'extérieur
        turned(fr, f'calf_{side}', E(-35 * (1 - push), 0, 0))           # appui fléchi, poussée tendue
    turned(fr, 'spine_02', E(6, 0, -5 * s_))
    turned(fr, 'upperarm_l', E(-18 * s_, 0, 0))                          # le bras libre accompagne
    skate.append(fr)

act = bpy.data.actions.new('run')
rig.animation_data.action = act
if hasattr(rig.animation_data, 'action_slot') and act.slots:
    rig.animation_data.action_slot = act.slots[0]
for i, fr in enumerate(skate):
    for pb in rig.pose.bones:
        pb.matrix = fr[pb.name]
        bpy.context.view_layer.update()
    for pb in rig.pose.bones:
        pb.keyframe_insert('rotation_quaternion', frame=i)
        pb.keyframe_insert('location', frame=i)
rig.animation_data.action = None
for pb in rig.pose.bones:
    pb.matrix_basis = Matrix()

# --- Os renommés comme le jeu les attend
for old, new_name in RENAME.items():
    rig.data.bones[old].name = new_name
    g = body.vertex_groups.get(old)
    if g:
        g.name = new_name
    for a in bpy.data.actions:
        for fc in curves_of(a):
            if f'"{old}"' in fc.data_path:
                fc.data_path = fc.data_path.replace(f'"{old}"', f'"{new_name}"')

for mat in bpy.data.materials:
    if not mat.use_nodes:
        continue
    for n in list(mat.node_tree.nodes):
        if n.type == 'NORMAL_MAP':
            mat.node_tree.nodes.remove(n)
for img in bpy.data.images:
    if img.size[0] > args.tex:
        img.scale(args.tex, args.tex)
rig.name = 'Serveuse_rig'
bpy.ops.export_scene.gltf(filepath=args.out, export_format='GLB', export_animation_mode='ACTIONS', export_cameras=False, export_lights=False,
                          export_image_format='JPEG')
print('SERVEUSE_OK', args.out, 'triangles', sum(len(p.vertices) - 2 for p in body.data.polygons), 'clips', sorted(a.name for a in bpy.data.actions))

if args.render:
    os.makedirs(args.render, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = 500, 600
    w = bpy.data.worlds.new('w'); w.color = (0.6, 0.65, 0.7); sc.world = w
    bpy.ops.object.light_add(type='SUN', rotation=(0.7, 0.2, 2.6)); bpy.context.active_object.data.energy = 4
    cam = bpy.data.cameras.new('c'); cam.type = 'ORTHO'; cam.ortho_scale = 2.2
    co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co
    for name, act_name, frame, loc in (('repos_brut', None, 0, (0.6, -4, 0.9)), ('face', 'idle', 10, (0.6, -4, 0.9)), ('trois_quarts', 'idle', 30, (3, -3, 0.9)),
                                       ('patin1', 'run', 9, (3, -3, 0.9)), ('patin2', 'run', 27, (3, -3, 0.9)), ('patin_face', 'run', 9, (0.3, -4, 0.9)),
                                       ('lancer', 'throw', 8, (3, -3, 0.9)), ('mort', 'death', 50, (3, -3, 0.9))):
        rig.animation_data.action = bpy.data.actions.get(act_name) if act_name else None
        if act_name and hasattr(rig.animation_data, 'action_slot') and rig.animation_data.action.slots:
            rig.animation_data.action_slot = rig.animation_data.action.slots[0]
        if not act_name:
            for pb in rig.pose.bones:
                pb.matrix_basis = Matrix()
        sc.frame_set(frame)
        co.location = loc
        co.rotation_euler = (Vector((0, 0, 0.85)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.join(args.render, f'{name}.png')
        bpy.ops.render.render(write_still=True)
