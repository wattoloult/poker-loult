# -*- coding: utf-8 -*-
"""Découpe assets/gossip.png (grille 4x4 = 16 frames, transparence réelle) en bande horizontale
assets/gossip_frames.png.

Même principe que café/cigare (voir slice_cafe.py) : la main émerge du MÊME point (le col de fourrure,
ancré en bas de chaque cellule) dans les 16 poses -> cellule NOMINALE + marge FIXE identique pour toutes
(pas de recentrage par bbox, qui ferait "sauter" la main d'une frame à l'autre puisque ce n'est pas une
pose indépendante mais une animation de geste). Masquage par composantes connexes pour ne garder, dans
chaque cellule, que ce qui appartient réellement à cette pose (retire les bavures de glow du voisin)."""
import numpy as np
from PIL import Image
from scipy import ndimage

im = Image.open('../assets/_sources/gossip.png').convert('RGBA')
W, H = im.size
a = np.array(im)
# le halo est TRÈS doux ici (contrairement à café/baffe) : un seuil bas (25) fusionne le halo de plusieurs
# mains voisines en UNE seule composante -> mal assignée à une seule cellule, les 15 autres restent vides
# (vérifié). Fix : seuil STRICT (230) pour séparer proprement les 16 mains, puis on étend chaque région
# vers son halo doux par plus-proche-voisin (Voronoi) -> on garde le halo tout en gardant les mains séparées.
strict = a[:, :, 3] > 230
lbl_raw, n_raw = ndimage.label(strict)
sizes = ndimage.sum(strict, lbl_raw, range(1, n_raw + 1))
big_labels = [i + 1 for i, sz in enumerate(sizes) if sz > 300]  # écarte les micro-composantes parasites (reflets d'ongle, etc.)
assert len(big_labels) == 16, f'{len(big_labels)} composantes significatives (attendu 16) -> ajuster le seuil'
remap = np.zeros(n_raw + 1, dtype=np.int32)
for new_id, old_id in enumerate(big_labels, start=1):
    remap[old_id] = new_id
lbl_strict = remap[lbl_raw]  # renumérote proprement 1..16, les parasites retombent à 0
soft = a[:, :, 3] > 25
_, nn_idx = ndimage.distance_transform_edt(lbl_strict == 0, return_indices=True)
nearest = lbl_strict[tuple(nn_idx)]
lbl = np.where(soft, nearest, 0)
slices = ndimage.find_objects(lbl)

COLS, ROWS = 4, 4
cw, ch = W // COLS, H // ROWS  # 384x256, division exacte

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

PAD = 50  # marge FIXE généreuse (doigts + griffes qui montent haut dans la cellule) autour de la cellule nominale
FW, FH = cw + 2 * PAD, ch + 2 * PAD
N = ROWS * COLS
strip = Image.new('RGBA', (FW * N, FH), (0, 0, 0, 0))

ap = np.pad(a, ((PAD, PAD), (PAD, PAD), (0, 0)), mode='constant', constant_values=0)
lblp = np.pad(lbl, ((PAD, PAD), (PAD, PAD)), mode='constant', constant_values=0)

idx = 0
for row in range(ROWS):
    for col in range(COLS):
        y0, y1 = row * ch, row * ch + FH
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
strip.save('../assets/gossip_frames.png')
print(f'N={N} FW={FW} FH={FH} ratio={FW/FH:.3f} (cellule nominale {cw}x{ch} + marge fixe {PAD})')
