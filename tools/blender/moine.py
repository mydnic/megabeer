"""
Habille un zombie Quaternius en moine : bure (corps et jupe jusqu'aux chevilles), manches larges,
capuche et cordelière. Les animations du modèle d'origine sont gardées.

    blender -b --factory-startup -P tools/blender/moine.py -- --src src/assets/quaternius-zombies/Zombie_Arm.gltf --out src/assets/models/moine_lanceur.glb [--variant lanceur] [--render DOSSIER]

La bure est ajustée automatiquement au corps : pour chaque anneau, on mesure les sommets du modèle
qui appartiennent aux os concernés, et on l'agrandit un peu. Chaque anneau suit un seul os (look
figurine, comme le Buveur). Les couleurs sont peintes dans une zone vide de la texture-palette du
modèle (le jeu dessine chaque ennemi avec une seule matière).
Repère Blender du modèle : Z en haut, le personnage regarde vers -Y.
"""
import bpy
import bmesh
import math
import os
import sys
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default=None):
    return argv[argv.index(name) + 1] if name in argv else default
SRC = arg('--src')
OUT = arg('--out')
VARIANT = arg('--variant', 'lanceur')
RENDER_DIR = arg('--render')

# ---------------------------------------------------------------- variantes (couleurs sRGB, ampleur)
VARIANTS = {
    # Bure brune de moine, cordelière de chanvre
    'lanceur': {'robe': (0.36, 0.24, 0.14), 'hood': (0.30, 0.20, 0.12), 'rope': (0.82, 0.72, 0.50), 'loose': 1.10},
    # Novice : bure grise plus claire
    'novice':  {'robe': (0.50, 0.47, 0.42), 'hood': (0.43, 0.40, 0.36), 'rope': (0.85, 0.78, 0.60), 'loose': 1.12},
    # Pèlerin : bure violacée tendue
    'pelerin': {'robe': (0.36, 0.20, 0.30), 'hood': (0.30, 0.16, 0.25), 'rope': (0.80, 0.66, 0.40), 'loose': 1.06},
}
V = VARIANTS[VARIANT]

TORSO = {'Hips', 'Abdomen', 'Torso', 'Neck', 'Body', 'Shoulder.L', 'Shoulder.R'}
LEGS = {'UpperLeg.L', 'UpperLeg.R', 'LowerLeg.L', 'LowerLeg.R'}
HEAD = {'Head', 'Eyelid.L', 'Eyelid.R'}
SEG = 18  # côtés de chaque anneau

# ---------------------------------------------------------------- import
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.abspath(SRC))
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
body = max((o for o in bpy.data.objects if o.type == 'MESH' and any(m.type == 'ARMATURE' for m in o.modifiers)),
           key=lambda o: len(o.data.vertices))
bones = {b.name: (arm.matrix_world @ b.head_local, arm.matrix_world @ b.tail_local) for b in arm.data.bones}

# Sommets du corps au repos (monde) et os principal de chacun
names = {g.index: g.name for g in body.vertex_groups}
verts = []
for v in body.data.vertices:
    if not v.groups:
        continue
    g = max(v.groups, key=lambda g: g.weight)
    verts.append((body.matrix_world @ v.co, names[g.group]))

def band(z0, z1, owners):
    return [p for p, b in verts if b in owners and z0 <= p.z <= z1]

def ellipse(points, loose, pad=0.025):
    """Ellipse horizontale qui englobe les points (centre, demi-axes), agrandie de `loose` et `pad` m."""
    if not points:
        return None
    cx = (min(p.x for p in points) + max(p.x for p in points)) / 2
    cy = (min(p.y for p in points) + max(p.y for p in points)) / 2
    rx = max(abs(p.x - cx) for p in points) * loose + pad
    ry = max(abs(p.y - cy) for p in points) * loose + pad
    return Vector((cx, cy)), rx, ry

# ---------------------------------------------------------------- couleurs peintes dans la palette
img = body.data.materials[0].node_tree.nodes['Image Texture'].image if body.data.materials[0].use_nodes else None
if img is None:
    img = next(iter(bpy.data.images))
W, H = img.size
px = list(img.pixels[:])

def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def paint(slot, rgb):
    """Peint un carré de 16 px dans le coin bas-droit (vide) de la palette ; renvoie son UV central."""
    x0, y0 = W - 16 * (slot + 1) - 8, 8
    lin = [srgb_to_lin(c) for c in rgb] if img.colorspace_settings.name != 'sRGB' else list(rgb)
    for y in range(y0, y0 + 16):
        for x in range(x0, x0 + 16):
            i = (y * W + x) * 4
            px[i:i + 4] = [*lin, 1.0]
    return ((x0 + 8) / W, (y0 + 8) / H)

UV = {'robe': paint(0, V['robe']), 'hood': paint(1, V['hood']), 'rope': paint(2, V['rope'])}
img.pixels[:] = px
img.pack()

# ---------------------------------------------------------------- pièces
bm = bmesh.new()
uv_layer = bm.loops.layers.uv.new('UVMap')
deform = bm.verts.layers.deform.new()
group_index = {}

def group(name):
    if name not in group_index:
        g = body.vertex_groups.get(name) or body.vertex_groups.new(name=name)
        group_index[name] = g.index
    return group_index[name]

def finish(faces, color):
    for f in faces:
        for loop in f.loops:
            loop[uv_layer].uv = UV[color]

def loft(rings, color, cap_bottom=False):
    """Tube d'anneaux elliptiques : rings = [(z, centre, rx, ry, os)], du haut vers le bas."""
    prev, faces = None, []
    for z, c, rx, ry, bone in rings:
        ring = []
        for k in range(SEG):
            a = 2 * math.pi * k / SEG
            v = bm.verts.new((c.x + math.cos(a) * rx, c.y + math.sin(a) * ry, z))
            v[deform][group(bone)] = 1.0
            ring.append(v)
        if prev:
            for k in range(SEG):
                faces.append(bm.faces.new((prev[k], prev[(k + 1) % SEG], ring[(k + 1) % SEG], ring[k])))
        prev = ring
    if cap_bottom:
        faces.append(bm.faces.new(list(reversed(prev))))
    finish(faces, color)

def tube_along(head, tail, radius0, radius1, bone, color, steps=3):
    """Manche : tube autour de l'axe d'un os, qui s'évase de radius0 à radius1."""
    axis = (tail - head).normalized()
    side = axis.cross(Vector((0, 0, 1)))
    if side.length < 1e-3:
        side = axis.cross(Vector((0, 1, 0)))
    side.normalize()
    up = side.cross(axis).normalized()
    prev, faces = None, []
    for s in range(steps + 1):
        t = s / steps
        center = head.lerp(tail, t)
        r = radius0 + (radius1 - radius0) * t
        ring = []
        for k in range(SEG):
            a = 2 * math.pi * k / SEG
            v = bm.verts.new(center + (side * math.cos(a) + up * math.sin(a)) * r)
            v[deform][group(bone)] = 1.0
            ring.append(v)
        if prev:
            for k in range(SEG):
                faces.append(bm.faces.new((prev[k], prev[(k + 1) % SEG], ring[(k + 1) % SEG], ring[k])))
        prev = ring
    finish(faces, color)

# Hauteurs repères
hips_z = bones['Hips'][0].z
waist_z = bones['Abdomen'][0].z
neck_z = bones['Neck'][0].z
foot_z = min(bones['Foot.L'][0].z, bones['Foot.R'][0].z)
knee_z = bones['LowerLeg.L'][0].z

# Haut de la bure : du bas de la tête à la taille, ajusté au torse (sans les bras)
head_pts = [p for p, b in verts if b in HEAD]
chin_z = min(p.z for p in head_pts)
top = []
n = 7
z_top = max(neck_z, chin_z + 0.04)
for i in range(n + 1):
    z = z_top - (z_top - waist_z) * i / n
    e = ellipse(band(z - 0.06, z + 0.06, TORSO | (HEAD if z > chin_z else set())), V['loose'])
    if e:
        bone = 'Neck' if z > neck_z else 'Torso' if z > bones['Torso'][0].z else 'Abdomen'
        top.append((z, e[0], e[1], e[2], bone))
loft(top, 'robe')

# Jupe : de la taille aux chevilles, elle englobe les jambes et s'évase
hip = ellipse(band(hips_z - 0.05, waist_z + 0.03, TORSO | LEGS), V['loose'] * 1.04)
legs = ellipse(band(foot_z + 0.05, knee_z + 0.05, LEGS), 1.0)
skirt = []
z_end = foot_z + (knee_z - foot_z) * 0.25
steps = 5
for i in range(steps + 1):
    t = i / steps
    z = waist_z + (z_end - waist_z) * t
    c = hip[0].lerp(legs[0], t) if legs else hip[0]
    rx = max(hip[1], (legs[1] if legs else 0) + 0.12) * (1 + 0.22 * t)
    ry = max(hip[2], (legs[2] if legs else 0) + 0.10) * (1 + 0.22 * t)
    skirt.append((z, c, rx, ry, 'Hips'))
loft([(top[-1][0], top[-1][1], top[-1][2], top[-1][3], 'Hips')] + skirt, 'robe')

# Cordelière à la taille, et ses deux bouts qui pendent devant
c, rx, ry = top[-1][1], top[-1][2] + 0.02, top[-1][3] + 0.02
loft([(waist_z + 0.025, c, rx, ry, 'Hips'), (waist_z - 0.025, c, rx, ry, 'Hips')], 'rope')
front = Vector((c.x + rx * 0.35, c.y - ry * 0.98, waist_z))
for dx, length in ((0.0, 0.32), (0.06, 0.26)):
    tube_along(front + Vector((dx, 0, 0)), front + Vector((dx, -0.02, -length)), 0.018, 0.022, 'Hips', 'rope', steps=2)

# Manches larges : du haut du bras jusqu'au milieu de l'avant-bras, évasées
for side in ('L', 'R'):
    ua, la = bones[f'UpperArm.{side}'], bones[f'LowerArm.{side}']
    arm_pts = [p for p, b in verts if b in (f'UpperArm.{side}', f'LowerArm.{side}', f'Shoulder.{side}')]
    def radius_at(head, tail):
        axis = (tail - head).normalized()
        d = [((p - head) - axis * (p - head).dot(axis)).length for p in arm_pts if 0 <= (p - head).dot(axis) <= (tail - head).length]
        d.sort()
        return (d[int(len(d) * 0.8)] if d else 0.10) * 1.02 + 0.03
    r_up = radius_at(*ua)
    r_low = radius_at(*la)
    tube_along(ua[0], ua[1], r_up, r_up * 1.05, f'UpperArm.{side}', 'robe')
    mid = la[0].lerp(la[1], 0.5)
    tube_along(la[0], mid, r_up * 1.05, r_up * 1.25, f'LowerArm.{side}', 'robe', steps=2)

# Capuche : coquille sur la tête, ouverte devant le visage
hmin = Vector((min(p.x for p in head_pts), min(p.y for p in head_pts), min(p.z for p in head_pts)))
hmax = Vector((max(p.x for p in head_pts), max(p.y for p in head_pts), max(p.z for p in head_pts)))
hc, hr = (hmin + hmax) / 2, (hmax - hmin) / 2 * 1.16 + Vector((0.03, 0.03, 0.03))
hood = bmesh.ops.create_uvsphere(bm, u_segments=SEG, v_segments=10, radius=1.0)['verts']
for v in hood:
    back = max(0.0, v.co.y) * max(0.0, v.co.z)  # pointe de la capuche : en haut, vers l'arrière
    v.co = Vector((hc.x + v.co.x * hr.x, hc.y + v.co.y * hr.y + back * hr.y * 0.6, hc.z + v.co.z * hr.z + hr.z * 0.12 + back * hr.z * 0.25))
    v[deform][group('Head')] = 1.0
# Ouverture du visage (devant = -Y) et dessous de la tête
bm.verts.ensure_lookup_table()
cut = [f for f in bm.faces if all(v in set(hood) for v in f.verts) and (
    (f.calc_center_median().y < hc.y - hr.y * 0.2 and f.calc_center_median().z < hc.z + hr.z * 0.65) or
    f.calc_center_median().z < hc.z - hr.z * 0.55)]
bmesh.ops.delete(bm, geom=cut, context='FACES')
finish([f for f in bm.faces if all(v in set(hood) for v in f.verts if v.is_valid)], 'hood')

# ---------------------------------------------------------------- assemblage avec le corps
robe_mesh = bpy.data.meshes.new('Bure')
bm.normal_update()
bm.to_mesh(robe_mesh)
bm.free()
robe = bpy.data.objects.new('Bure', robe_mesh)
bpy.context.scene.collection.objects.link(robe)
for name, idx in group_index.items():
    if robe.vertex_groups.get(name) is None:
        while len(robe.vertex_groups) <= idx:
            robe.vertex_groups.new(name=f'_{len(robe.vertex_groups)}')
        robe.vertex_groups[idx].name = name
robe.data.materials.append(body.data.materials[0])
bpy.ops.object.select_all(action='DESELECT')
robe.select_set(True)
body.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.join()
for v in [g for g in body.vertex_groups if g.name.startswith('_')]:
    body.vertex_groups.remove(v)

# ---------------------------------------------------------------- export
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(OUT), export_format='GLB', export_animations=True,
                          export_skins=True, export_image_format='AUTO')
print('EXPORT', OUT)

# ---------------------------------------------------------------- vues de contrôle
if RENDER_DIR:
    os.makedirs(RENDER_DIR, exist_ok=True)
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.color_type = 'TEXTURE'
    scene.display.shading.light = 'STUDIO'
    scene.render.resolution_x, scene.render.resolution_y = 500, 700
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 2.8
    views = [('face', (0, -5, 0.9), (1.5708, 0, 0)), ('profil', (5, 0, 0.9), (1.5708, 0, 1.5708)), ('dos', (0, 5, 0.9), (1.5708, 0, 3.1416))]
    for name, loc, rot in views:
        cam.location, cam.rotation_euler = loc, rot
        scene.render.filepath = os.path.join(RENDER_DIR, f'{VARIANT}_{name}.png')
        bpy.ops.render.render(write_still=True)
    # Une image en pleine marche et une en attaque
    for clip, frac in (('Walk', 0.25), ('Punch', 0.45)):
        act = bpy.data.actions.get(clip) or next((a for a in bpy.data.actions if a.name.startswith(clip)), None)
        if not act:
            continue
        arm.animation_data_create()
        arm.animation_data.action = act
        f0, f1 = act.frame_range
        scene.frame_set(int(f0 + (f1 - f0) * frac))
        cam.location, cam.rotation_euler = (3.5, -3.5, 0.9), (1.5708, 0, 0.7854)
        scene.render.filepath = os.path.join(RENDER_DIR, f'{VARIANT}_{clip.lower()}.png')
        bpy.ops.render.render(write_still=True)
