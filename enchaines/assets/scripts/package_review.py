"""Build review contact sheets and compact current-delivery archive."""
from pathlib import Path
import json,zipfile
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1]
codes=['Arena_Floor','Street','Stairs']+[f'B{i}' for i in range(1,10)]
sheet=Image.new('RGB',(1600,1200),(224,222,211));draw=ImageDraw.Draw(sheet)
for i,code in enumerate(codes):
 im=Image.open(ROOT/'textures'/f'{code}_atlas.png').convert('RGB');x=i%4*400;y=i//4*400
 sheet.paste(im.resize((360,360),Image.Resampling.NEAREST),(x+20,y+28));draw.text((x+20,y+7),f'{code}: {im.width} x {im.height}',fill=(25,26,24))
sheet.save(ROOT/'previews'/'atlas_contact_sheet.png')
sheet=Image.new('RGB',(1536,1614),(224,222,211));draw=ImageDraw.Draw(sheet)
for i in range(9):
 x=i%3*512;y=i//3*538;im=Image.open(ROOT/'previews'/f'Building_B{i+1}.png').convert('RGB')
 sheet.paste(im,(x,y+26));draw.text((x+16,y+8),f'Building B{i+1}',fill=(25,26,24))
sheet.save(ROOT/'previews'/'houses_contact_sheet.png')
Image.open(ROOT/'previews'/'map_isometric.png').resize((179,128),Image.Resampling.LANCZOS).save(ROOT/'previews'/'map_icon_size.png')
audit=json.loads((ROOT/'reports'/'export_audit.json').read_text())
(ROOT/'manifest.json').write_text(json.dumps({'objects':audit['objects'],'triangles':audit['reimport_triangles'],'atlas_count':12,'render_engine':'BLENDER_EEVEE','background_objects':1,'background_triangles':12,'background_texture':'textures/Mountains_Sky_Backdrop.png','rear_extension_m':6,'street_walkway_width_m':.1,'arena_walkway_width_m':1,'walkway_height_m':.12},indent=2))
zip_path=ROOT/'exports'/'combat_fight_arena_psx_delivery.zip'
with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED) as z:
 for path in sorted(ROOT.rglob('*')):
  if path.is_file() and path.suffix not in ('.zip','.pyc','.blend1') and '__pycache__' not in path.parts:
   z.write(path,path.relative_to(ROOT))
with zipfile.ZipFile(zip_path) as z:assert z.testzip() is None
print('ZIP',zip_path.stat().st_size,'bytes')
print('WORKSPACE',sum(p.stat().st_size for p in ROOT.rglob('*') if p.is_file()),'bytes')
