# Combat Fight Arena — PSX temple courtyard map

## Input and scope

- Input: the user's `combatfightareatest.blend`, preserved as `source/original_guide.blend`.
- Guide mesh: one object, 65 polygons/130 triangles, with material-marked areas `street`, `stairs`, `b1`–`b9`.
- Output: one complete, metre-scale PSX-style arena scene with distinct objects and individual image textures for Arena_Floor, Street, Stairs, and Building_B1 through Building_B9.
- Keep the guide layout. Use simple added silhouettes and put screens, timber joints, roof tiles, plaster wear, stone joints and ornament into the textures.

## Art direction

- The supplied references show a red timber pavilion, stacked dark ceramic eaves, pale plaster walls, green-grey stone, stairs and a modular temple compound. Make an original stylized interpretation for this arena, not a copy of a pictured building.
- B1 is the central multistorey landmark with the guide's recessed stair bay. B2/B3 flank the front approach with stepped lean-tos. B4/B5 mark the side buildings. B6–B9 form a deeper rear row with B7 as the tall central hall; their original front line is retained and the backs extend to Y=29.
- Separate texture image for each finished object. The broad playable arena floor has its own 2048 px atlas, apart from the connecting streets. Each building's front, side, roof and base artwork receives a deliberate role. One material per object may use an atlas internally, but no atlas is shared between objects.
- Coordinate system: preserve the guide's XY placement, ground Z=0, front at negative Y. Original guide extent X -20..20, Y -5..23; finished rear buildings extend to Y=29.
- 10 cm wide raised pedestrian edges along 3 m streets, cut at cross-street joins. The arena has a 1 m wide raised edge with an opening at B1's stair approach.

## Production route

Building Topology for all added building/stair geometry; existing Blender mesh retained as guide and street substrate. Boneglass for limited-palette pixel art; Building Texturing for editable per-object atlases; Blender 3.5.1 for UV mapping, assembly, renders and GLB; Smart Topology Classifier for final audit.

## Acceptance

- [x] Nine B objects in the guide locations; Arena_Floor, Street and Stairs separately textured.
- [x] Added geometry simple; surface character painted in each object's image.
- [x] Source `.blend` preserved and finished `.blend` saved separately.
- [x] Front, top, isometric and small preview reviewed; atlas review included.
- [x] GLB reopened with all texture images and UVs.

## Roof variation pass

B1, B2, B6 and B9 have crosswise ridges; B3, B5 and B8 retain lengthwise ridges and lean-tos. B4 has a shallow green pyramid roof and B7 has a taller blue pyramid roof. Pyramid roofs have four sloping faces and broad tiled eaves. All objects retain their own baked atlas.
