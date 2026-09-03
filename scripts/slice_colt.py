# -*- coding: utf-8 -*-
"""Découpe les assets du pistolet :
- assets/coltonly.png (grille 3x3 = 9 frames de l'arme) -> assets/colt_frames.png
  MÊME technique que café (nominal-cell + marge FIXE, PAS de recentrage par frame) : c'est une animation
  séquentielle, le pivot (la main/crosse) doit rester EXACTEMENT au même endroit sur les 9 frames, sinon
  l'arme "saute" quand on joue l'animation.
- assets/colt.png : 4 bandes horizontales de hauteur différente (arme réf. [ignorée, on garde coltonly],
  balles, impacts, douilles) détectées automatiquement par projection alpha, chaque bande recoupée en
  composantes connexes -> une bande de sortie par ligne, poses INDÉPENDANTES cette fois (recentrage bbox
  OK, ce ne sont pas des frames de mouvement continu)."""
import numpy as np
from PIL import Image
from scipy import ndimage


def bands_1d(has, min_gap):
    """Segmente un vecteur bool en bandes contiguës, en tolérant des trous <= min_gap (anti-aliasing /
    la main et l'arme d'une même frame sont parfois rendues avec un petit espace entre les deux)."""
    bands = []
    start = None
    gap = 0
    for i, h in enumerate(has):
        if h:
            if start is None:
                start = i
            gap = 0
        else:
            if start is not None:
                gap += 1
                if gap > min_gap:
                    bands.append((start, i - gap + 1))
                    start = None
    if start is not None:
        bands.append((start, len(has)))
    return bands


def slice_gun():
    """La grille de coltonly.png n'est PAS un 3x3 régulier : ré-inspection visuelle -> la ligne du haut a
    en réalité 4 poses (idle, idle, étincelle, flash), pas 3 comme supposé au départ (vérifié : un seuil
    de fusion trop large avalait la 4e pose dans la case 3 -> "2 armes dans la même case"). 10 frames au
    total (4+3+3). On détecte les VRAIES bandes par projection alpha : d'abord les lignes (creux vertical,
    seuil bas), puis dans CHAQUE ligne les colonnes avec un seuil de trou FIN (20px, mesuré : le plus
    petit vrai espace entre 2 poses distinctes est 36px sur la ligne du haut -> 20 le capte sans rien
    fusionner à tort)."""
    im = Image.open('../assets/_sources/coltonly.png').convert('RGBA')
    W, H = im.size
    a = np.array(im)
    al = a[:, :, 3]
    mask = al > 25
    lbl, n = ndimage.label(mask)

    row_bands = bands_1d((al > 25).any(axis=1), min_gap=8)
    cells = []  # (y0,y1,x0,x1) par cellule, ordre lecture (haut->bas, gauche->droite)
    for (y0, y1) in row_bands:
        col_bands = bands_1d((al[y0:y1] > 25).any(axis=0), min_gap=20)
        for (x0, x1) in col_bands:
            cells.append((y0, y1, x0, x1))
    print('cellules détectées :', cells)
    N = len(cells)

    PAD = 30
    maxw = max(x1 - x0 for (_, _, x0, x1) in cells)
    maxh = max(y1 - y0 for (y0, y1, _, _) in cells)
    FW, FH = maxw + 2 * PAD, maxh + 2 * PAD
    strip = Image.new('RGBA', (FW * N, FH), (0, 0, 0, 0))
    ap = np.pad(a, ((PAD, PAD), (PAD, PAD), (0, 0)), mode='constant', constant_values=0)
    lblp = np.pad(lbl, ((PAD, PAD), (PAD, PAD)), mode='constant', constant_values=0)

    for idx, (y0, y1, x0, x1) in enumerate(cells):
        # labels dont le bbox retenu est CENTRÉ dans cette cellule (pas juste "touche" -> évite de reprendre
        # un bout d'une frame voisine qui déborderait légèrement dans la fenêtre paddée)
        py0, py1, px0, px1 = y0 + PAD, y1 + PAD, x0 + PAD, x1 + PAD
        sub_full = ap[py0 - PAD:py1 + PAD, px0 - PAD:px1 + PAD]
        sub_lbl = lblp[py0 - PAD:py1 + PAD, px0 - PAD:px1 + PAD]
        labs_here = set(np.unique(lblp[py0:py1, px0:px1])) - {0}
        keep = np.isin(sub_lbl, list(labs_here))
        sub = sub_full.copy()
        sub[~keep] = 0
        w, h = x1 - x0, y1 - y0
        crop = Image.fromarray(sub, 'RGBA')
        # ancrage BAS-GAUCHE fixe (pas de centrage par bbox -> jitter garanti, déjà vu sur le café) :
        # la main/crosse est en bas-gauche de chaque frame, les effets (flash/fumée) débordent vers le
        # haut-droite -> ancrer bas-gauche garde la main immobile quelle que soit la taille de l'effet.
        paste_x = idx * FW + 0
        paste_y = FH - 2 * PAD - h
        strip.paste(crop, (paste_x, paste_y), crop)
    strip.save('../assets/colt_frames.png')
    print(f'colt_frames.png : N={N} FW={FW} FH={FH}')


def detect_rows(alpha, min_gap=10):
    rows_has = (alpha > 25).any(axis=1)
    bands = []
    start = None
    gap = 0
    for y, has in enumerate(rows_has):
        if has:
            if start is None:
                start = y
            gap = 0
        else:
            if start is not None:
                gap += 1
                if gap > min_gap:
                    bands.append((start, y - gap + 1))
                    start = None
    if start is not None:
        bands.append((start, len(rows_has)))
    return bands


def slice_row(a, lbl, y0, y1, out_name, min_area=40, pad_ratio=0.12):
    band_lbl = lbl[y0:y1]
    labs_here = sorted(set(band_lbl.flatten()) - {0})
    comps = []
    for lab in labs_here:
        ys, xs = np.where(band_lbl == lab)
        if len(ys) < min_area:
            continue
        comps.append((lab, xs.min(), xs.max() + 1, ys.min() + y0, ys.max() + 1 + y0))
    comps.sort(key=lambda c: c[1])  # gauche -> droite
    if not comps:
        print(f'!! rien trouvé pour {out_name}')
        return
    maxw = max(c[2] - c[1] for c in comps)
    maxh = max(c[4] - c[3] for c in comps)
    pad = round(max(maxw, maxh) * pad_ratio)
    FW, FH = maxw + 2 * pad, maxh + 2 * pad
    strip = Image.new('RGBA', (FW * len(comps), FH), (0, 0, 0, 0))
    for i, (lab, x0, x1, cy0, cy1) in enumerate(comps):
        sub = a[cy0:cy1, x0:x1].copy()
        keep = (lbl[cy0:cy1, x0:x1] == lab)
        sub[~keep] = 0
        w, h = x1 - x0, cy1 - cy0
        crop = Image.fromarray(sub, 'RGBA')
        strip.paste(crop, (i * FW + (FW - w) // 2, (FH - h) // 2), crop)
    strip.save(f'../assets/{out_name}')
    print(f'{out_name} : N={len(comps)} FW={FW} FH={FH}')


def slice_effects():
    im = Image.open('../assets/_sources/colt.png').convert('RGBA')
    a = np.array(im)
    mask = a[:, :, 3] > 25
    lbl, n = ndimage.label(mask)
    bands = detect_rows(a[:, :, 3])
    print('bandes détectées :', bands)
    names = ['gun_ref_ignored', 'bullet_frames.png', 'impact_frames.png', 'casing_frames.png']
    for i, (y0, y1) in enumerate(bands):
        if i == 0:
            continue  # ligne 1 = arme, on garde coltonly.png à la place
        if i < len(names):
            slice_row(a, lbl, y0, y1, names[i])


slice_gun()
slice_effects()
