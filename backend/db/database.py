"""
database.py
===========
Database driver initialization supporting both MongoDB (default) and Supabase.
Preserves existing MongoDB/Motor collections while enabling a seamless toggle
via the DATABASE_PROVIDER environment variable.
"""

import os
from typing import Any, Optional
from dotenv import load_dotenv
import certifi

from db.supabase_client import (
    get_database_provider,
    get_auth_provider,
    validate_supabase_config,
    get_supabase_client,
)

load_dotenv()

DATABASE_PROVIDER = get_database_provider()
AUTH_PROVIDER = get_auth_provider()

# ── MongoDB Initialization (when DATABASE_PROVIDER=mongodb) ──────────────────
client: Any = None
db: Any = None
users_collection: Any = None
projects_collection: Any = None
conversations_collection: Any = None
messages_collection: Any = None
identity_mappings_collection: Any = None

if DATABASE_PROVIDER == "mongodb":
    MONGO_URI = os.getenv("MONGO_URI")
    if not MONGO_URI:
        raise ValueError(
            "CRITICAL: MONGO_URI is missing for DATABASE_PROVIDER=mongodb. "
            "Please add it to backend/.env"
        )
    try:
        from motor.motor_asyncio import AsyncIOMotorClient  # type: ignore
        client_kwargs: dict[str, Any] = {}
        if "mongodb+srv://" in MONGO_URI or "tls=true" in MONGO_URI.lower() or "ssl=true" in MONGO_URI.lower():
            client_kwargs["tlsCAFile"] = certifi.where()
        client = AsyncIOMotorClient(MONGO_URI, **client_kwargs)
        db = client.ai_architect
        users_collection = db.get_collection("users")
        projects_collection = db.get_collection("projects")
        conversations_collection = db.get_collection("design_conversations")
        messages_collection = db.get_collection("conversation_messages")
        identity_mappings_collection = db.get_collection("user_identity_mappings")
    except ImportError as e:
        raise ImportError(
            "CRITICAL: motor is required when DATABASE_PROVIDER=mongodb. "
            "Please run 'pip install -r requirements.txt'"
        ) from e

elif DATABASE_PROVIDER == "supabase":
    # Fail fast if Supabase credentials are missing — do NOT fall back to MongoDB
    validate_supabase_config(for_db=True)
    # Supabase driver is available via get_supabase_client()
    # users_collection and projects_collection remain None in Supabase mode;
    # repository calls route through the Supabase PostgREST driver.
else:
    raise ValueError(
        f"CRITICAL: Unknown DATABASE_PROVIDER='{DATABASE_PROVIDER}'. "
        f"Must be 'mongodb' or 'supabase'."
    )
