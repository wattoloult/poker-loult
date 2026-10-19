# Combat Fight Arena PSX

One textured East Asian inspired courtyard map built from the user's labelled Blender guide. The guide's `b1`–`b9`, `stairs`, and `street` labels set the layout. The guide is preserved in `source/original_guide.blend`; the root input file was not changed.

## Contents

- `source/combat_fight_arena_psx.blend`: editable Blender 3.5.1 scene with Eevee lighting, a review camera, and the original guide hidden.
- `exports/combat_fight_arena_psx.glb`: 12 textured objects, ready for inspection or import.
- `source/*.btop` and `source/*.btex`: editable Building Topology and Building Texturing sources.
- `textures/*_atlas.png`: one baked atlas for each object. `textures/` also contains the editable painted source regions.
- `previews/`: scene views, a clay view, individual house renders, a small readability view, and contact sheets.
- `reports/`: topology, texture, Blender, and GLB reimport checks.

## Object and atlas manifest

| Object | Guide role | Atlas |
|---|---|---:|
| Arena_Floor | 14 × 11 m fighting court, 1 m raised pedestrian ring | 2048² |
| Street | Connecting streets, 10 cm raised edges on 3 m corridors | 2048² |
| Stairs | Central 2 m rise | 1024² |
| Building_B1 | 9 m hall with recessed stair bay and balconies | 2048² |
| Building_B2 | Stepped right front hall and lean-to | 1024² |
| Building_B3 | Stepped left front hall and lean-to | 1024² |
| Building_B4 | Low aged side building | 1024² |
| Building_B5 | Two-level side hall with balcony | 2048² |
| Building_B6 | Tall rear hall | 2048² |
| Building_B7 | Rear upper hall with balcony | 2048² |
| Building_B8 | Small rear lean-to | 512² |
| Building_B9 | Weathered rear building | 1024² |

All windows and ornament are painted. The map has no furnished interiors, collision meshes, rigs, or gameplay logic. Street and arena ground surfaces are intentionally open planes; their raised walkways are solid geometry.

## Regenerate

From this repository root, use the Python environment containing each tool and set `PYTHONPATH` to its local source package. Run `scripts/build_topology.py`, `scripts/make_art.py`, `scripts/make_atlases.py`, `scripts/assemble_blender.py`, then `scripts/validate_export.py`, in that order. The exact tested commands are in `STATUS.md`. Keep the original guide and all `.btop`/`.btex` files for edits. The Blender assembly step welds sub-millimetre join vertices after UV assignment.

Reference provenance: the user supplied the Blender guide and visual reference images in the conversation. The textures and geometry are original interpretations of those references; no reference image is embedded in the pack.

The rear row extends 6 m behind the original guide, making the building footprint approximately 40 × 34 m before roof overhangs. The arena edge is cut at the stair approach; street curbs are cut at the side-street joins. `source/before_improvement.zip` preserves the preceding scene, texture art and scripts.

Final roof variety: four gables use crosswise ridges; three buildings retain lengthwise gables and lean-tos; B4 and B7 have Chinese-inspired four-sided pyramid roofs. Roof tile courses, timber trim UVs and rear facades were corrected in the improvement pass.

## Combat views and background

Open `source/combat_stage_eevee.blend` for the combat-stage camera. Both Blender scenes contain a packed 2172 × 724 painted mountain-and-sky image on a separate background card. The main map GLB contains the 12 environment objects; `exports/mountains_sky_backdrop.glb` supplies the optional backdrop separately. Run `scripts/render_marketing.py` after assembly to recreate the card and combat views. The backdrop artwork was generated with an image model.

Free personal/commercial use with no standalone asset redistribution: see `LICENSE.txt`. Store copy and a local listing preview are in `marketing/`.
