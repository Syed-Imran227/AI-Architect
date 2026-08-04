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
- **Database:** MongoDB Atlas via Motor (Async PyMongo)
- **Authentication:** Python-Jose (JWT), Bcrypt for password hashing
- **Image Rendering:** Pillow (Python Imaging Library) to auto-scale and render floor plan PNGs in memory (Base64 streamed to client).
- **CAD Exporter:** `ezdxf` to dynamically write structural boundaries to DXF.

## AI Infrastructure
- **Base Model:** Meta Llama-3 70B Instruct
- **API Provider:** Hugging Face Inference API
- **Prompt Strategy:** Chain-of-Thought (CoT) prompting enforcing grid-partitioning constraints and strict JSON payload outputs.
