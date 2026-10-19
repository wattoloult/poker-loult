# Production status: Combat Fight Arena PSX

Completed locally: 2026-10-07 (Asia/Jerusalem). Free personal/commercial asset license selected; standalone redistribution prohibited. Marketing prepared locally; publication not requested.

Final scene: 12 mesh objects, 12 unique atlases, 7,444 exported triangles. Blender 3.5.1 Eevee camera and lights are saved in the finished scene. Original guide remains hidden in that scene and preserved separately.

## Changes and checks

- Buildings follow the guide's front positions, widths, recessed entry and height hierarchy. Rear row extends 6 m backwards at the user's request.
- Chinese-inspired pyramid roofs on B4 and B7; mixed ridge directions on the remaining buildings. Broad eaves and balconies retain simple geometry.
- Every object has its own atlas: arena/street/B1/B5/B6/B7 2048²; B2/B3/B4/B9/stairs 1024²; B8 512².
- Street bricks reduced to approximately 0.78 × 0.44 m. Raised street edges are 0.10 m wide; arena edges are 1 m wide, all 0.12 m high. Openings retained at the stairs and side-street joins.
- Fixed rear-wall UV projection, timber trim mapping, atlas subregion padding and a near-duplicate vertex join. Tile courses, timber colour, repairs and wear vary by building.
- Building Topology: all nine buildings, stairs and arena walkway pass its single-shell closure check. Street walkways consist of intentionally disconnected closed strips, so its single-shell check returns false.
- Smart Topology Classifier final Blender audit: no FAULT findings on added buildings or stairs. Open street/arena ground surfaces are intentional. Source n-gons are triangulated in GLB.
- GLB reopened in Blender 3.5.1: 12 meshes, 12 image atlases, UVs present, 7,444 triangles. See reports/export_audit.json.
- Eevee overview, top, front, rear, clay and individual house renders generated for review. Surface details remain baked into image textures.

## Reproduction commands

Run from /home/nooraldin21/nooraldin_Workspace/assetpack2. Tool APIs were executed locally; no automatic inter-app bridge is claimed.

```bash
PYTHONPATH=/home/nooraldin21/nooraldin_Workspace/building_topology_app/building_topology_app /home/nooraldin21/nooraldin_Workspace/topography_sim_Editor/.venv/bin/python packs/combat_fight_arena_psx/scripts/build_topology.py
/home/nooraldin21/nooraldin_Workspace/topography_sim_Editor/.venv/bin/python packs/combat_fight_arena_psx/scripts/make_art.py
PYTHONPATH=/home/nooraldin21/nooraldin_Workspace/building_texturing/building_texturing /home/nooraldin21/nooraldin_Workspace/topography_sim_Editor/.venv/bin/python packs/combat_fight_arena_psx/scripts/make_atlases.py
/home/nooraldin21/nooraldin_Workspace/vulbrg/test-results/portable/blender-3.5.1-linux-x64/blender --background --python-exit-code 1 --python packs/combat_fight_arena_psx/scripts/assemble_blender.py
/home/nooraldin21/nooraldin_Workspace/vulbrg/test-results/portable/blender-3.5.1-linux-x64/blender --background --python-exit-code 1 --python packs/combat_fight_arena_psx/scripts/validate_export.py
python3 packs/combat_fight_arena_psx/scripts/package_review.py
```

## Scope and storage

Static exterior art; no collision/gameplay or furnished interiors. Other engines untested. Windows are painted. Local tool paths must be adapted for another machine. Previous iteration retained locally in source/before_improvement.zip and omitted from current delivery ZIP. Native source artwork and models retained; no loose-file archival cleanup needed at this size. Size measurements are in reports/storage.json.

## Combat scene and free-pack marketing

Added two 1920 × 1080 arena-view Eevee renders and `source/combat_stage_eevee.blend`. Both Blender files contain a separate Topology-authored backdrop card with the generated mountain/sky image packed into the file. The 12-object environment GLB remains separate from `exports/mountains_sky_backdrop.glb`. The additional card has 12 triangles. `scripts/render_marketing.py` rebuilds the card and shots; run it after the main assembly script. `scripts/validate_marketing.py` checks both saved scenes and reimports the backdrop export.

User chose free personal/commercial use with no standalone redistribution. Terms are in LICENSE.txt. Copy-ready store fields, page article and local marketing preview are in marketing/. Backdrop provenance: generated with the built-in image tool from a request for a painted PSX Chinese mountain/sky panorama; 2172 × 724 PNG. No reference image was incorporated.
