# Stage 1: Repository Audit — AI Architect Dashboard Redesign

**Date**: October 2026  
**Auditor**: Creative Director & Staff Frontend Engineer  
**Workspace Root**: `c:\Users\yoges\OneDrive\Desktop\architect\AI-Architect`  
**Git Branch**: `main`  
**Git Remotes**:
- `origin`: `https://github.com/YOGESHS347/ARCHITECT.git`
- `upstream`: `https://github.com/Syed-Imran227/AI-Architect.git`

---

## 1. Working-Tree State & Preservation of Pre-existing Changes

Prior to beginning this task, the working tree had active local changes from prior milestone work. These changes must be preserved and remain intact:

### Pre-existing Modified Files:
- `backend/.env.example`
- `backend/core/auth.py`
- `backend/db/database.py`
- `backend/db/repositories.py`
- `backend/db/supabase_client.py`
- `backend/engines/bom_engine.py`
- `backend/engines/canonical_model.py`
- `backend/engines/cost_rates.py`
- `backend/main.py`
- `backend/routers/agent_routes.py`
- `backend/routers/engine_routes.py`
- `backend/routers/export_routes.py`
- `backend/routers/projects_routes.py`
- `docs/progress.md`
- `frontend/src/App.tsx`
- `frontend/src/modules/dashboard/pages/Dashboard.tsx`
- `frontend/src/modules/editor/components/AnalysisStudioView.tsx`
- `frontend/src/modules/editor/components/ComplianceSidebar.tsx`
- `frontend/src/modules/editor/components/FloorPlan3D.tsx`
- `frontend/src/modules/editor/components/InteractiveBlueprint.tsx`
- `frontend/src/modules/editor/components/RoomEditor.tsx`
- `frontend/src/modules/editor/components/furniture3DMeshBuilder.tsx`
- `frontend/src/modules/editor/constants/furnitureCatalog.ts`
- `frontend/src/modules/editor/geometry/architecturalLighting.ts`
- `frontend/src/modules/editor/geometry/building3DGenerator.ts`
- `frontend/src/modules/editor/geometry/commands.ts`
- `frontend/src/modules/editor/geometry/furnitureRegistry.ts`
- `frontend/src/modules/editor/geometry/index.ts`
- `frontend/src/modules/editor/geometry/layoutConstraints.ts`
- `frontend/src/modules/editor/geometry/migration.ts`
- `frontend/src/modules/editor/geometry/selectors.ts`
- `frontend/src/modules/editor/geometry/test_furniture_suite.ts`
- `frontend/src/modules/editor/geometry/test_geometry_suite.ts`
- `frontend/src/modules/editor/pages/Editor.tsx`
- `frontend/src/shared/api-client/api.ts`

### Pre-existing Untracked Files:
- `backend/core/identity_bridge.py`
- `backend/db/migrations/`
- `backend/requirements-dev.txt`
- `backend/scripts/`
- `backend/tests/fixtures/`
- `backend/tests/test_*.py` (auth, repository, BOM tests)
- `docs/milestone_*.md`, `docs/staging_cutover_runbook.md`, `docs/ai_architect_repair_audit.md`
- `frontend/src/modules/dashboard/components/Project3DPreviewModal.tsx`
- `frontend/src/modules/editor/geometry/bomCalculator.ts`
- `frontend/src/modules/editor/geometry/test_financial_bom_suite.ts`
- `frontend/src/modules/editor/geometry/test_shaft_and_viewport_suite.ts`

*Safety Invariant*: No `git reset`, `git clean`, or destructive actions will be executed. All existing work is preserved.

---

## 2. Router & Navigation Destinations

The frontend uses `react-router-dom` v7.15.1 configured in `frontend/src/App.tsx`:

| Path | Component | Protection | Description |
|---|---|---|---|
| `/` | `Landing.tsx` | Public | Editorial landing page |
| `/login` | `Login.tsx` | Public | Authentication login screen |
| `/register` | `Register.tsx` | Public | User registration screen |
| `/dashboard` | `Dashboard.tsx` | `ProtectedRoute` | Primary studio console & project archive |
| `/editor` | `Editor.tsx` | `ProtectedRoute` | Full architectural CAD editor (2D/3D/Analysis) |
| `*` | Redirect to `/dashboard` | Protected | Fallback route |

### Navigation Destinations Mapping:
1. **Studio (Dashboard) / Archive**: `/dashboard` (and `#archive` scroll anchor).
2. **New Generation / Create**: `/dashboard` opening console, with optional direct transition to `/editor?wizard=true`.
3. **Existing Projects**: `/dashboard` curated archive section with instant open actions.
4. **Editor**: `/editor?project={id}&mode=2d` (opens project in 2D blueprint drafting view).
5. **3D Exploration**: `/editor?project={id}&mode=3d` (opens project directly in 3D orbit viewport) and read-only on-demand preview modal on dashboard.
6. **Financial Studio**: `/editor?project={id}&mode=analysis` (opens Analysis Studio BOM / financial tab) and dashboard financial intelligence ledger.

*Note on dedicated routes*: The repository does not have standalone `/finance` or `/3d` routes; these are modes within `/editor` controlled via URL search parameters (`?project={id}&mode=3d` and `?project={id}&mode=analysis`). The redesign preserves these real paths without fabricating non-existent routes.

---

## 3. Dashboard Component Tree & Data Layer

- **Root Component**: `Dashboard.tsx` in `frontend/src/modules/dashboard/pages/Dashboard.tsx`.
- **Auth Context**: `useAuth()` (`frontend/src/modules/auth/store/AuthContext.tsx`), providing `user`, `logout`, and token state from `localStorage.getItem("token")`.
- **Data-Fetching**: `getProjects()` from `frontend/src/shared/api-client/api.ts` makes an authenticated HTTP `GET /projects` request to FastAPI backend (`API_BASE_URL`, default `http://localhost:8000`).
- **State Management**: React local state hooks (`useState`, `useMemo`, `useCallback`, `useRef`).
- **Lazy Components**: `Project3DPreviewModal` is loaded via `React.lazy` to keep the initial dashboard bundle free of heavy Three.js initialization.

---

## 4. API Endpoints & Response Shapes

### 1. `GET /projects`
Returns array of `Project` objects:
```typescript
interface Project {
  id: string;
  name: string;
  created_at: string;
  budget_target?: number;
  image_url?: string;
  layout_data: {
    rooms?: Room[];
    floors?: Floor[];
    vastuScore?: number;
    vastuResult?: VastuResult;
    form?: {
      length?: number;
      width?: number;
      floors?: number;
      entryDir?: string;
      bedrooms?: number;
      bathrooms?: number;
      duplex?: boolean;
    };
    plot_width?: number;
    plot_length?: number;
    plot_height?: number;
    budget_target?: number;
    target_budget?: number;
    bomResult?: BomResult;
    canonical?: CanonicalBuildingDocument;
  };
}
```

### 2. Available Project Fields for Redesign:
- **Project Name**: `project.name`
- **Updated / Created Date**: `project.created_at`
- **Plot Dimensions**: `project.layout_data.plot_width` × `project.layout_data.plot_length` (or `form.width` × `form.length`)
- **Orientation**: `project.layout_data.form?.entryDir`
- **Floor Count**: `project.layout_data.floors?.length` or `project.layout_data.form?.floors` (default: 1)
- **Room List**: `project.layout_data.rooms` or aggregated across `project.layout_data.floors[].rooms`
- **Thumbnails**: `project.image_url` (if populated) with live SVG fallback generated deterministically from `rooms`
- **Cost Totals & Budget**: `project.layout_data.bomResult.budget` or authoritative computation via `calculateAuthoritativeBOM(project.layout_data)`

### 3. `POST /generate`
Accepts `GeneratePlansPayload` (`length`, `width`, `bedrooms`, `bathrooms`, `floors`, `duplex`, `balcony`, `terrace`, `lift`, `vastuToggle`, `entryDir`).
Returns `{ candidates: LayoutData[] }`.

### 4. `DELETE /projects/{id}`
Deletes project by ID; returns deletion status.

---

## 5. Authoritative BOM & Cost Calculation Engine

- **Backend Source of Truth**: `backend/engines/bom_engine.py` and `backend/engines/cost_rates.py`.
- **Frontend Reactive Mirror**: `frontend/src/modules/editor/geometry/bomCalculator.ts` (`calculateAuthoritativeBOM`).
- **BOM Output Shape**:
  - `rooms`: Itemized room construction, finishes, structural RCC, and furniture costs.
  - `summary`: `total_area_sqft`, `material_total`, `labour_total` (strictly 30% of construction materials), `construction_total`, `furniture_total`, `grand_total`, `rate_per_sqft`.
  - `categories`: Structural, masonry & plaster, flooring, ceiling, electrical, plumbing, painting, doors & windows, labour, furniture.
  - `budget`: `target_budget`, `estimated_total`, `construction_total`, `furniture_total`, `remaining_budget`, `overrun_amount`, `budget_consumed_pct`, `is_over_budget`, `currency_symbol: "₹"`.

> [!IMPORTANT]
> **Authoritative Invariant**: The dashboard redesign reads values directly from `calculateAuthoritativeBOM` or `layout_data.bomResult`. It never recomputes, invents, or estimates with arbitrary alternate multipliers.

---

## 6. Existing 2D & 3D Renderers

- **2D Drafting**:
  - `InteractiveBlueprint.tsx`: SVG-based canvas with viewport pan/zoom, room dragging, furniture placement, circulation overlays.
  - Read-only preview: SVG vector projection based on room coordinates `(x, y, width, height)` and doors/windows.
- **3D Exploration**:
  - `FloorPlan3D.tsx`: Three.js scene utilizing `@react-three/fiber` and `@react-three/drei`, calling `building3DGenerator.ts` to extrude slabs, walls, door headers, and generate instanced furniture.
  - `Project3DPreviewModal.tsx`: Lightweight, on-demand read-only modal with orbital controls and auto-orbit.
  - Resource lifecycle: Disposes geometries, materials, and renderer on unmount.

---

## 7. Dependencies & Styling System

- **Animation**: `framer-motion` (v14.0.0). No new animation dependencies required.
- **Icons**: `lucide-react` (v1.16.0). Consistent thin-stroke (1.5px) styling.
- **Styling**: Vanilla CSS with comprehensive CSS custom properties in `src/index.css`.
- **Typography**:
  - Display: `Newsreader` (Editorial Serif, Google Fonts)
  - UI/Body: `Plus Jakarta Sans` (Neutral Grotesque, Google Fonts)
  - Technical / Mono: `JetBrains Mono` (Tabular figures, Google Fonts)
- **Palette**:
  - Paper: `--paper-warm` (`#F3F0E7`), `--paper-sheet` (`#FAF8F2`), `--paper-crisp` (`#FFFFFF`)
  - Ink: `--ink-primary` (`#252622`), `--ink-secondary` (`#474943`), `--ink-annotation` (`#777970`)
  - Dark Stage: `--studio-graphite` (`#272A29`), `--studio-deep` (`#1B1D1C`), hairline border `rgba(255,255,255,0.08)`
  - Architectural Accents: `--accent-vermilion` (`#D85740`), `--accent-cobalt` (`#365FA8`), `--accent-sage` (`#437A5D`)

---

## 8. Test Setup & Baseline Status

- **Backend Tests**: `pytest` runs in `backend/`. Baseline: **143 tests passed in 9.73s**.
- **Frontend Tests**: Executable via `npx tsx`:
  - `test_geometry_suite.ts`: 10/10 passed.
  - `test_furniture_suite.ts`: 10/10 passed.
  - `test_financial_bom_suite.ts`: 53/53 passed.
  - `test_shaft_and_viewport_suite.ts`: 11/11 passed.
  - `test_export_suite.ts`: 6/6 passed.
- **Production Build Baseline**:
  - Command: `npm run build` (`tsc -b && vite build`)
  - Build Time: 5.06s
  - Chunks & Sizes:
    - `dist/index.html`: 1.33 kB (gzip: 0.70 kB)
    - `dist/assets/index-BzAuV8Oe.css`: 5.41 kB (gzip: 1.79 kB)
    - `dist/assets/Dashboard-Cz-Ljx8Q.js`: 69.51 kB (gzip: 15.05 kB)
    - `dist/assets/Landing-C-sN8JTQ.js`: 51.77 kB (gzip: 10.85 kB)
    - `dist/assets/Project3DPreviewModal-DRLCQ36v.js`: 6.44 kB (gzip: 2.33 kB)
    - `dist/assets/bomCalculator-gEvMwOJQ.js`: 7.08 kB (gzip: 2.73 kB)
    - `dist/assets/furnitureRegistry-BOUfnHjK.js`: 14.47 kB (gzip: 3.12 kB)
    - `dist/assets/index-BWVoOaiv.js`: 471.83 kB (gzip: 135.62 kB)
    - `dist/assets/Editor-R6AwcqBu.js`: 886.46 kB (gzip: 301.94 kB)
    - `dist/assets/building3DGenerator-NKyQJ1c1.js`: 924.37 kB (gzip: 247.40 kB)
- **Three.js Initial Bundle Check**: Three.js is **NOT** bundled into the initial dashboard chunk; it is isolated in lazy-loaded chunks (`building3DGenerator` and `Project3DPreviewModal`).

---

## 9. Identified Risks & File Plan

### Risks:
1. **Form input regression**: Generation input states must remain 100% compatible with backend `GeneratePlansPayload`.
2. **Bundle pollution**: Under no circumstances should 3D canvas libraries be imported into the top-level dashboard chunk.
3. **WCAG AA Compliance**: High-contrast ratios must be maintained across both paper (light) and stage (dark) zones.
4. **Layout Shift (CLS)**: Skeletons and image frames must have deterministic aspect ratios (3:2, 4:3, 4:5).

### Files to Create / Modify:
1. `docs/ui-redesign/01-audit.md` (this audit)
2. `docs/ui-redesign/02-reference-analysis.md` (reference findings)
3. `docs/ui-redesign/03-design-spec.md` (complete design system & component spec)
4. `docs/ui-redesign/04-final-report.md` (final verification & metrics report)
5. `frontend/src/index.css` (tokens, typography, motion tokens, reduced motion)
6. `frontend/src/modules/dashboard/components/StudioHeader.tsx` (app shell navigation)
7. `frontend/src/modules/dashboard/components/StudioHeroOpening.tsx` (cinematic dark stage, brief input, parameter row, focal project visual)
8. `frontend/src/modules/dashboard/components/StudioContinueStrip.tsx` (quick resume strip)
9. `frontend/src/modules/dashboard/components/StudioProjectArchive.tsx` (curated portfolio, grid/list toggle, sorting, filtering, deterministic ratios, hover peek)
10. `frontend/src/modules/dashboard/components/StudioPlanPreviewSvg.tsx` (architectural vector plan thumbnail)
11. `frontend/src/modules/dashboard/components/StudioFinancialSection.tsx` (authoritative financial intelligence, ledger layout, stacked bar, budget alert)
12. `frontend/src/modules/dashboard/components/Studio3DStageModal.tsx` (lazy 3D preview, intent-based activation, WebGL resource disposal)
13. `frontend/src/modules/dashboard/pages/Dashboard.tsx` (integrate redesigned studio components cleanly while preserving all state, APIs, and actions)
14. `frontend/src/modules/dashboard/__tests__/dashboard_redesign_suite.ts` (test suite for grid/list toggle, filters, BOM math equivalence, SVG generator, reduced motion)
