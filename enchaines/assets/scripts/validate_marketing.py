from pathlib import Path
import bpy,json
ROOT=Path(__file__).resolve().parents[1];report={}
for name in ('combat_fight_arena_psx','combat_stage_eevee'):
 bpy.ops.wm.open_mainfile(filepath=str(ROOT/'source'/f'{name}.blend'))
 o=bpy.data.objects.get('Backdrop_Mountains_Sky');assert o and o.type=='MESH'
 images=[n.image for m in o.data.materials for n in m.node_tree.nodes if n.type=='TEX_IMAGE']
 assert len(images)==1 and images[0].packed_file
 assert bpy.context.scene.render.engine=='BLENDER_EEVEE'
 report[name]={'background_image':images[0].name,'image_size':list(images[0].size),'packed':True,'engine':bpy.context.scene.render.engine,'camera_type':bpy.context.scene.camera.data.type}
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'exports'/'mountains_sky_backdrop.glb'))
objs=[o for o in bpy.data.objects if o.type=='MESH'];assert len(objs)==1 and objs[0].data.uv_layers
report['backdrop_glb']={'objects':1,'triangles':sum(len(p.vertices)-2 for p in objs[0].data.polygons),'uv':True}
(ROOT/'reports'/'marketing_validation.json').write_text(json.dumps(report,indent=2))
print('MARKETING CHECK PASSED: two Eevee scenes, packed background, reopened backdrop GLB')
