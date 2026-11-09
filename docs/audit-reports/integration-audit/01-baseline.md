# AI ARCHITECT — MILESTONE 5: FULL APPLICATION INTEGRATION BASELINE AUDIT
*Document: `docs/integration-audit/01-baseline.md`*  
*Timestamp: October 26, 2026*  
*Author: Antigravity Agent*

---

## 1. Executive Summary

Milestone 5 executes a rigorous end-to-end integration and regression audit of AI Architect. Over the course of Milestones 1 through 4, the platform has gained:
1. **Milestone 1 — Dashboard & Studio Redesign**: Studio continue strip, hero generator, project archive, financial metrics, and lazy-loaded 3D modal preview.
2. **Milestone 2 — 2D Floor Plan Editor**: Canonical document architecture, shared-wall constraint propagation, physical openings, staircase/shaft clearance, room-furniture containment, and 100% reversible undo/redo command engine.
3. **Milestone 3 — AI Copilot Architectural Pipeline**: Natural-language intent resolution, sandboxed preview candidates, single-click application/rejection, multi-floor targeted editing, and strict server-side validation.
4. **Milestone 4 — Professional 3D Visualization**: Multi-floor stacking, elevator core generation, exploded axonometric views, element visibility filters, PBR materials, interior camera presets, collision-aware walkthrough, and Three.js chunk code-splitting (-63% bundle size).

The primary objective of Milestone 5 is to audit the entire system as **one unified, cohesive product**, validating that all cross-module invariants hold true, no regressions exist between 2D, 3D, Copilot, and financial calculations, and all user workflows operate reliably.

---

## 2. Workspace State & Configuration Audit

### 2.1 Git Working Tree
- Current Branch: Active local repository branch.
- Remotes: No remote operations (`push`, `pull`, `clone`) were executed.
- Uncommitted Changes Preserved:
  - Backend: Authentication hardening, canonical geometry models, BOM cost rates engine, projects/agent routes, and pytest test suites.
  - Frontend: Studio dashboard redesign components, 2D editor command engine, Copilot agent panel, 3D building generator, Three.js visualization, and deterministic test suites.
- Critical Env Settings:
  - `DATABASE_PROVIDER=mongodb` (Active and verified)
  - `AUTH_PROVIDER=jwt` (Active and verified)
  - Supabase database migrations remain inactive.

### 2.2 System Architecture & Module Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            FRONTEND (React + Vite)                          │
├─────────────────────┬──────────────────────────┬────────────────────────────┤
│      DASHBOARD      │        2D BLUEPRINT      │         3D STUDIO          │
│ - StudioHeader      │ - InteractiveBlueprint   │ - FloorPlan3D (Lazy)       │
│ - StudioHeroOpening │ - RoomEditor             │ - building3DGenerator     │
│ - StudioProjectCard │ - CommandEngine          │ - architecturalLighting   │
│ - Project3DPreview  │ - layoutConstraints      │ - WalkthroughController    │
├─────────────────────┴──────────────────────────┴────────────────────────────┤
│                       CENTRAL CANONICAL DOCUMENT STATE                      │
│ - CanonicalBuildingDocument (schemaVersion: 1) in SI Metres                 │
│ - Reversible Commands (undo/redo stack)                                     │
│ - Derived Selectors (areas, room bounds, legacy projections)                │
│ - Authoritative Client BOM (calculateAuthoritativeBOM)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                          AI COPILOT AGENT PANEL                             │
│ - Natural language prompt submission                                        │
│ - Non-mutating candidate preview                                            │
│ - Confirmation / Rejection via CommandEngine                                │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP / REST (JWT Bearer)
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                           BACKEND (FastAPI + Python)                        │
├─────────────────────┬──────────────────────────┬────────────────────────────┤
│     AUTH & USERS    │     PROJECT PERSISTENCE  │     COPILOT & ENGINE       │
│ - /auth/register    │ - /projects (CRUD)       │ - /agent/chat              │
│ - /auth/login       │ - /projects/{id}/version │ - /agent/proposal/apply    │
│ - /auth/me          │ - User-scoped isolation  │ - /generate (Gemini/Rules) │
├─────────────────────┴──────────────────────────┴────────────────────────────┤
│                      AUTHORITATIVE SERVER ENGINES                           │
│ - bom_engine.py & cost_rates.py (BOM calculation, 30% labour ratio)         │
│ - canonical_model.py (Strict Pydantic models & validation)                  │
│ - layout_modifier.py (Deterministic spatial mutations)                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Route Map & API Contracts

### 3.1 Client Routes (`frontend/src/App.tsx`)
- `/` $\rightarrow$ Landing page with studio callouts.
- `/login` $\rightarrow$ JWT / Supabase credentials form.
- `/register` $\rightarrow$ User account creation with instant JWT login.
- `/dashboard` $\rightarrow$ Protected user dashboard, design history, recent plans, financial metrics.
- `/editor` $\rightarrow$ Protected architectural design studio (`?project=<id>`, `?mode=2d|3d`).
- `/editor/:id` $\rightarrow$ Direct route to project studio.

### 3.2 Backend API Endpoints (`backend/main.py`)
- `POST /auth/register` $\rightarrow$ Registers new user, returns JWT access token.
- `POST /auth/login` $\rightarrow$ Authenticates user, returns JWT access token.
- `GET /auth/me` $\rightarrow$ Validates bearer token and returns current user profile.
- `GET /projects` $\rightarrow$ Lists all projects owned by `current_user["id"]`.
- `POST /projects` $\rightarrow$ Creates project and initializes version 1 in design history.
- `GET /projects/{id}` $\rightarrow$ Retrieves project by ID (strictly isolated to owner).
- `PUT /projects/{id}` $\rightarrow$ Updates project layout and creates incremental version snapshot.
- `DELETE /projects/{id}` $\rightarrow$ Deletes project (owner check enforced).
- `GET /projects/{id}/versions` $\rightarrow$ Returns immutable version snapshot timeline.
- `POST /generate` $\rightarrow$ Generative architectural layout synthesis.
- `POST /agent/chat` $\rightarrow$ AI Copilot architectural intent parsing & proposal candidate generation.
- `POST /agent/proposal/apply` $\rightarrow$ Server-side verification and proposal commit.
- `POST /bom` $\rightarrow$ Authoritative server-side Bill of Materials calculation.

---

## 4. Subsystem Audits & Integration Touchpoints

### 4.1 Canonical Document Schema & Persistence
- Schema Version: `1`.
- Units: SI Metres throughout authoritative document.
- Migration Adapter: `migrateLegacyToCanonical` converts legacy feet-based layouts into canonical SI coordinates on-the-fly, ensuring 100% backward compatibility with existing saved projects.
- Persistence Integrity: `Editor.tsx` persists `CanonicalBuildingDocument` under `layout_data`. Serialized JSON round-trips preserve node topologies, wall kinds, openings, and item placements.

### 4.2 2D Blueprint Engine & Shared-Wall Constraints
- Coordinate System: 2D plane ($x, y$ in metres).
- Constraint Engine: `propagateRoomBoundsWithSharedWalls` detects collinear, touching room edges and propagates movements to neighbor rooms without creating gaps, overlaps, or illegal room shrinkages (< 2.5 ft).
- Command Reversibility: Every operation generates an inverse patch, giving instant single-click undo/redo without server round-trips.

### 4.3 AI Copilot Architectural Pipeline
- Flow: Natural Language $\rightarrow$ Intent Parser $\rightarrow$ Layout Modifier $\rightarrow$ Candidate Document $\rightarrow$ Preview Isolation $\rightarrow$ User Confirmation / Rejection $\rightarrow$ Command Dispatch.
- Invariants:
  1. The canonical document is never touched when a proposal is suggested or rejected.
  2. The candidate preview is kept in a separate React state variable (`candidateDoc`).
  3. Acceptance dispatches through `CommandEngine`, creating a valid undo history entry.

### 4.4 3D Building Visualization Subsystem
- Pipeline: `generate3DBuilding(doc)` converts canonical document to 3D meshes:
  - 2D $x \rightarrow$ 3D $X$
  - 2D $y \rightarrow$ 3D $Z$
  - Floor elevation $\rightarrow$ 3D $Y$
- Multi-Floor Features: Full stacked building, floor isolation, exploded axonometric stack, element visibility toggles (walls, furniture, openings, roof, elevations).
- Optimization: Three.js and heavy generators are lazy-loaded via `React.lazy()` in `Editor.tsx`, keeping `Editor.js` bundle size at **332 kB** (63% reduction).

### 4.5 Financial & BOM Model Synchronization
- Client Formula: `calculateAuthoritativeBOM(floors)` in `bomCalculator.ts`.
- Server Formula: `bom_engine.py` using `cost_rates.py`.
- Verified Invariants:
  - 30% construction labour ratio strictly applied to materials cost.
  - Retail furniture pricing referenced from authoritative `furnitureRegistry.ts` catalog in INR.
  - Furniture costs are invariant under spatial movement and rotation.
  - Totals match identically across Dashboard, 2D Editor drawer, and 3D views.

---

## 5. Baseline Test & Build Verification

The baseline was executed and verified against all unit, integration, and backend tests:

| Test Suite | File / Scope | Tests Run | Result | Notes |
|:---|:---|:---:|:---:|:---|
| **3D Visualization Suite** | `test_3d_visualization_suite.ts` | 11 | **11 / 11 PASS** | Unit conversion, lift core, exploded mode, visibility. |
| **Multi-Floor Suite** | `test_multifloor_suite.ts` | 12 | **12 / 12 PASS** | Floor switching, 2D/3D sync, stair termination. |
| **Shaft & Viewport Suite** | `test_shaft_and_viewport_suite.ts` | 11 | **11 / 11 PASS** | MEP chase, glazed lightwell, viewport framing. |
| **3D Building Engine** | `test_building_3d_suite.ts` | 10 | **10 / 10 PASS** | Wall thickness, voids, multi-floor pitch, JSONB round-trip. |
| **Camera & Lighting** | `test_camera_lighting_suite.ts` | 6 | **6 / 6 PASS** | Presets, dynamic sun trajectory, document immutability. |
| **Financial & BOM Suite**| `test_financial_bom_suite.ts` | 53 | **53 / 53 PASS** | 30% labour, furniture rates, budget overruns, tiers. |
| **Copilot Pipeline** | `test_copilot_pipeline_suite.ts` | 6 | **6 / 6 PASS** | Proposal preview, rejection, undo/redo, schema safety. |
| **2D Editor Suite** | `test_editor_improvement_suite.ts`| 11 | **11 / 11 PASS** | Shared walls, openings, furniture containment, undo/redo. |
| **Core Geometry Suite** | `test_geometry_suite.ts` | 10 | **10 / 10 PASS** | Segment math, validation rejection, legacy migration. |
| **Furniture Registry** | `test_furniture_suite.ts` | 10 | **10 / 10 PASS** | Catalog audit, placement, transform, persistence. |
| **Backend Pytest** | `pytest` in `backend/` | 154 | **154 / 154 PASS** | Auth passthrough, BOM engine, canonical models, projects. |
| **Production Build** | `tsc -b && vite build` | 2,809 modules | **0 Errors (732ms)** | Clean TypeScript and Vite bundle build. |

---

## 6. Baseline Verification Conclusion

The existing codebase is structurally sound, rigorously tested, and operates under consistent architectural invariants. Proceeding to Phase Two: End-to-End User Workflows and Phase Three: Cross-Module Invariant Verification.
