# Recent History & Conversations

## August 2026: Architect-Drafter AI Integration & Backend Refactoring
- **Real AI Integration**: Fixed fake endpoints. `/vastu/fix` now queries Groq (Llama-3.3-70b-versatile) with failing Vastu rules to generate a revised architectural topology, then reruns the Python Drafter for overlap-free geometry. `/regenerate-room` now handles natural-language room edit instructions via the LLM instead of a hardcoded *1.2 multiplier.
- **Backend Modularization**: Broke the single-folder backend monolith into proper Python packages (`core/`, `db/`, `engines/`, `exporters/`, `routers/`).
- **Data Access Layer**: Extracted all Motor (MongoDB) calls from the route handlers into a dedicated `repositories.py` layer for cleaner separation of concerns.

## August 2026: Full-Stack Audit & Remediation
- Replaced the LLM geometry generator with a **Deterministic Python Engine** (`architectural_layout.py`) that strictly enforces boundaries and tiling.
- **Security & DB**: Corrected project documentation to reflect the actual MongoDB usage (was mistakenly documented as SQLite). Secured `/generate` and `/export/dxf` endpoints with JWT auth, and removed fallback JWT secrets.
- **UX & Architecture**: Added circulation reachability detection, reporting landlocked rooms to the UI via a warning banner.
- **Geometry Fixes**: Implemented a 3x3 ft door swing exclusion zone so furniture doesn't block doors. Fixed the DXF exporter to correctly map real door arcs instead of hardcoding a bottom-wall arc.

## August 2026: Linting & Code Quality
- Resolved 14 ESLint errors/warnings across the frontend.
- Refactored `InteractiveBlueprint.tsx` from mutable `let` chains to a pure `getDoorGeometry()` helper function.
- Refactored `Dashboard.tsx` to use strict domain types instead of `Record<string, unknown>`.
- Added "Real Developer Refactoring Standard" rule to `.agents/AGENTS.md`.

## August 2026: Roadmap Execution — Phases 1–3 Implemented

### Phase 1: Window Generation ✅
- Created `backend/window_placer.py` — deterministic exterior-wall window engine.
  - Scans each room; places windows only on plot-boundary walls.
  - Avoids door positions (with 0.5 ft clearance) and corners (1.5 ft margin).
  - Centres window in the largest available clear zone on the wall.
- Updated `floor_renderer.py` to draw data-driven window double-line symbols (all 4 walls).
- Updated `dxf_exporter.py` with a dedicated `WINDOW` layer.
- Updated `InteractiveBlueprint.tsx`: replaced heuristic `WindowMarks` with data-driven `WindowMarkers` component that reads `room.windows[]`.
- Added `WindowSpec` interface to `api.ts`.

### Phase 2: Circulation Path Visualization ✅
- Created `backend/circulation.py` — BFS pathfinder on a room adjacency graph.
  - Rooms are adjacent if they share a wall segment ≥ 1.5 ft.
  - BFS from entrance (Foyer/Lobby/Hall) to every other room.
  - Returns waypoints: `[room_centre → shared_wall_midpoint → next_room_centre]`.
  - Flags unreachable rooms in `floor["circulation"]["unreachable"]`.
- Created `frontend/src/components/CirculationOverlay.tsx` — dashed green polylines + waypoint dots.
- Extended `InteractiveBlueprint.tsx` with `circulation` and `showCirculation` props.
- Added `FloorCirculation`, `CirculationPath` types to `api.ts`.
- Updated `Editor.tsx`: `🛤 Show Paths` toggle button; live unreachable-rooms badge.

### Phase 3: BOM Cost Estimation + PDF Report ✅
- Created `backend/cost_rates.py` — INR rate constants (2026 estimates, all documented).
- Created `backend/bom_engine.py` — room-level cost calculator:
  - Wall cost: brick + plaster per sqft of wall face area.
  - Flooring: marble for premium rooms (master bedroom, living, dining); tile otherwise.
  - Ceiling: POP/gypsum per sqft of floor area.
  - MEP: electrical per sqft; plumbing only for wet rooms (bathroom, kitchen).
  - Openings: per-unit door and window costs.
  - Labour: 30% of all material costs.
- Created `backend/pdf_report.py` — 4-page ReportLab Platypus PDF:
  - Page 1: Cover (project metadata, vastu score).
  - Page 2: Floor plan images (Base64 PNGs embedded).
  - Page 3: Vastu analysis table (colour-coded pass/warn/fail rows).
  - Page 4: BOM table with grand total and INR formatting (lakh/crore).
- Added `POST /export/report` endpoint to `backend/main.py`.
- Added `exportReport()` to `frontend/src/services/api.ts`.
- Added `📄 Report` download button to the Editor action bar.
- Installed `reportlab 5.0.0` into `.venv`.

### Phase 4: Municipal Bylaw Compliance (NBC 2016) ✅
- **Description:** Score the layout against Indian National Building Code 2016 rules.
- **Implementation:** `backend/nbc_engine.py` implements 8 rules (Setbacks, FAR, Room/Kitchen/Bath minimum areas, Corridor widths). Converts JSON ft to meters. Renders a new "🏛 NBC 2016 Compliance" panel in the Editor right sidebar.

### Phase 5: Furniture Placement Engine ✅
- **Description:** Automatically furnish rooms with appropriately sized furniture.
- **Implementation:** `backend/architectural_layout.py` handles deterministic furniture injection with door-swing exclusion zones. Exposed to `dxf_exporter.py` via `FURNITURE` layer, and `floor_renderer.py` via rendering rectangles/labels on the PNG. Also already rendered in the SVG editor.

### Phase 6: 3D WebGL Visualization ✅
- **Description:** Extrude the 2D layout into an interactive 3D walkthrough view.
- **Implementation:** Installed `@react-three/fiber` and `@react-three/drei`. Added `FloorPlan3D.tsx` component that extrudes floor plates and semi-transparent walls based on JSON. Added a "2D View" / "3D View" toggle switch in the Editor action bar.

## UI Refinements (earlier)
- Modified the glassmorphism layout to ensure all cards have the exact same color variables.
- Integrated a Uiverse `namecho` design toggle switch for the UI.
- Adjusted the Master Bedroom test data inside `frontend/src/pages/Editor.tsx` to read exactly 14x12 ft.
- Adjusted concept sketch image container styles (`.plan-img`) inside `frontend/src/App.css` to fix layout glitches.

## LinkedIn Profile Prep
- Wrote two highly tailored LinkedIn project summaries for the user's profile (AI Architect + EchoAI Voice Assistant).

## Academic Publication (IEEE Paper)
- Formatted `ieee_paper_formatted.tex` into a strict IEEE two-column, 10pt format.
- Expanded the paper by 36% to comfortably pass a 7-page minimum constraint.
- Pushed all modified files to GitHub (`Syed-Imran227/AI-Architect`).
