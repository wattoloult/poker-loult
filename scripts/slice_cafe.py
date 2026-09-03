# -*- coding: utf-8 -*-
"""Découpe assets/café.png (grille 6x4 = 24 frames, transparence réelle) en bande horizontale
assets/cafe_frames.png.

IMPORTANT (contrairement au découpage des vignettes emote, qui sont des poses INDÉPENDANTES) : ceci est
une ANIMATION séquentielle (la tasse s'incline, la main bouge). Recentrer chaque frame sur SA PROPRE bbox
(comme pour les emotes) casse l'alignement d'une frame à l'autre -> la tasse "saute" verticalement au
fil de la lecture (vérifié : jusqu'à ~30px de dérive du centroïde entre frames avec cette méthode).

Ici chaque frame est découpée à sa cellule NOMINALE + une marge FIXE identique pour toutes (pas basée sur
le contenu de la frame) -> le repère source->sortie est le même pour les 24 frames, donc le sujet reste
ancré exactement où l'artiste l'a dessiné. Un léger masquage par composantes connexes (groupées par
cellule nominale) retire juste les bavures d'un voisin qui déborderait dans la marge."""
import numpy as np
from PIL import Image
from scipy import ndimage

im = Image.open('../assets/_sources/café.png').convert('RGBA')
W, H = im.size
a = np.array(im)
mask = a[:, :, 3] > 25
lbl, n = ndimage.label(mask)
slices = ndimage.find_objects(lbl)

COLS, ROWS = 6, 4
cw, ch = W // COLS, H // ROWS  # 256x256, division exacte

# regroupe chaque composante par cellule nominale (son centroïde)
comp_cell = {}
for i, sl in enumerate(slices):
    if sl is None:
        continue
    lab = i + 1
    area = int((lbl[sl] == lab).sum())
    if area < 20:
        continue
    ys, xs = sl
    cy, cx = (ys.start + ys.stop) / 2, (xs.start + xs.stop) / 2
    col, row = min(COLS - 1, int(cx // cw)), min(ROWS - 1, int(cy // ch))
    comp_cell[lab] = (col, row)

PAD = 40  # marge FIXE (identique pour toutes les frames) autour de la cellule nominale, pour ne rien couper
FW, FH = cw + 2 * PAD, ch + 2 * PAD
N = ROWS * COLS
strip = Image.new('RGBA', (FW * N, FH), (0, 0, 0, 0))

# canvas source paddé de transparent -> les cellules de bord (row/col 0 ou max) peuvent lire ± PAD sans sortir du tableau
ap = np.pad(a, ((PAD, PAD), (PAD, PAD), (0, 0)), mode='constant', constant_values=0)
lblp = np.pad(lbl, ((PAD, PAD), (PAD, PAD)), mode='constant', constant_values=0)

idx = 0
for row in range(ROWS):
    for col in range(COLS):
        y0, y1 = row * ch, row * ch + FH  # même fenêtre pour toutes -> alignement garanti
        x0, x1 = col * cw, col * cw + FW
        sub = ap[y0:y1, x0:x1].copy()
        sub_lbl = lblp[y0:y1, x0:x1]
        keep = np.zeros(sub_lbl.shape, dtype=bool)
        for lab, cell in comp_cell.items():
            if cell == (col, row):
                keep |= (sub_lbl == lab)
        sub[~keep] = 0
        crop = Image.fromarray(sub, 'RGBA')
        strip.paste(crop, (idx * FW, 0), crop)
        idx += 1
strip.save('../assets/cafe_frames.png')
print(f'N={N} FW={FW} FH={FH} ratio={FW/FH:.3f} (cellule nominale {cw}x{ch} + marge fixe {PAD})')
