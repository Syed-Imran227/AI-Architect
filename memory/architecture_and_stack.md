# Technology Stack & System Architecture (V2 Atelier)

## 1. Frontend Presentation Layer
- **Framework & Runtime:** React 19 + TypeScript (ES2022)
- **Bundler & Dev Server:** Vite 8
- **Architectural Design System:** Warm Architectural Paper aesthetic (`#FAF8F5`, `#FAF7F2`, `#252622`, `#E8E2D6`, `#C85A32`)
- **Rendering Engines:**
  - **2D Drafting Canvas:** HTML5 Browser SVG with 60FPS pointer event tracking, 8-handle CAD resizing, and live dimension HUD.
  - **3D Cinematic Viewport:** `@react-three/fiber` & `@react-three/drei` (Three.js WebGL) supporting Stacked/Isolated/Exploded modes, Dollhouse cutaways, X-Ray wireframe, and dynamic solar shadow maps.
- **State & Geometry Architecture:**
  - `commandEngine.ts`: Command pattern orchestrator enforcing `(doc, command) -> (validated_doc, inverse_patch)`.
  - `commands.ts`: Atomic actions (`SetRoomBoundsCommand`, `MoveOpeningCommand`, `AddFurnitureCommand`, etc.).
  - `validators.ts`: Invariant checks (Plot boundary containment, non-overlap, minimum room dimensions).
  - `migration.ts`: Pure schema version migrations ensuring backward compatibility.
- **Modular Directory Structure (`frontend/src/`):**
  - `modules/auth/`: Studio Enrollment, Login, AuthContext, Supabase Bridge.
  - `modules/dashboard/`: Studio Header, Project Archive, Financial Strip, Hero Opening Sequence.
  - `modules/editor/`: 5 Atelier workspace views, 2D drafting canvas, 3D WebGL viewport, Multi-Floor Wizard, Copilot Agent panel.
  - `shared/api-client/`: Strict TypeScript API client (`api.ts`, `supabase.ts`).

---

## 2. Backend Processing Layer
- **Framework & ASGI Server:** Python 3.10+ with FastAPI and Uvicorn.
- **Core Architecture Modules (`backend/`):**
  - `core/`:
    - `auth.py`: JWT HS256 authentication, Bcrypt password hashing, token validation dependencies.
    - `identity_bridge.py`: Translates Supabase Auth JWT claims into unified internal session models.
  - `db/`:
    - `supabase_client.py`: Asynchronous Supabase PostgreSQL client.
    - `repositories.py`: Dual-persistence repository layer (Supabase PostgreSQL primary with automated fallback to MongoDB Atlas).
    - `migrations/`: Milestone 3 SQL schema scripts and Row Level Security (RLS) policies.
  - `engines/`:
    - `canonical_model.py`: Formal Pydantic geometry schemas (`CanonicalBuildingDocument`, `CanonicalFloor`, `CanonicalRoom`, `CanonicalOpening`, `CanonicalWallSegment`, `CanonicalFurnitureItem`, `CanonicalStaircase`).
    - `intelligent_generator.py`: Multi-candidate layout synthesis (Central Core, Lateral Spine, Garden Buffer).
    - `architectural_layout.py`: Multi-floor deterministic drafter with vertical core shaft locking and setback offset clamping.
    - `sunlight_engine.py`: Solar azimuth/elevation calculation, window daylight penetration depth, and lux distribution.
    - `circulation.py`: BFS pathfinding on room adjacency graph, computing egress paths and detecting landlocked zones.
    - `window_placer.py`: Deterministic exterior wall window placement with door clearance.
    - `bom_engine.py` & `cost_rates.py`: Delhi Schedule of Rates (CPWD DSR 2026) financial calculator.
    - `vastu_engine.py`: 10-rule geometric compass scoring engine using centroid math and transition exemptions.
    - `nbc_engine.py`: Indian National Building Code (NBC 2016) setback, FAR, and room dimension validator.
    - `inference.py`: Multi-model LLM inference router with fallback chain.
  - `services/`:
    - `agent_service.py`: Conversational Copilot agent service parsing natural language into architectural actions.
    - `layout_modifier.py`: Non-destructive spatial modifier updating shared partitions and openings.
  - `exporters/`:
    - `pdf_dossier.py`: 4-page Executive Blueprint Dossier (ReportLab Platypus).
    - `dxf_exporter.py`: Multi-floor layered AutoCAD DXF generator (`ezdxf`).
    - `floor_renderer.py`: High-resolution Pillow PNG concept sketch compiler.

---

## 3. Persistence & Cloud Infrastructure
- **Primary Database:** **Supabase PostgreSQL**
  - Tables: `profiles`, `projects`, `plans`, `revisions`.
  - Security: Row Level Security (RLS) active on all tables (`auth.uid() = user_id`).
- **Secondary / Fallback Database:** **MongoDB Atlas**
  - Async driver: Motor (`AsyncIOMotorClient`).
  - Collections: `users`, `projects`.
- **Identity Bridge:** Ensures user accounts and projects sync seamlessly across both databases.

---

## 4. AI & Inference Infrastructure
- **Topological Reasoning (The AI Architect):**
  - Multi-provider fallback chain:
    1. Google `gemini-3.1-pro-preview` (AI Studio)
    2. DeepSeek `deepseek-ai/DeepSeek-V3-0324` (HuggingFace Inference Router)
    3. Google `gemini-3.8-flash`
    4. Google `gemini-3.7-flash`
    5. Qwen `qwen/qwen3.8-27b` (Groq fallback)
- **Deterministic Drafter:** Zero LLM hallucination on coordinates; all dimensions, setbacks, and wall graphs are solved mathematically in Python.

---

## 5. Complete API Endpoint Reference

| Method | Endpoint | Auth | Layer / Service | Description |
| :--- | :--- | :---: | :--- | :--- |
| `POST` | `/auth/register` | Public | Auth | Register new studio user |
| `POST` | `/auth/login` | Public | Auth | Authenticate user & return JWT token |
| `GET` | `/projects` | JWT | Repositories | List all saved projects for current user |
| `POST` | `/projects` | JWT | Repositories | Save or update building document |
| `GET` | `/projects/{id}` | JWT | Repositories | Retrieve full project document by ID |
| `DELETE` | `/projects/{id}` | JWT | Repositories | Delete project document |
| `POST` | `/generate` | JWT | Drafter / Engine | Legacy single-floor generation endpoint |
| `POST` | `/generate-candidates` | JWT | Intelligent Generator | Synthesize multi-candidate layouts (Core, Spine, Buffer) |
| `POST` | `/evaluate-sunlight` | JWT | Sunlight Engine | Compute solar azimuth, shadow projection, and lux |
| `POST` | `/vastu-fix` | JWT | Vastu / Inference | AI-driven topology correction for failing Vastu rules |
| `POST` | `/regenerate-room` | JWT | Drafter / Inference | Regenerate single room topology via LLM |
| `POST` | `/agent/chat` | JWT | Agent Service | Conversational Copilot assistant dialogue |
| `POST` | `/agent/modify-layout` | JWT | Layout Modifier | Execute natural language spatial edit commands |
| `POST` | `/export/dxf` | JWT | DXF Exporter | Download production-grade layered AutoCAD DXF |
| `POST` | `/export/report` | JWT | PDF Report | Download standard 4-page architectural PDF report |
| `POST` | `/export/dossier` | JWT | PDF Dossier | Download Executive Blueprint Dossier |
| `POST` | `/export/svg` | JWT | Exporters | Export vector SVG floor plan |
| `POST` | `/export/bom-csv` | JWT | BOM Engine | Download itemized CPWD BOM schedule as CSV |

---

## 6. Testing & Quality Verification Suite
- **User Test Suite (`ai_architect_tests`):** 99/99 passed (100%)
  - `test_auth.py` (11 tests), `test_circulation.py` (10 tests), `test_drafter.py` (59 tests), `test_engines.py` (11 tests), `test_nbc_setbacks.py` (8 tests).
- **Canonical Backend Test Suite (`backend/tests/`):** 14/14 passed (100%)
  - `test_canonical_geometry.py` (9 tests), `test_intelligent_generator.py` (5 tests).
- **Frontend Production Build:** Vite build clean with 0 TypeScript/ESLint errors across 2,809 modules.
