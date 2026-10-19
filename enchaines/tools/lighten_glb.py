#!/usr/bin/env python3
"""Allège un GLB sans toucher à l'original : textures PNG -> WebP (EXT_texture_webp), côté ramené à MAX px si plus grand.
Géométrie, matériaux, noms des pièces et hiérarchie restent identiques. Usage : lighten_glb.py in.glb out.glb [MAX=2048] [QUALITY=92]"""
import sys, json, struct, io
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]; MAX = int(sys.argv[3]) if len(sys.argv) > 3 else 2048; Q = int(sys.argv[4]) if len(sys.argv) > 4 else 92
b = open(src, 'rb').read(); magic, ver, total = struct.unpack('<III', b[:12]); jl, jt = struct.unpack('<II', b[12:20]); j = json.loads(b[20:20 + jl]); off = 20 + jl
bl, bt = struct.unpack('<II', b[off:off + 8]); binchunk = b[off + 8:off + 8 + bl]
views = j['bufferViews']; img_views = {im['bufferView'] for im in j['images']}
newbin = bytearray(); newviews = []
for i, v in enumerate(views):
    data = binchunk[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']]
    if i in img_views:
        im = Image.open(io.BytesIO(data)); w0, h0 = im.size
        if max(im.size) > MAX: k = MAX / max(im.size); im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        mode = 'RGBA' if im.mode in ('RGBA', 'LA', 'P') and 'A' in im.getbands() or im.mode == 'RGBA' else 'RGB'
        im = im.convert(mode); out = io.BytesIO(); im.save(out, 'WEBP', quality=Q, method=6); data = out.getvalue(); print(f'image {i}: {w0}x{h0} -> {im.width}x{im.height} {len(data)/1e6:.2f} Mo')
    while len(newbin) % 4: newbin.append(0)
    nv = {k: val for k, val in v.items() if k != 'byteOffset'}; nv['buffer'] = 0; nv['byteOffset'] = len(newbin); nv['byteLength'] = len(data); newbin += data; newviews.append(nv)
j['bufferViews'] = newviews; j['buffers'] = [{'byteLength': len(newbin)}]
for im in j['images']: im['mimeType'] = 'image/webp'
for t in j['textures']: s = t.pop('source'); t.setdefault('extensions', {})['EXT_texture_webp'] = {'source': s}
for k in ('extensionsUsed', 'extensionsRequired'): j.setdefault(k, [])
for k in ('extensionsUsed', 'extensionsRequired'):
    if 'EXT_texture_webp' not in j[k]: j[k].append('EXT_texture_webp')
js = json.dumps(j, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
while len(newbin) % 4: newbin.append(0)
out = struct.pack('<III', magic, ver, 12 + 8 + len(js) + 8 + len(newbin)) + struct.pack('<II', len(js), jt) + js + struct.pack('<II', len(newbin), bt) + bytes(newbin)
open(dst, 'wb').write(out); print('écrit', dst, f'{len(out)/1e6:.1f} Mo (original {len(b)/1e6:.1f} Mo)')
