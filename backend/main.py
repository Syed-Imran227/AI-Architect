import os
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from routers.auth_routes import router as auth_router
from routers.projects_routes import router as projects_router
from routers.engine_routes import router as engine_router
from routers.agent_routes import router as agent_router
from routers.export_routes import router as export_router

IS_PRODUCTION = os.getenv("ENVIRONMENT", "").strip().lower() == "production"

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup validation — raises on missing required env vars so the
    process exits immediately instead of silently misbehaving at runtime."""
    db_provider = os.getenv("DATABASE_PROVIDER", "mongodb").strip().lower()
    auth_provider = os.getenv("AUTH_PROVIDER", "jwt").strip().lower()

    if db_provider == "mongodb":
        if not os.getenv("MONGO_URI"):
            raise ValueError("CRITICAL: MONGO_URI environment variable is missing for DATABASE_PROVIDER=mongodb.")
    elif db_provider == "supabase":
        if not os.getenv("SUPABASE_URL") or not (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_DB_URL")):
            raise ValueError(
                "CRITICAL: DATABASE_PROVIDER is set to 'supabase', but required Supabase credentials "
                "(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_DB_URL) are missing. Cannot boot."
            )
    else:
        raise ValueError(f"CRITICAL: Unknown DATABASE_PROVIDER='{db_provider}'. Must be 'mongodb' or 'supabase'.")

    if auth_provider == "jwt":
        if not os.getenv("JWT_SECRET"):
            raise ValueError("CRITICAL: JWT_SECRET environment variable is missing for AUTH_PROVIDER=jwt. Cannot boot securely.")
    elif auth_provider == "supabase":
        from db.supabase_client import validate_supabase_config
        validate_supabase_config(for_db=False, for_auth=True)
    else:
        raise ValueError(f"CRITICAL: Unknown AUTH_PROVIDER='{auth_provider}'. Must be 'jwt' or 'supabase'.")

    if not any([os.getenv("GOOGLE_API_KEY"), os.getenv("GEMINI_API_KEY"), os.getenv("GROQ_API_KEY"), os.getenv("HF_API_KEY")]):
        raise ValueError("CRITICAL: No LLM API Key found (need GOOGLE, GEMINI, HF, or GROQ). Cannot generate AI layouts.")

    if db_provider == "mongodb":
        from db.database import client as mongo_client
        if mongo_client is not None:
            try:
                await mongo_client.admin.command("ping")
                print("[startup] Database connection: MongoDB connected successfully.")
            except Exception as e:
                print(f"[startup] Database connection warning: MongoDB ping failed ({e}).")

    # Production JWT secret validation
    jwt_sec = os.getenv("JWT_SECRET", "")
    if auth_provider == "jwt":
        if IS_PRODUCTION and (jwt_sec == "your_jwt_secret_here" or len(jwt_sec) < 32):
            raise ValueError(
                "CRITICAL: In production mode, JWT_SECRET must not use the default placeholder "
                "and must be at least 32 characters in length for HS256 security."
            )
        elif jwt_sec == "your_jwt_secret_here" or len(jwt_sec) < 32:
            print("[startup] SECURITY NOTICE: JWT_SECRET appears to be a default placeholder or short key. Use a 32+ char secret in production.")

    print(f"[startup] AI Architect live | Database Provider: {db_provider} | Auth Provider: {auth_provider}")
    yield  # App is live

    # Graceful shutdown — release database connection pools
    if db_provider == "mongodb":
        from db.database import client as mongo_client
        if mongo_client is not None:
            mongo_client.close()
            print("[shutdown] Database connection: MongoDB client connection closed.")

app = FastAPI(title="AI Architect API", lifespan=lifespan)

# ── Security Headers & Body Size Limit Middleware ─────────────────────────────
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

MAX_REQUEST_BODY_SIZE = 15 * 1024 * 1024  # 15 MB limit

class SecurityHardeningMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # 1. Enforce payload size limit based on Content-Length header
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                if int(content_length) > MAX_REQUEST_BODY_SIZE:
                    return Response(
                        content='{"detail":"Request payload exceeds maximum allowed limit of 15MB."}',
                        status_code=413,
                        media_type="application/json",
                    )
            except ValueError:
                pass

        # 2. Process request
        response: Response = await call_next(request)

        # 3. Attach standard defense-in-depth security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"

        # HSTS in production or when connection is HTTPS
        if IS_PRODUCTION or request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        return response

app.add_middleware(SecurityHardeningMiddleware)

# ── CORS Setup ────────────────────────────────────────────────────────────────
# Comma-separated origins via CORS_ORIGINS; defaults to the Vite dev server.
# In production, local regex wildcard matching is strictly disabled.
cors_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
origin_regex = None if IS_PRODUCTION else r"https?://(localhost|127\.0\.0\.1)(:\d+)?"

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=origin_regex,
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
app.include_router(agent_router)
app.include_router(export_router)

@app.get("/")
def read_root():
    return {"message": "AI Architect API — Programmatic Floor Plan Generator"}

@app.get("/health")
async def health_check():
    db_provider = os.getenv("DATABASE_PROVIDER", "mongodb").strip().lower()
    db_connected = False
    details: dict[str, str] = {}
    if db_provider == "mongodb":
        from db.database import client as mongo_client
        if mongo_client is not None:
            try:
                pong = await mongo_client.admin.command("ping")
                db_connected = bool(pong.get("ok") == 1.0)
            except Exception as exc:
                details["error"] = str(exc)
        else:
            details["error"] = "Mongo client not initialized"
    elif db_provider == "supabase":
        try:
            from db.supabase_client import get_supabase_client
            sb = get_supabase_client()
            sb.table("projects").select("id").limit(1).execute()
            db_connected = True
        except Exception as exc:
            details["error"] = str(exc)

    return {
        "status": "healthy",
        "database_provider": db_provider,
        "database_connected": db_connected,
        **details,
    }


