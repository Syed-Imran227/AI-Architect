# Recent History & Development Milestones

## November 2026: V2 Multi-Floor, Solar & Circulation Synthesis Integration (Current HEAD)

### 1. Repository Merge & Integration (`3d0e5d9` & `a5529ba`)
- **Fast-Forward Merge**: Successfully merged remote developments from Yogesh (`3772640..3d0e5d9`) incorporating 53,148 insertions across 147 files.
- **Progress Tracking Sync**: Updated `docs/progress.md` marking Phase 6 (Slice 1), Master Editor Repair, Phase 7 Innovations, and V2 Multi-Floor/Solar Synthesis as **Completed & Verified**.

### 2. Core Architectural Features Delivered in V2
- **Multi-Floor Synthesis (Up to 4 Floors)**:
  - Generates Level 0 (Ground), Level 1 (Duplex Upper), Level 2 (Floor 2), and Level 3 (Rooftop Terrace).
  - Deterministic vertical staircase pinning locks the stairwell footprint across all levels.
  - Duplex open-to-below void geometry over the ground floor living room.
- **Solar Daylighting & Lux Simulation (`sunlight_engine.py`)**:
  - Calculates real-time solar azimuth and elevation across morning (AM), noon, golden hour, and nighttime.
  - Simulates window daylight penetration depth and casts directional shadows in 3D.
  - Night mode activates 2700K warm incandescent point lights in room centroids.
- **8-Handle CAD Resizing & Direct Room Manipulation**:
  - 8 directional resize handles (`nw`, `ne`, `se`, `sw`, `n`, `s`, `e`, `w`) with stationary anchor vector math.
  - Live floating HUD badge displaying imperial and metric dimensions in real-time.
  - CAD mode toggle between partition synchronization and independent room expansion.
- **Cinematic 3D ArchViz Pipeline (`FloorPlan3D.tsx`)**:
  - Dollhouse cutaway mode (4.5ft and 10ft wall slice with dark slate caps).
  - Stacked multi-floor vs single-floor isolation vs exploded axonometric view.
  - X-Ray mode showing translucent wireframe walls (10% cyan opacity) and service cores.
  - Architectural section cut mode with real-time clipping depth slider.
  - Procedural site landscaping: perimeter walls, lawn turf, swimming pool, and palm trees.
- **Dual Persistence & Security**:
  - Primary Supabase PostgreSQL database with Row Level Security (RLS) policies.
  - Secondary fallback to MongoDB Atlas via `IdentityBridge`.
  - Secure session migration and JWT verification.

### 3. Critical Regressions Discovered & Fixed During Handover Audit
- **Frontend Missing Dependency (`@supabase/supabase-js`)**:
  - Missing from `frontend/package.json`, causing Vite build failure.
  - Installed and verified; `tsc -b && vite build` now completes with 0 errors in 1.83s.
- **Upper-Floor Staircase Double-Setback Overflow**:
  - In `backend/engines/architectural_layout.py:196`, upper floors inadvertently re-applied `front_setback` to the ground floor staircase coordinates, pushing upper staircases out of bounds.
  - Fixed by subtracting `front_setback`: `staircase_y = (gf_staircase["y"] - front_setback) if gf_staircase else 0.0`.
  - Re-tested against `TestMultiFloor.test_two_floor_in_bounds_all_floors`; 100% of tests passed.
- **Algorithmic Figures Polish & Renaming**:
  - Renamed 18 raw verification screenshots in `figures/` to semantic filenames (`fig_01_atelier_landing_hero.png` through `fig_18_3d_night_staircase_void.png`).
  - Cataloged all figures in `figures/README.md`.
  - Re-rendered `figures/algorithm_accuracy.jpeg` at 300 DPI, resolving a title/legend collision bug.
  - Re-rendered `figures/algorithm_latency.jpeg` at 300 DPI for visual consistency.
- **Academic Paper Invariant**:
  - Confirmed strict preservation of `ieee_paper.tex` and `ieee_paper_old.tex` with zero modifications.

---

## October 2026: Vastu Accuracy & Multi-Floor Logic Update
- **Vastu Engine Refinement**: Updated `vastu_engine.py` to use centroid-based Brahmasthan calculation. Transitional spaces (Corridors, Staircases, non-master Baths) exempted from center-mass penalties, raising scores to 70+/100.
- **Vertical Pinning**: Solved staircase misalignment between Ground and Upper floors via vertical coordinate locking.
- **Model Hierarchy Upgrade**: Shifted inference priority to Google `gemini-3.1-pro-preview`, DeepSeek-V3-0324, and Gemini 3.8 Flash.

---

## Late August 2026: Architectural Layout Engine Restoration
- **Layout Reversion**: Reverted `architectural_layout.py` back to stable deterministic state to eliminate public/private zoning bugs.
- **Dynamic Cramming**: Adjusted minimum limits (`MIN_BED_H` 8.5ft, `MIN_ROOM_H` 7ft) to allow flexible room cramming in tighter plots.
- **API Resilience**: Fixed a 500 error in `/generate` caused by an unpassed `duplex` argument.

---

## Mid-August 2026: 2D/3D Parity & Full-Stack Fortification
- **3D Openings**: Solved invisible doors and windows in 3D viewer by replacing solid box walls with segment-based `WallWithOpenings`.
- **2D Blueprint Parity**: Replaced heuristic window marks with data-driven `WindowMarkers` reading `room.windows[]`.
- **Furniture Logic**: Fixed `_try_place()` in backend that stripped furniture names, restoring chair-around-table logic.
- **External Test Suite**: Established 99-test external suite in `ai_architect_tests` verifying drafter boundaries, setbacks, circulation, and auth.
