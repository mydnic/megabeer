"""
Alliés des abbayes (issue #18) : Krilin, Yoda et Steve montés sur le squelette de la Universal Animation Library
(Quaternius, CC0), dont ils prennent des clips choisis pour chacun (repos, course, geste de pouvoir) ; et le bloc de TNT
que pose Steve.

Comme `robot.py` : un squelette provisoire posé sur les articulations du modèle (relevées sur des rendus, `JOINTS`), des
poids presque rigides (chaque morceau suit l'os le plus proche), membres tournés en pose en T, puis les articulations du
mannequin replacées sur celles du modèle (orientation des os gardée : les clips restent valables).

- krilin : modèle fourni d'une seule pièce, mains sur les hanches. Les poids du bras ne gardent que la partie reliée à
  l'épaule (sinon la hanche, que touche la main, partirait avec elle).
- yoda : modèle fourni en pose en A, plusieurs pièces (bure, mains, tête, cheveux).
- steve : le fichier fourni a ses blocs éparpillés ; on le refait (six blocs aux proportions du jeu d'origine) avec la
  texture du fichier, chaque bloc rigide sur son os (bras et jambes sans coude ni genou).
- tnt : le bloc fourni, centré, posé au sol, à la taille voulue, textures réduites (rendu pixelisé).
- naruto : le ninja qui court sur la planète (pas un allié : on l'attrape pour un coffre). Modèle fourni en pose en A,
  plusieurs pièces, sans poids (son squelette d'origine n'est qu'une colonne). Sa course est faite ici à partir du sprint
  du mannequin : buste penché en avant, tête relevée, bras tendus droit en arrière (`naruto_run`).

Usage (Blender 5.2) :
  blender -b --factory-startup -P tools/blender/allies.py -- --variant krilin --src "C:/Users/mydnic/Desktop/MODELS/krilin.glb"
      --ual "C:/Users/mydnic/Desktop/MODELS/animations/quaternius_universal_animation_library/UAL1_Standard.glb"
      --out src/assets/models/krilin.glb [--render DOSSIER]
  (yoda.glb -> yoda.glb, minecraft_player.glb -> steve.glb, naruto.glb -> naruto.glb ; --variant tnt --src minecraft_block_tnt.glb -> tnt.glb, sans --ual)
"""
import argparse
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

ap = argparse.ArgumentParser()
ap.add_argument('--variant', required=True, choices=['krilin', 'yoda', 'steve', 'naruto', 'tnt'])
ap.add_argument('--src', required=True)
ap.add_argument('--ual', default='')
ap.add_argument('--out', required=True)
ap.add_argument('--tex', type=int, default=512)
ap.add_argument('--render', default='')
args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:])

# Articulations dans le fichier source (unités du fichier, face vers -Y, côté gauche du perso = +X, le droit en miroir)
VARIANTS = {
    'krilin': dict(
        height=1.45,
        joints={'pelvis': (0, 0, 70), 'chest': (0, 0, 99), 'neck': (0, 0, 114), 'top': (0, 0, 186),
                'shoulder': (37, 0, 107), 'elbow': (47, 0, 86), 'wrist': (29, 0, 73), 'fingers': (23, -2, 69),
                'hip': (13.8, 0, 62), 'knee': (17, 0, 38), 'ankle': (21, 0, 14), 'toe': (21, -18, 4)},
        # Repos les poings sur les hanches tranquille, il trottine, lance le Kienzan d'un geste
        clips={'Idle_Loop': 'idle', 'Jog_Fwd_Loop': 'run', 'Spell_Simple_Shoot': 'power'},
        armIslands=True),
    'yoda': dict(
        height=0.95,
        joints={'pelvis': (0, -0.02, -0.60), 'chest': (0, -0.03, -0.33), 'neck': (0, -0.07, -0.235), 'top': (0, -0.06, 0.0),
                'shoulder': (0.13, -0.04, -0.28), 'elbow': (0.28, -0.05, -0.41), 'wrist': (0.39, -0.06, -0.52),
                'fingers': (0.44, -0.07, -0.585), 'hip': (0.08, -0.03, -0.64), 'knee': (0.09, -0.03, -0.80),
                'ankle': (0.09, -0.02, -0.93), 'toe': (0.09, -0.14, -0.98)},
        # Petits pas pressés, la paume tendue pour la poussée de Force
        clips={'Idle_Loop': 'idle', 'Jog_Fwd_Loop': 'run', 'Spell_Simple_Shoot': 'power'},
        armIslands=False),
    'steve': dict(
        height=1.85,
        # En pixels du jeu d'origine (32 de haut)
        joints={'pelvis': (0, 0, 12), 'chest': (0, 0, 21), 'neck': (0, 0, 24), 'top': (0, 0, 32),
                'shoulder': (6, 0, 22), 'elbow': (6, 0, 16), 'wrist': (6, 0, 11), 'fingers': (6, 0, 10),
                'hip': (2, 0, 12), 'knee': (2, 0, 6), 'ankle': (2, 0, 1), 'toe': (2, -2, 0)},
        # Il sprinte, pose son bloc d'un geste de la main
        clips={'Idle_Loop': 'idle', 'Sprint_Loop': 'run', 'Interact': 'power'},
        armIslands=False),
    'naruto': dict(
        height=1.65,
        joints={'pelvis': (0, 0, 98), 'chest': (0, 0, 128), 'neck': (0, 0, 152), 'top': (0, 0, 188),
                'shoulder': (17.7, 0, 141), 'elbow': (39, 0, 119.7), 'wrist': (58, 0, 97.5), 'fingers': (66.8, 0, 89.5),
                'hip': (10, 0, 87), 'knee': (14, 0, 50), 'ankle': (25, 0, 12.6), 'toe': (25, -15, 0)},
        # Il attend en respirant ; sa course est refaite à partir du sprint (voir `naruto_run`)
        clips={'Idle_Loop': 'idle', 'Sprint_Loop': 'sprint'},
        armIslands=False),
}
# Course de Naruto : penchée du buste (degrés, pour chaque os du dos), tête relevée, direction des bras tendus en arrière
# (repère du squelette, face vers -Y : y > 0 vers l'arrière ; x vers l'extérieur)
NARUTO_RUN = dict(lean={'spine_01': 16, 'spine_02': 14, 'spine_03': 10}, head=-60, arm=(0.22, 0.92, -0.25))
TNT_SIZE = 0.8  # côté du bloc de TNT (m)

TEMP = {'pelvis': ('pelvis', 'chest'), 'spine_03': ('chest', 'neck'), 'Head': ('neck', 'top')}
for s in ('l', 'r'):
    TEMP.update({f'upperarm_{s}': (f'shoulder.{s}', f'elbow.{s}'), f'lowerarm_{s}': (f'elbow.{s}', f'wrist.{s}'),
                 f'hand_{s}': (f'wrist.{s}', f'fingers.{s}'), f'thigh_{s}': (f'hip.{s}', f'knee.{s}'),
                 f'calf_{s}': (f'knee.{s}', f'ankle.{s}'), f'foot_{s}': (f'ankle.{s}', f'toe.{s}')})
ALIGN = [f'{b}_{s}' for s in ('l', 'r') for b in ('upperarm', 'lowerarm', 'hand', 'thigh', 'calf', 'foot')]


def curves_of(action):
    try:
        return action.fcurves
    except AttributeError:
        return action.layers[0].strips[0].channelbags[0].fcurves


def seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
    return (a + ab * t - p).length


def reduce_textures(size):
    for mat in bpy.data.materials:
        if not mat.use_nodes:
            continue
        for n in list(mat.node_tree.nodes):
            if n.type == 'NORMAL_MAP':
                mat.node_tree.nodes.remove(n)
    for img in bpy.data.images:
        if img.size[0] > size:
            img.scale(size, max(1, int(size * img.size[1] / img.size[0])))


def import_meshes(path):
    """Importe un GLB et rend une seule pièce, transformations appliquées (le reste de la scène retiré)."""
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.context.scene.objects if o not in before]
    meshes = [o for o in new if o.type == 'MESH']
    for m in meshes:
        mw = m.matrix_world.copy()
        m.parent = None
        m.data.transform(mw)
        m.matrix_world = Matrix()
    for o in new:
        if o not in meshes:
            bpy.data.objects.remove(o)
    bpy.ops.object.select_all(action='DESELECT')
    for m in meshes:
        m.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    return bpy.context.view_layer.objects.active


bpy.ops.wm.read_factory_settings(use_empty=True)
V = VARIANTS.get(args.variant)

# --- Le bloc de TNT : centré, posé au sol, à la taille voulue
if args.variant == 'tnt':
    tnt = import_meshes(args.src)
    vs = [v.co for v in tnt.data.vertices]
    lo = Vector(map(min, *vs)); hi = Vector(map(max, *vs))
    k = TNT_SIZE / max(hi - lo)
    tnt.data.transform(Matrix.Scale(k, 4) @ Matrix.Translation(Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z))))
    for img in bpy.data.images:
        if img.size[0] > 128:
            img.scale(128, 128)
    for mat in bpy.data.materials:
        for n in (mat.node_tree.nodes if mat.use_nodes else []):
            if n.type == 'TEX_IMAGE':
                n.interpolation = 'Closest'
    tnt.name = 'TNT'
    bpy.ops.export_scene.gltf(filepath=args.out, export_format='GLB', export_cameras=False, export_lights=False, export_image_format='AUTO')
    print('ALLY_OK', args.out, 'size', [round(x * k, 3) for x in (hi - lo)])
    sys.exit(0)


def joint(name):
    base, _, side = name.partition('.')
    x, y, z = V['joints'][base]
    return Vector((-x if side == 'r' else x, y, z))


# --- Le mannequin : squelette et clips
bpy.ops.import_scene.gltf(filepath=args.ual)
rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
for o in [o for o in bpy.context.scene.objects if o.type == 'MESH']:
    bpy.data.objects.remove(o)
for a in list(bpy.data.actions):
    if a.name in V['clips']:
        a.name = V['clips'][a.name]
    else:
        bpy.data.actions.remove(a)
if rig.animation_data:
    rig.animation_data.action = None
ual = {b.name: (rig.matrix_world @ b.head_local, rig.matrix_world @ b.tail_local) for b in rig.data.bones}
kept = set(V['clips'].values())


def build_steve():
    """Steve refait : six blocs aux proportions d'origine (en pixels), texture du fichier fourni, chacun sur son os."""
    imgs = set(bpy.data.images)
    bpy.ops.import_scene.gltf(filepath=args.src)
    skin = next(i for i in bpy.data.images if i not in imgs and i.size[0] == 64)
    for o in [o for o in bpy.context.scene.objects if o is not rig]:
        bpy.data.objects.remove(o)
    for a in list(bpy.data.actions):
        if a.name not in kept:
            bpy.data.actions.remove(a)
    mat = bpy.data.materials.new('steve')
    mat.use_nodes = True
    nt = mat.node_tree
    tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = skin; tex.interpolation = 'Closest'
    bsdf = nt.nodes['Principled BSDF']
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 1.0
    # (os, x0, x1, y0, y1, z0, z1, origine de la texture u, v) ; l'image du fichier est retournée : v = ligne / 64
    boxes = [('Head', -4, 4, -4, 4, 24, 32, 0, 0), ('spine_03', -4, 4, -2, 2, 12, 24, 16, 16),
             ('upperarm_r', -8, -4, -2, 2, 12, 24, 40, 16), ('upperarm_l', 4, 8, -2, 2, 12, 24, 32, 48),
             ('thigh_r', -4, 0, -2, 2, 0, 12, 0, 16), ('thigh_l', 0, 4, -2, 2, 0, 12, 16, 48)]
    me = bpy.data.meshes.new('steve')
    ob = bpy.data.objects.new('steve', me)
    bpy.context.scene.collection.objects.link(ob)
    me.materials.append(mat)
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new('UVMap')
    owner = []
    for bone, x0, x1, y0, y1, z0, z1, u, v in boxes:
        w, h, d = x1 - x0, z1 - z0, y1 - y0
        P = lambda x, y, z: bm.verts.new((x, y, z))

        def face(pts, rect):
            """`pts` : coins haut-gauche, haut-droit, bas-droit, bas-gauche vus de face ; `rect` : (u0, v0, u1, v1) en pixels."""
            vs = [P(*p) for p in pts]
            f = bm.faces.new(vs)
            u0, v0, u1, v1 = rect
            for loop, (uu, vv) in zip(f.loops, ((u0, v0), (u1, v0), (u1, v1), (u0, v1))):
                loop[uvl].uv = (uu / 64, vv / 64)
            owner.extend([bone] * 4)
        # Devant (-Y) : la gauche de l'image est le côté droit du perso (-X)
        face([(x0, y0, z1), (x1, y0, z1), (x1, y0, z0), (x0, y0, z0)], (u + d, v + d, u + d + w, v + d + h))
        # Derrière (+Y)
        face([(x1, y1, z1), (x0, y1, z1), (x0, y1, z0), (x1, y1, z0)], (u + 2 * d + w, v + d, u + 2 * d + 2 * w, v + d + h))
        # Côté droit du perso (-X), vu de -X : la gauche de l'image est le dos
        face([(x0, y1, z1), (x0, y0, z1), (x0, y0, z0), (x0, y1, z0)], (u, v + d, u + d, v + d + h))
        # Côté gauche (+X), vu de +X : la gauche de l'image est le devant
        face([(x1, y0, z1), (x1, y1, z1), (x1, y1, z0), (x1, y0, z0)], (u + d + w, v + d, u + 2 * d + w, v + d + h))
        # Dessus : le bas de l'image touche le devant
        face([(x0, y1, z1), (x1, y1, z1), (x1, y0, z1), (x0, y0, z1)], (u + d, v, u + d + w, v + d))
        # Dessous
        face([(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0)], (u + d + w, v, u + d + 2 * w, v + d))
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    groups = {n: ob.vertex_groups.new(name=n) for n in TEMP}
    for i, bone in enumerate(owner):
        groups[bone].add([i], 1.0, 'REPLACE')
    return ob


if args.variant == 'steve':
    body = build_steve()
else:
    body = import_meshes(args.src)
    for a in list(bpy.data.actions):
        if a.name not in kept:
            bpy.data.actions.remove(a)
    # Sommets doublés (facettes séparées) recollés : les morceaux se tiennent
    bm = bmesh.new(); bm.from_mesh(body.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4 * max(Vector(map(max, *[v.co for v in bm.verts])) - Vector(map(min, *[v.co for v in bm.verts]))))
    bm.to_mesh(body.data); bm.free()

# Mise à l'échelle provisoire (m) : pieds à 0, taille voulue ; les articulations suivent
vs = [v.co for v in body.data.vertices]
lo = Vector(map(min, *vs)); hi = Vector(map(max, *vs))
S0 = Matrix.Scale(V['height'] / (hi.z - lo.z), 4) @ Matrix.Translation(Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z)))
body.data.transform(S0)
src_joint = joint
joint = lambda n: S0 @ src_joint(n)

# --- 1. Squelette provisoire, poids presque rigides
tmp_data = bpy.data.armatures.new('tmp')
tmp = bpy.data.objects.new('tmp', tmp_data)
bpy.context.scene.collection.objects.link(tmp)
bpy.context.view_layer.objects.active = tmp
bpy.ops.object.mode_set(mode='EDIT')
for name, (a, b) in TEMP.items():
    eb = tmp_data.edit_bones.new(name)
    eb.head, eb.tail = joint(a), joint(b)
for name in TEMP:
    s = name[-1]
    parent = {'spine_03': 'pelvis', 'Head': 'spine_03', f'upperarm_{s}': 'spine_03', f'lowerarm_{s}': f'upperarm_{s}',
              f'hand_{s}': f'lowerarm_{s}', f'thigh_{s}': 'pelvis', f'calf_{s}': f'thigh_{s}', f'foot_{s}': f'calf_{s}'}.get(name)
    if parent:
        tmp_data.edit_bones[name].parent = tmp_data.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')

if not body.vertex_groups:
    segs = {n: (joint(a), joint(b)) for n, (a, b) in TEMP.items()}
    blend = 0.03 * V['height'] / 1.78
    near = []
    for v in body.data.vertices:
        near.append(sorted((seg_dist(v.co, a, b), n) for n, (a, b) in segs.items()))
    label = [ds[0][1] for ds in near]
    if V['armIslands']:
        # Un sommet n'est au bras que s'il est relié à l'épaule par des sommets du bras (la main posée sur la hanche ne
        # doit pas emporter la hanche)
        adj = [[] for _ in body.data.vertices]
        for e in body.data.edges:
            a, b = e.vertices
            adj[a].append(b); adj[b].append(a)
        for s in ('l', 'r'):
            arm = {f'upperarm_{s}', f'lowerarm_{s}', f'hand_{s}'}
            sh = joint(f'shoulder.{s}')
            seed = min((i for i, n in enumerate(label) if n == f'upperarm_{s}'), key=lambda i: (body.data.vertices[i].co - sh).length)
            ok = {seed}; st = [seed]
            while st:
                i = st.pop()
                for j in adj[i]:
                    if j not in ok and label[j] in arm:
                        ok.add(j); st.append(j)
            for i, n in enumerate(label):
                if n in arm and i not in ok:
                    label[i] = next(m for _, m in near[i] if m not in arm)
    ARMS = {f'{b}_{s}' for b in ('upperarm', 'lowerarm', 'hand') for s in ('l', 'r')}
    if V['armIslands']:
        # Les faces qui relient l'avant-bras ou la main au corps (la main collée à la hanche) s'étireraient : retirées
        fore = {f'{b}_{s}' for b in ('lowerarm', 'hand') for s in ('l', 'r')}
        bm = bmesh.new(); bm.from_mesh(body.data); bm.faces.ensure_lookup_table()
        cut = [f for f in bm.faces if any(label[v.index] in fore for v in f.verts) and any(label[v.index] not in ARMS for v in f.verts)]
        bmesh.ops.delete(bm, geom=cut, context='FACES_ONLY')
        bm.to_mesh(body.data); bm.free()
        print('faces coupées', len(cut))
    groups = {n: body.vertex_groups.new(name=n) for n in TEMP}
    for i, ds in enumerate(near):
        n0 = label[i]
        d0 = next(d for d, n in ds if n == n0)
        other = next(((d, n) for d, n in ds if n != n0), None)
        w1 = 0.0
        # Pas de fondu entre le bras et le corps quand le bras a été séparé par ses liens (Krilin)
        split = V['armIslands'] and other and ((n0 in ARMS) != (other[1] in ARMS))
        if other and other[0] - d0 < blend and not split:
            w1 = max(0.0, 0.5 - (other[0] - d0) / (2 * blend))
        groups[n0].add([i], 1.0 - w1, 'REPLACE')
        if w1 > 0:
            groups[other[1]].add([i], w1, 'REPLACE')
mod = body.modifiers.new('tmp', 'ARMATURE'); mod.object = tmp
body.parent = tmp

# --- 2. Membres tournés dans la direction du mannequin (pose en T), puis la pose devient la forme du maillage
bpy.context.view_layer.objects.active = tmp
bpy.ops.object.mode_set(mode='POSE')
for name in ALIGN:
    pb = tmp.pose.bones[name]
    h0, t0 = ual[name]
    want = (t0 - h0).normalized()
    cur = (pb.tail - pb.head).normalized()
    q = cur.rotation_difference(want)
    m = pb.matrix.copy()
    head = m.translation.copy()
    pb.matrix = Matrix.Translation(head) @ q.to_matrix().to_4x4() @ Matrix.Translation(-head) @ m
    bpy.context.view_layer.update()
posed = {pb.name: (tmp.matrix_world @ pb.head, tmp.matrix_world @ pb.tail) for pb in tmp.pose.bones}
bpy.ops.object.mode_set(mode='OBJECT')
bpy.context.view_layer.objects.active = body
bpy.ops.object.modifier_apply(modifier=mod.name)
body.parent = None
bpy.data.objects.remove(tmp)

# Taille finale, pieds au sol, centré
vs = [v.co for v in body.data.vertices]
lo = Vector(map(min, *vs)); hi = Vector(map(max, *vs))
T = Matrix.Scale(V['height'] / (hi.z - lo.z), 4) @ Matrix.Translation(Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z)))
body.data.transform(T)
posed = {n: (T @ h, T @ t) for n, (h, t) in posed.items()}
P = lambda n: posed[n][0]
PT = lambda n: posed[n][1]

# --- 3. Articulations du mannequin replacées sur celles du modèle
k = (PT('Head') - P('pelvis')).length / (ual['Head'][1] - ual['pelvis'][0]).length
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


chest, neck = P('spine_03'), P('Head')
place('pelvis', P('pelvis'), P('pelvis').lerp(chest, 0.35))
place('spine_01', P('pelvis').lerp(chest, 0.35), P('pelvis').lerp(chest, 0.7))
place('spine_02', P('pelvis').lerp(chest, 0.7), chest)
place('spine_03', chest, neck)
place('neck_01', neck, neck.lerp(PT('Head'), 0.15))
place('Head', neck.lerp(PT('Head'), 0.15), PT('Head'))
for s in ('l', 'r'):
    place(f'clavicle_{s}', chest.lerp(neck, 0.6), P(f'upperarm_{s}'))
    place(f'upperarm_{s}', P(f'upperarm_{s}'), P(f'lowerarm_{s}'))
    place(f'lowerarm_{s}', P(f'lowerarm_{s}'), P(f'hand_{s}'))
    place(f'hand_{s}', P(f'hand_{s}'), PT(f'hand_{s}'))
    place(f'thigh_{s}', P(f'thigh_{s}'), P(f'calf_{s}'))
    place(f'calf_{s}', P(f'calf_{s}'), P(f'foot_{s}'))
    place(f'foot_{s}', P(f'foot_{s}'), PT(f'foot_{s}'))
    place(f'ball_{s}', PT(f'foot_{s}'))
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

mod = body.modifiers.new('rig', 'ARMATURE'); mod.object = rig
body.parent = rig


def naruto_run():
    """Course de Naruto : le sprint du mannequin, jambes gardées ; buste penché, tête relevée, bras tendus en arrière."""
    sprint = bpy.data.actions['sprint']
    rig.animation_data_create()
    f0, f1 = (int(round(x)) for x in sprint.frame_range)
    X = Vector((1, 0, 0))

    def rot(name, axis, deg):
        pb = rig.pose.bones[name]
        h = pb.head.copy()
        pb.matrix = Matrix.Translation(h) @ Matrix.Rotation(math.radians(deg), 4, axis) @ Matrix.Translation(-h) @ pb.matrix
        bpy.context.view_layer.update()

    def aim(name, want):
        pb = rig.pose.bones[name]
        h = pb.head.copy()
        q = (pb.tail - pb.head).normalized().rotation_difference(want.normalized())
        pb.matrix = Matrix.Translation(h) @ q.to_matrix().to_4x4() @ Matrix.Translation(-h) @ pb.matrix
        bpy.context.view_layer.update()

    # Les courbes du sprint lues à la main à chaque image (frame_set ne réévaluait plus le clip après la première
    # image retouchée : les jambes restaient figées)
    curves = []
    for fc in curves_of(sprint):
        bone, _, prop = fc.data_path.partition('"].')
        if bone.startswith('pose.bones["') and bone[len('pose.bones["'):] in rig.pose.bones:
            curves.append((rig.pose.bones[bone[len('pose.bones["'):]], prop, fc.array_index, fc))
    rig.animation_data.action = None
    frames = {}
    for f in range(f0, f1 + 1):
        for pb in rig.pose.bones:
            pb.matrix_basis = Matrix()
        for pb, prop, i, fc in curves:
            getattr(pb, prop)[i] = fc.evaluate(f)
        bpy.context.view_layer.update()
        for n, deg in NARUTO_RUN['lean'].items():
            rot(n, X, deg)
        rot('neck_01', X, NARUTO_RUN['head'] * 0.5)
        rot('Head', X, NARUTO_RUN['head'] * 0.5)
        ax, ay, az = NARUTO_RUN['arm']
        for s, sx in (('l', 1), ('r', -1)):
            d = Vector((ax * sx, ay, az))
            for n in (f'upperarm_{s}', f'lowerarm_{s}', f'hand_{s}'):
                aim(n, d)
        frames[f] = {pb.name: pb.matrix_basis.copy() for pb in rig.pose.bones}
    act = bpy.data.actions.new('run')
    rig.animation_data.action = act
    for f, mats in frames.items():
        # Pas de mise à jour de la scène ici : elle rejouerait le clip en cours d'écriture par-dessus la pose
        for pb in rig.pose.bones:
            pb.matrix_basis = mats[pb.name]
        if hasattr(rig.animation_data, 'action_slot') and act.slots:
            rig.animation_data.action_slot = act.slots[0]
        for pb in rig.pose.bones:
            pb.keyframe_insert('location', frame=f - f0)
            pb.keyframe_insert('rotation_quaternion' if pb.rotation_mode == 'QUATERNION' else 'rotation_euler', frame=f - f0)
    bpy.data.actions.remove(sprint)
    rig.animation_data.action = None
    for pb in rig.pose.bones:
        pb.matrix_basis = Matrix()
    bpy.context.view_layer.update()


if args.variant == 'naruto':
    naruto_run()
reduce_textures(args.tex)
rig.name = f'{args.variant}_rig'
bpy.ops.export_scene.gltf(filepath=args.out, export_format='GLB', export_animation_mode='ACTIONS', export_cameras=False, export_lights=False,
                          export_image_format='AUTO')
print('ALLY_OK', args.out, 'triangles', sum(len(p.vertices) - 2 for p in body.data.polygons), 'clips', sorted(a.name for a in bpy.data.actions))

if args.render:
    os.makedirs(args.render, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.color_type = 'TEXTURE'
    sc.render.resolution_x, sc.render.resolution_y = 400, 480
    H = V['height']
    cam = bpy.data.cameras.new('c'); cam.type = 'ORTHO'; cam.ortho_scale = H * 1.4
    co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co
    rig.animation_data_create()
    for name, act, frame, d in (('repos', None, 1, (0, -1, 0)), ('idle', 'idle', 20, (0, -1, 0)), ('trois_quarts', 'idle', 40, (1, -1, 0)),
                                ('course', 'run', 4, (1, -1, 0)), ('course2', 'run', 10, (1, 0, 0)), ('course_face', 'run', 10, (0, -1, 0)),('pouvoir', 'power', 6, (1, -1, 0)),
                                ('pouvoir2', 'power', 20, (0, -1, 0))):
        rig.animation_data.action = bpy.data.actions.get(act) if act else None
        if rig.animation_data.action is None:
            for pb in rig.pose.bones:
                pb.matrix_basis = Matrix()
        elif hasattr(rig.animation_data, 'action_slot') and rig.animation_data.action.slots:
            rig.animation_data.action_slot = rig.animation_data.action.slots[0]
        sc.frame_set(frame)
        dv = Vector(d).normalized()
        c = Vector((0, 0, H * 0.5))
        co.location = c + dv * H * 4
        co.rotation_euler = (-dv).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.join(args.render, f'{name}.png')
        bpy.ops.render.render(write_still=True)
