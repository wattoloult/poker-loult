# -*- coding: utf-8 -*-
"""Découpe setemojiwatto.png (grille 4x3, fond dégradé continu SANS transparence -> pas de
masquage par alpha possible) en 12 PNG séparés, avec une marge de sécurité par cellule pour
ne jamais capter le bout d'un personnage voisin (contrairement à un découpage pile au bord)."""
from PIL import Image

im = Image.open('../assets/_sources/setemojiwatto.png').convert('RGBA')
W, H = im.size
COLS, ROWS = 4, 3
cw, ch = W / COLS, H / ROWS
INSET = 0.02  # % de marge retirée de chaque côté de la cellule (juste assez pour éviter les pires bavures,
              # sans tronquer le personnage lui-même — 0.09 coupait des jetons/étincelles/cheveux)

names = [
    'w-relax', 'w-cheer', 'w-cool', 'w-angry',
    'w-sleep', 'w-love', 'w-think', 'w-sweat',
    'w-card', 'w-throw', 'w-chips', 'w-shrug',
]
i = 0
for row in range(ROWS):
    for col in range(COLS):
        x0, y0 = col * cw, row * ch
        x1, y1 = x0 + cw, y0 + ch
        ix, iy = cw * INSET, ch * INSET
        crop = im.crop((round(x0 + ix), round(y0 + iy), round(x1 - ix), round(y1 - iy)))
        crop.save(f'../assets/emote_{names[i]}.png')
        i += 1
print(f'{i} vignettes écrites dans assets/emote_*.png, taille cellule ~{round(cw-2*cw*INSET)}x{round(ch-2*ch*INSET)}')
