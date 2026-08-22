# AI Architect — Problem Tracker

> **Convention:** Issues are erased from this file when fully fixed and verified.

---

## Open Issues

*None — all identified issues have been fixed and verified.*

---

## Completed & Erased Issues

| # | Summary | Fix Applied |
|---|---------|-------------|
| 1 | **LLM Geometry Trap** (main generator) | Architect-Drafter Hybrid: LLM outputs topology JSON only, Python Drafter builds coordinates. Measured 2026-08-22: the test suite is not in this repo. It lives at `C:\Users\syedi\Downloads\ai_architect_tests` and contains exactly two tests, `test_drafter_no_overlaps` and `test_drafter_vastu_topology`. Both pass (2 passed in 25.10s). |
| 2 | **Physics Engine Overlap Trap** | Demoted `layout_validator` to safety-net `boundary_check_only()`. Drafter guarantees zero overlaps by construction. |
| 3 | **Bathroom Adjacency Broken** | The drafter places a bathroom immediately after its bedroom on the same bay y-cursor, so separation is impossible by construction. |
| 4 | **Unauthenticated LLM Routes** | Added `Depends(get_current_user)` to `/regenerate-room` and `/vastu-fix`. |
| 5 | **Furniture Injection Overlaps** | `inject_furniture()` upgraded with 2D overlap checking against placed items AND door-swing zones. |
| 6 | **DXF Exporter Arc Divergence** | Rewrote door arc logic to swing inward per wall direction; added `WALLOPENING` layer for the gap; clamped arc radius. Verified: 76 KB DXF with DOORS + WALLOPENING layers present. |
| 7 | **Stale Concept Sketch (State Desync)** | Backend auto-fixes now return `imageUrl`; Frontend merges it properly via `handleLayoutUpdate`. |
| 8 | **Missing Payload Propagation** | Refactored `handleLayoutUpdate` to accept optional `newImageUrl`. |
| 9 | **Redundant State Data Risk** | Dropped `plotSize` from API models; backend computes it dynamically. |
| 10 | **Missing Theme Toggle** | Added a functional theme toggle button to `Editor.tsx`. |
| 11 | **Unhandled LLM Exceptions** | Wrapped Groq inference calls in `try/except`; properly returning HTTP 503 instead of raw 500s. |
| 12 | **Stubbed Regeneration Fallback** | Removed naive math fallbacks; now fails gracefully with HTTP 400 on LLM non-convergence. |
| 13 | **Suppressed Exhaustive-Deps** | Wrapped `loadSavedProject` in `useCallback`; removed erroneous `eslint-disable`. |
| 14 | **Swallowed DB Exceptions** | Explicitly catch `InvalidId` in DB methods; surface genuine DB errors properly. |
| 15 | **Report Export Failed (Signature Mismatch)** | Fixed `compute_bom` signature to accept `(layout_or_rooms, sqft)` flexibly; hardened `pdf_report.py` table wrapping and `entry_dir` string formatting. |
