# ⬡ AI Architect

AI Architect is an advanced, generative AI-powered floor plan generator and architectural layout engine. It takes user requirements (plot size, facing direction, rooms, floors, and Vastu compliance) and autonomously generates structurally sound, buildable floor plans, complete with a 2D interactive blueprint and AutoCAD-ready DXF exports.

## 🏗 The Architect-Drafter Hybrid Model

The core innovation of AI Architect is its **Architect-Drafter Hybrid Model**, which solves the fundamental problem of LLMs hallucinating overlapping or unbuildable physical coordinates:

1. **The AI Architect (LLM via Groq):** The LLM is strictly used for linguistic, topological, and spatial reasoning. It receives the user's requirements and generates a structured JSON topology. It decides *what* rooms exist, *how* they relate to each other, and *where* they roughly belong conceptually (e.g., "Kitchen in South-East"). It does **not** generate raw X, Y coordinates.
2. **The Deterministic Drafter (Python Grid Partitioner):** A strictly mathematical Python engine reads the topological JSON and structurally partitions the plot canvas. It mathematically guarantees 0 overlaps, perfect alignment, and precise parametric sizing (wall thickness, door gaps, circulation paths), effectively acting as a traditional draftsman.

## ✨ Features

- **Generative Floor Plans:** Input your plot dimensions, BHK requirements, and facing direction to instantly generate a full layout.
- **🧿 Vastu Shastra Engine:** Features a comprehensive Vastu scoring system (0-100) that evaluates room placement (e.g., Pooja room in NE, Kitchen in SE). Includes an **Auto-Fix** feature that automatically restructures the layout to improve the Vastu score.
- **Interactive Blueprint Editor:** A fully interactive React canvas allows you to view the plan, click on rooms to edit dimensions and positions, and view real-time circulation warnings.
- **AutoCAD DXF Export:** Download production-ready DXF files of your generated floor plans, complete with mathematically calculated inward-swinging door arcs, wall openings, and proper layer management.
- **Modern UI:** Built with a stunning Glassmorphism aesthetic, supporting both Nebula Dark Mode and Genesis Light Mode.

## 🛠 Tech Stack

### Frontend
- **Framework:** React 18 with TypeScript & Vite
- **Routing:** React Router v6
- **Styling:** Vanilla CSS with custom theme-aware CSS variables (Light/Dark mode)
- **Icons & UI:** Lucide React, React Hot Toast

### Backend
- **Framework:** FastAPI (Python 3)
- **AI Integration:** Groq API (Llama-3.3-70b-versatile)
- **CAD Generation:** `ezdxf`
- **Authentication:** JWT-based user auth

## 🚀 Getting Started

### Prerequisites
- Node.js (v16+)
- Python 3.9+
- A [Groq API Key](https://console.groq.com/) for the LLM.

### 1. Backend Setup

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# Mac/Linux
source .venv/bin/activate

pip install -r requirements.txt
```

Create a `.env` file in the `backend` directory and add your Groq API key:
```env
GROQ_API_KEY=gsk_your_api_key_here
```

Start the backend server:
```bash
uvicorn main:app --reload
```
The backend will run on `http://127.0.0.1:8000`.

### 2. Frontend Setup

Open a new terminal and run:

```bash
cd frontend
npm install
npm run dev
```
The frontend will run on `http://localhost:5173`.

## 📂 Project Structure

- `/backend`
  - `main.py`: FastAPI application, endpoints, and generation orchestration.
  - `architectural_layout.py`: The "Drafter" logic (Grid partitioning, door/window generation).
  - `inference.py`: The "Architect" logic (LLM prompt engineering and topological generation).
  - `vastu_engine.py`: Vastu Shastra rule evaluation and scoring.
  - `dxf_exporter.py`: Mathematical DXF compilation using `ezdxf`.
- `/frontend`
  - `/src/pages`: Main application views (Dashboard, Editor, Login, Register).
  - `/src/components`: Reusable UI components including the `InteractiveBlueprint` and `RoomEditor`.
  - `/src/services`: API client for connecting to the FastAPI backend.
