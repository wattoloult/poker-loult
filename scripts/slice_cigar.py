# -*- coding: utf-8 -*-
"""Découpe assets/cigare.png (cigares en diagonale, décalés) en frames propres et alignées.
Sortie : assets/cigare_frames.png = bande horizontale de N frames uniformes (FW x FH), centrées."""
import numpy as np
from PIL import Image
from scipy import ndimage

im = Image.open('../assets/_sources/cigare.png').convert('RGBA')
W, H = im.size
a = np.array(im)
mask = a[:, :, 3] > 40                       # pixels opaques
lbl, n = ndimage.label(mask)
slices = ndimage.find_objects(lbl)
comps = []
for i, sl in enumerate(slices):
    if sl is None:
        continue
    ys, xs = sl
    area = int((lbl[sl] == (i + 1)).sum())
    if area < 3000:                          # ignore le bruit
        continue
    comps.append((ys.start, ys.stop, xs.start, xs.stop))

# ordre : rangée du haut (centre y < H/2) puis du bas, chacune gauche->droite
midY = H / 2
def cy(c): return (c[0] + c[1]) / 2
def cx(c): return (c[2] + c[3]) / 2
top = sorted([c for c in comps if cy(c) < midY], key=cx)
bot = sorted([c for c in comps if cy(c) >= midY], key=cx)
ordered = top + bot
N = len(ordered)

# index de label de chaque composant retenu (pour ne garder QUE ses pixels, pas les voisins dans la bbox diagonale)
lab_of = {}
for i, sl in enumerate(slices):
    if sl is None:
        continue
    if int((lbl[sl] == (i + 1)).sum()) < 3000:
        continue
    lab_of[(sl[0].start, sl[0].stop, sl[1].start, sl[1].stop)] = i + 1

maxW = max(c[3] - c[2] for c in ordered)
maxH = max(c[1] - c[0] for c in ordered)
pad = 8
FW, FH = maxW + pad * 2, maxH + pad * 2
strip = Image.new('RGBA', (FW * N, FH), (0, 0, 0, 0))
for idx, (y0, y1, x0, x1) in enumerate(ordered):
    lab = lab_of[(y0, y1, x0, x1)]
    sub = a[y0:y1, x0:x1].copy()                 # bbox
    sub[lbl[y0:y1, x0:x1] != lab] = 0            # efface tout ce qui n'est PAS ce cigare (voisins)
    crop = Image.fromarray(sub, 'RGBA')
    w, h = x1 - x0, y1 - y0
    strip.paste(crop, (idx * FW + (FW - w) // 2, (FH - h) // 2), crop)
strip.save('../assets/cigare_frames.png')
print(f'N={N} FW={FW} FH={FH} ratio={FW/FH:.3f}')
