# -*- coding: utf-8 -*-
"""Empaquette POKER LOULT (client local) en un seul HTML autonome pour Artifact."""
import base64, glob, io, os, re, json
from PIL import Image

def b64(buf, mime):
    return f'data:{mime};base64,' + base64.b64encode(buf).decode()

# --- cartes : downscale + WebP (alpha) ---
CARD_URI = {}
for f in glob.glob('../cards/*.png'):
    code = os.path.splitext(os.path.basename(f))[0]
    im = Image.open(f).convert('RGBA')
    w = 190; h = round(im.height * w / im.width)
    im = im.resize((w, h), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, 'WEBP', quality=88, method=6)
    CARD_URI[code] = b64(buf.getvalue(), 'image/webp')

# --- plateau : JPEG ---
im = Image.open('../assets/plateau.png').convert('RGB')
w = 1200; im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
buf = io.BytesIO(); im.save(buf, 'JPEG', quality=82, optimize=True)
PLATEAU = b64(buf.getvalue(), 'image/jpeg')

# --- jeton : WebP réduit ---
im = Image.open('../assets/jetons.png').convert('RGBA').resize((160, 160), Image.LANCZOS)
buf = io.BytesIO(); im.save(buf, 'WEBP', quality=90, method=6)
JETONS = b64(buf.getvalue(), 'image/webp')

# --- assemblage ---
css = open('../style.css', encoding='utf-8').read()
css = css.replace("url('plateau.png')", f"url({PLATEAU})").replace("url('jetons.png')", f"url({JETONS})")

js = open('../game.js', encoding='utf-8').read()
js = js.replace("url('cards/${data.code}.png')", "url('${CARD_URI[data.code]}')")

body = re.search(r'<body>(.*)</body>', open('../index.html', encoding='utf-8').read(), re.S).group(1)
body = body.replace('<script src="game.js"></script>', '')

out = (
    '<meta charset="utf-8">\n'
    '<title>Poker Loult</title>\n'
    f'<style>{css}</style>\n'
    f'{body}\n'
    f'<script>const CARD_URI={json.dumps(CARD_URI)};</script>\n'
    f'<script>{js}</script>\n'
)
open('../pokerloult.bundle.html', 'w', encoding='utf-8').write(out)
print('bundle:', round(os.path.getsize('../pokerloult.bundle.html') / 1e6, 2), 'MB')
