"""
Icônes de l'application installée (PWA) : une pinte dorée moussante sur le fond brun de l'accueil.
Écrit public/icons/icon-192.png, icon-512.png et icon-maskable-512.png (marge de sécurité pour les formes
découpées d'Android), et apple-touch-icon.png (180 px, iPhone).

Usage : python tools/icons/pwa_icons.py
"""
import os

from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'icons')
os.makedirs(OUT, exist_ok=True)

BG_IN, BG_OUT = (110, 64, 28), (26, 14, 6)
INK = (26, 18, 12)
BEER_TOP, BEER_BOTTOM = (255, 214, 90), (224, 138, 18)
FOAM = (255, 248, 232)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def icon(size, pad):
    S = size * 4  # dessiné en grand puis réduit (bords lisses)
    img = Image.new('RGB', (S, S), BG_OUT)
    px = img.load()
    c = S / 2
    for y in range(S):
        for x in range(S):
            d = min(1.0, (((x - c) ** 2 + (y - c * 0.85) ** 2) ** 0.5) / (S * 0.62))
            px[x, y] = lerp(BG_IN, BG_OUT, d)
    d = ImageDraw.Draw(img)
    # Zone utile (marge pour l'icône maskable)
    u = S * (1 - 2 * pad)
    o = S * pad
    X = lambda f: o + f * u
    w = u * 0.04  # épaisseur du trait
    # Verre : trapèze, la bière en dégradé, une anse
    left, right, top, bottom = 0.27, 0.69, 0.30, 0.86
    glass = [(X(left), X(top)), (X(right), X(top)), (X(right - 0.03), X(bottom)), (X(left + 0.03), X(bottom))]
    beer = Image.new('RGB', (S, S))
    bd = ImageDraw.Draw(beer)
    for i in range(int(X(top)), int(X(bottom)) + 1):
        t = (i - X(top)) / (X(bottom) - X(top))
        bd.line([(0, i), (S, i)], fill=lerp(BEER_TOP, BEER_BOTTOM, t))
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).polygon(glass, fill=255)
    img.paste(beer, (0, 0), mask)
    # Anse
    d.rounded_rectangle([X(right - 0.02), X(0.42), X(0.86), X(0.74)], radius=u * 0.1, outline=INK, width=int(w * 1.6))
    d.rounded_rectangle([X(right - 0.02), X(0.42), X(0.86), X(0.74)], radius=u * 0.1, outline=(240, 236, 228), width=int(w * 0.7))
    d.polygon(glass, outline=INK, width=int(w))
    # Bulles et reflet
    for bx, by, br in ((0.38, 0.62, 0.025), (0.50, 0.72, 0.02), (0.58, 0.55, 0.018), (0.45, 0.48, 0.015)):
        d.ellipse([X(bx - br), X(by - br), X(bx + br), X(by + br)], fill=(255, 240, 190))
    d.line([(X(left + 0.06), X(top + 0.08)), (X(left + 0.08), X(bottom - 0.08))], fill=(255, 250, 230), width=int(w * 0.8))
    # Mousse qui déborde : des boules
    for fx, fy, fr in ((0.30, 0.29, 0.09), (0.42, 0.24, 0.11), (0.56, 0.24, 0.11), (0.67, 0.29, 0.09), (0.36, 0.34, 0.06), (0.62, 0.35, 0.06), (0.71, 0.40, 0.05)):
        d.ellipse([X(fx - fr), X(fy - fr), X(fx + fr), X(fy + fr)], fill=FOAM, outline=INK, width=int(w))
    for fx, fy, fr in ((0.30, 0.29, 0.09), (0.42, 0.24, 0.11), (0.56, 0.24, 0.11), (0.67, 0.29, 0.09)):
        d.ellipse([X(fx - fr) + w, X(fy - fr) + w, X(fx + fr) - w, X(fy + fr) - w], fill=FOAM)
    return img.resize((size, size), Image.LANCZOS)


icon(192, 0.06).save(os.path.join(OUT, 'icon-192.png'))
icon(512, 0.06).save(os.path.join(OUT, 'icon-512.png'))
icon(512, 0.16).save(os.path.join(OUT, 'icon-maskable-512.png'))
icon(180, 0.08).save(os.path.join(OUT, 'apple-touch-icon.png'))
print('OK', os.path.abspath(OUT))
