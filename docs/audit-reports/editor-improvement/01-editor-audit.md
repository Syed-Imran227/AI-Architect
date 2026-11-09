# Milestone 2 — Phase 1: 2D Floor Plan Editor Audit

**Target System:** AI Architect 2D Floor Plan Studio  
**Date:** October 2026  
**Auditor:** AI Architect Core Engineering  
**Scope:** Frontend (`/editor`, `InteractiveBlueprint`, `CommandEngine`, `RoomEditor`, `RayonFloatingToolbar`, `ArchitecturalInspectorDrawer`, `FurnitureCatalogDrawer`), Backend (`canonical_model.py`, `bom_engine.py`, `cost_rates.py`), and test suites.

---

## 1. Editor Route and Main Editor Components

### Route Handler
- **Route:** `/editor` (defined in `frontend/src/App.tsx`, routed to `frontend/src/modules/editor/pages/Editor.tsx`).
- **URL Query Parameters Supported:**
  - `?project={id}`: Loads existing project archive from MongoDB backend via `getProjectById(id)`.
  - `?wizard=true`: Launches the multi-floor generation wizard modal.
  - `?mode={brief|2d|3d|analysis|compare}`: Direct deep linking into workspace modes.

### Main Editor Components
1. **`AtelierWorkspaceHeader.tsx` (`frontend/src/modules/editor/components/AtelierWorkspaceHeader.tsx`)**:
   - Manages top-level navigation, project renaming, save state indicator (`saved` / `saving` / `unsaved`).
   - Houses the mode switcher tabs: Architectural Brief (`brief`), 2D Drafting Sheet (`2d`), 3D Atelier Viewport (`3d`), Techno-Economic Analysis (`analysis`), and Variant Comparison (`compare`).
   - Multi-floor level selector dropdown (Level 01, Level 02, etc.).
   - Undo and Redo buttons bound to `commandEngineRef.current.canUndo()` / `canRedo()`.
   - Export dropdowns: DXF CAD, PDF Engineering Report, 2D SVG/PNG, 3D Render (1080p, 4K), Presentation Sheet.
   - Catalog toggle button for the furniture drawer.
2. **`InteractiveBlueprint.tsx` (`frontend/src/modules/editor/components/InteractiveBlueprint.tsx`)**:
   - The primary 2D vector CAD canvas (2,036 lines).
   - Renders SVG architectural blueprint over a tactile drafting sheet (`#FAF8F2`) with fine millimeter grid (`finegrid`) and coarse drafting grid (`coarsegrid`).
   - SVG `viewBox` dynamic calculation with continuous zoom (`onWheel`) and panning (middle mouse / canvas drag).
   - Dual-pass architectural rendering:
     - *Pass 1:* Exterior hatch cut line (`#hatch`), room floor fills (`getRoomStyle`), inner double-line wall markings, shaft voids (exterior open-to-sky vs. interior MEP chase), stair step treads & UP arrow, room typography & area labels, dimension strings with 45° CAD ticks, furniture symbols, and interactive transform handles.
     - *Pass 2:* Wall openings drawn on top (`DoorArcs` with swing deduplication via `doorAttributes.claims`, `WindowMarks` with glass pane & end ticks).
     - *Overlays:* Dynamic CAD alignment guides, north azimuth compass, 1:50 graphic scale bar, zone legend, circulation paths, and sunlight exposure heatmaps.
3. **`RayonFloatingToolbar.tsx` (`frontend/src/modules/editor/components/RayonFloatingToolbar.tsx`)**:
   - Docked floating toolbar at the bottom center of the canvas.
   - Tool mode toggle (`select` pointer vs `pan` hand).
   - Architectural layer visibility toggles: Dimension strings, Furniture items, Sunlight analysis, Circulation flow.
   - Zoom controls: Zoom In (`+15%`), Zoom Out (`-15%`), Zoom to Fit (`1.0x` centered).
   - Quick-switch pills for multi-floor levels (`L0 · Ground`, `L1 · First`, etc.).
4. **`ArchitecturalInspectorDrawer.tsx` (`frontend/src/modules/editor/components/ArchitecturalInspectorDrawer.tsx`)**:
   - Slide-out right panel providing deep property inspection.
   - When a room is selected: Embeds `RoomEditor.tsx` with numeric offset and dimension fields (X, Y, Width, Height), room reclassification, and AI natural-language room regeneration.
   - When furniture is selected: Shows placed item properties, rotation, elevation, dimensions, category, and removal action.
   - Sub-tabs: Room Dimensions, Regulatory Compliance (Vastu & NBC scoring and automatic fixes), and Copilot AI Chat Assistant.
5. **`FurnitureCatalogDrawer.tsx` (`frontend/src/modules/editor/components/FurnitureCatalogDrawer.tsx`)**:
   - Slide-out asset library containing 32 architectural furniture & lighting items.
   - Filter chips for categories: Living Room, Bedroom, Kitchen & Dining, Bathroom, Outdoor / Terrace, Lighting Fixtures.
   - Drag-and-drop into the canvas or single-click "Place in Selected Room".
   - 2D plan footprint and 3D miniature preview tabs.
6. **`FloorPlan3D.tsx` & `building3DGenerator.ts`**:
   - Three.js WebGL viewport rendering walls, floor slabs, ceiling openings, voids, doors, windows, and procedural furniture meshes derived from the canonical document.
7. **`AnalysisStudioView.tsx` (`frontend/src/modules/editor/components/AnalysisStudioView.tsx`)**:
   - Full-page analysis dashboard with Vastu compass breakdown, NBC clearance checks, solar exposure, energy rating, and client-side authoritative BOM with finish tier selection (`economy`, `standard`, `premium`, `luxury`).

---

## 2. Canonical Floor-Plan Data Model and Coordinate System

### Canonical Model (`CanonicalBuildingDocument`)
The single source of truth is defined in `frontend/src/modules/editor/geometry/types.ts`:
- **Units:** Strict SI metres ($m$).
- **Plot/Site:**
  ```typescript
  site: {
    width: number;       // plot width in metres
    length: number;      // plot length in metres
    orientation: number; // azimuth degrees (0 = North)
    entrySide: 'north' | 'south' | 'east' | 'west';
    setbacks: { front: number; rear: number; left: number; right: number };
  }
  ```
- **Levels (`Level[]`):**
  - `levelIndex`: 0-indexed integer (0 = Ground, 1 = First, etc.).
  - `elevation`: Height above ground ($m$).
  - `height`: Floor-to-ceiling clearance ($m$).
  - `slabThickness`: Floor slab thickness ($m$).
  - `nodes: WallNode[]`: Wall graph vertices `{ id, x, y }` in SI metres.
  - `walls: WallSegment[]`: Line segments connecting nodes `{ id, startNodeId, endNodeId, thickness, loadBearing, material }`.
  - `openings: Opening[]`: Doors and windows embedded on walls `{ id, wallId, type, offset, width, height, sillHeight }`.
  - `rooms: CanonicalRoom[]`: Closed boundary loops `{ id, name, boundaryNodeIds: string[], roomType, intendedUse, finishSchedule }`.
  - `items: PlacedItem[]`: Placed furniture/fixtures `{ id, assetId, name, x, y, elevation, rotation, width, depth, height, color, isLight, properties }`.

### 2D Drafting Coordinate System (UI Projection)
- **Units:** Imperial feet ($ft$) for traditional architectural readability.
- **Conversion Boundary:**
  - $1\text{ ft} = 0.3048\text{ m}$ (`ftToM`).
  - $1\text{ m} = \frac{1}{0.3048}\text{ ft} \approx 3.28084\text{ ft}$ (`mToFt`).
  - Coordinate conversions occur strictly at the command execution boundary and selector projection boundary (`canonicalToLegacyFloors`).
  - No internal floating "magic scale factors".

### Legacy Format (`LayoutData`)
- `floors: [{ level, name, rooms: [{ name, x, y, width, height, doors: [{ wall, position, width }], windows: [...], furniture: [...] }] }]`.
- Produced dynamically on-the-fly via pure selector `canonicalToLegacyFloors(doc)` for UI consumers, exporters, and backward-compatible backend endpoints.

---

## 3. Room Creation, Movement, Resizing, and Shared-Wall Constraints

### Shared-Wall Geometric Constraint Engine
- Defined in `frontend/src/modules/editor/geometry/layoutConstraints.ts`:
  - `propagateRoomBoundsWithSharedWalls(rooms, targetIdentifier, newBounds, plotWidth, plotHeight)`:
    - Finds the target room by identifier.
    - Validates minimum dimensions ($\ge 2.5\text{ ft}$).
    - Validates plot boundary containment $[0, \text{plotWidth}] \times [0, \text{plotHeight}]$.
    - Identifies all adjacent rooms sharing boundary walls within `SHARED_WALL_TOLERANCE_FT` ($0.5\text{ ft}$) and having collinear interval overlap ($\ge 0.5\text{ ft}$).
    - Synchronously shifts and resizes neighboring rooms along the shared axis:
      - *Right neighbor:* Left boundary shifts to target's new right edge; width adjusts accordingly.
      - *Left neighbor:* Right boundary shifts to target's new left edge; width adjusts.
      - *Bottom neighbor:* Top boundary shifts to target's new bottom edge; height adjusts.
      - *Top neighbor:* Bottom boundary shifts to target's new top edge; height adjusts.
    - Rejects mutations that would compress any neighboring room below $2.5\text{ ft}$.
    - Clamps openings (doors/windows) and contained furniture to new wall boundaries.
    - Runs `validateRoomPlacement` to ensure no illegal room overlaps or boundary escapes.

### Interactive Dragging in `InteractiveBlueprint.tsx`
- Edge drag handles (`top`, `bottom`, `left`, `right`) and vertex corner handles (`topLeft`, `topRight`, `bottomLeft`, `bottomRight`).
- Calculates live mouse delta `totalDx, totalDy`, snaps to $0.5\text{ ft}$ grid.
- Shows dynamic blue CAD alignment guidelines (`alignmentGuides`) when edges align with other rooms within $0.6\text{ ft}$.
- On pointer up: Dispatches `createUpdateFloorRoomsCommand(floorIndex, dragRooms)` to the authoritative `CommandEngine`.

---

## 4. Openings, Stairs, Shafts, and Furniture Placement

### Openings (Doors & Windows)
- **Doors:**
  - Placed on room boundary walls (`top`, `bottom`, `left`, `right`) at offset `position` with clear width `width` (typically $3.0\text{ ft}$).
  - `DoorArcs` draws $90^\circ$ swing arc with quarter-circle trajectory and wall opening paper gap.
  - Deduping mechanism: `doorAttributes.claims` map deduplicates door arcs on shared walls so duplicate arcs do not double-draw across adjacent rooms.
- **Windows:**
  - `WindowMarks` draws double-line architectural glazing symbol with outer boundary tick marks.
- **Staircase:**
  - Rooms named with `stair` or `staircase` render architectural tread lines and directional UP arrow.
- **Shafts:**
  - External lightwell: Rendered with sky-blue dashed border, diagonal CAD crosses, and skylight indicator.
  - Internal MEP chase: Rendered with slate mechanical hatching.

### Furniture Placement
- Placed items are positioned with `(x, y)` relative to the parent room origin.
- Placement via Catalog:
  - Drag-and-drop onto the SVG canvas converts screen pointer to SVG coordinates via `getSvgCoordinates`.
  - Locates the containing room bounding box.
  - Calculates relative coordinates, snaps to $0.5\text{ ft}$, constructs `PlacedItem`, and dispatches `createPlaceItemCommand`.
- Furniture Transform:
  - Selecting furniture displays bounding outline, 4 corner resize handles, and floating action pill with rotation ($\pm 45^\circ$, $90^\circ$), duplicate ($\$), and delete ($\times$).

---

## 5. Furniture Catalog and 2D-to-3D Object Associations

- 32 assets registered in `furnitureRegistry.ts`:
  - Living Room (8): 3-Seater Sofa, L-Shape Sectional, Accent Armchair, Coffee Table, TV Console Unit, Bookshelf, Floor Plant Pot, Living Rug.
  - Bedroom (6): King Size Bed, Queen Size Bed, Nightstand, Wardrobe 3-Door, Dressing Table, Bedroom Vanity.
  - Kitchen & Dining (7): 6-Seater Dining Table, 4-Seater Dining Table, Dining Chair, Kitchen Island Counter, Modular Cooking Range, Refrigerator, Kitchen Sink Unit.
  - Bathroom (5): Ceramic Water Closet / Toilet, Bathroom Vanity Sink, Bathtub, Shower Enclosure, Towel Rack.
  - Outdoor / Terrace (3): Outdoor Lounge Set, Planter Box, Patio Umbrella & Chairs.
  - Lighting Fixtures (3): Ceiling Recessed Downlight, Wall Sconce Lamp, Pendant Chandelier.
- Each asset specifies:
  - Exact dimensions (ft and m).
  - 2D footprint type (`rect`, `l_shape`, `circle`, `complex_cad`).
  - Detailed CAD 2D rendering in `renderDetailedFurniture`.
  - 3D representation: procedural mesh builder in `furniture3DMeshBuilder.tsx` or `building3DGenerator.ts`.
  - Unit cost in INR (`FURNITURE_PRICES_INR`).

---

## 6. Snapping, Measurements, Zoom, Pan, Selection, and Collision Constraints

- **Zoom:**
  - Wheel zoom factor $1.15\times$ / $0.85\times$, clamped between $0.4\times$ and $3.5\times$.
  - ViewBox scales relative to canvas center.
- **Pan:**
  - Middle-mouse button drag or canvas background drag.
- **Snapping:**
  - Snaps coordinates to $0.5\text{ ft}$ grid.
  - Snaps to neighboring room edges within $0.6\text{ ft}$, rendering visual alignment guide lines.
- **Measurements:**
  - Dimension lines rendered along top and left walls of rooms larger than $5\text{ ft}$.
  - Formatted in architectural cobalt (`#365FA8`) with 45° tick marks and numeric dimension labels.
- **Selection State:**
  - Selected room: Terracotta border (`#D85740`), dashed outline, edge handles for wall dragging, corner circles for vertex dragging.
  - Selected furniture: Cyan bounding box (`#0284c7`), corner resize handles, floating action toolbar.
- **Collision Constraints:**
  - `validateRoomPlacement` checks for room-on-room overlaps (minimum overlap tolerance $0.2\text{ ft}$) and containment within plot bounds.

---

## 7. Multi-Floor Editing and Floor Switching

- `activeFloorIndex` in `Editor.tsx` controls which level is currently active.
- `InteractiveBlueprint` receives `rooms={currentRooms}` and `floorIndex={activeFloorIndex}`.
- Rayon floating toolbar provides floor buttons (`L0 · Ground`, `L1 · First`, etc.).
- Commands specify `levelIndex` (e.g. `createUpdateFloorRoomsCommand(floorIndex, ...)`, `createPlaceItemCommand(floorIndex, ...)`).
- When switching floors:
  - Viewport remains focused on the plot.
  - Floor-specific rooms and furniture are loaded without affecting other levels.

---

## 8. Undo/Redo, Save/Load, Autosave, and Project Persistence

- **Authoritative Command Engine (`CommandEngine`):**
  - Maintains `CanonicalBuildingDocument`.
  - Executes commands, checks validity, pushes to `undoStack`, clears `redoStack`.
  - Undo pops command, applies `inverse` patch, pushes to `redoStack`.
  - Redo reapplies command `execute`.
- **Project Persistence:**
  - `saveProject(payload)` / `updateProject(id, payload)` stores the project in MongoDB.
  - Payload contains both `floors` (for legacy/dashboard) and `canonical` (`CanonicalBuildingDocument`).
  - Autosave: Debounced 1.5s background autosave triggers when changes occur (`saveStatus: 'unsaved' -> 'saving' -> 'saved'`).
  - Loading: Restores canonical document if present; otherwise runs `migrateLegacyToCanonical`.

---

## 9. BOM Calculations and Relationship to Canonical Geometry

- Client-side calculation in `frontend/src/modules/editor/geometry/bomCalculator.ts`:
  - Construction costs computed directly from room dimensions (area $\times$ structural rates) and wall perimeters (perimeter $\times$ 10ft ceiling $\times$ masonry/plaster rates).
  - Labour cost strictly calculated as 30% of construction materials.
  - Wet-wall plumbing infrastructure added for bathrooms, toilets, and kitchens.
  - Furniture costs summed from placed items mapped to `FURNITURE_PRICES_INR`.
  - Target budget overrun tracking and category breakdowns.
- Exact parity with backend `bom_engine.py` and `cost_rates.py`.
- Verified by 53 unit tests in `test_financial_bom_suite.ts`.

---

## 10. Audit Findings: Verified Defects vs. Architectural Opportunities

### Confirmed Defects (Requiring Immediate Fix)

1. **Defect 1: Canvas Pan Speed Mismatch (Arbitrary Magic Scale Factor)**
   - *Location:* `InteractiveBlueprint.tsx` line 1205.
   - *Code:* `const dx = (e.clientX - panStartRef.current.clientX) / (effectiveZoom * 18);`
   - *Issue:* The constant `18` is an arbitrary hardcoded pixel factor. The actual SVG viewBox-to-screen pixel ratio is `vbW / rect.width`. When panning, the canvas either lags or overshoots the mouse cursor depending on window width and monitor DPI.
   - *Evidence:* Tested by inspecting SVG client dimensions vs viewbox scaling.

2. **Defect 2: Furniture Trapped Inside Single Room During Dragging**
   - *Location:* `InteractiveBlueprint.tsx` lines 1194–1195.
   - *Code:*
     ```typescript
     const newX = Math.max(0, Math.min(Math.max(0, room.width - furn.width), draggingFurniture.origX + dx));
     const newY = Math.max(0, Math.min(Math.max(0, room.height - furn.height), draggingFurniture.origY + dy));
     ```
   - *Issue:* Furniture dragging clamps `(newX, newY)` strictly to the boundaries of the room where the drag originated. If a user tries to drag a piece of furniture into an adjoining room or corridor, the item hits an invisible boundary and cannot leave the room.
   - *Evidence:* Code inspection confirms strict clamping to `room.width` and `room.height` without cross-room re-parenting logic on pointer up.

3. **Defect 3: Unclamped Doors and Windows During Wall/Corner Resizing**
   - *Location:* `InteractiveBlueprint.tsx` lines 1237–1260 and 1426–1430.
   - *Issue:* When dragging a wall edge or corner, `targetRoom` and adjacent rooms have their width/height updated, but existing `doors` and `windows` positions are not checked or clamped to the new wall lengths in `dragRooms`. If a room is shrunk from 16ft to 10ft, a window previously at position 12ft remains at position 12ft — floating outside the room in empty space.
   - *Evidence:* `WindowMarks` lines 716–735 does not clamp `pos + ww` to `room.width` or `room.height`.

4. **Defect 4: Room Body Drag Shows "Grab/Grabbing" Cursor but Does Nothing**
   - *Location:* `InteractiveBlueprint.tsx` lines 1221–1223 & 1696.
   - *Code:*
     ```typescript
     if (!draggingEdge) {
       return; // Room box dragging disabled in favor of vertex/wall dragging
     }
     ```
   - *Issue:* Hovering over a room body displays `cursor: grab`, and clicking displays `cursor: grabbing`, but moving the mouse does nothing because room box dragging is explicitly bypassed. This confuses users who expect to be able to reposition unattached rooms or move detached spaces.
   - *Evidence:* Direct return statement in `handlePointerMove`.

5. **Defect 5: Stale Selection State on Floor Switching**
   - *Location:* `Editor.tsx` / `InteractiveBlueprint.tsx`.
   - *Issue:* When switching between floors (e.g. Ground Floor to First Floor), `selectedRoomIndex` and `selectedFurniture` state are not reset, causing the editor to select an arbitrary room or stale furniture index on the newly activated floor.
   - *Evidence:* `setActiveFloorIndex` does not clear `selectedRoomIndex` or `selectedFurnitureItem`.

6. **Defect 6: Catalog Drop Positioning Fallback to Room Index 0**
   - *Location:* `InteractiveBlueprint.tsx` lines 1056–1066.
   - *Issue:* When dropping a catalog item onto the canvas, if the mouse is near a wall or boundary, `targetRoomIdx` can evaluate to `-1`. The fallback selects `displayRooms[0]`, placing the item in the first room (e.g., Living Room) even if dropped over a Bedroom.
   - *Evidence:* `if (targetRoomIdx === -1) targetRoomIdx = 0;`

---

## Summary of Audit Phase 1

The editor has a solid architectural core:
- A versioned canonical building document (`CanonicalBuildingDocument`) with SI metre precision.
- A functional `CommandEngine` with reversible undo/redo.
- Deterministic BOM and financial calculation models matching the backend.
- Professional 1:50 drafting sheet aesthetics.

Fixing the confirmed interaction defects in coordinate transformation, cross-room furniture dragging, door/window wall containment, selection resetting, and dragging feedback will bring the editor to a high standard of architectural usability.
