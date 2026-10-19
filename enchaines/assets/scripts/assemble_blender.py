"""Keep the user's labelled guide, assemble Topology shells and per-object baked atlases.

No geometry is modeled here: original street faces are extracted as supplied;
B1-B9 and Stairs come from Building Topology handoff meshes.
"""
from pathlib import Path
import bpy,bmesh,json,math
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
PAYLOAD=json.loads((ROOT/'handoff'/'topology_meshes.json').read_text())
SOURCE=ROOT/'source'/'original_guide.blend'
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
bpy.context.preferences.filepaths.save_version=0
guide=bpy.data.objects['Plane'];guide.name='Original_Guide';guide.hide_render=True;guide.hide_set(True)
masters={}
def atlas_material(code):
 image=bpy.data.images.load(str(ROOT/'textures'/f'{code}_atlas.png'));image.pack();image.colorspace_settings.name='sRGB'
 mat=bpy.data.materials.new(f'{code}_unique_baked_atlas');mat.use_nodes=True
 nodes=mat.node_tree.nodes;bs=nodes.get('Principled BSDF')
 tex=nodes.new('ShaderNodeTexImage');tex.image=image;tex.interpolation='Closest'
 mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
 bs.inputs['Roughness'].default_value=1
 masters[code]=mat;return mat

def clamp(x):return max(0.,min(1.,x))
def atlas_uv(role,u,v,size,sub=None):
 # Four independent named regions in each object's atlas, four-pixel gutters.
 col,row={'front':(0,0),'side':(1,0),'roof':(0,1),'base':(1,1),
          'top':(0,0),'riser':(1,0)}[role]
 cell=size//2;gutter=4 if size>=1024 else 2
 if sub=='stone':v=.02+v*.46
 elif sub=='trim':v=.52+v*.46
 return ((col*cell+gutter+clamp(u)*(cell-2*gutter))/size,
         ((1-row)*cell+gutter+clamp(v)*(cell-2*gutter))/size)

def world_bounds(item,role=None):
 pts=[]
 for face,mat in zip(item['faces'],item['materials']):
  if role is None or mat in role:pts += [item['vertices'][i] for i in face]
 return [[min(p[k] for p in pts) for k in range(3)],[max(p[k] for p in pts) for k in range(3)]]
def norm(value,low,high):return clamp((value-low)/max(1e-6,high-low))

def make_topology(item):
 code=item['id'];allb=world_bounds(item);cx=(allb[0][0]+allb[1][0])/2;cy=(allb[0][1]+allb[1][1])/2
 verts=[(v[0]-cx,v[1]-cy,v[2]) for v in item['vertices']]
 mesh=bpy.data.meshes.new(code+'_Topology');mesh.from_pydata(verts,[],item['faces']);mesh.update()
 obj=bpy.data.objects.new(code if code=='Stairs' else 'Building_'+code,mesh);bpy.context.collection.objects.link(obj);obj.location=(cx,cy,0)
 mesh.materials.append(atlas_material(code));uv=mesh.uv_layers.new(name='UVMap')
 size=bpy.data.images[f'{code}_atlas.png'].size[0]
 wallb=world_bounds(item,('wall','plaster')) if code!='Stairs' else allb
 for face,base in zip(mesh.polygons,item['materials']):
  points=[Vector(item['vertices'][mesh.loops[li].vertex_index]) for li in face.loop_indices]
  n=face.normal;center=sum(points,Vector())/len(points)
  if code=='Stairs':
   if n.z>.55:role='top'
   elif abs(n.y)>=abs(n.x):role='riser'
   elif n.z<-.55:role='base'
   else:role='side'
   sub='stone' if role=='base' else None
   for li,p in zip(face.loop_indices,points):
    u=norm(p.x,-2.33,2.33) if role in ('top','riser') else norm(p.y,6,8)
    v=norm(p.y,6,8) if role=='top' else norm(p.z,0,2)
    uv.data[li].uv=atlas_uv(role,u,v,size,sub)
   continue
  if base in ('wall','plaster'):
   role='front' if abs(n.y)>=abs(n.x) and n.y<0 else 'side'
   sub=None
  elif base=='roof' and max(abs(n.x),abs(n.y))>.7 and abs(n.z)<.3:
   role='base';sub='trim'
  elif base=='roof':role='roof';sub=None
  elif base=='trim':role='base';sub='trim'
  else:role='base';sub='stone'
  for li,p in zip(face.loop_indices,points):
   if role=='front':u=norm(p.x,wallb[0][0],wallb[1][0]);v=norm(p.z,wallb[0][2],wallb[1][2])
   elif role=='side':
    u=norm(p.x,wallb[0][0],wallb[1][0]) if abs(n.y)>=abs(n.x) else norm(p.y,wallb[0][1],wallb[1][1])
    v=norm(p.z,wallb[0][2],wallb[1][2])
   elif role=='roof':
    if code in ('B4','B7'):
     # Project each pyramid pitch along its eave so tile courses stay level.
     u=norm(p.x,allb[0][0],allb[1][0]) if abs(n.y)>=abs(n.x) else norm(p.y,allb[0][1],allb[1][1])
     roofz=2.92 if code=='B4' else 11.92
     v=norm(p.z,roofz,roofz+(2.06 if code=='B4' else 2.92))
    elif code in ('B1','B2','B6','B9'):u=norm(p.x,allb[0][0],allb[1][0]);v=norm(p.y,allb[0][1],allb[1][1])
    else:u=norm(p.y,allb[0][1],allb[1][1]);v=norm(p.x,allb[0][0],allb[1][0])
   else:
    u=norm(p.x,allb[0][0],allb[1][0]) if abs(n.y)>=abs(n.x) else norm(p.y,allb[0][1],allb[1][1])
    v=norm(p.z,min(q.z for q in points),max(q.z for q in points)) if sub=='trim' else norm(p.z,0,.5)
   uv.data[li].uv=atlas_uv(role,u,v,size,sub)
 # Topology's decimal handoff can leave near-identical vertices at solid joins.
 bm=bmesh.new();bm.from_mesh(mesh)
 bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=.0001)
 bm.to_mesh(mesh);bm.free();mesh.update()
 return obj

def make_ground(code):
 mesh0=guide.data;faces=[]
 for p in mesh0.polygons:
  if mesh0.materials[p.material_index].name!='street':continue
  central=abs(p.center.x)<=7.001 and p.center.y<=6.001
  if central==(code=='Arena_Floor'):faces.append(p)
 used=sorted({i for p in faces for i in p.vertices});index={old:j for j,old in enumerate(used)}
 vs=[(mesh0.vertices[i].co.x,mesh0.vertices[i].co.y-9,mesh0.vertices[i].co.z) for i in used]
 fs=[[index[i] for i in p.vertices] for p in faces]
 # Topology-authored raised walkways join their corresponding original guide floor.
 raised_id='Arena_Walkway' if code=='Arena_Floor' else 'Street_Walkway'
 raised=next(item for item in PAYLOAD if item['id']==raised_id)
 offset=len(vs)
 vs.extend((v[0],v[1]-9,v[2]) for v in raised['vertices'])
 fs.extend([[offset+i for i in face] for face in raised['faces']])
 mesh=bpy.data.meshes.new(code+'_from_original_guide');mesh.from_pydata(vs,[],fs);mesh.update()
 obj=bpy.data.objects.new(code,mesh);bpy.context.collection.objects.link(obj);obj.location=(0,9,0)
 mesh.materials.append(atlas_material(code));uv=mesh.uv_layers.new(name='UVMap')
 for loop in mesh.loops:
  v=mesh.vertices[loop.vertex_index].co
  uv.data[loop.index].uv=(norm(v.x,-7,7),norm(v.y+9,-5,6)) if code=='Arena_Floor' else (norm(v.x,-20,20),norm(v.y+9,-5,23))
 return obj

objects=[make_ground('Street'),make_ground('Arena_Floor')]+[make_topology(item) for item in PAYLOAD if item['id'] in ('Stairs',*[f'B{i}' for i in range(1,10)])]
# Keep the original guide hidden; the Eevee setup is saved below.
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.hide_set(False);o.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
bpy.ops.export_scene.gltf(filepath=str(ROOT/'exports'/'combat_fight_arena_psx.glb'),export_format='GLB',use_selection=True,export_image_format='AUTO')
report={'object_count':len(objects),'objects':[]}
for o in objects:
 mesh=o.data;mesh.calc_loop_triangles()
 report['objects'].append({'name':o.name,'vertices':len(mesh.vertices),'faces':len(mesh.polygons),'triangles':len(mesh.loop_triangles),'atlas_pixels':list(masters[o.name.replace('Building_','')].node_tree.nodes.get('Image Texture').image.size)})
(ROOT/'reports'/'blender.json').write_text(json.dumps(report,indent=2))

# Eevee review lighting and camera are retained in the editable Blender scene.
scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE';scene.eevee.taa_render_samples=32;scene.eevee.use_gtao=True;scene.eevee.gtao_distance=2;scene.eevee.gtao_factor=1.15
scene.render.resolution_x=1400;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
world=bpy.data.worlds.new('warm overcast');world.color=(.18,.20,.20);scene.world=world
scene.view_settings.view_transform='Standard';scene.view_settings.look='Medium High Contrast'
scene.view_settings.exposure=0
def area(name,loc,power,size):
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size
 o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=loc
 o.rotation_euler=(Vector((0,8,2))-o.location).to_track_quat('-Z','Y').to_euler()
area('key',(-32,-28,43),7000,24);area('fill',(29,22,35),6500,22)
sun_data=bpy.data.lights.new('Late afternoon sun','SUN');sun_data.energy=2.0;sun_data.angle=.16
sun=bpy.data.objects.new('Late afternoon sun',sun_data);scene.collection.objects.link(sun);sun.rotation_euler=(.45,-.55,-.4)
camd=bpy.data.cameras.new('Review Camera');cam=bpy.data.objects.new('Review Camera',camd);scene.collection.objects.link(cam);scene.camera=cam;camd.type='ORTHO'
cam.location=(56,-65,52);cam.rotation_euler=(Vector((0,12,3.5))-cam.location).to_track_quat('-Z','Y').to_euler();camd.ortho_scale=62
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'source'/'combat_fight_arena_psx.blend'),compress=True)
def render(name,pos,target,scale):
 cam.location=pos;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();camd.ortho_scale=scale
 scene.render.filepath=str(ROOT/'previews'/name);bpy.ops.render.render(write_still=True)
render('map_isometric.png',(56,-65,52),(0,12,3.5),62)
render('map_top.png',(0,12,77),(0,12,0),52)
render('map_front.png',(0,-56,29),(0,12,4),54)
# Readable central-building review.
for o in objects:o.hide_render=o.name not in ('Building_B1','Stairs','Street','Arena_Floor')
render('b1_detail.png',(25,-21,20),(0,11,5),24)
for o in objects:o.hide_render=False
# Export visual checks: rear UVs, simple silhouette, then each house individually.
render('map_rear.png',(-52,65,44),(0,12,4),62)
clay=bpy.data.materials.new('Diagnostic clay');clay.diffuse_color=(.6,.6,.6,1)
scene.view_layers[0].material_override=clay
render('map_clay.png',(56,-65,52),(0,12,3.5),62)
scene.view_layers[0].material_override=None
scene.render.resolution_x=512;scene.render.resolution_y=512;scene.eevee.taa_render_samples=24
for o in objects:
 if not o.name.startswith('Building_'):continue
 for q in objects:q.hide_render=q!=o
 bounds=[o.matrix_world@Vector(c) for c in o.bound_box]
 target=sum(bounds,Vector())/8
 width=max(o.dimensions);distance=max(15,width*2)
 render(o.name+'.png',target+Vector((distance,-distance,distance*.7)),target,width*1.65)
for o in objects:o.hide_render=False
print('ASSEMBLED',len(objects),'objects',sum(x['triangles'] for x in report['objects']),'triangles',flush=True)
