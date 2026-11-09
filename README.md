# ⬡ AI Architect (V2 Atelier)

[![Backend Tests](https://img.shields.io/badge/backend%20tests-113%2F113%20passed-brightgreen.svg)](#-testing--quality-verification)
[![Frontend Build](https://img.shields.io/badge/frontend%20build-clean%200%20errors-brightgreen.svg)](#2-frontend-setup)
[![React](https://img.shields.io/badge/frontend-React%2019%20%7C%20TypeScript%20%7C%20Vite%208-blue.svg)](frontend/)
[![FastAPI](https://img.shields.io/badge/backend-FastAPI%20%7C%20Python%203.10%2B-009688.svg)](backend/)
[![Three.js](https://img.shields.io/badge/3D%20ArchViz-Three.js%20%7C%20R3F-black.svg)](frontend/src/modules/editor/components/FloorPlan3D.tsx)
[![Database](https://img.shields.io/badge/database-Supabase%20PostgreSQL%20(RLS)%20%2B%20MongoDB%20Atlas-orange.svg)](#-persistence--cloud-infrastructure)

**AI Architect (V2 Atelier)** is a full-stack, production-grade generative CAD platform that transforms natural language and parametric briefs into mathematically sound, regulation-compliant, buildable multi-floor architectural blueprints.

It combines a multi-model LLM inference fallback chain for spatial topology planning with a deterministic Python geometric drafter and an immutable canonical building document model, guaranteeing **zero room overlaps**, **perfect wall alignment**, and **complete structural continuity** across up to 4 stacked floors.

---

## 🏗 The Architect-Drafter Hybrid Model & Canonical Document

A persistent failure mode of pure Large Language Models in spatial design is *coordinate hallucination*—generating overlapping rooms, disconnected doors, or physically impossible non-rectangular geometries. AI Architect solves this through a strict separation of concerns:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      PRESENTATION LAYER                                │
│       React 19 SVG 2D Blueprint Canvas  &  Three.js 3D Viewport        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Commands (JSON)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   CANONICAL GEOMETRY ENGINE                            │
│  One Source of Truth: CanonicalBuildingDocument (Plot, Levels, Walls)  │
│  CommandEngine: Candidate Doc ➔ Validators ➔ Atomic Commit / Undo      │
└──────────────────┬─────────────────────────────────┬───────────────────┘
                   │                                 │
                   ▼                                 ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│       THE AI ARCHITECT (LLM)         │  │  THE DETERMINISTIC DRAFTER   │
│ Priority Chain:                      │  │ Python Grid Partitioner:     │
│ 1. Gemini 3.1 Pro Preview            │  │ • 0 Overlaps by Construction │
│ 2. DeepSeek-V3-0324 (671B)           │  │ • NBC Setbacks & Clearances  │
│ 3. Gemini 3.8 Flash                  │  │ • Locked Vertical Core Shafts│
│ ➔ Outputs Topological Program (JSON) │  │ ➔ Exact Decimal Coordinates  │
└──────────────────────────────────────┘  └──────────────────────────────┘
```

1. **The AI Architect (LLM Chain):** Google Gemini 3.1 Pro / DeepSeek-V3-0324 evaluates the architectural program, deciding which rooms exist, room zoning (public vs private bays), orientation, and spatial adjacencies. It produces **topological JSON only**—never raw coordinates.
2. **The Deterministic Drafter (`intelligent_generator.py` & `architectural_layout.py`):** A mathematical Python engine partitions the plot canvas into exact parametric rectangles, enforces NBC setbacks, aligns vertical staircase cores, and guarantees 100% buildable coordinates.
3. **Canonical Building Document (`canonical_model.py`):** Unifies plot bounds, levels, wall graphs, openings, stairs, and furniture into a single authoritative schema. 2D blueprints, 3D WebGL scenes, CPWD financial schedules, and AutoCAD DXF files are projections of this document.

---

## ✨ Key Features

### 🏢 1. Multi-Floor Generative Synthesis (Up to 4 Floors)
- Generates **Level 0 (Ground Floor)**, **Level 1 (Duplex Upper)**, **Level 2 (Floor 2)**, and **Level 3 (Rooftop Terrace)**.
- **Vertical Core Locking:** Staircases and service ducts maintain identical $(X, Y)$ footprints across all floors, preventing structural stair disconnects.
- **Duplex Voids:** Dynamically accommodates double-height spatial volumes over ground floor living areas.

### 📐 2. Multi-Candidate Synthesis (`intelligent_generator.py`)
- Synthesizes 3 distinct architectural typologies for any given plot:
  - **Central Core:** Public zones wrap around a central foyer and spine staircase.
  - **Lateral Spine:** Linear service corridor branching symmetrically north and south.
  - **Garden Buffer:** Courtyard-centric layout maximizing daylight and green buffer zones.
- Provides objective candidate rankings based on Vastu harmony, circulation efficiency, daylight index, and structural coverage.

### ☀️ 3. Cinematic 3D ArchViz & Sunlight Simulation (`FloorPlan3D.tsx`)
- High-fidelity WebGL rendering powered by Three.js and `@react-three/fiber`:
  - **Dollhouse Cutaways:** 4.5 ft and 10 ft sliced views with dark slate `#1e293b` wall caps.
  - **Stacked vs Isolated vs Exploded:** View individual floor plates or the full 4-story stack with ghost floor outlines.
  - **Solar Daylighting:** Real-time AM, Noon, Golden Hour, and Night timeline with physical shadow casting based on plot azimuth.
  - **Night Mode Luminaires:** 2700K warm incandescent point lights placed in room centroids.
  - **X-Ray Core Mode:** Translucent cyan walls (10% opacity) showing structural shafts and vertical circulation.
  - **Architectural Section Plane:** Dynamic front/side section cuts with an interactive clipping slider.
  - **Procedural Landscaping:** Perimeter boundary walls, lawn turf, swimming pools, timber pergolas, and palm trees.

### ✏️ 4. 2D CAD Blueprint Workspace (`InteractiveBlueprint.tsx`)
- 60FPS vector SVG canvas with Warm Architectural Paper aesthetic (`#FAF8F5`).
- **8-Handle CAD Resizing:** 8 directional handles (`nw`, `ne`, `se`, `sw`, `n`, `s`, `e`, `w`) with stationary anchor vector math.
- **Partition Sync Toggle:** Switch between stretching shared walls (`[ 🔗 Sync Partition ]`) or independent room expansion (`[ ⤢ Independent Room ]`).
- **Live Dimension HUD:** Floating badges displaying real-time width, depth, and area in imperial and metric units.
- **Circulation & Solar Overlays:** Visualized BFS egress paths and sun azimuth arc.

### 🤖 5. Conversational Copilot Agent (`agent_service.py`)
- Context-aware architectural assistant embedded directly in the drafting canvas.
- Interprets natural language instructions (*"Make kitchen 2ft wider"*, *"Swap guest room and pooja room"*), generates non-destructive geometry patches via `layout_modifier.py`, and presents visual preview diffs before committing.

### 🧿 6. Regulatory & Cultural Compliance
- **Vastu Shastra Engine (`vastu_engine.py`):** 10-rule geometric scoring engine using a 3×3 compass mandala grid and centroid mathematics. Exempts transitional spaces (corridors, stairs) to achieve valid 70+/100 baseline scores.
- **NBC 2016 Compliance (`nbc_engine.py`):** Validates setbacks, Floor Area Ratio (FAR), minimum room dimensions, and window ventilation percentages against the Indian National Building Code.

### 📊 7. CPWD BOM Financial Studio (`bom_engine.py`)
- Official Delhi Schedule of Rates (CPWD DSR 2026) cost estimation:
  - Itemized breakdowns for RCC structure, brick masonry, premium flooring, waterproofing, MEP wiring/plumbing, and labor (30%).
  - Real-time interactive budget strip with Indian Lakh/Crore formatting.

### 📥 8. Production CAD & PDF Exporters
- **AutoCAD DXF:** Multi-floor layered DXF files with millimeter-accurate walls, inward swing door arcs, windows, and labels.
- **Executive PDF Dossier:** 4-page client report containing project brief, floor blueprints, Vastu radar analysis, and CPWD BOM schedules.
- **High-Res Concept Sketch:** Pillow-rendered presentation drawing with title block and north arrow.

---

## 🛠 Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, TypeScript (ES2022), Vite 8, Lucide React, React Hot Toast |
| **3D Graphics** | Three.js, `@react-three/fiber`, `@react-three/drei` |
| **Backend** | Python 3.10+, FastAPI, Uvicorn (ASGI) |
| **AI Inference** | Google GenAI SDK (`gemini-3.1-pro-preview`, `gemini-3.8-flash`), HuggingFace Inference Router (`DeepSeek-V3-0324`), Groq (`qwen3.8-27b`) |
| **CAD & Graphics** | `ezdxf` 1.4+, ReportLab 4.1+, Pillow 11.0+, Shapely 2.1+, Pysolar |
| **Databases** | **Supabase PostgreSQL** (Primary with Row Level Security) + **MongoDB Atlas** (Async Motor driver fallback) |
| **Security** | Python-Jose (JWT HS256), Bcrypt password hashing, Supabase Auth Bridge |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: `^20.19.0` or `>=22.12.0`
- **Python**: `3.10+`
- **Git**

---

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# Windows (PowerShell):
..\.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

#### Backend Environment Variables
Create a `.env` file in the `backend/` directory:

```env
# AI & LLM Inference Keys
GEMINI_API_KEY=AIzaSy...
HF_API_KEY=hf_...
GROQ_API_KEY=gsk_...

# Authentication & Security
JWT_SECRET=your_super_secret_jwt_key_here
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# Primary Database: Supabase PostgreSQL (Optional but recommended)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=ey...
SUPABASE_JWT_SECRET=your_supabase_jwt_secret

# Secondary Database: MongoDB Atlas (Fallback)
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/ai_architect?retryWrites=true&w=majority
```

Start the backend server:
```powershell
..\.venv\Scripts\activate; uvicorn main:app --reload --port 8000
```
The API documentation will be available at `http://127.0.0.1:8000/docs`.

---

### 2. Frontend Setup

Open a new terminal:

```bash
cd frontend

# Install packages
npm install

# Create environment configuration
cp .env.example .env
```

#### Frontend Environment Variables (`frontend/.env`):
```env
VITE_API_URL=http://127.0.0.1:8000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=ey...
```

Start the development server:
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

To verify a production build:
```bash
npm run build
```

---

## 🧪 Testing & Quality Verification

All 113 automated unit, integration, and geometry tests pass 100%:

```powershell
# 1. Run User External Test Suite (99 tests)
cd backend
..\.venv\Scripts\activate; pytest "C:\Users\syedi\Downloads\ai_architect_tests" -v

# 2. Run Canonical Geometry & Generator Test Suite (14 tests)
cd backend
..\.venv\Scripts\activate; pytest tests/ -v
```

### Test Suite Summary:
- **`test_drafter.py`** (59 tests): Zero room overlaps, plot boundary containment, corridor clearances.
- **`test_canonical_geometry.py`** (9 tests): `CanonicalBuildingDocument` serialization, multi-floor stair pinning.
- **`test_intelligent_generator.py`** (5 tests): Central Core, Lateral Spine, Garden Buffer synthesis.
- **`test_circulation.py`** (10 tests): BFS adjacency graph traversal and landlocked room detection.
- **`test_nbc_setbacks.py`** (8 tests): Indian National Building Code 2016 setbacks and FAR limits.
- **`test_engines.py`** (11 tests): Vastu Shastra quadrant scoring and CPWD BOM pricing.
- **`test_auth.py`** (11 tests): JWT registration, login, and session validation.

---

## 🖼 Visual Gallery & Verification Figures

See [`figures/README.md`](figures/README.md) for the complete visual catalog:

- [`fig_01_atelier_landing_hero.png`](figures/fig_01_atelier_landing_hero.png) — Atelier landing hero with interactive concept drawing suite.
- [`fig_05_multifloor_wizard_step1_massing.png`](figures/fig_05_multifloor_wizard_step1_massing.png) — Multi-Floor Wizard Step 1: 4-story massing & duplex void.
- [`fig_08_2d_drafting_cad_workspace.png`](figures/fig_08_2d_drafting_cad_workspace.png) — 2D Blueprint Editor with 8-handle CAD resizing and solar arc overlay.
- [`fig_09_3d_dollhouse_night_luminaires.png`](figures/fig_09_3d_dollhouse_night_luminaires.png) — 3D Massing dollhouse at night with 2700K warm luminaires and pool.
- [`fig_10_3d_dollhouse_daylight_am_sun.png`](figures/fig_10_3d_dollhouse_daylight_am_sun.png) — 3D Massing dollhouse under AM sunlight with directional shadows.
- [`fig_11_3d_xray_vertical_core_shaft.png`](figures/fig_11_3d_xray_vertical_core_shaft.png) — 3D X-Ray mode highlighting the continuous vertical staircase shaft.
- [`fig_12_3d_section_vertical_cutaway.png`](figures/fig_12_3d_section_vertical_cutaway.png) — Architectural front section cut showing multi-floor heights.
- [`algorithm_accuracy.jpeg`](figures/algorithm_accuracy.jpeg) — Algorithmic viability benchmark (Zero overlaps, door adjacency, Vastu, NBC).
- [`algorithm_latency.jpeg`](figures/algorithm_latency.jpeg) — Computational time-to-draft benchmark (2.5s Hybrid Drafter vs 180s GA).

---

## 📄 Academic Research Paper

The formal algorithms, mathematical proofs, and convergence benchmarks of AI Architect are documented in `ieee_paper.tex` (IEEE two-column format).
> **Note:** `ieee_paper.tex` is strictly maintained and preserved under core repository invariants.

---

## 📜 License & Compliance

Developed as an academic and professional architectural engineering platform. All bundled assets, rates, and building code formulas conform to the National Building Code of India (NBC 2016) and CPWD Delhi Schedule of Rates (DSR 2026).
