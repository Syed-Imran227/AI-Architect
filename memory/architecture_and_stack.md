# Technology Stack & Architecture

## Frontend Presentation Layer
- **Framework:** React 19 + TypeScript
- **Build Tooling:** Vite 6
- **Styling:** Vanilla CSS, custom glassmorphism design system
- **Theming:** Dual Light/Dark modes switched via CSS variables
- **Rendering:** Native HTML/Browser SVG for the 2D layout editor (drag-overlay pattern for 60FPS)

## Backend Processing Layer
- **Framework:** Python + FastAPI
- **Web Server:** Uvicorn (ASGI)
- **Database:** **MongoDB Atlas** via Motor (Async PyMongo). MONGO_URI is configured in `backend/.env`.
  - ⚠️ NOT SQLite — any docs/notes saying SQLite are incorrect.
- **Authentication:** Python-Jose (JWT HS256, 7-day expiry), Bcrypt password hashing. JWT_SECRET must be set in `.env` — no fallback.
- **Image Rendering:** Pillow (Python Imaging Library), auto-scaled floor plan PNGs streamed as Base64 to client.
- **CAD Exporter:** `ezdxf` — writes wall polylines + door arcs (per-wall, from layout JSON) to AutoCAD R2010-compatible DXF at 1ft = 304.8mm scale.

## AI Infrastructure
- **Layout Engine:** **Deterministic Python** (`backend/architectural_layout.py`) — all room geometry, corridor, and door placement is handled in Python. The LLM is NOT used for spatial coordinates.
- **Furniture Placement:** `backend/inference.py` injects standard furniture items deterministically (catalog-based, no LLM call).
- **Vastu Scoring:** `backend/vastu_engine.py` — rule-based scorer (10 rules, 3×3 compass grid). Scoring only — no LLM repair loop exists.
- **LLM Provider:** **Groq** (`api.groq.com/openai/v1`) — NOT Hugging Face.
- **LLM Model:** `llama-3.3-70b-versatile`
- **API Key:** `GROQ_API_KEY` in `backend/.env`

## Security Notes (as of Aug 2026)
- `/generate` and `/export/dxf` endpoints require valid JWT (`Depends(get_current_user)`).
- JWT_SECRET raises `ValueError` on startup if missing (no insecure fallback).
- Error responses are sanitized — no raw exceptions or API context leaked to frontend.
- CORS is currently `allow_origins=["*"]` — restrict before production deployment.
