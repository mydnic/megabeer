"""
Outils communs aux scripts qui préparent des modèles pour la foule du jeu (monk.py, kaykit.py) :
couleurs (teinte, saturation, luminosité) et pixels des images de Blender.
"""
import bpy
import numpy as np


def rgb_to_hsv(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx, mn = rgb.max(-1), rgb.min(-1)
    d = mx - mn
    h = np.zeros_like(mx)
    nz = d > 1e-6
    rm, gm = nz & (mx == r), nz & (mx == g) & (mx != r)
    bm_ = nz & ~rm & ~gm
    h[rm] = ((g - b)[rm] / d[rm]) % 6
    h[gm] = (b - r)[gm] / d[gm] + 2
    h[bm_] = (r - g)[bm_] / d[bm_] + 4
    s = np.where(mx > 1e-6, d / np.maximum(mx, 1e-6), 0)
    return np.stack([h / 6, s, mx], -1)


def hsv_to_rgb(hsv):
    h, s, v = hsv[..., 0] * 6, hsv[..., 1], hsv[..., 2]
    i = np.floor(h).astype(int) % 6
    f = h - np.floor(h)
    p, q, t = v * (1 - s), v * (1 - s * f), v * (1 - s * (1 - f))
    choices = [np.stack(c, -1) for c in ((v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q))]
    out = np.zeros(h.shape + (3,), dtype=np.float32)
    for k, c in enumerate(choices):
        out[i == k] = c[i == k]
    return out


def recolor(px, mask, to):
    """
    Vire à une autre couleur les pixels dont la teinte, la saturation et la luminosité tombent dans
    `mask` ({'hue': (a, b), 'sat': (a, b), 'val': (a, b)}) : nouvelle teinte `to['hue']`, saturation
    et luminosité multipliées par `to['sat']` et `to['val']`.
    """
    hsv = rgb_to_hsv(px[..., :3])
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    sel = (h >= mask['hue'][0]) & (h <= mask['hue'][1]) & (s >= mask['sat'][0]) & (s <= mask['sat'][1]) \
        & (v >= mask.get('val', (0, 1))[0]) & (v <= mask.get('val', (0, 1))[1])
    hsv[..., 0] = np.where(sel, to['hue'], h)
    hsv[..., 1] = np.where(sel, np.minimum(s * to['sat'], 1), s)
    hsv[..., 2] = np.where(sel, np.minimum(v * to['val'], 1), v)
    px[..., :3] = hsv_to_rgb(hsv)
    return px


def pixels(image, w, h=None):
    """Pixels RGBA (h x w, origine en bas) d'une image de Blender, redimensionnée."""
    h = h or w
    img = image.copy()
    img.scale(w, h)
    return np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
