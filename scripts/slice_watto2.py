# -*- coding: utf-8 -*-
"""Découpe assets/setemotewatto.png (grille 4x3, transparence RÉELLE cette fois) en 12 PNG propres.
Contrairement à setemojiwatto.png (fond dégradé opaque), celui-ci a un vrai alpha par pixel : on peut
grouper par composantes connexes SANS jamais mordre sur le voisin ni couper le personnage.

Les effets flottants (cœurs, Z, ?, étincelles, gouttes) ne sont pas toujours SOUDÉS au personnage
(espace transparent entre les deux) -> on les regroupe par CELLULE NOMINALE (grille 4x3) plutôt que par
seule connexité, pour que chaque emote garde bien tous ses effets associés.

Toutes les vignettes sont ensuite paddées sur un canvas de MÊME taille (le plus grand bbox des 12),
personnage centré, marge transparente ~8% -> tailles/ratio cohérents entre les 12 assets."""
import numpy as np
from PIL import Image
from scipy import ndimage

im = Image.open('../assets/_sources/setemotewatto.png').convert('RGBA')
W, H = im.size
a = np.array(im)
mask = a[:, :, 3] > 25
lbl, n = ndimage.label(mask)
slices = ndimage.find_objects(lbl)

COLS, ROWS = 4, 3
cw, ch = W / COLS, H / ROWS
groups = {}  # (col,row) -> liste de labels
comp_bbox = {}  # label -> (y0,y1,x0,x1)
for i, sl in enumerate(slices):
    if sl is None:
        continue
    lab = i + 1
    area = int((lbl[sl] == lab).sum())
    if area < 25:  # bruit
        continue
    ys, xs = sl
    y0, y1, x0, x1 = ys.start, ys.stop, xs.start, xs.stop
    cy, cx = (y0 + y1) / 2, (x0 + x1) / 2
    col, row = min(COLS - 1, int(cx // cw)), min(ROWS - 1, int(cy // ch))
    groups.setdefault((col, row), []).append(lab)
    comp_bbox[lab] = (y0, y1, x0, x1)

names = [
    'w-relax', 'w-cheer', 'w-cool', 'w-angry',
    'w-sleep', 'w-love', 'w-think', 'w-sweat',
    'w-card', 'w-throw', 'w-chips', 'w-shrug',
]

# bbox union par cellule (avant padding commun)
raw = {}
for row in range(ROWS):
    for col in range(COLS):
        labs = groups.get((col, row), [])
        if not labs:
            print(f'!! aucune composante pour la cellule ({col},{row})')
            continue
        y0 = min(comp_bbox[l][0] for l in labs); y1 = max(comp_bbox[l][1] for l in labs)
        x0 = min(comp_bbox[l][2] for l in labs); x1 = max(comp_bbox[l][3] for l in labs)
        raw[(col, row)] = (y0, y1, x0, x1, labs)

# canvas commun = plus grand bbox (+ marge ~8%) -> tailles cohérentes entre toutes les vignettes
maxw = max(x1 - x0 for (_, _, x0, x1, _) in raw.values())
maxh = max(y1 - y0 for (y0, y1, _, _, _) in raw.values())
pad = round(max(maxw, maxh) * 0.08)
CW, CH = maxw + pad * 2, maxh + pad * 2

i = 0
for row in range(ROWS):
    for col in range(COLS):
        if (col, row) not in raw:
            i += 1
            continue
        y0, y1, x0, x1, labs = raw[(col, row)]
        sub = a[y0:y1, x0:x1].copy()
        keep = np.isin(lbl[y0:y1, x0:x1], labs)
        sub[~keep] = 0  # n'efface que ce qui n'appartient PAS à cette emote (débris d'un voisin dans la bbox)
        w, h = x1 - x0, y1 - y0
        canvas = np.zeros((CH, CW, 4), dtype=np.uint8)
        oy, ox = (CH - h) // 2, (CW - w) // 2
        canvas[oy:oy + h, ox:ox + w] = sub
        Image.fromarray(canvas, 'RGBA').save(f'../assets/emote_{names[i]}.png')
        i += 1

print(f'{len(raw)}/12 cellules découpées, canvas commun {CW}x{CH}')
