# -*- coding: utf-8 -*-
"""Découpe croupier.png (2 poses côte à côte, fond RÉELLEMENT transparent) en 2 PNG :
assets/croupier_idle.png (gauche, calme) et assets/croupier_deal.png (droite, distribue)."""
import numpy as np
from PIL import Image
from scipy import ndimage

im = Image.open('../assets/_sources/croupier.png').convert('RGBA')
W, H = im.size
a = np.array(im)
mask = a[:, :, 3] > 40
lbl, n = ndimage.label(mask)
slices = ndimage.find_objects(lbl)
comps = []
for i, sl in enumerate(slices):
    if sl is None:
        continue
    area = int((lbl[sl] == (i + 1)).sum())
    if area < 3000:
        continue
    ys, xs = sl
    comps.append((ys.start, ys.stop, xs.start, xs.stop, i + 1))

comps.sort(key=lambda c: (c[2] + c[3]) / 2)  # gauche -> droite
names = ['croupier_idle', 'croupier_deal']
for (y0, y1, x0, x1, lab), name in zip(comps, names):
    pad = 6
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(W, x1 + pad), min(H, y1 + pad)
    sub = a[y0:y1, x0:x1].copy()
    sub[lbl[y0:y1, x0:x1] != lab] = 0  # n'efface que le VOISIN qui déborderait dans la bbox
    Image.fromarray(sub, 'RGBA').save(f'../assets/{name}.png')
    print(name, sub.shape[1], 'x', sub.shape[0])
print(f'{len(comps)} composante(s) trouvée(s)')
