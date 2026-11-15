"""
Le Père Noël (perso jouable) : le modèle « Surprised Santa » de Matt Connors (Poly by Google, CC-BY), monté sur le
squelette et les animations du Buveur.

Le modèle est en pièces rigides (bonnet, barbe, manteau, bras d'un seul tenant, jambes, bottes) sans squelette, les
bras levés. Le script :
1. le tourne vers -Y comme le Buveur, le met à la taille voulue, pieds au sol ;
2. rabaisse les bras le long du corps (rotation de chaque bras autour de son épaule) ;
3. replace les articulations du squelette du Buveur sur celles du Père Noël (hanches, genoux, chevilles, épaules,
   cou), chaque os gardant son orientation : les animations du Buveur (idle, run, jump, fall, land, death, throw)
   restent valables ;
4. attache chaque pièce à un os (poids 1) et exporte le tout avec les animations.

Usage (Blender 5.2) :
  blender -b --factory-startup -P tools/blender/pere_noel.py -- --src "C:/Users/mydnic/Desktop/MODELS/Surprised Santa by Matt Connors - 3Q7goR4wcNE.glb"
      --out src/assets/models/pere_noel.glb [--render DOSSIER]
"""
import argparse
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

ap = argparse.ArgumentParser()
ap.add_argument('--src', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--buveur', default='src/assets/models/buveur.glb')
ap.add_argument('--render', default='')
args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:])

HEIGHT = 1.75          # taille du Père Noël, du sol au pompon (m)
ARM_OUT = 0.18         # bras rabaissés : écart vers l'extérieur (pente de la direction du bras)

bpy.ops.wm.read_factory_settings(use_empty=True)

# --- Le squelette et les animations du Buveur
bpy.ops.import_scene.gltf(filepath=args.buveur)
rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
for o in [o for o in bpy.context.scene.objects if o.type == 'MESH']:
    bpy.data.objects.remove(o)
old = {b.name: (rig.matrix_world @ b.head_local, rig.matrix_world @ b.tail_local) for b in rig.data.bones}

# --- Le Père Noël : vers -Y, à la taille, pieds au sol
before = set(bpy.context.scene.objects)
bpy.ops.import_scene.gltf(filepath=args.src)
pieces = [o for o in bpy.context.scene.objects if o not in before and o.type == 'MESH']
# Toutes les pièces détachées de leurs parents (des pièces sont filles d'autres pièces : la pointe du bonnet et son
# pompon), leur place dans le monde gardée, avant d'appliquer les transformations
for o in pieces:
    mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
for o in pieces:
    o.data.transform(o.matrix_world)
    o.matrix_world = Matrix()
    o.data.transform(Matrix.Rotation(math.pi, 4, 'Z'))
allv = [v.co for o in pieces for v in o.data.vertices]
lo = Vector(map(min, *allv)); hi = Vector(map(max, *allv))
k = HEIGHT / (hi.z - lo.z)
centre = (lo + hi) / 2
for o in pieces:
    o.data.transform(Matrix.Translation(Vector((-centre.x * k, -centre.y * k, -lo.z * k))) @ Matrix.Scale(k, 4))

def verts(o):
    return [v.co.copy() for v in o.data.vertices]

# Centré sur le corps (le tronc, entre 20 et 55 % de la hauteur), pas sur la boîte englobante que les bras levés décalent
trunk = [v.co for o in pieces for v in o.data.vertices if 0.2 * HEIGHT < v.co.z < 0.55 * HEIGHT]
mid = sum(trunk, Vector()) / len(trunk)
# En largeur : le milieu des deux jambes (le manteau n'est pas symétrique)
low = [v.co for o in pieces for v in o.data.vertices if v.co.z < 0.15 * HEIGHT]
legs_mid = (Vector(map(min, *low)) + Vector(map(max, *low))) / 2
for o in pieces:
    o.data.transform(Matrix.Translation(Vector((-legs_mid.x, -mid.y, 0))))

def centroid(o):
    vs = verts(o)
    return sum(vs, Vector()) / len(vs)

def zrange(o):
    vs = verts(o)
    return min(v.z for v in vs), max(v.z for v in vs)

# --- Rôle de chaque pièce, d'après sa place
H = HEIGHT
arms = {'L': None, 'R': None}
for o in pieces:
    c = centroid(o)
    if abs(c.x) > 0.3 * H * 0.6 and len(o.data.vertices) > 300:
        arms['L' if c.x > 0 else 'R'] = o
role = {}
for o in pieces:
    if o is arms['L']: role[o] = 'upperarm.L'; continue
    if o is arms['R']: role[o] = 'upperarm.R'; continue
    c = centroid(o)
    z0, z1 = zrange(o)
    if c.z < 0.2 * H and abs(c.x) > 0.02 * H:  # jambes : pantalon, bottes, semelles (l'ourlet du manteau reste au tronc)
        side = 'L' if c.x > 0 else 'R'
        role[o] = ('foot.' if z1 < 0.12 * H else 'thigh.') + side
    elif c.z > 0.62 * H:
        role[o] = 'head'
    else:
        role[o] = 'spine'
# La barbe et le visage suivent la tête même s'ils descendent sur le ventre
for o in pieces:
    c = centroid(o)
    if role[o] == 'spine' and c.z > 0.55 * H and abs(c.x) < 0.15 * H:
        role[o] = 'head'

if os.environ.get('PN_DEBUG'):
    for o, r in sorted(role.items(), key=lambda x: x[1]):
        print('ROLE', r, o.name, round(centroid(o).z / H, 2), round(centroid(o).x, 2), round(centroid(o).y, 2), len(o.data.vertices), [m.name for m in o.data.materials if m])

# --- Bras rabaissés le long du corps
def repose(o, side):
    vs = verts(o)
    vs.sort(key=lambda v: abs(v.x))
    n = max(4, len(vs) // 12)
    pivot = sum(vs[:n], Vector()) / n                      # l'épaule : le bout du bras contre le corps
    far = sum(vs[-n:], Vector()) / n                       # la main : le bout le plus loin
    cur = (far - pivot).normalized()
    want = Vector((ARM_OUT * (1 if side == 'L' else -1), -0.05, -1)).normalized()
    rot = cur.rotation_difference(want).to_matrix().to_4x4()
    o.data.transform(Matrix.Translation(pivot) @ rot @ Matrix.Translation(-pivot))
    vs = verts(o)
    tip = min(vs, key=lambda v: v.z)
    return pivot, tip

shoulder, tip = {}, {}
for side in ('L', 'R'):
    shoulder[side], tip[side] = repose(arms[side], side)

# --- Repères du corps
legs = {s: [o for o in pieces if role[o] in (f'thigh.{s}', f'foot.{s}')] for s in ('L', 'R')}
hip_z = max(zrange(o)[1] for s in legs for o in legs[s] if role[o].startswith('thigh'))
ankle_z = max(zrange(o)[1] for s in legs for o in legs[s] if role[o].startswith('foot'))
leg_x = {s: sum((centroid(o).x for o in legs[s]), 0) / len(legs[s]) for s in legs}
neck_z = min(zrange(o)[0] for o in pieces if role[o] == 'head' and centroid(o).z > 0.72 * H)
neck_z = max(neck_z, (shoulder['L'].z + shoulder['R'].z) / 2 + 0.04 * H)
top_z = max(zrange(o)[1] for o in pieces)
toe_y = min(v.y for s in legs for o in legs[s] if role[o].startswith('foot') for v in verts(o))

# --- Le squelette replacé : chaque os garde sa direction, sa tête va sur l'articulation du Père Noël
def place(name, head, length=None, tail=None):
    eb = rig.data.edit_bones[name]
    h0, t0 = old[name]
    d = (t0 - h0)
    L = (tail - head).length if tail is not None else (length if length is not None else d.length)
    eb.head = head
    eb.tail = head + d.normalized() * L

bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
for eb in rig.data.edit_bones:
    eb.use_connect = False
mid_spine = hip_z + (neck_z - hip_z) * 0.45
place('hips', Vector((0, 0, hip_z)), tail=Vector((0, 0, mid_spine)))
place('spine', Vector((0, 0, mid_spine)), tail=Vector((0, 0, neck_z - 0.1 * H)))
place('belly', Vector((0, -0.12 * H, mid_spine)), length=0.1 * H)
place('chest', Vector((0, 0, neck_z - 0.1 * H)), tail=Vector((0, 0, neck_z)))
place('head', Vector((0, 0, neck_z)), tail=Vector((0, 0, top_z)))
for s in ('L', 'R'):
    knee = (hip_z + ankle_z) / 2
    place(f'thigh.{s}', Vector((leg_x[s], 0, hip_z)), tail=Vector((leg_x[s], 0, knee)))
    place(f'shin.{s}', Vector((leg_x[s], 0, knee)), tail=Vector((leg_x[s], 0, ankle_z)))
    place(f'foot.{s}', Vector((leg_x[s], 0, ankle_z)), tail=Vector((leg_x[s], toe_y, 0.0)))
    sh, tp = shoulder[s], tip[s]
    elbow = sh + (tp - sh) * 0.48
    wrist = sh + (tp - sh) * 0.82
    place(f'upperarm.{s}', sh, tail=elbow)
    place(f'forearm.{s}', elbow, tail=wrist)
    place(f'hand.{s}', wrist, tail=tp)
place('pint', rig.data.edit_bones['hand.R'].tail.copy(), length=0.15)
bpy.ops.object.mode_set(mode='OBJECT')

# --- Une pièce = un os (rigide), le tout en un maillage animé par le squelette
for o in pieces:
    o.vertex_groups.clear()
    g = o.vertex_groups.new(name=role[o])
    g.add([v.index for v in o.data.vertices], 1.0, 'REPLACE')
bpy.ops.object.select_all(action='DESELECT')
for o in pieces:
    o.select_set(True)
bpy.context.view_layer.objects.active = pieces[0]
bpy.ops.object.join()
body = bpy.context.active_object
body.name = 'pere_noel'
mod = body.modifiers.new('rig', 'ARMATURE')
mod.object = rig
body.parent = rig
rig.name = 'PereNoel_rig'
counts = {}
for o in role.values():
    counts[o] = counts.get(o, 0) + 1
print('Pièces par os :', counts)

bpy.ops.export_scene.gltf(filepath=args.out, export_format='GLB', export_animation_mode='ACTIONS', export_cameras=False, export_lights=False)
print('OK', args.out)

if args.render:
    os.makedirs(args.render, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = 500, 600
    w = bpy.data.worlds.new('w'); w.color = (0.6, 0.65, 0.7); sc.world = w
    bpy.ops.object.light_add(type='SUN', rotation=(0.7, 0.2, 2.6)); bpy.context.active_object.data.energy = 4
    cam = bpy.data.cameras.new('c'); cam.type = 'ORTHO'; cam.ortho_scale = 2.2
    co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co
    for name, act, frame, loc in (('profil', 'idle', 1, (4, 0, 1.1)), ('face', 'idle', 1, (0.6, -4, 1.1)), ('course', 'run', 6, (3, -3, 1.1)), ('saut', 'jump', 8, (0.6, -4, 1.1)), ('lancer', 'throw', 8, (3, -3, 1.1)), ('dos', 'idle', 1, (0, 4, 1.1))):
        rig.animation_data.action = bpy.data.actions.get(act)
        sc.frame_set(frame)
        co.location = loc
        co.rotation_euler = (Vector((0, 0, 0.9)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.join(args.render, f'{name}.png')
        bpy.ops.render.render(write_still=True)
