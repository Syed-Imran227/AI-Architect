# AI Architect — Full Project Repair, Spatial Editor Overhaul & UI Transformation
## Phase 0: Baseline Repair Audit & Root Cause Analysis

**Audit Date:** October 2026  
**Repository:** `AI-Architect`  
**Active Environment Baseline:**
- **Database Provider:** `mongodb` (Active & Authoritative)
- **Authentication Provider:** `jwt` (Active & Authoritative)
- **Supabase Integration Status:** Client & verifier implemented offline; live database cutover unactivated (preserved per invariant)
- **Backend Test Status:** 125/125 unit tests passing (`unittest`)
- **Frontend Build Status:** Vite v8.0.10 production build passing (`tsc -b && vite build` in 1.53s, 0 errors)

---

## 1. Project Structure & Architecture Discovery

### 1.1 Architecture Overview & Technology Stack
```
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 19 + Vite)                     │
│  - Router: React Router v7 (/dashboard, /editor, /login, /register)   │
│  - 2D Drafting Sheet: InteractiveBlueprint (SVG CAD renderer)          │
│  - 3D Viewport: FloorPlan3D (@react-three/fiber + Three.js r185)       │
│  - Single Canonical Document: CanonicalBuildingDocument (Metres/SI)   │
│  - Command Pattern: CommandEngine (reversible undo/redo patches)       │
│  - Projections: canonicalToLegacyFloors (Feet) for 2D/3D compatibility │
└───────────────────▲────────────────────────────────┬───────────────────┘
                    │ HTTP REST (JSON)               │
                    ▼                                ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│       BACKEND (FastAPI / Python)     │  │       PERSISTENCE LAYER      │
│  - Routers: /projects, /generate,    │  │  - Active: MongoDB (Motor)   │
│    /auth, /export, /agent            │  │  - Active Auth: Local JWT    │
│  - Engines: intelligent_generator,   │  │  - Staging Ready: Supabase   │
│    bom_engine, vastu_engine,         │  │    PostgREST + UUID Bridge   │
│    nbc_engine, sunlight_engine       │  │    (Safety gate unactivated) │
└──────────────────────────────────────┘  └──────────────────────────────┘
```

### 1.2 Core Repository Inventory
| Subsystem | Key Files | Purpose & Architectural Role | Status |
| :--- | :--- | :--- | :--- |
| **Frontend Shell & Routing** | `frontend/src/App.tsx`<br>`frontend/src/main.tsx` | App routing, auth protection, global toast notifications | Working |
| **Dashboard** | `frontend/src/modules/dashboard/pages/Dashboard.tsx`<br>`SelfDrawingBlueprint.tsx` | Project listing, quick generation prompt, project creation | Needs AIHom UI & Financial Transformation |
| **2D Blueprint Editor** | `frontend/src/modules/editor/components/InteractiveBlueprint.tsx`<br>`RoomEditor.tsx`<br>`layoutConstraints.ts` | SVG CAD drafting sheet, room polygons, dimension labels, shared wall dragging | Partially Working (Buggy room resizing & preview shadowing) |
| **Furniture System** | `frontend/src/modules/editor/components/FurnitureCatalogDrawer.tsx`<br>`furnitureRegistry.ts`<br>`furnitureCatalog.ts`<br>`furniture3DMeshBuilder.tsx` | 32 architectural furniture assets, procedural 3D models, catalog drawer | Partially Working (Placement toast succeeds but items invisible due to preview shadowing & coordinate offset) |
| **3D Engine** | `frontend/src/modules/editor/components/FloorPlan3D.tsx`<br>`building3DGenerator.ts`<br>`architecturalLighting.ts`<br>`architecturalMaterials.ts` | Procedural watertight 3D walls, slabs, stairs, lighting, OrbitControls, materials | Working but visually cramped; shafts identical |
| **Geometry & Commands** | `frontend/src/modules/editor/geometry/commands.ts`<br>`commandEngine.ts`<br>`selectors.ts`<br>`validators.ts`<br>`migration.ts` | Single source of truth (CanonicalBuildingDocument), command pattern, undo/redo | Working (Strong algorithmic core) |
| **Financial / BOM** | `backend/engines/bom_engine.py`<br>`cost_rates.py`<br>`frontend/.../AnalysisStudioView.tsx`<br>`ComplianceSidebar.tsx` | Bill of materials, rate calculations, room construction costs | Outdated / Disconnected (Ignores furniture, absent from dashboard) |
| **Backend & Persistence** | `backend/main.py`<br>`backend/routers/projects_routes.py`<br>`backend/db/database.py`<br>`backend/db/repositories.py` | FastAPI application, project CRUD, MongoDB motor collections | Working |
| **Supabase Layer** | `backend/db/supabase_client.py`<br>`backend/core/auth.py`<br>`backend/core/identity_bridge.py` | Supabase config validation, PostgREST client, RS256/HS256 verifier | Configured & Validated Offline (Unactivated) |

---

## 2. Confirmed Bugs vs. Suspected Bugs & Exact Root Causes

### Bug 1: Furniture Placement Data-Flow Bug (Phase 3)
- **Observed Behavior:** User clicks "Add" on a catalog item or drags furniture onto the blueprint. A toast appears ("Placed 3-Seater Sofa in Living Room"), but the furniture is NOT visible on the 2D blueprint or 3D scene, and does not persist on reload.
- **Status:** **CONFIRMED BUG**
- **Exact Root Cause:**
  1. **The Preview Shadowing Trap in `Editor.tsx`:** When a plan is generated (via `generatePlans` or `generateMultiFloorPlans`), `Editor.tsx` executes `setPreviewPlan(newPlans[0])`. While `previewPlan` is set, `effectiveFloors` (lines 961–979) and `effectiveCanonicalDoc` (lines 982–1012) strictly return `previewPlan.layout.floors` and `previewPlan.canonicalDocument`. When the user adds furniture, `executeGeometryCommand` modifies `commandEngineRef.current` and calls `setActivePlan(...)`, but **never clears or updates `previewPlan`**. Consequently, `currentRooms` and `effectiveCanonicalDoc` fed to `InteractiveBlueprint` and `FloorPlan3D` remain locked to the unmutated `previewPlan`.
  2. **Auto-save Invalidation:** Line 914 of `Editor.tsx` explicitly checks `!previewPlan` before allowing auto-save. Because `previewPlan` is non-null, auto-save never fires for any furniture added in preview mode.
  3. **Accept Plan Wipe:** When the user clicks "Accept Plan", `handleAcceptPlan` applies the original unedited candidate from `previewPlan`, wiping any commands executed in the CommandEngine.
  4. **3D Coordinate Center Offset:** `building3DGenerator.ts` converts top-left meters `item.x, item.y` into `positionFt.x, positionFt.z`. In `furniture3DMeshBuilder.tsx`, Three.js procedural meshes (e.g. `<Box args={[fw, fh, fd]}>`) are centered at origin `(0, 0, 0)`, causing the 3D model to be offset by `(+width/2, +depth/2)` from its true 2D footprint.

---

### Bug 2: 2D Blueprint Room Resizing & Dimension Inconsistency (Phase 2)
- **Observed Behavior:** Users cannot reliably resize rooms or walls. Resizing either snaps back, shows validation errors, or fails to update neighboring rooms and area calculations.
- **Status:** **CONFIRMED BUG**
- **Exact Root Cause:**
  1. **Unconstrained Wall Dragging in `InteractiveBlueprint.tsx`:** In lines 1302–1324, `InteractiveBlueprint.tsx` checks `Math.abs(origR.x - sharedX) <= EPSILON` without checking whether rooms share vertical or horizontal overlap (`intervalsOverlap`). As a result, non-adjacent rooms along the same axis get shifted indiscriminately. When a room width falls below 2ft, it shifts `r.x -= (2 - r.width)`, causing geometric overlap that triggers `validateRoomPlacement` rejection upon mouse release.
  2. **RoomEditor Discards Propagated Shared Walls:** In `RoomEditor.tsx` (lines 67–78), `propagateRoomBoundsWithSharedWalls` successfully computes updated boundaries for all adjacent rooms (`res.rooms`), but line 78 only invokes `onRoomUpdate(index, local)`, discarding all neighboring wall adjustments.
  3. **Preview Shadowing Again:** Just like furniture, any room bounds command dispatched while `previewPlan` is non-null is shadowed in the UI.

---

### Bug 3: Internal vs. External Shafts (Phase 4)
- **Observed Behavior:** In 3D, internal shafts and external shafts look 100% identical. The external shaft does not function as a true architectural envelope lightwell/ventilation shaft.
- **Status:** **CONFIRMED BUG**
- **Exact Root Cause:**
  1. **Identical 3D Rendering:** In `FloorPlan3D.tsx` (lines 580–607), both internal and external shafts are rendered using the exact same four 0.12ft grey curb boxes (`#475569`) flat on the floor slab. Only a small text label differs: `(INTERIOR CHASE)` vs `(EXTERIOR SHAFT)`.
  2. **Missing Floor Slab Penetration:** Neither shaft cuts through intermediate floor slabs properly; floor slabs cap the shafts vertically.
  3. **No Architectural Envelope Interface:** External shafts do not have exterior wall openings, weather louvers, or railing recesses, and internal shafts lack fire-rated partition walls and MEP service markers.
  4. **2D Representation:** `InteractiveBlueprint.tsx` renders shafts like generic rooms rather than standard CAD void symbols (diagonal cross hatching with clear technical labeling).

---

### Bug 4: 3D Viewport Compact, Cramped & Distant (Phase 5)
- **Observed Behavior:** The 3D house appears tiny and cramped in the middle of a dark viewport, requiring excessive manual zoom and orbit manipulation.
- **Status:** **CONFIRMED BUG**
- **Exact Root Cause:**
  1. **Oversized Fit Distance in `architecturalLighting.ts`:** `calculateCameraFraming` applies an aggressive trigonometric distance `fitDistance = (effectiveDim / 2) / tan(22.5°) * 1.25`, resulting in a camera placed 80–110 ft away from a 30–40 ft residence.
  2. **Camera FOV & Missing Framing Modes:** Canvas default FOV is 45° with fixed OrbitControls distance limits up to 3000 ft. There is no automated "Zoom to Selected Room", "Focus on Selected Furniture", or "Fit to Building" button.
  3. **Flat Ambient Lighting & Uniform Concrete Slabs:** Room interiors lack distinct flooring finishes (marble, oak parquet, tiles) in 3D, causing the interior spaces to blend together into a cramped, dark volume.

---

### Bug 5: Financial / Budget Section Outdated & Incomplete (Phase 8 / Milestone C)
- **Observed Behavior:** The financial dashboard cards were missing from the Dashboard page. In the Editor, the BOM breakdown ignored all placed furniture items.
- **Status:** **VERIFIED FIXED (Milestone C)**
- **Resolution Summary:**
  1. **Unified Authoritative Financial Model:** `backend/engines/bom_engine.py`, `backend/engines/cost_rates.py`, and `frontend/src/modules/editor/geometry/bomCalculator.ts` implement the identical deterministic CPWD / Indian market rate baseline (2026).
  2. **Construction + Labour Separation:** Standard 30% labour ratio is strictly applied to physical masonry, RCC, finishes, and openings, while retail manufactured furniture items are procured separately without artificial labour markup.
  3. **Placed Furniture Integration:** All 32 catalog items mapped to authoritative pricing. Moving or rotating items does not alter costs (invariance verified). Placed instances are tracked by unique ID; duplicates correctly increment quantity and total; deletions decrement costs. Missing/unlisted items report `is_available: false` and `unit_price: null` without fabricating numbers.
  4. **Target Budget & Overrun Math:** Persisted `budget_target` field across projects, editor auto-save, and API routes. Calculates remaining budget, overrun amount, consumption percentage, and triggers clear visual alert ribbons (`#D85740` / `#ef4444`) when total exceeds target.
  5. **Editor & Dashboard Consistency:** `ComplianceSidebar.tsx`, `AnalysisStudioView.tsx`, and `Dashboard.tsx` consume the identical calculation outputs. Dashboard displays Portfolio Valuation (`₹...`) and Budget Alerts in the top metrics ribbon, plus itemized cost and overrun badges with direct links to the Financial Studio.
  6. **Test Verification:** 53/53 TypeScript tests passing (`test_financial_bom_suite.ts`); 9/9 Python unit tests passing (`test_bom_financial_engine.py`); 0 build errors (`npm run build`).

---

### Bug 6: Dashboard Visual Direction Needs AIHom Polish (Phase 6)
- **Observed Behavior:** Current dashboard uses a basic dark theme with an SVG grid pattern, lacking the cinematic depth, subtle architectural outlines, smooth transitions, and premium aesthetic demonstrated by [aihom.ai](https://www.aihom.ai/home).
- **Status:** **CONFIRMED REDESIGN REQUIREMENT**

---

## 3. Phase 1 — Supabase & Backend Connection Status Audit

Per strict user rules and safety boundaries:
- **Active Database Provider:** `mongodb` (using Motor async client)
- **Active Auth Provider:** `jwt` (using passlib bcrypt + pyjwt)
- **Supabase Real Connection Status:**
  - `SUPABASE_URL` & Publishable Key: Present in `.env` / `.env.example`.
  - Client Driver (`supabase_client.py`): Initialized and tested offline.
  - Verification Keys: Public RSA PEM & Keyring JSON verification validated offline.
  - Active Connection: **NOT connected to live Supabase database or auth**. No live SQL, collections, migrations, or network calls have been performed.
  - **Verdict:** `Supabase configured in code but not used by running application`. MongoDB/JWT remains the 100% active operational system.

---

## 4. Planned Fixes & Implementation Milestones

```mermaid
graph TD
    M0[Phase 0: Baseline Audit & User Alignment] --> M1[Phase 1: Backend & Supabase Safety Check]
    M1 --> M2[Phase 2: 2D Blueprint Editor Overhaul]
    M2 --> M3[Phase 3: Furniture Placement Lifecycle Repair]
    M3 --> M4[Phase 4: Internal vs External Shafts Overhaul]
    M4 --> M5[Phase 5: 3D Viewport Spacious Transformation]
    M5 --> M6[Phase 8: Financial / BOM Engine & Cost Integration]
    M6 --> M7[Phase 6 & 7: Premium Dashboard Redesign AIHom & Coohom]
    M7 --> M8[Phase 9 & 10: State Persistence & Regression Verification]
```

### Milestone Details & Files Expected to Change

#### Milestone A: 2D Blueprint Editor & Furniture Placement Repair (Phases 2 & 3)
- **Target Files:**
  - `frontend/src/modules/editor/pages/Editor.tsx`: Remove the `previewPlan` shadowing defect. When a candidate plan is generated, initialize it into `commandEngineRef` and `activePlan` immediately or synchronize `previewPlan` bidirectionally so furniture and geometry commands update the active canvas and enable auto-save.
  - `frontend/src/modules/editor/components/InteractiveBlueprint.tsx`: Fix wall drag propagation to strictly respect orthogonal overlap (`intervalsOverlap`); prevent non-adjacent room shifting; fix catalog drop event selection timing. Add visible dimension tags, direct numerical inputs, and grid snapping guides.
  - `frontend/src/modules/editor/components/RoomEditor.tsx`: Ensure `handleApply` passes the complete propagated room set (`res.rooms`) to `onLayoutUpdate` and CommandEngine.
  - `frontend/src/modules/editor/geometry/building3DGenerator.ts` & `furniture3DMeshBuilder.tsx`: Correct center-aligned coordinate mapping (`posX + widthFt / 2`, `posZ + depthFt / 2`) so 3D meshes align with 2D bounds.
  - `frontend/src/modules/editor/constants/furnitureCatalog.ts` & `furnitureRegistry.ts`: Add realistic INR unit costs and material finish specifications to all 32 furniture assets.

#### Milestone B: Shaft Semantics & 3D Spatial Transformation (Phases 4 & 5)
- **Target Files:**
  - `frontend/src/modules/editor/geometry/types.ts` & `building3DGenerator.ts`: Model internal shafts (`isInteriorShaft`) and external shafts (`isExteriorShaft`) with explicit architectural properties, floor slab penetrations, and vertical continuity.
  - `frontend/src/modules/editor/components/InteractiveBlueprint.tsx`: Render CAD diagonal cross-hatch symbols for internal MEP shafts and dashed perimeter with wall openings for exterior lightwells.
  - `frontend/src/modules/editor/components/FloorPlan3D.tsx` & `architecturalLighting.ts`:
    - Recalibrate `calculateCameraFraming` with a spacious, generous framing multiplier (reducing distance from 85ft to 42–48ft for typical plots, keeping building dominant without edge clipping).
    - Add "Zoom to Selected Room", "Focus on Furniture", and "Reset Camera" actions.
    - Render distinct 3D geometry for external shafts (exterior louvers, recessed envelope, open sky cutaway) vs internal shafts (fire-rated partition enclosure, service access panels).
    - Add cutaway wall height toggle (Full 10ft, NBC Sill 4.5ft, Floor Slab 0.5ft).

#### Milestone C: Financial / Budget Section Integration (Phase 8)
- **Target Files:**
  - `backend/engines/bom_engine.py` & `cost_rates.py`: Extend `compute_bom` to aggregate placed furniture line items (item name, quantity, unit cost, category total) into the project BOM summary alongside structural, masonry, and finishing costs.
  - `frontend/src/modules/editor/components/AnalysisStudioView.tsx` & `ComplianceSidebar.tsx`: Add itemized furniture & fixture bill of materials, user-configurable budget threshold, and cost-variance indicators.
  - `frontend/src/modules/dashboard/pages/Dashboard.tsx`: Add a dedicated financial summary card showing total estimated construction cost, furniture allowance, and cost per square foot for recent projects.

#### Milestone D: Premium AIHom-Inspired Dashboard Redesign (Phase 6 & 7)
- **Target Files:**
  - `frontend/src/modules/dashboard/pages/Dashboard.tsx`:
    - Redesign with cinematic architectural depth, restrained ambient glows, refined typography (`Newsreader` serif + `Plus Jakarta Sans`), and subtle animated wireframe layering.
    - Integrated Project Cards with interactive 2D blueprint thumbnail, 3D preview toggle, BOM cost badge, and direct edit/export actions.
    - Active project quick-resume bar and recent activity log.
    - Fully accessible, respecting `prefers-reduced-motion`.

#### Milestone E: End-to-End Testing & Verification (Phases 9, 10, 11, 12)
- Run complete test suite:
  - 125 backend unit tests (`unittest`).
  - Frontend TypeScript build (`tsc -b && vite build`).
  - Frontend geometry and furniture suites (`test_geometry_suite.ts`, `test_furniture_suite.ts`, `test_building_3d_suite.ts`).
  - Add comprehensive regression tests for room resizing, furniture add/move/delete/reload, and shaft distinctions.
  - Capture runtime evidence and produce final handover report `docs/ai_architect_repair_report.md`.

---

## 5. Missing Information & Clarifications for the User

Per instruction 0.2, the following clarifications ensure complete alignment before beginning implementation:

1. **External Shaft Architectural Behavior:**
   - **User Confirmed Specification:** Enclosed lightwell shaft within the building footprint with interior-facing windows, open continuous vertical shaft spanning floors, open to sky, while internal shafts represent enclosed MEP plumbing/duct chases.
2. **Dashboard & Project Financial Model Scope:**
   - **User Confirmed Specification:** Include both construction costs and itemized furniture costs with an editable target budget limit and overrun alert on both Editor BOM views and Dashboard overview.
3. **Candidate Plan Preview Mode vs. Direct Editing:**
   - **User Confirmed Specification:** Make newly generated plans immediately editable and auto-saving in the active canvas, removing the read-only preview barrier that caused UI shadowing and prevented furniture/room persistence.

---

## 6. Audit Verdict & Phase Milestones

### Milestone A: 2D Room Resizing & Furniture Placement Lifecycle Repair — COMPLETED & VERIFIED
- **Date Completed:** October 2026
- **Tasks Implemented:**
  1. **Task 1 — Furniture State Shadowing Fixed (`Editor.tsx`):**
     - Made newly generated plans immediately editable and active (`openPlan(newPlans[0])`, `setPreviewPlan(null)`).
     - Auto-promoted any active preview candidate into `commandEngineRef.current` and `activePlan` upon geometry or furniture editing commands.
     - Lifted `effectiveFloors` and `effectivePlan` definitions so all callbacks resolve the active layout without variable shadowing or hoisting errors.
     - Uninhibited auto-save for newly generated and edited plans.
  2. **Task 2 — Furniture Placement End-to-End & Coordinate Alignment (`furniture3DMeshBuilder.tsx`, `FloorPlan3D.tsx`):**
     - Corrected Three.js procedural group placement: centered at `[wx + fw / 2, wy, wz + fd / 2]`, aligning the 3D model center exactly with its 2D footprint center `(room.x + furn.x + fw / 2, room.y + furn.y + fd / 2)`.
     - Centered the selection cage in `FloorPlan3D.tsx` over `[item.positionFt.x + item.dimensionsFt.width / 2, item.positionFt.y + item.dimensionsFt.height / 2, item.positionFt.z + item.dimensionsFt.depth / 2]`.
     - Preserved `positionFt` in `GeneratedFurniture3D` without introducing secondary scale factors or breaking existing tests.
  3. **Task 3 — Room Resizing and Shared Wall Propagation (`InteractiveBlueprint.tsx`, `RoomEditor.tsx`, `layoutConstraints.ts`):**
     - Exported `intervalsOverlap` from `layoutConstraints.ts`.
     - In `InteractiveBlueprint.tsx` wall-drag handler, enforced orthogonal 1D interval overlap checks before propagating wall movements to neighbor rooms, preventing non-adjacent rooms along the same axis from shifting.
     - In `RoomEditor.tsx` `handleApply`, dispatched the full propagated room set (`res.rooms`) through `onLayoutUpdate({ rooms: res.rooms })` and updated the target room via `onRoomUpdate`.
  4. **Task 4 — Regression Test Suite (`test_furniture_suite.ts`, `test_geometry_suite.ts`):**
     - Added TEST 9 & TEST 10 to `test_furniture_suite.ts`:
       - Verified generated plans become immediately editable.
       - Verified furniture appears immediately in 2D and 3D with zero coordinate deviation (`2D center == 3D center`).
       - Verified persistence through save and reload round-trip.
       - Verified furniture deletion permanence after reload.
     - Added TEST 9 & TEST 10 to `test_geometry_suite.ts`:
       - Verified shared wall resizing with adjacent rooms.
       - Verified non-adjacent rooms along the same axis remain 100% invariant.
       - Verified rejection of invalid out-of-plot and shrinking geometry.
       - Verified document immutability on rejected commands and clean undo/redo.

### Test Execution Evidence:
- `npx -y tsx src/modules/editor/geometry/test_furniture_suite.ts`: **10/10 tests PASSED**
- `npx -y tsx src/modules/editor/geometry/test_geometry_suite.ts`: **10/10 tests PASSED**
- `npx -y tsx src/modules/editor/geometry/test_building_3d_suite.ts`: **10/10 tests PASSED**
- `npx -y tsx src/modules/editor/geometry/test_furniture_mesh_builder.ts`: **5/5 tests PASSED**
- `npx -y tsx src/modules/editor/geometry/test_stabilization_suite.ts`: **12/12 tests PASSED**
- `python -W ignore -m unittest ...`: **120/120 backend unit tests PASSED**
- `npm run build` (`tsc -b && vite build`): **PASSED in 1.29s (0 errors)**

- **Safety Boundaries Intact:** No live secrets exposed; `DATABASE_PROVIDER=mongodb` and `AUTH_PROVIDER=jwt` remain 100% active.
- **Ready for Next Step:** Milestone A completed and verified.

---

### Milestone B: Architectural Shaft Repair & Spacious 3D Viewport — COMPLETED & VERIFIED
- **Date Completed:** October 2026
- **Status:** VERIFIED FIXED (Geometry, multi-floor continuity, camera fit calibration, 2D/3D synchronization, and production build verified; runtime auth gate documented for browser walkthrough).
- **Tasks Implemented:**
  1. **Task 1 — Architectural Shaft Repair (2D & 3D Synchronization, Intermediate Slab Openings, Distinct Geometry):**
     - Established distinct domain classifications in `api.ts`, `selectors.ts`, `migration.ts`, and `building3DGenerator.ts`:
       - **External Shaft / Lightwell:** Enclosed vertical lightwell within the building footprint, with continuous open void across floors, interior-facing windows into adjacent rooms, safety glass balustrades (`#e0f2fe`), ground drainage grate, and open-to-sky roof coping rim.
       - **Internal Shaft / MEP Chase:** Enclosed MEP plumbing/duct chase with full-height fire-rated partition walls, stainless steel service inspection door with latch, vertical utility risers (copper supply, PVC soil, galvanized HVAC duct, electrical conduit), and rooftop exhaust louver cowl.
     - Repaired intermediate floor slab generation: Upper floors omit solid floor slab and floor finish over shaft voids (`isVoid: true`), preserving continuous vertical voids from sky/roof down to ground.
     - Added distinct CAD blueprint styling in `InteractiveBlueprint.tsx` (sky-blue wash + cyan dashed border + diagonal void lines + badge for lightwells; slate wash + thick boundary + mechanical cross-hatch for MEP chases).
     - Added room classification dropdown in `RoomEditor.tsx` ("Standard Room", "External Lightwell Shaft", "Internal MEP Chase").
  2. **Task 2 — Spacious 3D Viewport & Camera Framing Controls:**
     - Confirmed and resolved camera over-inflation root cause in `architecturalLighting.ts`: Recalibrated `calculateCameraFraming` to use exact 3D bounding sphere trigonometry ($D = (R / \tan(\theta_v)) \times 1.15$), eliminating excessive compound multipliers and plot inflation that previously placed camera 80–110ft away.
     - Implemented real camera and viewport controls in `FloorPlan3D.tsx`:
       - `FIT` (`btn-camera-fit`): Recalibrated building-bounds framing.
       - `RESET` (`btn-camera-reset`): Return to default exterior perspective view.
       - `ZOOM ROOM` (`btn-camera-zoom-room`): Smoothly frame active/selected room bounds.
       - `FOCUS ITEM` (`btn-camera-focus-item`): Smoothly frame selected furniture item.
       - `TOP` (`btn-camera-top`): Top-down orthographic plan projection.
       - `ISO` (`btn-camera-iso`): True axonometric 45° angle.
       - `COMBINED` (`btn-3d-mode-stacked` / `btn-floor-combined`): Multi-floor stacked building view.
       - `ISOLATE FLOOR` (`btn-3d-mode-single` / `btn-floor-isolate`): View single isolated floor level.
       - Wall Cutaway Controls (`4.5 FT`, `10 FT`, `FULL`).
     - Connected 2D/3D selection synchronization in `Editor.tsx` (`selectedRoomName`, `onSelectRoom`).
  3. **Task 3 — Regression Tests & Build Verification:**
     - Created `frontend/src/modules/editor/geometry/test_shaft_and_viewport_suite.ts` with 11 comprehensive tests covering shaft geometry, multi-floor continuity, intermediate slab openings, camera fit scaling, and immutability (ALL 11 PASSED).
     - Re-verified all existing suites: `test_camera_lighting_suite.ts` (6/6), `test_building_3d_suite.ts` (10/10), `test_furniture_suite.ts` (10/10), `test_geometry_suite.ts` (10/10), `test_stabilization_suite.ts` (12/12), and offline backend tests (98/98).
     - Verified production build: `npm run build` (`tsc -b && vite build`) passed with 0 errors.

### Test Execution Evidence:
- `npx tsx frontend/src/modules/editor/geometry/test_shaft_and_viewport_suite.ts`: **11/11 tests PASSED**
- `npx tsx frontend/src/modules/editor/geometry/test_camera_lighting_suite.ts`: **6/6 tests PASSED**
- `npx tsx frontend/src/modules/editor/geometry/test_building_3d_suite.ts`: **10/10 tests PASSED**
- `npx tsx frontend/src/modules/editor/geometry/test_furniture_suite.ts`: **10/10 tests PASSED**
- `npx tsx frontend/src/modules/editor/geometry/test_geometry_suite.ts`: **10/10 tests PASSED**
- `npx tsx frontend/src/modules/editor/geometry/test_stabilization_suite.ts`: **12/12 tests PASSED**
- `npm run build` (`tsc -b && vite build`): **PASSED in 1.36s (0 errors)**
- Offline Backend Test Suites (`python -m unittest`): **98/98 tests PASSED**

- **Safety Boundaries Intact:** No live secrets exposed; `DATABASE_PROVIDER=mongodb` and `AUTH_PROVIDER=jwt` remain 100% active.
- **Ready for Next Step:** Stop and present Milestone B results before proceeding to Milestone C.


