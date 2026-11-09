# AI ARCHITECT — MILESTONE 4: 3D ARCHITECTURAL VISUALIZATION PIPELINE AUDIT
*Document: `docs/3d-visualization/01-audit.md`*  
*Timestamp: October 26, 2026*  
*Author: Antigravity Agent*

---

## 1. Executive Summary

Milestone 4 focuses on auditing and improving the 3D architectural visualization pipeline of AI Architect. The goal is to generate accurate, navigable, multi-floor 3D buildings from the canonical 2D floor-plan data with strict geometric correctness, architectural consistency, high performance, and preservation of all existing functionality.

This audit evaluates the end-to-end 3D subsystem:
1. **Canonical Building Document Schema & Migration**
2. **Pure 2D-to-3D Geometry Extrusion & Slicing (`building3DGenerator.ts`)**
3. **Multi-Floor Vertical Stacking, Elevations, Slabs, and Inter-Floor Stairs**
4. **Physical Openings (Doors, Windows, Sills, Lintels, Glazing, Entrance Portals)**
5. **Specialized Core Zones (Stairwells, Internal MEP Chases, External Glazed Lightwells, Lifts/Elevators)**
6. **High-Fidelity Parametric Furniture System (`furniture3DMeshBuilder.tsx` & `furnitureRegistry.ts`)**
7. **PBR Procedural Materials & Textures Pipeline (`architecturalMaterials.ts`)**
8. **Cinematic Environmental Lighting, Sun Trajectory, and Sky Rigs (`architecturalLighting.ts`)**
9. **Camera Framing, Presets, and Viewport Calibration**
10. **Interactive First-Person Walkthrough and Orbit Controls**
11. **Dashboard 3D Preview Modal & Cross-View Navigation (`Project3DPreviewModal.tsx` & `Editor.tsx`)**
12. **GPU Resource Lifecycle, WebGL Fallback, and Production Bundle Performance**

---

## 2. Detailed Subsystem Audit

### 2.1 Canonical Data Model & 2D-to-3D Conversion
- **Single Source of Truth**: The `CanonicalBuildingDocument` (schemaVersion: 1) in SI metres is the authoritative foundation. No secondary geometry representation exists.
- **Conversion Consistency**: `building3DGenerator.ts` converts SI metres to renderer feet via `METRES_TO_FEET = 3.28084`. The coordinate mapping is consistently:
  - 2D $X$ (metres) $\rightarrow$ 3D $X$ (feet)
  - 2D $Y$ (metres) $\rightarrow$ 3D $Z$ (feet)
  - Level Elevation (metres) $\rightarrow$ 3D $Y$ (feet)
- **Wall Thickness & Heights**:
  - Exterior/Parapet walls: 230 mm (9 in / 0.755 ft)
  - Interior/Partition walls: 115 mm (4.5 in / 0.377 ft)
  - Standard room height: 10.0 ft (3.048 m)
  - Slab thickness: 0.8 ft (0.244 m)
  - Parapet height: 3.5 ft (1.067 m)
  - Wall deduplication: Shared interior walls are represented once in the canonical wall graph, eliminating duplicated or overlapping meshes.
- **Physical Openings**: Wall openings physically cut solid wall segments into discrete solid chunks (`solidSegments`). Windows contain parametric sills and lintels with tempered glazing; doors have zero sill and full floor-to-lintel clearance.

### 2.2 Multi-Floor Vertical Alignment & Slabs
- **Elevation Formula**: Each level calculates its ground elevation via `level.elevation * METRES_TO_FEET` or `levelIndex * (ROOM_HEIGHT + SLAB_THICKNESS)`.
- **Slab Integrity**: Concrete floor slabs are generated per room footprint with visible dark edge trim and smooth plaster underside ceiling planes.
- **Shaft and Void Preservation**: Duplex voids, open lightwells, and MEP chases cleanly omit intermediate floor slabs, ensuring continuous vertical openings across stories.
- **Staircase Termination**: Staircases span accurately from lower landing to upper landing. Top-level terrace floors terminate ascending stairs cleanly without shooting into the sky.

### 2.3 Identified Defects & Missing Capabilities

| ID | Category | Severity | Description | Verified Impact |
|:---|:---|:---|:---|:---|
| **DEF-01** | **Navigation** | High | `Editor.tsx` ignores `?mode=3d` query parameter when opening from `Project3DPreviewModal.tsx`. | Clicking "Open in Studio 3D" in Dashboard preview modal leaves the editor in 2D blueprint mode instead of 3D. |
| **DEF-02** | **Geometry** | Medium | Missing specialized Lift / Elevator geometry in `building3DGenerator.ts` and `FloorPlan3D.tsx`. | Elevator rooms only render as generic rooms or shafts without lift cabin, landing doors, call indicators, or guide rails. |
| **DEF-03** | **Multi-Floor UI** | Medium | Missing fine-grained visibility toggles for building elements (Walls, Furniture, Openings, Structure, Roof). | Users cannot hide walls or roofs to inspect interiors or structural slabs independently. |
| **DEF-04** | **Interaction** | Medium | Walkthrough mode lacks interactive keyboard movement (WASD / Arrow keys) and collision-aware boundaries. | Walkthrough only repositions orbit camera rather than allowing free, collision-safe room navigation. |
| **DEF-05** | **Camera** | Low | Missing dedicated 'interior' camera preset. | Presets currently include perspective, isometric, topdown, front, side, exterior, but lack an instant eye-level interior viewpoint. |
| **DEF-06** | **Performance** | Medium | `FloorPlan3D` is statically imported into `Editor.tsx`, loading Three.js and 3D generators into the initial 2D editor bundle. | Initial editor chunk is inflated by ~924 kB before the user even activates 3D mode. |
| **DEF-07** | **Error Resilience**| Low | `ErrorBoundary` in `FloorPlan3D.tsx` lacks WebGL capability detection, retry action, and graceful 2D fallback. | If WebGL fails, the user is left with a static error message without recovery options. |
| **DEF-08** | **Test Discrepancy**| Medium | `test_multifloor_suite.ts` Test 8 fails assertion on `framing3D.targetLookAt.y === 5.0` due to Milestone B edit in `architecturalLighting.ts`. | Test expects target lookAt at grade Y=5.0 for isolated floor mode, while `architecturalLighting.ts` was set to raw elevation. |

---

## 3. Architecture & Implementation Plan

### Phase 2: Geometric Correctness & Lift Core Engine
- Add first-class `GeneratedLift3D` model to `building3DGenerator.ts`.
- Detect lift/elevator rooms and generate vertical shaft core, steel guide rails, counterweight column, elevator cabin with stainless steel/glass finishes, and landing doors on each floor.
- Resolve the targetLookAt elevation discrepancy in `architecturalLighting.ts` so both isolated-at-grade and elevated-in-stack framing work deterministically across all test suites.

### Phase 3: Multi-Floor Presentation & Element Visibility Controls
- Implement presentation visibility state:
  - `showWalls` (boolean)
  - `showFurniture` (boolean)
  - `showOpenings` (boolean)
  - `showStructure` (boolean)
  - `showRoof` (boolean)
- Implement 3D floor elevation markers and badges in the 3D viewport (e.g. `+0.00'`, `+10.83'`, `+21.65'`).
- Ensure all visibility filters are purely projective and do not mutate the canonical document.

### Phase 4: Materials, Finishes & Interior Camera Presets
- Add 'interior' camera preset to `architecturalLighting.ts` and `FloorPlan3D.tsx`.
- Enable quick floor and wall finish tier presets (Wood, Tile, Marble, Concrete) in the 3D viewer.
- Provide clean loading, empty layout, and WebGL capability detection with retry mechanism.

### Phase 5: Collision-Aware Interactive First-Person Walkthrough
- Implement true keyboard-driven (WASD / Arrow keys) first-person walkthrough controller.
- Keep eye-level camera height fixed at 5.5 ft above the active floor elevation.
- Add collision clamping against room bounding polygons and wall lines so the user cannot clip through exterior walls.
- Fix navigation from `Project3DPreviewModal` into `Editor.tsx` with `mode=3d`.

### Phase 6: Code Splitting & Performance Optimization
- Lazy-load `FloorPlan3D` in `Editor.tsx` using `React.lazy()` with `<Suspense>`.
- Keep Three.js out of the initial 2D editor chunk.
- Measure and record production bundle sizes before and after optimization.

### Phase 7 & 8: Comprehensive Regression Testing & Final Report
- Implement deterministic unit tests in `frontend/src/modules/editor/geometry/test_3d_visualization_suite.ts`.
- Verify all single-floor, multi-floor, lift core, exploded view, visibility toggles, walkthrough collision, and bundle size requirements.
- Run the full suite of frontend and backend regression tests.
- Compile `docs/3d-visualization/02-final-report.md`.
