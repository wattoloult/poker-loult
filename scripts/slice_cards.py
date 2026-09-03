# -*- coding: utf-8 -*-
"""Decoupe les 4 sprite sheets en 52 cartes individuelles."""
import os
import numpy as np
from PIL import Image
from scipy import ndimage

SHEETS = {
    'h': '../assets/set coeur.png',
    'd': '../assets/set carreau.png',
    's': '../assets/set piques.png',
    'c': '../assets/Set trèfles.png',
}
RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
OUT = '../cards'
os.makedirs(OUT, exist_ok=True)


def boxes_for(path):
    im = Image.open(path).convert('RGBA')
    a = np.array(im)[:, :, 3]
    mask = a > 40
    # ferme les petits trous internes pour un seul blob par carte
    mask = ndimage.binary_closing(mask, iterations=3)
    lbl, n = ndimage.label(mask)
    slices = ndimage.find_objects(lbl)
    boxes = []
    for sl in slices:
        if sl is None:
            continue
        y0, y1 = sl[0].start, sl[0].stop
        x0, x1 = sl[1].start, sl[1].stop
        if (x1 - x0) < 120 or (y1 - y0) < 160:  # ignore le bruit
            continue
        boxes.append((x0, y0, x1, y1))
    return im, boxes


def reading_order(boxes):
    # regroupe par lignes selon le centre vertical
    boxes = sorted(boxes, key=lambda b: (b[1] + b[3]) / 2)
    rows, cur, last_c = [], [], None
    for b in boxes:
        c = (b[1] + b[3]) / 2
        if last_c is None or abs(c - last_c) < 150:
            cur.append(b)
        else:
            rows.append(cur)
            cur = [b]
        last_c = c
    if cur:
        rows.append(cur)
    ordered = []
    for row in rows:
        ordered.extend(sorted(row, key=lambda b: b[0]))
    return ordered


for suit, fname in SHEETS.items():
    im, boxes = boxes_for(fname)
    ordered = reading_order(boxes)
    print(fname, '->', len(ordered), 'cartes')
    assert len(ordered) == 13, f'{fname}: {len(ordered)} cartes detectees (attendu 13)'
    for rank, (x0, y0, x1, y1) in zip(RANKS, ordered):
        card = im.crop((x0, y0, x1, y1))
        card.save(os.path.join(OUT, f'{suit}{rank}.png'))
print('OK - 52 cartes dans', OUT)
