"""Reopen the delivered GLB and run the final mesh/texture audit."""
from pathlib import Path
import json,sys
import bpy,bmesh
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,'/home/nooraldin21/nooraldin_Workspace/blender_topology_addon/blender_topology_addon')
from smart_topology_classifier import audit,classify
expected=['Street','Arena_Floor','Stairs']+[f'Building_B{i}' for i in range(1,10)]
want_size={'Street':2048,'Arena_Floor':2048,'Stairs':1024,**{f'Building_B{i}':(2048 if i in (1,5,6,7) else 512 if i==8 else 1024) for i in range(1,10)}}
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'source'/'combat_fight_arena_psx.blend'))
objects={o.name:o for o in bpy.data.objects if o.type=='MESH'}
assert set(expected).issubset(objects)
assert 'Original_Guide' in objects and objects['Original_Guide'].hide_render
rows=[];image_names=[]
for name in expected:
 o=objects[name];mesh=o.data
 images=[n.image for m in mesh.materials if m and m.use_nodes for n in m.node_tree.nodes if n.type=='TEX_IMAGE' and n.image]
 assert len(images)==1 and list(images[0].size)==[want_size[name]]*2,(name,[list(i.size) for i in images])
 assert mesh.uv_layers,(name,'missing UV')
 image_names.append(images[0].name)
 bm=bmesh.new();bm.from_mesh(mesh);bm.normal_update()
 _,_,stats=classify.classify(bm,classify.Settings())
 findings=[{'level':v.level,'label':v.label,'count':v.count} for v in audit.report(bm,o.matrix_world) if v.count]
 rows.append({'name':name,'triangles':sum(len(f.verts)-2 for f in bm.faces),'components':len(audit.islands(bm)),'findings':findings,'atlas':[want_size[name]]*2})
 bm.free()
assert len(set(image_names))==len(expected),'atlases are shared between objects'
# Street and Arena_Floor are the original open ground faces; added Topology assets are closed.
for row in rows:
 if row['name'] not in ('Street','Arena_Floor'):
  assert not any(x['level']=='FAULT' for x in row['findings']),(row['name'],row['findings'])
report={'blender_version':bpy.app.version_string,'source_object_count':len(expected),'unique_atlas_count':len(set(image_names)),'objects':rows,'glb_bytes':(ROOT/'exports'/'combat_fight_arena_psx.glb').stat().st_size}
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'exports'/'combat_fight_arena_psx.glb'))
reopened={o.name:o for o in bpy.data.objects if o.type=='MESH'}
report['reimport_mesh_count']=len(reopened)
report['reimport_image_sizes']=sorted([list(i.size) for i in bpy.data.images if i.size[0]])
report['reimport_has_uv']=all(bool(o.data.uv_layers) for o in reopened.values())
report['reimport_triangles']=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in reopened.values())
(ROOT/'reports'/'export_audit.json').write_text(json.dumps(report,indent=2))
print('AUDIT',report['source_object_count'],'objects',report['unique_atlas_count'],'unique atlases',report['reimport_mesh_count'],'reimported',report['reimport_triangles'],'triangles',flush=True)
assert len(reopened)==len(expected) and report['reimport_has_uv']
