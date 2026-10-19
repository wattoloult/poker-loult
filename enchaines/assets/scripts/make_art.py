"""Paint object-specific PSX atlas regions from the user's temple/courtyard direction.

Each of Street, Stairs, B1..B9 receives its own independent image atlas.
Boneglass measures a palette from the authored colors and maps every pigment to it.
"""
from pathlib import Path
import json,sys,random
import numpy as np
from PIL import Image,ImageDraw
sys.path.insert(0,'/home/nooraldin21/nooraldin_Workspace/pixelart/pixelart')
from boneglass.color import quantize
from boneglass.oklab import oklab_to_u8
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'textures';OUT.mkdir(exist_ok=True)
P={'red':'#834638','red_light':'#aa6650','red_edge':'#c2825f','red_dark':'#532d29','timber':'#3f302b','timber_light':'#79604d',
   'plaster':'#c6c0ac','plaster_hi':'#d9d1b9','plaster_low':'#a5a696','paper':'#d8ceb3','paper_grid':'#705844',
   'glass':'#516067','glass_hi':'#85999a','glass_dark':'#2e3a3e','tile':'#303b3f','tile_hi':'#5a6869','tile_mid':'#425257','tile_low':'#1e2a2e',
   'stone':'#8a9088','stone_hi':'#afb0a2','stone_low':'#626f68','moss':'#506953','gold':'#bd9766','shadow':'#201f1c','iron':'#45494a'}
class Paint:
 def __init__(self,size,bg):self.size=size;self.s=size/512;self.im=Image.new('RGB',(size,size),P[bg]);self.d=ImageDraw.Draw(self.im)
 def xy(self,a):return round(a*self.s)
 def box(self,box,c):self.d.rectangle(tuple(self.xy(x) for x in box),fill=P[c])
 def line(self,points,c,w=1):self.d.line(tuple(self.xy(x) for x in points),fill=P[c],width=max(1,self.xy(w)))
 def poly(self,points,c):self.d.polygon([(self.xy(x),self.xy(y)) for x,y in points],fill=P[c])
 def arc(self,box,start,end,c,w=1):self.d.arc(tuple(self.xy(x) for x in box),start,end,fill=P[c],width=max(1,self.xy(w)))
 def oval(self,box,c):self.d.ellipse(tuple(self.xy(x) for x in box),fill=P[c])

def grain(p,box,seed,horizontal=False,n=20):
 rng=random.Random(seed);x0,y0,x1,y1=box
 for _ in range(n):
  if horizontal:
   x=rng.randrange(x0+2,max(x0+3,x1-10));y=rng.randrange(y0+1,max(y0+2,y1-1));p.line((x,y,min(x1,x+rng.randrange(5,45)),y),'red_dark' if rng.random()<.7 else 'red_edge',1)
  else:
   x=rng.randrange(x0+1,max(x0+2,x1-1));y=rng.randrange(y0+2,max(y0+3,y1-10));p.line((x,y,x,min(y1,y+rng.randrange(6,40))),'red_dark' if rng.random()<.7 else 'red_edge',1)

def beam(p,box,seed,horizontal=False):
 p.box(box,'red');x0,y0,x1,y1=box
 if horizontal:p.line((x0,y0+2,x1,y0+2),'red_edge',2)
 else:p.line((x0+2,y0,x0+2,y1),'red_edge',2)
 grain(p,box,seed,horizontal,max(8,(x1-x0 if horizontal else y1-y0)//10))

def lattice(p,box,style='screen'):
 x0,y0,x1,y1=box;p.box(box,'timber');p.box((x0+6,y0+6,x1-6,y1-6),'glass_dark' if style=='glass' else 'paper')
 if style=='glass':
  p.poly([(x0+9,y0+9),(x0+31,y0+9),(x0+9,y0+73)],'glass_hi')
  p.box((x0+13,y0+13,x1-13,y1-13),'glass')
 else:
  p.line((x0+10,y0+11,x1-10,y0+11),'plaster_hi',2)
 for x in range(x0+8,x1-7,15 if style=='screen' else 25):p.line((x,y0+7,x,y1-7),'paper_grid',2)
 for y in range(y0+8,y1-7,24):p.line((x0+7,y,x1-7,y),'paper_grid',2)
 p.line((x0+3,y0+3,x1-3,y0+3),'timber_light',2)

def carved_band(p,y0,y1,seed):
 p.box((0,y0,511,y1),'red_dark');p.line((0,y0+2,511,y0+2),'red_edge',3)
 p.line((0,y1-3,511,y1-3),'gold',2)
 rng=random.Random(seed)
 for x in range(17,511,25):
  p.poly([(x,y0+8),(x+5,y0+13),(x,y0+18),(x-5,y0+13)],'gold')
  if rng.random()<.55:p.line((x-6,y0+22,x+6,y0+22),'red_edge',1)

def plaster_marks(p,seed,n=130):
 rng=random.Random(seed)
 for _ in range(n):
  x=rng.randrange(8,500);y=rng.randrange(12,499)
  p.line((x,y,x+rng.randrange(2,10),y),'plaster_low' if rng.random()<.38 else 'plaster_hi',1)

def story_band(p,code,role,y0,y1,index,count):
 height=y1-y0;prominent=code in ('B1','B7');wall=code in ('B4','B8','B9')
 p.box((0,y0,511,y1),'plaster' if not prominent else 'red_dark')
 if not prominent:plaster_marks(p,1000*int(code[1:])+100*index+sum(map(ord,role)),n=45)
 # framed bays: red columns and broad timber sill retain identity at thumbnail size
 p.box((0,y0,511,y0+14),'red_dark');p.line((0,y0+14,511,y0+14),'red_edge',3)
 p.box((0,y1-16,511,y1),'red_dark');p.line((0,y1-18,511,y1-18),'gold' if prominent else 'red_edge',2)
 for j,x in enumerate((0,101,203,305,407,500)):beam(p,(x,y0+14,x+11,y1-16),index*31+j+int(code[1:])*97)
 if wall:
  # Recessed pale panels and brick-height stone course; no fake doors on wall runs.
  for x0,x1 in ((17,97),(119,199),(221,301),(323,403),(425,495)):
   p.box((x0,y0+38,x1,y1-36),'plaster_hi')
   p.box((x0,y1-104,x1,y1-37),'plaster')
   p.line((x0,y0+38,x1,y0+38),'plaster_low',2)
   p.line((x0+7,y0+45,x0+7,y1-44),'plaster_low',1)
   p.line((x1-7,y0+45,x1-7,y1-44),'plaster_low',1)
   p.line((x0+7,y1-44,x1-7,y1-44),'plaster_low',1)
   for xx in range(x0+10,x1-5,24):p.line((xx,y1-62,xx,y1-38),'paper_grid',2)
   # Rain streaks settle below the cap, with sparse moss at the lower sill.
   for j in range(3):
    xx=x0+14+j*22
    p.line((xx,y0+39,xx+2,y0+71+j*13),'plaster_low',1)
    if j==1:p.line((xx,y1-41,xx+9,y1-41),'moss',2)
 elif code=='B7' and index==count-1:
  # Real gate opening is geometry; ornament stays on the flanking pier faces.
  for x0,x1 in ((18,94),(420,494)):
   lattice(p,(x0,y0+43,x1,y1-31),'screen')
  carved_band(p,y0+18,y0+38,index+42)
 elif prominent:
  if index==count-1 and role=='front':
   lattice(p,(116,y0+47,247,y1-24),'screen');lattice(p,(263,y0+47,394,y1-24),'screen')
   p.oval((247,(y0+y1)//2-5,257,(y0+y1)//2+5),'gold')
  else:
   for x0,x1 in ((20,94),(121,196),(223,297),(324,399),(426,493)):
    lattice(p,(x0,y0+42,x1,y1-35),'glass' if role=='side' else 'screen')
  carved_band(p,y0+17,y0+37,index+66)
  if index<count-1:
   # Painted balcony rail: broad silhouette stays in the roof overhang.
   p.box((0,y1-61,511,y1-54),'red_light')
   for x in range(13,511,29):p.box((x,y1-57,x+4,y1-19),'red_edge')
   p.box((0,y1-21,511,y1-17),'red_light')
 else:
  # Auxiliary halls vary by location; doors face the approach, other sides are screened.
  if role=='front' and code in ('B2','B3','B5','B6') and index==count-1:
   lattice(p,(42,y0+43,185,y1-34),'screen');lattice(p,(209,y0+41,302,y1-22),'glass');lattice(p,(327,y0+43,470,y1-34),'screen')
  else:
   lattice(p,(27,y0+47,174,y1-36),'screen');lattice(p,(204,y0+47,343,y1-36),'glass');lattice(p,(372,y0+47,489,y1-36),'screen')
  carved_band(p,y0+17,y0+38,index+33)

def facade(code,role,size):
 p=Paint(size,'plaster');prominent=code in ('B1','B7')
 if prominent:bands=[(0,162),(162,334),(334,512)] if code=='B1' else [(0,252),(252,512)]
 elif code in ('B5','B6'):bands=[(0,251),(251,512)]
 else:bands=[(0,512)]
 for i,(y0,y1) in enumerate(bands):story_band(p,code,role,y0,y1,i,len(bands))
 # Edge shadows and joinery pegs, painted at actual facade scale.
 p.line((0,0,511,0),'shadow',4)
 for x in (7,108,210,312,414,507):
  for y in (20,164,337,496):p.box((x,y,x+3,y+3),'iron')
 # Separate histories: paint repairs, joinery and weathering differ by house.
 if code=='B1':
  for x in range(17,511,50):p.poly([(x,8),(x+8,18),(x,28),(x-8,18)],'gold')
 elif code=='B2':
  for x in (33,135,237,339,441):
   p.box((x,102,x+56,245),'glass');p.line((x+28,103,x+28,244),'red_edge',3)
  p.box((0,305,511,319),'tile_mid')
 elif code=='B3':
  for x in (13,114,215,316,417):
   p.line((x,44,x+85,265),'timber',6);p.line((x+85,44,x,265),'timber_light',3)
  p.box((0,445,511,463),'timber')
 elif code=='B4':
  for x,y in ((48,80),(179,197),(331,101),(462,283)):
   p.line((x,y,x+13,y+36),'plaster_low',3);p.line((x+13,y+36,x+6,y+59),'plaster_low',2)
  for x in range(10,511,42):p.box((x,456,x+18,462),'moss')
 elif code=='B5':
  for x in range(14,511,28):p.poly([(x,239),(x+7,246),(x,253),(x-7,246)],'gold')
  for x in (50,152,254,356,458):p.box((x,280,x+12,470),'red_light')
 elif code=='B6':
  for x in (48,153,258,363,468):
   p.box((x,56,x+23,196),'glass_dark');p.box((x+5,65,x+18,186),'glass')
   p.box((x,300,x+23,441),'glass_dark');p.box((x+5,310,x+18,430),'glass')
  p.box((0,489,511,505),'timber')
 elif code=='B7':
  for x in range(16,510,30):p.poly([(x,231),(x+7,239),(x,247),(x-7,239)],'gold')
  p.box((0,467,511,478),'red_light')
 elif code=='B8':
  for x in range(23,510,52):
   p.line((x,55,x+42,385),'timber_light',4)
   p.box((x,393,x+39,405),'timber')
  for x in range(10,510,29):p.box((x,460,x+11,465),'moss')
 elif code=='B9':
  p.box((0,397,511,428),'stone_low')
  for x in (30,131,232,333,434):
   p.box((x,112,x+43,326),'timber_light');p.line((x+20,115,x+20,324),'timber',3)
  for x,y in ((62,48),(208,172),(381,98),(467,268)):
   p.line((x,y,x+11,y+48),'plaster_low',3)
 # Material-dependent ageing keeps paper screens clean and plaster stained.
 a=np.asarray(p.im).copy();original=a.copy()
 timber_tones={'B1':(1.05,.93,.88),'B2':(.87,1.02,1.05),'B3':(.68,.83,.88),'B4':(.70,.83,.79),'B5':(.94,1.04,.98),'B6':(.62,.72,.79),'B7':(1.08,.85,.77),'B8':(.67,.82,.74),'B9':(.80,.89,.85)}[code]
 for pigment in ('red','red_light','red_dark','red_edge'):
  rgb=np.array(tuple(bytes.fromhex(P[pigment][1:])))
  mask=np.all(original==rgb,axis=2)
  a[mask]=np.clip(rgb*np.array(timber_tones),0,255).astype('uint8')
 yy,xx=np.indices(a.shape[:2]);scale=size/512
 for pigment in ('plaster','plaster_hi','plaster_low'):
  rgb=np.array(tuple(bytes.fromhex(P[pigment][1:])))
  mask=np.all(original==rgb,axis=2)
  stains=(np.sin(xx/(19*scale))+np.cos(xx/(37*scale)))>1.15
  lower=(yy>size*.74)&stains
  under=(yy%(max(1,size//(3 if code=='B1' else 2))))<size*.055
  a[mask&lower]=np.clip(rgb*.81,0,255).astype('uint8')
  a[mask&under]=np.clip(rgb*.88,0,255).astype('uint8')
 return Image.fromarray(a,'RGB')

def roof(code,size):
 p=Paint(size,'tile');rng=random.Random(4100+int(code[1:]))
 # Long ceramic channels, overlapped tile courses and restrained chipped edges.
 for col,x in enumerate(range(-10,520,10)):
  p.box((x,0,x+9,511),'tile_low')
  p.box((x+1,0,x+7,511),'tile_mid')
  p.line((x+2,0,x+2,511),'tile_hi',1)
  for row,y in enumerate(range(-4,520,15)):
   p.line((x+1,y+12,x+8,y+12),'tile_low',2)
   p.line((x+2,y+14,x+7,y+14),'tile_hi',1)
   if rng.random()<.12:p.box((x+3,y+3,x+6,y+8),'tile')
   if rng.random()<.045:p.line((x+3,y+10,x+5,y+10),'stone_hi',1)
 for _ in range(38):
  x=rng.randrange(8,500);y=rng.randrange(370,507)
  p.line((x,y,x+2,y+5),'moss',1)
 # Tile batches from different repairs: deliberately varied fired-clay tones.
 tones={
  'B1':('#253138','#485c65'),'B2':('#444a49','#72776e'),
  'B3':('#3d3533','#65544a'),'B4':('#435046','#6e7a63'),
  'B5':('#344954','#66808a'),'B6':('#282d31','#526069'),
  'B7':('#263341','#586b79'),'B8':('#4d5444','#7a815d'),
  'B9':('#55524d','#817c70')}
 dark,light=tones[code]
 a=np.asarray(p.im).copy();mid=np.array(Image.new('RGB',(1,1),P['tile_mid']))[0,0]
 low=np.array(Image.new('RGB',(1,1),P['tile_low']))[0,0]
 hi=np.array(Image.new('RGB',(1,1),P['tile_hi']))[0,0]
 a[np.all(a==mid,axis=2)]=tuple(bytes.fromhex(dark[1:]))
 a[np.all(a==hi,axis=2)]=tuple(bytes.fromhex(light[1:]))
 a[np.all(a==low,axis=2)]=tuple(round(v*.72) for v in bytes.fromhex(dark[1:]))
 return Image.fromarray(a,'RGB')

def base(code,size):
 p=Paint(size,'stone');rng=random.Random(820+int(code[1:]))
 # Top half: roof ridges and eave fascia; bottom half: foundation stonework.
 # Dedicated timber region for balconies, gable ends, fascia and ridges.
 p.box((0,0,511,255),'timber')
 for y in range(0,256,32):
  p.box((0,y+2,511,y+28),'red_dark')
  p.line((0,y+3,511,y+3),'red_light',2)
  p.line((0,y+28,511,y+28),'shadow',2)
  for q in range(16):
   x=rng.randrange(0,480);yy=y+rng.randrange(6,24)
   p.line((x,yy,min(511,x+rng.randrange(10,50)),yy),'timber_light',1)
  for x in (12,246,495):p.box((x,y+8,x+2,y+10),'iron')
 p.box((0,256,511,511),'stone')
 for row,y in enumerate((260,315,369,425,480)):
  p.line((0,y,511,y),'stone_low',3);p.line((0,y+4,511,y+4),'stone_hi',1)
  for x in range(-30+(row%2)*49,550,99):p.line((x,y,x,y+53),'stone_low',3)
 for _ in range(105):
  x=rng.randrange(2,510);y=rng.randrange(266,510)
  p.line((x,y,x+rng.randrange(2,13),y),'stone_low' if rng.random()<.55 else 'stone_hi',1)
  if y>442 and rng.random()<.12:p.box((x,y,x+4,y+2),'moss')
 return p.im

def stair_tile(role,size):
 p=Paint(size,'stone');rng=random.Random(700+['top','riser','side','base'].index(role))
 for y in range(0,512,64):
  p.line((0,y,511,y),'stone_low',4);p.line((0,y+5,511,y+5),'stone_hi',2)
  for x in range((y//64%2)*53,512,104):p.line((x,y,x,y+63),'stone_low',3)
 if role=='top':
  for y in range(47,512,64):p.box((0,y,511,y+7),'stone_hi')
 if role=='riser':
  for y in range(20,512,64):p.line((14,y,498,y),'stone_hi',1)
  for x in range(24,512,96):p.poly([(x,220),(x+14,235),(x,250),(x-14,235)],'stone_low')
 if role=='side':
  for y in range(48,512,64):p.line((0,y,511,y),'moss',2)
 for _ in range(180):
  x=rng.randrange(1,506);y=rng.randrange(1,506);p.line((x,y,x+rng.randrange(2,12),y),'stone_low' if rng.random()<.65 else 'stone_hi',1)
 return p.im

def street(size):
 p=Paint(size,'stone');rng=random.Random(2001)
 # Unique whole-map UV artwork: flags, offset joints and a framed front approach.
 for row,y in enumerate(range(0,512,8)):
  p.line((0,y,511,y),'stone_low',1);p.line((0,y+2,511,y+2),'stone_hi',1)
  for x in range(-10+(row%2)*5,520,10):p.line((x,y,x,y+8),'stone_low',1)
  for x in range(7+(row%3)*8,512,31):
   if rng.random()<.65:p.line((x,y+6,x+5,y+6),'stone_hi',1)
 # Main approach and lateral curb lines follow the original 40 x 28 m guide.
 for x in (166,173,339,346):
  p.line((x,0,x,511),'stone_low',3)
  p.line((x+3,0,x+3,511),'stone_hi',1)
 for _ in range(720):
  x=rng.randrange(0,512);y=rng.randrange(0,512)
  p.line((x,y,x+rng.randrange(1,5),y),'stone_low' if rng.random()<.55 else 'stone_hi',1)
 for _ in range(75):
  x=rng.choice([rng.randrange(0,90),rng.randrange(420,511)]);y=rng.randrange(0,512)
  p.line((x,y,x+rng.randrange(2,7),y),'moss',1)
 return p.im

def arena_floor(size):
 p=Paint(size,'stone');rng=random.Random(9021)
 # Larger, calmer flags mark the playable court, with a unique central inlay.
 for row,y in enumerate(range(0,512,26)):
  p.line((0,y,511,y),'stone_low',3);p.line((0,y+4,511,y+4),'stone_hi',1)
  for x in range(-34+(row%2)*29,540,58):p.line((x,y,x,y+26),'stone_low',2)
 for x in (6,16,496,506):
  p.line((x,0,x,511),'stone_low',4);p.line((x+3,0,x+3,511),'stone_hi',1)
 for y in (8,19,493,504):
  spans=((0,169),(343,511)) if y<30 else ((0,511),)
  for x0,x1 in spans:
   p.line((x0,y,x1,y),'stone_low',4);p.line((x0,y+3,x1,y+3),'stone_hi',1)
 p.box((164,160,348,344),'stone_low');p.box((172,168,340,336),'stone_hi')
 p.box((182,178,330,326),'stone');p.box((197,193,315,311),'stone_low')
 p.poly([(256,199),(311,254),(256,309),(201,254)],'stone_hi')
 p.poly([(256,215),(295,254),(256,293),(217,254)],'stone_low')
 p.poly([(256,229),(281,254),(256,279),(231,254)],'stone')
 for q in range(4):
  x=68+q*125;p.box((x,70,x+26,96),'stone_low');p.box((x+5,75,x+21,91),'stone_hi')
  p.box((x,413,x+26,439),'stone_low');p.box((x+5,418,x+21,434),'stone_hi')
 for _ in range(420):
  x=rng.randrange(18,494);y=rng.randrange(21,489)
  if 160<x<349 and 159<y<345:continue
  p.line((x,y,x+rng.randrange(2,8),y),'stone_low' if rng.random()<.6 else 'stone_hi',1)
 for _ in range(42):
  x=rng.choice([rng.randrange(19,47),rng.randrange(465,494)])
  y=rng.randrange(28,485);p.line((x,y,x+4,y),'moss',1)
 return p.im

def boneglass_image(im,name):
 # Sample for a compact palette, preserving each authored pigment as a part.
 sample=im.resize((256,256),Image.Resampling.NEAREST)
 a=np.asarray(sample).copy();pigments,inverse=np.unique(a.reshape(-1,3),axis=0,return_inverse=True)
 partmap=inverse.reshape(256,256).astype(np.int32)+1
 idx,palette,_=quantize(a/255.,np.ones((256,256),bool),partmap,[str(i) for i in range(len(pigments))],budget=48,max_steps=8,smooth=False)
 colors=oklab_to_u8(palette).astype('uint8')
 full=np.asarray(im);unique,inv=np.unique(full.reshape(-1,3),axis=0,return_inverse=True)
 distance=((unique[:,None,:].astype('int32')-colors[None,:,:].astype('int32'))**2).sum(axis=2)
 nearest=colors[distance.argmin(axis=1)]
 out=Image.fromarray(nearest[inv].reshape(full.shape),'RGB')
 return out,len(unique),len(np.unique(np.asarray(out).reshape(-1,3),axis=0))

def main():
 report={}
 for code in [f'B{i}' for i in range(1,10)]:
  s=1024 if code in ('B1','B5','B6','B7') else 256 if code=='B8' else 512
  for role,fn in [('front',lambda:facade(code,'front',s)),('side',lambda:facade(code,'side',s)),('roof',lambda:roof(code,s)),('base',lambda:base(code,s))]:
   img,n0,n1=boneglass_image(fn(),code+'_'+role)
   img.save(OUT/f'{code}_{role}.png',optimize=True)
   report[f'{code}_{role}']={'pixels':[s,s],'source_colors':n0,'final_colors':n1}
  print('ART',code,s,'px regions',flush=True)
 for role in ('top','riser','side','base'):
  img,n0,n1=boneglass_image(stair_tile(role,512),'Stairs_'+role)
  img.save(OUT/f'Stairs_{role}.png',optimize=True);report[f'Stairs_{role}']={'pixels':[512,512],'source_colors':n0,'final_colors':n1}
 img,n0,n1=boneglass_image(street(2048),'Street')
 img.save(OUT/'Street.png',optimize=True);report['Street']={'pixels':[2048,2048],'source_colors':n0,'final_colors':n1}
 img,n0,n1=boneglass_image(arena_floor(2048),'Arena_Floor')
 img.save(OUT/'Arena_Floor.png',optimize=True);report['Arena_Floor']={'pixels':[2048,2048],'source_colors':n0,'final_colors':n1}
 (ROOT/'reports'/'boneglass_art.json').write_text(json.dumps(report,indent=2))
 print('ART COMPLETE',len(report),'separate painted regions',flush=True)
if __name__=='__main__':main()
