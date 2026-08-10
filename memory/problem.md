# AI Architect — Problem Tracker

> **Convention:** Issues are erased from this file when fully fixed and verified.

---

## Open Issues

*None — all identified issues have been fixed and verified.*

---

## Completed & Erased Issues

| # | Summary | Fix Applied |
|---|---------|-------------|
| 1 | **LLM Geometry Trap** (main generator) | Architect-Drafter Hybrid: LLM outputs topology JSON only, Python Drafter builds coordinates. 79/79 tests pass. |
| 2 | **Physics Engine Overlap Trap** | Demoted `layout_validator` to safety-net `boundary_check_only()`. Drafter guarantees zero overlaps by construction. |
| 3 | **Bathroom Adjacency Broken** | Drafter places bathroom immediately after bedroom via y-cursor. Structurally impossible to separate. All 19 adjacency tests pass. |
| 4 | **Unauthenticated LLM Routes** | Added `Depends(get_current_user)` to `/regenerate-room` and `/vastu-fix`. |
| 5 | **Furniture Injection Overlaps** | `inject_furniture()` upgraded with 2D overlap checking against placed items AND door-swing zones. |
| 6 | **DXF Exporter Arc Divergence** | Rewrote door arc logic to swing inward per wall direction; added `WALLOPENING` layer for the gap; clamped arc radius. Verified: 76 KB DXF with DOORS + WALLOPENING layers present. |
