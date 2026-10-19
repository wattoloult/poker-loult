"""Author low-poly architecture at the user's b1-b9 guide positions in Building Topology."""
from pathlib import Path
import json,sys,time
from app.studio import Studio
ROOT=Path(__file__).resolve().parents[1]
COLORS={'wall':(147,79,61),'roof':(55,63,66),'trim':(91,55,45),'stone':(113,113,103),'plaster':(202,193,175)}

def box(p,x,y,z,w,d,h,m):p.append(('cube',x,y,z,w,d,h,0,m))
def wedge(p,x,y,z,w,d,h,m,turn=0):p.append(('wedge',x,y,z,w,d,h,turn,m))
def roof(p,x0,x1,y0,y1,z,rise,over=.6,axis=0,pyramid=False):
    if pyramid:
        box(p,x0-over,y0-over,z-.10,x1-x0+2*over,y1-y0+2*over,.22,'roof')
        p.append(('pyramid',x0-over,y0-over,z+.06,x1-x0+2*over,y1-y0+2*over,max(2.0,rise*2.2),0,'roof'))
        return
    if axis==90:
        temp=[];cx=(x0+x1)/2;cy=(y0+y1)/2;w=x1-x0;d=y1-y0
        roof(temp,-d/2,d/2,-w/2,w/2,z,rise,over)
        for kind,x,y,zz,ww,dd,hh,turn,mat in temp:
            nx=cx-(y+dd/2);ny=cy+(x+ww/2)
            p.append((kind,nx-ww/2,ny-dd/2,zz,ww,dd,hh,turn+90,mat))
        return
    half=(x1-x0)/2;mid=(x0+x1)/2
    # Two pitches create broad, shallow eaves and a steeper central roof.
    skirt=min(.85,half*.3);lift=.18;depth=y1-y0+2*over
    wedge(p,x0-over,y0-over,z,skirt+over,depth,lift,'roof')
    wedge(p,x1-skirt,y0-over,z,skirt+over,depth,lift,'roof',180)
    box(p,x0+skirt-.03,y0-over,z-.03,x1-x0-2*skirt+.06,depth,lift+.04,'roof')
    wedge(p,x0+skirt,y0-over,z+lift-.01,half-skirt,depth,rise-lift+.01,'roof')
    wedge(p,mid,y0-over,z+lift-.01,half-skirt,depth,rise-lift+.01,'roof',180)
    box(p,mid-.14,y0-over-.04,z+rise-.07,.28,y1-y0+2*over+.08,.17,'trim')
    box(p,x0-over-.06,y0-over-.10,z-.08,x1-x0+2*over+.12,.12,.17,'trim')
    box(p,x0-over-.06,y1+over-.02,z-.08,x1-x0+2*over+.12,.12,.17,'trim')

def one_storey(p,x0,x1,y0,y1,height,roofrise,base=.42,role='wall',axis=0,pyramid=False):
    box(p,x0,y0,0,x1-x0,y1-y0,base,'stone')
    box(p,x0+.15,y0+.15,base,x1-x0-.3,y1-y0-.3,height-base,role)
    roof(p,x0,x1,y0,y1,height-.08,roofrise,axis=axis,pyramid=pyramid)

def recipe(code):
 p=[]
 if code=='B1':
    # Guide: 14 x 11 m, 9 m tall, with a 4.66 m wide recessed stair bay.
    box(p,-7,6,0,4.67,11,9,'wall')
    box(p,2.33,6,0,4.67,11,9,'wall')
    box(p,-2.33,8,2,4.66,9,7,'wall')
    roof(p,-7,7,6,17,9,1.35,.48,axis=90)
    # Shallow balconies mark the three guide storeys without changing the shell.
    for z in (3.05,6.05):
      for x in (-7,2.33):
       box(p,x,5.48,z,4.67,.7,.16,'trim')
       box(p,x,5.35,z+.7,4.67,.12,.14,'trim')
       for xx in (x+.1,x+2.27,x+4.46):box(p,xx,5.38,z+.16,.10,.12,.55,'trim')
 elif code=='B2':
    # Guide's 4 m inner wing rises to the 7 m outer hall.
    box(p,7,-5,0,3,8,4,'plaster')
    box(p,10,-5,0,10,8,7,'plaster')
    wedge(p,7,-5,4,3,8,3,'roof')
    roof(p,10,20,-5,3,7,1.05,.42,axis=90)
    box(p,10,-5.55,3.9,10,.63,.16,'trim')
    box(p,10,-5.55,4.05,10,.12,.78,'trim')
 elif code=='B3':
    box(p,-20,-5,0,10,8,7,'plaster')
    box(p,-10,-5,0,3,8,4,'plaster')
    wedge(p,-10,-5,4,3,8,3,'roof',180)
    roof(p,-20,-10,-5,3,7,1.05,.42)
    box(p,-20,-5.55,3.9,10,.63,.16,'trim')
    box(p,-20,-5.55,4.05,10,.12,.78,'trim')
 elif code=='B4':one_storey(p,-20,-10,6,17,3,.8,role='plaster',pyramid=True)
 elif code=='B5':
    one_storey(p,10,20,6,17,6,1.05,role='plaster')
    box(p,10,5.48,3.05,10,.72,.16,'trim')
    box(p,10,5.37,3.83,10,.12,.13,'trim')
    for x in (10.2,12.6,15,17.4,19.8):box(p,x,5.39,3.21,.10,.12,.62,'trim')
 elif code=='B6':one_storey(p,7,20,20,29,10,1.05,role='wall',axis=90)
 elif code=='B7':
    # Guide: 6 m front level, then an upper rear volume reaching 12 m.
    box(p,-7,20,0,14,9,6,'wall')
    box(p,-6.65,21.0,5.92,13.3,8,6.08,'wall')
    box(p,-7,19.48,5.95,14,.67,.27,'trim')
    box(p,-7,19.48,6.18,14,.12,.77,'trim')
    for x in (-6.8,-3.4,0,3.4,6.7):box(p,x,19.38,6.22,.10,.12,.6,'trim')
    roof(p,-7,7,20,29,11.92,1.3,.48,pyramid=True)
 elif code=='B8':
    box(p,-10,20,0,3,9,4,'plaster')
    box(p,-10,23,3.92,3,6,2.08,'plaster')
    roof(p,-10,-7,20,23,3.92,.5,.25)
    roof(p,-10,-7,23,29,5.92,.65,.25)
 elif code=='B9':one_storey(p,-20,-10,20,29,7,1.0,role='plaster',axis=90)
 elif code=='Stairs':
    for i in range(6):
       z=(i+1)/3
       box(p,-2.33,6+i/3,0,4.66,2-i/3,z,'stone')
 elif code=='Arena_Walkway':
    # One-metre pedestrian ring within the 14 x 11 m arena court.
    box(p,-7,-5,0,14,1,.12,'stone')
    # Leave the recessed B1 stair approach open at the north edge.
    box(p,-7,5,0,4.67,1,.12,'stone')
    box(p,2.33,5,0,4.67,1,.12,'stone')
    box(p,-7,-4,0,1,9,.12,'stone')
    box(p,6,-4,0,1,9,.12,'stone')
 elif code=='Street_Walkway':
    # Ten-centimetre edges of the three-metre street corridors.
    for x0,x1 in ((-20,-7),(7,20)):
     box(p,x0,3,0,x1-x0,.10,.12,'stone')
    # Break the curb where the side streets meet this east-west route.
    for x0,x1 in ((-20,-10),(10,20)):
     box(p,x0,5.9,0,x1-x0,.10,.12,'stone')
    for x0 in (-10,7):
     box(p,x0,6,0,.10,14,.12,'stone')
     box(p,x0+2.9,6,0,.10,14,.12,'stone')
    for x0,x1 in ((-20,-10),(-7,7),(10,20)):
     box(p,x0,17,0,x1-x0,.10,.12,'stone')
     box(p,x0,19.9,0,x1-x0,.10,.12,'stone')
 else:raise KeyError(code)
 return p

def build(code):
 parts=recipe(code);studio=Studio();studio.set_scale(8);studio.grid(.01)
 for kind,x,y,z,w,d,h,turn,mat in parts:
    studio.solid(kind,x,y,z,w,d,h,turn=turn,sides=8 if kind=='dome' else 4,colour=COLORS[mat])
 studio.save(str(ROOT/'source'/f'{code}.btop'))
 shell=studio.shell;verts=[];index={};faces=[];mats=[]
 for face in shell.faces:
    ring=[]
    for point in face.points:
       key=tuple(round(float(q)*studio.scene.metres_per_unit,5) for q in point)
       if key not in index:index[key]=len(verts);verts.append(key)
       ring.append(index[key])
    if len(set(ring))>=3:
       faces.append(ring);mats.append(next((k for k,v in COLORS.items() if tuple(face.colour)==v),'wall'))
 payload={'id':code,'vertices':verts,'faces':faces,'materials':mats}
 report={'id':code,'parts':len(parts),'vertices':len(verts),'faces':len(faces),'closed':studio.closed(),'stats':studio.stats()}
 print('TOPOLOGY',code,report['parts'],'parts',report['faces'],'faces','closed',report['closed'],flush=True)
 return payload,report

def main():
 chosen=sys.argv[1:] or [f'B{i}' for i in range(1,10)]+['Stairs','Arena_Walkway','Street_Walkway']
 payload=[];reports=[]
 for code in chosen:
    p,r=build(code);payload.append(p);reports.append(r)
 (ROOT/'handoff'/'topology_meshes.json').write_text(json.dumps(payload,separators=(',',':')))
 (ROOT/'reports'/'topology.json').write_text(json.dumps(reports,indent=2,default=str))
 print('BUILT',len(payload),'objects',flush=True)
if __name__=='__main__':main()
