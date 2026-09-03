# -*- coding: utf-8 -*-
"""Découpe assets/baffe.png. Pas de grille : la ligne "main" et la ligne "effets" n'ont AUCUN espace vide
entre elles (vérifié), donc extraction par composantes connexes individuelles, triées (haut->bas puis
gauche->droite, comme slice_baffe_probe.py) et sélectionnées par INDEX dans cet ordre trié — identifiées
visuellement en inspectant la sortie de slice_baffe_probe.py :
- main qui gifle (5 poses, dont l'impact déjà fusionné à un éclat) -> assets/baffe_frames.png
  (même technique qu'avec le colt : ancrage bas-gauche fixe, canvas commun -> pas de jitter du pivot)
- éclat d'impact (2 frames) -> assets/baffe_impact_frames.png
- traces de main qui reste sur le visage, en s'estompant (5 frames) -> assets/baffe_mark_frames.png
"""
import numpy as np
from PIL import Image
from scipy import ndimage

im = Image.open('../assets/_sources/baffe.png').convert('RGBA')
a = np.array(im)
mask = a[:, :, 3] > 25
lbl, n = ndimage.label(mask)
slices = ndimage.find_objects(lbl)

comps = []  # (y0,y1,x0,x1,lab), TRIÉ comme dans slice_baffe_probe.py -> l'index ci-dessous = celui vu à l'écran
for i, sl in enumerate(slices):
    if sl is None:
        continue
    lab = i + 1
    area = int((lbl[sl] == lab).sum())
    if area < 200:
        continue
    ys, xs = sl
    comps.append((ys.start, ys.stop, xs.start, xs.stop, lab))
comps.sort(key=lambda c: (c[0], c[2]))


def crop_masked(idx, pad):
    y0, y1, x0, x1, lab = comps[idx]
    yy0, yy1 = max(0, y0 - pad), min(a.shape[0], y1 + pad)
    xx0, xx1 = max(0, x0 - pad), min(a.shape[1], x1 + pad)
    sub = a[yy0:yy1, xx0:xx1].copy()
    keep = lbl[yy0:yy1, xx0:xx1] == lab
    sub[~keep] = 0
    return sub, x1 - x0, y1 - y0


# indices (triés haut->bas puis gauche->droite, cf. slice_baffe_probe.py) identifiés visuellement
HAND_IDX = [7, 5, 1, 0, 3]     # ordre de lecture gauche->droite : ouverte, recul, swing rapide, IMPACT (fusionné à un éclat), suivi
IMPACT_IDX = [13, 11]          # 2 éclats (l'un un peu plus gros que l'autre)
MARK_IDX = [17, 19, 20, 18, 21]  # traces rouges, de la plus nette à la plus estompée


def slice_hand():
    PAD = 25
    frames = [crop_masked(i, PAD) for i in HAND_IDX]
    maxw = max(w for (_, w, h) in frames)
    maxh = max(h for (_, w, h) in frames)
    FW, FH = maxw + 2 * PAD, maxh + 2 * PAD
    strip = Image.new('RGBA', (FW * len(frames), FH), (0, 0, 0, 0))
    for idx, (sub, w, h) in enumerate(frames):
        crop = Image.fromarray(sub, 'RGBA')
        # ancrage BAS-GAUCHE fixe (comme colt_frames.png) : le poignet/manchette reste immobile, seul
        # l'éclat d'impact déborde en plus vers le haut-droite selon les frames.
        strip.paste(crop, (idx * FW, FH - 2 * PAD - h), crop)
    strip.save('../assets/baffe_frames.png')
    print(f'baffe_frames.png : N={len(frames)} FW={FW} FH={FH}')


def slice_independent(idxs, out_name, pad=10):
    frames = [crop_masked(i, pad) for i in idxs]
    maxw = max(w for (_, w, h) in frames)
    maxh = max(h for (_, w, h) in frames)
    FW, FH = maxw + 2 * pad, maxh + 2 * pad
    strip = Image.new('RGBA', (FW * len(frames), FH), (0, 0, 0, 0))
    for idx, (sub, w, h) in enumerate(frames):
        crop = Image.fromarray(sub, 'RGBA')
        strip.paste(crop, (idx * FW + (FW - (w + 2 * pad)) // 2, (FH - (h + 2 * pad)) // 2), crop)
    strip.save(f'../assets/{out_name}')
    print(f'{out_name} : N={len(frames)} FW={FW} FH={FH}')


slice_hand()
slice_independent(IMPACT_IDX, 'baffe_impact_frames.png')
slice_independent(MARK_IDX, 'baffe_mark_frames.png')
