# AI Architect — Problem Tracker

> **Convention:** Issues are moved to "Completed & Erased Issues" when fully resolved and verified across all test suites.

---

## Open Issues & Active Engineering Tracks

1. **IFC / openBIM 3D Export Pipeline**:
   - Currently, exports are limited to AutoCAD DXF, 4-page PDF dossiers, and vector SVGs.
   - Extend the export suite to generate standard `.ifc` (Industry Foundation Classes) files via `IfcOpenShell` to support BIM software (Revit, ArchiCAD).

2. **Automated Municipal Bylaw Sanction Submission**:
   - Expand the NBC-2016 compliance engine into a localized municipal sanction generator (e.g., BBMP for Bangalore, DDA for Delhi), producing official municipal submission drawings with mandated title blocks and margin specifications.

---

## Completed & Erased Issues

| # | Summary | Fix Applied |
|---|---------|-------------|
| 1 | **LLM Geometry Trap** (main generator) | Architect-Drafter Hybrid: LLM outputs topology JSON only, Python Drafter builds coordinates. Verified: zero overlaps. |
| 2 | **Physics Engine Overlap Trap** | Demoted `layout_validator` to safety-net `boundary_check_only()`. Drafter guarantees zero overlaps by construction. |
| 3 | **Bathroom Adjacency Broken** | The drafter places a bathroom immediately after its bedroom on the same bay y-cursor, so separation is impossible by construction. |
| 4 | **Unauthenticated LLM Routes** | Added `Depends(get_current_user)` to `/regenerate-room` and `/vastu-fix`. |
| 5 | **Furniture Injection Overlaps** | `inject_furniture()` upgraded with 2D overlap checking against placed items AND door-swing zones. |
| 6 | **DXF Exporter Arc Divergence** | Rewrote door arc logic to swing inward per wall direction; added `WALLOPENING` layer for the gap; clamped arc radius. |
| 7 | **Stale Concept Sketch (State Desync)** | Backend auto-fixes now return `imageUrl`; Frontend merges it properly via `handleLayoutUpdate`. |
| 8 | **Missing Payload Propagation** | Refactored `handleLayoutUpdate` to accept optional `newImageUrl`. |
| 9 | **Redundant State Data Risk** | Dropped `plotSize` from API models; backend computes it dynamically. |
| 10 | **Missing Theme Toggle** | Added a functional theme toggle button to `Editor.tsx`. |
| 11 | **Unhandled LLM Exceptions** | Wrapped Groq inference calls in `try/except`; properly returning HTTP 503 instead of raw 500s. |
| 12 | **Stubbed Regeneration Fallback** | Removed naive math fallbacks; now fails gracefully with HTTP 400 on LLM non-convergence. |
| 13 | **Suppressed Exhaustive-Deps** | Wrapped `loadSavedProject` in `useCallback`; removed erroneous `eslint-disable`. |
| 14 | **Swallowed DB Exceptions** | Explicitly catch `InvalidId` in DB methods; surface genuine DB errors properly. |
| 15 | **Report Export Failed (Signature Mismatch)** | Fixed `compute_bom` signature to accept `(layout_or_rooms, sqft)` flexibly; hardened `pdf_report.py` table wrapping and `entry_dir` string formatting. |
| 16 | **Silently Failing Backend Routes (`duplex` bug)** | Restored the `duplex` argument to `build_layout_from_topology` in `architectural_layout.py` so that staircase logic triggers properly. |
| 17 | **AI Assistant Topology Ignored on Ground Floor** | Rewrote `_build_ground_floor` from static hardcoded coordinates to a dynamic array loop, protected by geometric guardrails. |
| 18 | **Laggy / Dropped Room Dragging** | Fixed `InteractiveBlueprint.tsx` `handlePointerMove` to use cumulative total distance rather than frame-by-frame deltas. |
| 19 | **Missing `@supabase/supabase-js` Package** | Added package to `frontend/package.json` and ran `npm install`. Vite build compiles in 1.83s with 0 errors. |
| 20 | **Upper-Floor Staircase Double-Setback Overflow** | In `backend/engines/architectural_layout.py:196`, upper floor staircases subtracted `front_setback` when reading ground floor `y`, fixing `test_two_floor_in_bounds_all_floors` across all 99 tests. |
| 21 | **Algorithm Accuracy Figure Text Collision** | Re-rendered `figures/algorithm_accuracy.jpeg` using matplotlib with 300 DPI, moving the legend above the plot and eliminating title collision. |
| 22 | **Multi-Floor Vertical Stair Alignment** | Locked staircase $(x, y)$ footprint across all 4 levels, ensuring continuous vertical core shafts for stairs and MEP ducts. |
| 23 | **8-Handle CAD Resizing Vector Drift** | Implemented stationary anchor vector math for all 8 handles with boundary clamping and live dimension HUD badges. |
| 24 | **Dual-Persistence RLS Integration** | Implemented `backend/db/supabase_client.py` and `identity_bridge.py` with automatic fallback to MongoDB Atlas. |
