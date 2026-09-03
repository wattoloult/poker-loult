# -*- coding: utf-8 -*-
"""Extrait CHAQUE composante connexe de baffe.png séparément (pas de grille supposée -> la ligne main et
la ligne effets n'ont aucun espace vide entre elles, impossible à séparer par projection). On regarde
ensuite les fichiers un par un pour savoir laquelle est quoi."""
import numpy as np
from PIL import Image
from scipy import ndimage
import os

outdir = r"C:\Users\eaxis\AppData\Local\Temp\claude\C--Users-eaxis\6d9d47a1-5c03-4005-8049-513cad3db75e\scratchpad\baffe_probe"
os.makedirs(outdir, exist_ok=True)

im = Image.open('../assets/_sources/baffe.png').convert('RGBA')
a = np.array(im)
mask = a[:, :, 3] > 25
lbl, n = ndimage.label(mask)
slices = ndimage.find_objects(lbl)

comps = []
for i, sl in enumerate(slices):
    if sl is None:
        continue
    lab = i + 1
    area = int((lbl[sl] == lab).sum())
    if area < 200:
        continue
    ys, xs = sl
    comps.append((ys.start, ys.stop, xs.start, xs.stop, lab, area))

comps.sort(key=lambda c: (c[0], c[2]))  # haut->bas, gauche->droite
for idx, (y0, y1, x0, x1, lab, area) in enumerate(comps):
    pad = 8
    yy0, yy1 = max(0, y0 - pad), min(a.shape[0], y1 + pad)
    xx0, xx1 = max(0, x0 - pad), min(a.shape[1], x1 + pad)
    sub = a[yy0:yy1, xx0:xx1].copy()
    keep = lbl[yy0:yy1, xx0:xx1] == lab
    sub[~keep] = 0
    Image.fromarray(sub, 'RGBA').save(os.path.join(outdir, f'{idx:02d}_y{y0}_x{x0}.png'))
    print(idx, 'bbox y=(%d,%d) x=(%d,%d) area=%d' % (y0, y1, x0, x1, area))
