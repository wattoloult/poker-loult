"""Diagnostic only: render Building Topology shell, no saved geometry edits."""
from pathlib import Path
import json,bpy
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
items=json.loads((ROOT/'handoff'/'topology_meshes.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
colors={'wall':(.51,.20,.15,1),'plaster':(.75,.72,.63,1),'roof':(.15,.20,.23,1),'trim':(.32,.14,.11,1),'stone':(.48,.48,.43,1)}
for item in items:
 mesh=bpy.data.meshes.new(item['id']);mesh.from_pydata(item['vertices'],[],item['faces']);mesh.update()
 obj=bpy.data.objects.new(item['id'],mesh);bpy.context.collection.objects.link(obj)
 for name,c in colors.items():
  mat=bpy.data.materials.get(name) or bpy.data.materials.new(name);mat.diffuse_color=c;mesh.materials.append(mat)
 for face,name in zip(mesh.polygons,item['materials']):face.material_index=list(colors).index(name)
scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE';scene.eevee.taa_render_samples=32
scene.render.resolution_x=1000;scene.render.resolution_y=760;scene.render.resolution_percentage=100
world=bpy.data.worlds.new('World');world.color=(.16,.16,.16);scene.world=world
ld=bpy.data.lights.new('Sun','SUN');lo=bpy.data.objects.new('Sun',ld);scene.collection.objects.link(lo);lo.rotation_euler=(.3,-.4,-.5);ld.energy=2.5
bpy.ops.mesh.primitive_plane_add(size=100,location=(0,9,-.025));ground=bpy.context.object;ground.name='Review ground'
mat=bpy.data.materials.new('ground');mat.diffuse_color=(.3,.32,.28,1);ground.data.materials.append(mat)
camd=bpy.data.cameras.new('Camera');cam=bpy.data.objects.new('Camera',camd);scene.collection.objects.link(cam);scene.camera=cam;camd.type='ORTHO'
cam.location=(32,-34,27);target=Vector((0,11,5));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();camd.ortho_scale=26 if len(items)==1 else 58
scene.render.filepath=str(ROOT/'previews'/'blockout.png');bpy.ops.render.render(write_still=True)
print('BLOCKOUT',len(items))
