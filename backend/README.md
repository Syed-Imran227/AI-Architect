# AI Architect (Backend Processing & Engines)

The backend engine suite for **AI Architect (V2 Atelier)**: an asynchronous FastAPI architecture running deterministic architectural drafting algorithms, multi-candidate layout synthesis, solar daylight simulation, Vastu Shastra compliance analysis, CPWD BOM financial schedules, and production AutoCAD/PDF exporters.

---

## 🏛 System Architecture

The backend implements a strict **Architect-Drafter Hybrid Model**:
- **The AI Architect (LLM Chain):** Google Gemini 3.1 Pro / DeepSeek-V3-0324 / Gemini 3.8 Flash evaluates the architectural program and decides spatial topology (room allocations, bay grouping, orientation). It produces **topological JSON only**—never raw coordinates.
- **The Deterministic Drafter (`intelligent_generator.py` & `architectural_layout.py`):** A strictly mathematical Python engine partitions the plot canvas into exact parametric rectangles, enforces NBC setbacks, aligns vertical shafts, and guarantees 100% buildable coordinates.
- **Canonical Building Document (`canonical_model.py`):** Unifies plot bounds, levels, wall graphs, openings, stairs, and furniture into a single authoritative schema.

---

## 📂 Backend Structure

```text
backend/
├── core/
│   ├── auth.py                      # JWT HS256 auth, Bcrypt hashing, get_current_user dependencies
│   └── identity_bridge.py           # Supabase-to-MongoDB session bridge
├── db/
│   ├── database.py                  # MongoDB async connection lifecycle
│   ├── models.py                    # Pydantic v2 schemas
│   ├── repositories.py              # Dual-persistence layer (Supabase PostgreSQL primary + MongoDB fallback)
│   ├── supabase_client.py           # Async Supabase PostgreSQL REST client
│   └── migrations/                  # SQL schema & Row Level Security (RLS) migrations
├── engines/
│   ├── canonical_model.py           # CanonicalBuildingDocument, CanonicalFloor, CanonicalRoom, etc.
│   ├── intelligent_generator.py     # Multi-candidate synthesis (Central Core, Lateral Spine, Garden Buffer)
│   ├── architectural_layout.py      # Multi-floor deterministic drafter with vertical core shaft pinning
│   ├── sunlight_engine.py           # Solar azimuth/elevation, daylight lux distribution, shadow casting
│   ├── circulation.py               # BFS pathfinding on room adjacency graph
│   ├── window_placer.py             # Exterior wall window placement with door clearance
│   ├── bom_engine.py                # CPWD DSR 2026 financial cost estimator
│   ├── cost_rates.py                # 2026 CPWD Delhi Schedule of Rates constants
│   ├── vastu_engine.py              # 10-rule geometric compass scoring engine
│   ├── nbc_engine.py                # Indian National Building Code 2016 setbacks & FAR validator
│   └── inference.py                 # Multi-provider LLM fallback chain
├── services/
│   ├── agent_service.py             # Conversational Copilot agent service
│   └── layout_modifier.py           # Non-destructive spatial modifier updating shared partitions
├── exporters/
│   ├── pdf_dossier.py               # 4-page Executive Blueprint Dossier (ReportLab Platypus)
│   ├── dxf_exporter.py              # Multi-floor layered AutoCAD DXF generator (ezdxf)
│   └── floor_renderer.py            # High-resolution Pillow PNG concept sketch compiler
├── routers/
│   ├── agent_routes.py              # Copilot conversation & layout modification endpoints
│   ├── engine_routes.py             # Floor plan generation, candidates, and solar endpoints
│   ├── export_routes.py             # DXF, PDF dossier, SVG, and BOM CSV export endpoints
│   └── projects_routes.py           # Project CRUD & revision history endpoints
└── tests/
    ├── test_canonical_geometry.py   # Canonical model serialization & stair pinning tests
    └── test_intelligent_generator.py# Multi-candidate generator & setback enforcement tests
```

---

## 🚀 Setup & Execution

### Prerequisites
- Python 3.10+
- Virtual environment (`venv`)

### 1. Installation
```powershell
cd backend
python -m venv .venv
..\.venv\Scripts\activate; pip install -r requirements.txt
```

### 2. Environment Configuration (`backend/.env`)
```env
# AI & LLM Inference Keys
GEMINI_API_KEY=AIzaSy...
HF_API_KEY=hf_...
GROQ_API_KEY=gsk_...

# Authentication & Security
JWT_SECRET=your_super_secret_jwt_key_here
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# Primary Database: Supabase PostgreSQL
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=ey...
SUPABASE_JWT_SECRET=your_supabase_jwt_secret

# Secondary Database: MongoDB Atlas (Fallback)
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/ai_architect?retryWrites=true&w=majority
```

### 3. Start the Server
```powershell
..\.venv\Scripts\activate; uvicorn main:app --reload --port 8000
```
Interactive Swagger docs: `http://127.0.0.1:8000/docs`.

---

## 🧪 Testing

```powershell
# Run canonical backend tests (14 tests)
..\.venv\Scripts\activate; pytest tests/ -v

# Run external verification suite (99 tests)
..\.venv\Scripts\activate; pytest "C:\Users\syedi\Downloads\ai_architect_tests" -v
```
**Total automated test coverage: 113 / 113 passed (100%).**
