# AI Architect — Milestone 6: Baseline Inspection Report

**Date:** 2026-10-26  
**Auditor:** AI Architect Production Readiness Taskforce  
**Workspace:** `C:\Users\yoges\OneDrive\Desktop\architect\AI-Architect`  
**Active Providers:** `DATABASE_PROVIDER=mongodb`, `AUTH_PROVIDER=jwt`  

---

## 1. Executive Summary & Objective

This report establishes the verified, non-destructive initial baseline for **Milestone 6: Production Readiness, Security, and Performance Audit**. The audit evaluates the complete AI Architect stack:
- **Frontend:** React 19, TypeScript, Vite 8, Vanilla CSS, Lucide icons, Three.js, `@react-three/fiber`, `@react-three/drei`.
- **Backend:** Python 3.12, FastAPI, Uvicorn, Motor (MongoDB Atlas async client), custom JWT authentication (`python-jose`, `bcrypt`).
- **Engines & Capabilities:** 2D canvas editor, multi-floor 3D building generation, AI Copilot agent with deterministic geometry validation, Vastu & NBC compliance scorers, and itemized Bill of Materials (BOM) cost engine.

In accordance with non-negotiable safety rules:
- Work is restricted to the local workspace.
- No GitHub remotes, commits, pushes, or deployments were triggered.
- `DATABASE_PROVIDER=mongodb` and `AUTH_PROVIDER=jwt` remain active; Supabase migrations were not executed.
- No secrets, tokens, or credentials are exposed in reports or logs.

---

## 2. Baseline Build and Test Verification

Before any code inspections or corrections, the entire application test and build suite was executed to establish an indisputable quality baseline.

### 2.1 Frontend Production Build
- **Command:** `npm run build` (in `frontend/`)
- **Execution Output:** `tsc -b && vite build`
- **Result:** **PASSED** (0 TypeScript errors, 0 compilation warnings, build completed in 1.35s).
- **Bundle Output Breakdown:**

| Asset / Chunk | Size (Minified) | Gzip Size | Nature |
| :--- | :--- | :--- | :--- |
| `dist/index.html` | 1.33 kB | 0.71 kB | HTML entry |
| `dist/assets/index-tZLBEMiq.css` | 6.52 kB | 2.20 kB | Core stylesheet |
| `dist/assets/Landing-BWxk9n-H.js` | 56.93 kB | 11.72 kB | Landing page route |
| `dist/assets/Dashboard-etlXdvUv.js` | 61.61 kB | 13.65 kB | Dashboard studio route |
| `dist/assets/Editor-PZ1j024b.js` | 332.15 kB | 69.78 kB | 2D CAD & editor route |
| `dist/assets/index-Oe1bDic1.js` | 472.01 kB | 135.71 kB | Application runtime core |
| `dist/assets/FloorPlan3D-DJG0cyC2.js` | 539.84 kB | 225.65 kB | 3D Viewport & ArchViz (lazy) |
| `dist/assets/building3DGenerator-icrrDkz7.js` | 751.20 kB | 193.30 kB | 3D Geometry generator (lazy) |

### 2.2 Frontend Automated Test Suite
- **Command:** `npx tsx --test frontend/test/*.ts`
- **Suites Executed:** 20 test files
- **Total Tests:** 284 tests
- **Result:** **284 PASSED, 0 FAILED** (100% pass rate in 1.51s).
- **Verified Suites:**
  1. `test_geometry_suite.ts` (Geometry primitives & transformations)
  2. `test_multifloor_suite.ts` (Multi-floor hierarchy & elevation calculations)
  3. `test_stabilization_suite.ts` (12 critical regression & boundary tests)
  4. `test_intelligent_generator_slice.ts` (Rule-based candidate generation)
  5. `test_furniture_suite.ts` (Furniture catalog & placement commands)
  6. `test_furniture_mesh_builder.ts` (3D procedural furniture mesh construction)
  7. `test_visualization_materials.ts` (PBR material registry & GPU disposal)
  8. `test_building_3d_suite.ts` (Wall junctions, shafts, and stair geometry)
  9. `test_camera_lighting_suite.ts` (Cinematic lighting rigs & camera framing)
  10. `test_landscaping_suite.ts` (Procedural site foliage, paths, and perimeter)
  11. `test_export_suite.ts` (AutoCAD DXF export & PDF dossier structures)
  12. `test_single_floor_and_stairs.ts` (Stair termination & single-floor isolation)
  13. `test_shaft_and_viewport_suite.ts` (MEP chases, lightwells, and viewport modes)
  14. `test_dashboard_studio_suite.ts` (Dashboard tabs & project cards)
  15. `test_dashboard_3d_preview.ts` (Interactive 3D modal preview)
  16. `test_bom_financial_engine.ts` (Itemized BOM, rates, and budget delta)
  17. `test_copilot_frontend_integration.ts` (AI Copilot chat UI & action triggers)
  18. `test_editor_view_mode_toggle.ts` (2D vs 3D viewport toggle safety)
  19. `test_canonical_migration_suite.ts` (Legacy-to-canonical schema migration)
  20. `test_planarization_suite.ts` (Boundary sanitization & planar graph validation)

### 2.3 Backend Automated Test Suite
- **Command:** `pytest backend/tests`
- **Suites Executed:** 10 test files
- **Total Tests:** 154 tests
- **Result:** **154 PASSED, 0 FAILED** (100% pass rate in 12.57s).
- **Verified Suites:**
  1. `test_canonical_geometry.py` (Canonical models & coordinate transforms)
  2. `test_agent_copilot_suite.py` (AI agent parsing & deterministic operations)
  3. `test_intelligent_generator.py` (Procedural floor plan generation)
  4. `test_bom_financial_engine.py` (Backend BOM calculations & schedules)
  5. `test_auth_token_passthrough.py` (Bearer token extraction & auth header handoff)
  6. `test_authorization_hardening.py` (Cross-user IDOR rejection & ownership checks)
  7. `test_identity_bridge_persistence.py` (Fail-closed UUID-to-ObjectId resolution)
  8. `test_isolated_supabase_auth.py` (Supabase JWT cryptographic validation)
  9. `test_migrate_mongo_to_supabase.py` (Dry-run data migration engine)
  10. `test_repository_mapping.py` (Repository layer dispatch & fallback storage)

---

## 3. Configuration and Environment Inventory

### 3.1 Tracked Files vs. Local Files
- Verification via `git ls-files .env* backend/.env* frontend/.env*`:
  - **Tracked in Git:**
    - `backend/.env.example`
    - `frontend/.env.example`
  - **Untracked (Protected by `.gitignore`):**
    - `backend/.env`
    - `frontend/.env`
    - Root `.gitignore` has comprehensive exclusion rules (`.env`, `.env.local`, `.env.*`, with negative pattern `!.env.example`).
  - **No live `.env` files or secret values are tracked by Git.**

### 3.2 Required Environment Variables Inventory

| Variable | Scope | Provider | Purpose | Default / Requirement |
| :--- | :--- | :--- | :--- | :--- |
| `DATABASE_PROVIDER` | Backend | Both | Controls persistence layer | `"mongodb"` (default) or `"supabase"` |
| `AUTH_PROVIDER` | Backend | Both | Controls token validation engine | `"jwt"` (default) or `"supabase"` |
| `MONGO_URI` | Backend | MongoDB | MongoDB connection string | Required when `DATABASE_PROVIDER=mongodb` |
| `JWT_SECRET` | Backend | Custom JWT | HMAC-SHA256 signature secret | Required when `AUTH_PROVIDER=jwt` |
| `CORS_ORIGINS` | Backend | Both | Permitted frontend origins | `"http://localhost:5173"` (comma-separated) |
| `GROQ_API_KEY` | Backend | AI Engines | Groq Cloud LLM API key | Optional if GEMINI/GOOGLE/HF configured |
| `GEMINI_API_KEY` | Backend | AI Engines | Google Gemini API key | Optional fallback |
| `GOOGLE_API_KEY` | Backend | AI Engines | Google AI Studio API key | Optional fallback |
| `HF_API_KEY` | Backend | AI Engines | Hugging Face inference key | Optional fallback |
| `VITE_API_BASE_URL` | Frontend | Client | Backend API root URL | `"http://localhost:8000"` |
| `VITE_AUTH_PROVIDER` | Frontend | Client | Client auth mechanism | `"jwt"` (default) or `"supabase"` |

---

## 4. Initial Dependency Vulnerability Check

### 4.1 Frontend (`npm audit`)
- **Total Vulnerabilities Reported:** 10 (2 moderate, 8 high)
- **Primary Packages Affected:**
  - `vite` (8.0.0–8.1.5): Dev server middleware & launch-editor UNC path issues (affects development server only, not static production bundles).
  - `react-router` (6.0.0–7.18.1): SSR deserialization & backslash redirect (AI Architect uses client-side SPA routing without SSR).
  - `zod` (<4.6.6): High memory on oversized constrained collections.
  - `postcss` (<=8.5.22): Source map path traversal in dev toolchain.
- **Production Impact Assessment:** None of the reported vulnerabilities affect the static production bundle served to end users; they pertain to the local Vite development server and SSR hydration paths. Upgrades should be scheduled deliberately rather than applied automatically with breaking changes.

### 4.2 Backend (`pip list`)
- Python 3.12 packages audited.
- `pip-audit` was not installed in the local virtual environment.
- Documented under "Checks not performed or blocked" for manual follow-up.

---

## 5. Summary Baseline Table

| Metric / Check | Baseline Value | Status |
| :--- | :--- | :--- |
| Total Automated Tests | 438 tests | **100% Passed (438/438)** |
| Frontend Test Suites | 20 test files | **284/284 Passed** |
| Backend Pytest Suites | 10 test files | **154/154 Passed** |
| Frontend Production Build | `tsc -b && vite build` | **Clean (0 errors, 1.35s)** |
| Production JS Assets | 2.37 MB uncompressed (707 kB gzip) | **Code-split across 8 chunks** |
| Tracked Secrets in Git | 0 secrets | **Verified Clean** |
| Hardcoded JWTs / Keys in Frontend | 0 secrets | **Verified Clean** |
