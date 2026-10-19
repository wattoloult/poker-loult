"""Render combat-stage viewpoints from the delivered Eevee scene."""
from pathlib import Path
import bpy,math,json
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'source'/'combat_fight_arena_psx.blend'))
# Recreate the Topology-authored 2D background card, with its image packed.
old=bpy.data.objects.get('Backdrop_Mountains_Sky')
if old:bpy.data.objects.remove(old,do_unlink=True)
j=json.loads((ROOT/'handoff'/'backdrop_mesh.json').read_text())
mesh=bpy.data.meshes.new('Backdrop_card');mesh.from_pydata(j['vertices'],[],j['faces']);mesh.update()
obj=bpy.data.objects.new('Backdrop_Mountains_Sky',mesh);bpy.context.scene.collection.objects.link(obj)
uv=mesh.uv_layers.new(name='UVMap')
for loop in mesh.loops:
 p=mesh.vertices[loop.vertex_index].co;uv.data[loop.index].uv=((p.x+120)/240,(p.z+12)/80)
im=bpy.data.images.load(str(ROOT/'textures'/'Mountains_Sky_Backdrop.png'),check_existing=True);im.pack()
mat=bpy.data.materials.new('Mountains_Sky_unlit');mat.use_nodes=True;mat.shadow_method='NONE'
n=mat.node_tree.nodes;n.clear();out=n.new('ShaderNodeOutputMaterial');em=n.new('ShaderNodeEmission');tex=n.new('ShaderNodeTexImage');tex.image=im;tex.interpolation='Closest'
mat.node_tree.links.new(tex.outputs['Color'],em.inputs['Color']);em.inputs['Strength'].default_value=.85;mat.node_tree.links.new(em.outputs[0],out.inputs['Surface']);mesh.materials.append(mat)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'source'/'combat_fight_arena_psx.blend'),compress=True)
bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
bpy.ops.export_scene.gltf(filepath=str(ROOT/'exports'/'mountains_sky_backdrop.glb'),export_format='GLB',use_selection=True)
scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE';scene.eevee.taa_render_samples=32
scene.render.resolution_x=1920;scene.render.resolution_y=1080;scene.render.resolution_percentage=100
cam=scene.camera;cam.data.type='PERSP';cam.data.lens=22;cam.data.clip_start=.05;cam.data.clip_end=250
scene.render.image_settings.file_format='PNG'
def shot(name,pos,target,lens):
 cam.location=pos;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=lens
 scene.render.filepath=str(ROOT/'previews'/name);bpy.ops.render.render(write_still=True)
shot('arena_fighter_view.png',(0,-4.4,1.75),(0,9,1.8),16)
shot('arena_combat_stage.png',(0,-10,3.0),(0,8,3.3),20)
# Preserve a ready-to-render combat composition as a separate editable scene.
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'source'/'combat_stage_eevee.blend'),compress=True)
print('MARKETING RENDERS COMPLETE',flush=True)
