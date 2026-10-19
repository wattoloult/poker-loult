"""Use Building Texturing to bake and preserve one editable atlas per arena object."""
import os
os.environ['QT_QPA_PLATFORM']='offscreen'
from pathlib import Path
import json
from PySide6.QtWidgets import QApplication
from editor.studio import Studio
ROOT=Path(__file__).resolve().parents[1];TEX=ROOT/'textures';SRC=ROOT/'source';HAND=ROOT/'handoff'
app=QApplication.instance() or QApplication([])

def regions(code):
 if code in ('Street','Arena_Floor'):names=[code];cells=[(0,0,1,1)];size=2048
 else:
  names=['front','side','roof','base'] if code!='Stairs' else ['top','riser','side','base']
  cells=[(0,.5,.5,.5),(.5,.5,.5,.5),(0,0,.5,.5),(.5,0,.5,.5)]
  size=2048 if code in ('B1','B5','B6','B7') else 512 if code=='B8' else 1024
 rr=[]
 for name,(u,v,w,h) in zip(names,cells):
  rr.append({'name':name,'u':u,'v':v,'w':w,'h':h,'axis':2,'sign':1,'faces':1,'area_m2':4.0,'centre3d':[0,0,0],'outline':[[[0,0],[1,0],[1,1],[0,1]]],'origin_m':[0,0]})
 return names,rr,size
for code in ['Street','Arena_Floor','Stairs']+[f'B{i}' for i in range(1,10)]:
 names,rr,size=regions(code)
 layout=HAND/f'{code}_regions.json';layout.write_text(json.dumps({'object':code,'uv':'UVMap','regions':rr},indent=2))
 studio=Studio(size=size);studio.layout(layout)
 studio.materials({name:TEX/(f'{code}_{name}.png' if code not in ('Street','Arena_Floor') else f'{code}.png') for name in names},world_m=2.0,pixel_art=True)
 for name in names:assert studio.dress(name,name)
 studio.bake();studio.save(SRC/f'{code}.btex')
 atlas=TEX/f'{code}_atlas.png';assert studio.canvas.flattened().save(str(atlas))
 print('TEXTURING',code,size,'px',flush=True)
