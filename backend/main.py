import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from routers.auth_routes import router as auth_router
from routers.projects_routes import router as projects_router
from routers.engine_routes import router as engine_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup validation — raises on missing required env vars so the
    process exits immediately instead of silently misbehaving at runtime."""
    if not os.getenv("JWT_SECRET"):
        raise ValueError("CRITICAL: JWT_SECRET environment variable is missing. Cannot boot securely.")
    if not os.getenv("GROQ_API_KEY"):
        raise ValueError("CRITICAL: GROQ_API_KEY environment variable is missing. Cannot generate AI layouts.")
    yield  # App is live

app = FastAPI(title="AI Architect API", lifespan=lifespan)

# ── CORS Setup ────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Dev frontend origin, change for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Static Files ──────────────────────────────────────────────────────────────
public_dir = os.path.join(os.path.dirname(__file__), "public")
os.makedirs(os.path.join(public_dir, "downloads"), exist_ok=True)
app.mount("/public", StaticFiles(directory=public_dir), name="public")

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(projects_router)
app.include_router(engine_router)

@app.get("/")
def read_root():
    return {"message": "AI Architect API — Programmatic Floor Plan Generator"}
