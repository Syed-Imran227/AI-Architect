"""
repositories.py
===============
Data-access repository layer supporting both MongoDB and Supabase PostgreSQL.
Preserves all Motor find/insert/delete operations for MongoDB mode.
When DATABASE_PROVIDER=supabase, operations route through SupabaseProjectRepository
targeting public.projects and public.project_versions.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any, Optional, List, Dict
from datetime import datetime, timezone

logger = logging.getLogger(__name__)
try:
    from bson import ObjectId
    from bson.errors import InvalidId
except ImportError:
    ObjectId = None  # type: ignore
    InvalidId = Exception  # type: ignore

from db.database import (
    db,
    users_collection,
    projects_collection,
    conversations_collection,
    messages_collection,
    identity_mappings_collection,
    DATABASE_PROVIDER,
)
from db.supabase_client import get_supabase_client


# ── ID Validation Helpers ────────────────────────────────────────────────────

def is_valid_uuid(val: Any) -> bool:
    """Check if the provided value is a valid standard UUID."""
    if not val:
        return False
    try:
        parsed = uuid.UUID(str(val).strip())
        return str(parsed).lower() == str(val).strip().lower()
    except (ValueError, AttributeError, TypeError):
        return False


def is_valid_object_id(val: Any) -> bool:
    """Check if the provided value is a valid 24-char hex MongoDB ObjectId."""
    if not val or ObjectId is None:
        return False
    try:
        ObjectId(str(val).strip())
        return True
    except (InvalidId, TypeError, ValueError):
        return False


# ── Identity Mapping Repository & Effective Identity Resolution ──────────────

class IdentityMappingRepository:
    """
    Read-only repository for querying persistent identity mappings between
    Supabase Auth UUIDs and MongoDB ObjectIds in 'user_identity_mappings'.

    DOCUMENTED INDEX SPECIFICATIONS (Milestone 5A/5B):
    1. uniq_supabase_user_id: {"supabase_user_id": 1}, unique=True
       - Guarantees each Supabase UUID maps to at most one MongoDB identity.
    2. uniq_mongodb_user_id:  {"mongodb_user_id": 1}, unique=True
       - Guarantees each MongoDB ObjectId maps to at most one Supabase identity.
    3. idx_status_supabase:   {"supabase_user_id": 1, "status": 1}
       - Composite index to accelerate active identity resolution queries.
    4. idx_migration_batch:   {"migration_batch_id": 1}
       - Enables atomic verification and targeted rollback of migration batches.

    INVARIANTS:
    1. Read-only: Exposes only query/resolution methods. Zero runtime writes/upserts.
    2. Fail-closed: Returns None for unmapped, non-active (revoked/quarantined/pending),
       or malformed identities.
    3. Standalone-compatible: Queries single documents with index constraints;
       never requires MongoDB multi-document transactions.
    4. Production safety: Never silently falls back to an in-memory ledger in production.
    """
    def __init__(self, collection: Any = None, test_ledger: Optional[Any] = None) -> None:
        self._collection = collection
        self._test_ledger = test_ledger

    def _resolve_collection(self) -> Any:
        if self._collection is not None:
            return self._collection
        from db.database import identity_mappings_collection
        return identity_mappings_collection

    async def get_mapping_by_supabase_uuid(self, supabase_uid: str) -> Optional[Dict[str, Any]]:
        """Fetch mapping document by Supabase UUID. Only returns if status is active."""
        if not is_valid_uuid(supabase_uid):
            return None
        norm_sb = str(supabase_uid).strip().lower()

        col = self._resolve_collection()
        if col is not None:
            try:
                doc = await col.find_one({"supabase_user_id": norm_sb, "status": "active"})
                if doc:
                    mongo_id = str(doc.get("mongodb_user_id") or doc.get("mongo_user_id") or "")
                    if is_valid_object_id(mongo_id):
                        return {
                            "supabase_user_id": norm_sb,
                            "mongodb_user_id": mongo_id,
                            "status": doc.get("status", "active"),
                            "linked_at": doc.get("linked_at"),
                            "verification_source": doc.get("verification_source"),
                        }
            except Exception as e:
                logger.warning(f"Failed to query user_identity_mappings collection: {e}")

        # Injected test ledger (ONLY if explicitly configured for testing)
        if self._test_ledger is not None:
            resolved = self._test_ledger.resolve_mongo_id(norm_sb)
            if resolved and is_valid_object_id(resolved):
                return {
                    "supabase_user_id": norm_sb,
                    "mongodb_user_id": resolved,
                    "status": "active",
                    "verification_source": "test_ledger",
                }
        return None

    async def resolve_mongo_id(self, supabase_uid: str) -> Optional[str]:
        """Resolve Supabase UUID to active MongoDB ObjectId string. Fail closed."""
        mapping = await self.get_mapping_by_supabase_uuid(supabase_uid)
        return mapping["mongodb_user_id"] if mapping else None

    async def resolve_supabase_uuid(self, mongo_user_id: str) -> Optional[str]:
        """Reverse lookup: resolve MongoDB ObjectId to Supabase UUID."""
        if not is_valid_object_id(mongo_user_id):
            return None
        norm_mongo = str(mongo_user_id).strip().lower()
        col = self._resolve_collection()
        if col is not None:
            try:
                doc = await col.find_one({"mongodb_user_id": norm_mongo, "status": "active"})
                if doc:
                    sb_uid = str(doc.get("supabase_user_id") or doc.get("supabase_uid") or "")
                    if is_valid_uuid(sb_uid):
                        return sb_uid
            except Exception as e:
                logger.warning(f"Failed to query user_identity_mappings collection: {e}")
        if self._test_ledger is not None:
            return self._test_ledger.resolve_supabase_uid(norm_mongo)
        return None


_default_identity_mapping_repo = IdentityMappingRepository()
_test_identity_ledger: Optional[Any] = None


def set_test_identity_ledger(ledger: Optional[Any]) -> None:
    """Explicitly inject an in-memory ledger for isolated offline testing."""
    global _test_identity_ledger
    _test_identity_ledger = ledger


def get_test_identity_ledger() -> Optional[Any]:
    return _test_identity_ledger


def get_identity_mapping_repository() -> IdentityMappingRepository:
    """Return identity mapping repository instance, respecting test injection."""
    if _test_identity_ledger is not None:
        return IdentityMappingRepository(test_ledger=_test_identity_ledger)
    return _default_identity_mapping_repo


async def resolve_effective_user_id(
    user_id: Optional[str],
    mapping_repo: Optional[IdentityMappingRepository] = None,
) -> Optional[str]:
    """
    Resolves an incoming user identity to an effective MongoDB user ID string.

    1. Supabase UUID Transitional Lookup:
       If user_id is a valid 36-character hyphenated UUID (or contains hyphens),
       it is resolved against the persistent IdentityMappingRepository.
       Only 'active' mappings resolve.
       If unmapped, revoked, quarantined, pending_verification, or malformed, returns None (FAILS CLOSED).
       NEVER returns the raw UUID into MongoDB queries.
       NEVER invents a synthetic or guest ObjectId.

    2. Native MongoDB Mode (O(1) path):
       If user_id is NOT a UUID (e.g. 24-character BSON ObjectId or existing native MongoDB user ID),
       it is returned directly unchanged. Existing MongoDB and custom JWT authentication
       continues to work with zero overhead and full backward compatibility.
    """
    if not user_id or not isinstance(user_id, str):
        return None
    cleaned = user_id.strip()

    # Route Supabase Auth UUIDs (and any hyphenated IDs) to the identity bridge
    if is_valid_uuid(cleaned) or ("-" in cleaned):
        repo = mapping_repo or get_identity_mapping_repository()
        return await repo.resolve_mongo_id(cleaned)

    # Native MongoDB identifier (ObjectId or existing account ID)
    return cleaned


# ── Helper for Supabase Project mapping ───────────────────────────────────────

def _format_supabase_project(row: Dict[str, Any]) -> Dict[str, Any]:
    """Map a Supabase projects table row to the standard dict format expected by FastAPI & Frontend."""
    prefs = row.get("building_preferences") or {}
    layout_data = row.get("layout_data") or prefs.get("layout_data") or {}
    image_url = row.get("image_url") or prefs.get("image_url")

    # Resolve plot dimensions from direct columns or fallback to layout_data
    plot_width = row.get("plot_width")
    if plot_width is None and isinstance(layout_data, dict):
        plot_width = layout_data.get("plot_width") or layout_data.get("form", {}).get("width")

    plot_length = row.get("plot_length")
    if plot_length is None and isinstance(layout_data, dict):
        plot_length = (
            layout_data.get("plot_height")
            or layout_data.get("plot_length")
            or layout_data.get("form", {}).get("length")
        )

    return {
        "id": str(row["id"]),
        "user_id": str(row["user_id"]),
        "name": row.get("name", "Untitled Plan"),
        "layout_data": layout_data,
        "image_url": image_url,
        "plot_width": float(plot_width) if plot_width is not None else 30.0,
        "plot_length": float(plot_length) if plot_length is not None else 40.0,
        "measurement_unit": row.get("measurement_unit") or "ft",
        "entry_direction": row.get("entry_direction") or "east",
        "budget_target": float(row["budget_target"]) if row.get("budget_target") is not None else None,
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }


# ── In-Memory Fallback Store (for offline local development) ─────────────────
_in_memory_users: Dict[str, dict] = {}
_in_memory_projects: Dict[str, dict] = {}
_in_memory_conversations: Dict[str, dict] = {}
_in_memory_messages: Dict[str, list] = {}


# ── Users ─────────────────────────────────────────────────────────────────────

async def get_user_by_email(email: str, user_token: Optional[str] = None) -> dict | None:
    """Return the full user document or None if not found."""
    if DATABASE_PROVIDER == "mongodb":
        if users_collection is not None:
            try:
                doc = await users_collection.find_one({"email": email})
                if doc:
                    return doc
            except Exception as e:
                logger.warning(f"MongoDB query failed ({e}). Using in-memory fallback.")
        return _in_memory_users.get(email)

    # Supabase provider
    sb = get_supabase_client()
    try:
        rows = await sb.select("profiles", match={"email": email}, user_token=user_token)
        return rows[0] if rows else None
    except Exception as e:
        logger.warning(f"Supabase profiles query by email failed: {e}")
        return None


async def get_user_by_id(user_id: str, user_token: Optional[str] = None) -> dict | None:
    """Return the full user document by ID, or None if not found."""
    if DATABASE_PROVIDER == "mongodb":
        effective_user_id = await resolve_effective_user_id(user_id)
        if not effective_user_id:
            return None
        if users_collection is not None:
            try:
                if is_valid_object_id(effective_user_id):
                    oid = ObjectId(effective_user_id)
                    doc = await users_collection.find_one({"_id": oid})
                    if doc:
                        return doc
            except Exception as e:
                logger.warning(f"MongoDB query failed ({e}). Using in-memory fallback.")
        for u in _in_memory_users.values():
            if str(u.get("_id")) == str(effective_user_id) or str(u.get("id")) == str(effective_user_id):
                return u
        return None

    # Supabase provider (user_id is a UUID)
    if not is_valid_uuid(user_id):
        return None
    sb = get_supabase_client()
    try:
        rows = await sb.select("profiles", match={"id": user_id}, user_token=user_token)
        return rows[0] if rows else None
    except Exception as e:
        logger.warning(f"Supabase profiles query by id failed: {e}")
        return None


async def create_user(user_doc: dict, user_token: Optional[str] = None) -> str:
    """Insert a new user document. Returns the inserted id as a string."""
    if DATABASE_PROVIDER == "mongodb":
        if users_collection is not None:
            try:
                result = await users_collection.insert_one(user_doc)
                return str(result.inserted_id)
            except Exception as e:
                logger.warning(f"MongoDB insert failed ({e}). Using in-memory fallback.")
        new_id = str(uuid.uuid4())
        user_doc["_id"] = new_id
        user_doc["id"] = new_id
        _in_memory_users[user_doc["email"]] = user_doc
        return new_id

    # Supabase provider
    sb = get_supabase_client()
    profile_data: Dict[str, Any] = {
        "id": user_doc.get("id"),
        "full_name": user_doc.get("name") or user_doc.get("full_name") or "Architect",
    }
    if user_doc.get("email"):
        profile_data["email"] = user_doc["email"]
    profile_data = {k: v for k, v in profile_data.items() if v is not None}

    try:
        rows = await sb.insert("profiles", profile_data, user_token=user_token)
        return str(rows[0]["id"]) if rows else str(user_doc.get("id", ""))
    except Exception as e:
        err_str = str(e)
        if "email" in err_str and "does not exist" in err_str:
            # Table lacks email column; retry with core fields only
            pruned = {k: v for k, v in profile_data.items() if k != "email"}
            try:
                rows = await sb.insert("profiles", pruned, user_token=user_token)
                return str(rows[0]["id"]) if rows else str(user_doc.get("id", ""))
            except Exception as inner_e:
                logger.warning(f"Supabase profile creation fallback failed: {inner_e}")
                return str(user_doc.get("id", ""))
        logger.warning(f"Supabase profile creation skipped: {e}")
        return str(user_doc.get("id", ""))


# ── MongoDB Project Repository ───────────────────────────────────────────────

class MongoProjectRepository:
    """Project repository implementation for MongoDB collections."""

    async def get_projects_for_user(self, user_id: str, user_token: Optional[str] = None) -> list[dict]:
        effective_user_id = await resolve_effective_user_id(user_id)
        if not effective_user_id:
            return []
        if projects_collection is not None:
            try:
                cursor = projects_collection.find({"user_id": effective_user_id}).sort("created_at", -1)
                projects = await cursor.to_list(length=100)
                for p in projects:
                    p["id"] = str(p["_id"])
                return projects
            except Exception as e:
                logger.warning(f"MongoDB query failed ({e}). Using in-memory fallback.")
        return [p for p in _in_memory_projects.values() if p.get("user_id") == effective_user_id]

    async def get_project_by_id(self, project_id: str, user_id: str, user_token: Optional[str] = None) -> dict | None:
        effective_user_id = await resolve_effective_user_id(user_id)
        if not effective_user_id:
            return None
        if projects_collection is not None:
            try:
                if is_valid_object_id(project_id):
                    oid = ObjectId(project_id)
                    project = await projects_collection.find_one({"_id": oid, "user_id": effective_user_id})
                    if project:
                        project["id"] = str(project["_id"])
                        return project
                    return None
            except Exception as e:
                logger.warning(f"MongoDB query failed ({e}). Using in-memory fallback.")
        proj = _in_memory_projects.get(project_id)
        if proj and str(proj.get("user_id")) == str(effective_user_id):
            return proj
        return None

    async def create_project(self, project_doc: dict, user_token: Optional[str] = None) -> str:
        raw_uid = project_doc.get("user_id")
        effective_user_id = await resolve_effective_user_id(raw_uid)
        if not effective_user_id:
            raise ValueError(f"Cannot create project: unmapped or invalid user_id '{raw_uid}'")
        project_doc["user_id"] = effective_user_id

        if projects_collection is not None:
            try:
                result = await projects_collection.insert_one(project_doc)
                return str(result.inserted_id)
            except Exception as e:
                logger.warning(f"MongoDB insert failed ({e}). Storing in-memory.")
        pid = str(uuid.uuid4())
        project_doc["_id"] = pid
        project_doc["id"] = pid
        _in_memory_projects[pid] = project_doc
        return pid

    async def update_project(
        self,
        project_id: str,
        project_doc: dict,
        user_id: str,
        commit_message: str = "Layout updated via editor",
        user_token: Optional[str] = None,
    ) -> bool:
        effective_user_id = await resolve_effective_user_id(user_id)
        if not effective_user_id:
            return False
        if projects_collection is not None:
            try:
                if is_valid_object_id(project_id):
                    oid = ObjectId(project_id)
                    result = await projects_collection.update_one(
                        {"_id": oid, "user_id": effective_user_id},
                        {"$set": project_doc}
                    )
                    return result.matched_count > 0
            except Exception as e:
                logger.warning(f"MongoDB update failed ({e}). Updating in-memory.")
        proj = _in_memory_projects.get(project_id)
        if proj and str(proj.get("user_id")) == str(effective_user_id):
            proj.update(project_doc)
            return True
        return False

    async def delete_project(self, project_id: str, user_id: str, user_token: Optional[str] = None) -> int:
        effective_user_id = await resolve_effective_user_id(user_id)
        if not effective_user_id:
            return 0
        if projects_collection is not None and is_valid_object_id(project_id):
            try:
                oid = ObjectId(project_id)
                result = await projects_collection.delete_one({"_id": oid, "user_id": effective_user_id})
                if result.deleted_count > 0:
                    _in_memory_projects.pop(project_id, None)
                    return result.deleted_count
                return 0
            except Exception as e:
                logger.warning(f"MongoDB delete failed ({e}). Checking in-memory.")

        # In-memory fallback
        if project_id in _in_memory_projects:
            proj = _in_memory_projects[project_id]
            if str(proj.get("user_id")) == str(effective_user_id):
                del _in_memory_projects[project_id]
                return 1
        return 0

    async def get_project_versions(self, project_id: str, user_id: str, user_token: Optional[str] = None) -> list[dict]:
        return []

    async def get_or_create_conversation(self, project_id: str, user_id: str, user_token: Optional[str] = None) -> dict:
        effective_user_id = await resolve_effective_user_id(user_id)
        if not effective_user_id:
            return {}
        if project_id and project_id != "standalone":
            proj = await self.get_project_by_id(project_id, effective_user_id, user_token=user_token)
            if not proj:
                logger.warning(f"Cannot get/create conversation: user '{user_id}' does not own project '{project_id}'")
                return {}

        if conversations_collection is not None:
            try:
                doc = await conversations_collection.find_one({"project_id": project_id, "user_id": effective_user_id})
                if doc:
                    doc["id"] = str(doc["_id"])
                    return doc
                new_conv = {
                    "project_id": project_id,
                    "user_id": effective_user_id,
                    "title": "Design Assistant",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
                res = await conversations_collection.insert_one(new_conv)
                new_conv["id"] = str(res.inserted_id)
                return new_conv
            except Exception as e:
                logger.warning(f"MongoDB conversation query failed ({e}). Using in-memory fallback.")
        key = f"{project_id}_{effective_user_id}"
        if key not in _in_memory_conversations:
            conv_id = f"conv_{project_id}_{effective_user_id}"
            _in_memory_conversations[key] = {
                "id": conv_id,
                "project_id": project_id,
                "user_id": effective_user_id,
                "title": "Design Assistant",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        return _in_memory_conversations[key]

    async def get_conversation_by_id(self, conversation_id: str, user_id: str, user_token: Optional[str] = None) -> Optional[dict]:
        effective_user_id = await resolve_effective_user_id(user_id)
        if not effective_user_id:
            return None
        if conversations_collection is not None:
            try:
                if is_valid_object_id(conversation_id):
                    doc = await conversations_collection.find_one({"_id": ObjectId(conversation_id), "user_id": effective_user_id})
                    if doc:
                        doc["id"] = str(doc["_id"])
                        return doc
                    return None
            except Exception as e:
                logger.warning(f"MongoDB conversation lookup failed ({e}). Checking in-memory.")

        for c in _in_memory_conversations.values():
            if c.get("id") == conversation_id and str(c.get("user_id")) == str(effective_user_id):
                return c

        if conversation_id in (f"session_{effective_user_id[:8]}", f"session_{effective_user_id}"):
            return {"id": conversation_id, "user_id": effective_user_id, "title": "Design Assistant"}

        return None

    async def get_conversation_messages(
        self,
        conversation_id: str,
        user_id: Optional[str] = None,
        user_token: Optional[str] = None,
    ) -> list[dict]:
        if user_id is not None:
            effective_user_id = await resolve_effective_user_id(user_id)
            if not effective_user_id:
                return []
            conv = await self.get_conversation_by_id(conversation_id, effective_user_id, user_token=user_token)
            if not conv:
                return []
        if messages_collection is not None:
            try:
                cursor = messages_collection.find({"conversation_id": conversation_id}).sort("created_at", 1).limit(100)
                docs = await cursor.to_list(length=100)
                for d in docs:
                    d["id"] = str(d["_id"])
                return docs
            except Exception as e:
                logger.warning(f"MongoDB message fetch failed ({e}). Using in-memory fallback.")
        return _in_memory_messages.get(conversation_id, [])

    async def add_conversation_message(
        self,
        conversation_id: str,
        sender: str,
        content: str,
        operation: Optional[dict] = None,
        user_id: Optional[str] = None,
        user_token: Optional[str] = None,
    ) -> dict:
        if user_id is not None:
            effective_user_id = await resolve_effective_user_id(user_id)
            if not effective_user_id:
                return {}
            conv = await self.get_conversation_by_id(conversation_id, effective_user_id, user_token=user_token)
            if not conv:
                logger.warning(f"Unauthorized message insert: user '{user_id}' does not own conversation '{conversation_id}'")
                return {}
        msg = {
            "conversation_id": conversation_id,
            "sender": sender,
            "content": content,
            "operation": operation,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        if messages_collection is not None:
            try:
                res = await messages_collection.insert_one(dict(msg))
                msg["id"] = str(res.inserted_id)
                return msg
            except Exception as e:
                logger.warning(f"MongoDB message insert failed ({e}). Using in-memory fallback.")
        msg["id"] = f"msg_{datetime.now().timestamp()}"
        _in_memory_messages.setdefault(conversation_id, []).append(msg)
        return msg


# ── Supabase Project Repository ──────────────────────────────────────────────

class SupabaseProjectRepository:
    """
    Project repository targeting Supabase PostgreSQL (public.projects and public.project_versions).
    Implements ownership verification, full layout_data persistence, and design snapshots.
    """

    def __init__(self, sb_client=None):
        self._sb_client = sb_client

    def _client(self):
        return self._sb_client or get_supabase_client()

    async def _insert_project_row(
        self, sb, row_data: Dict[str, Any], user_token: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        attempt = dict(row_data)
        try:
            return await sb.insert("projects", attempt, user_token=user_token)
        except RuntimeError as e:
            err_msg = str(e)
            if "layout_data" in err_msg and "layout_data" in attempt:
                attempt.pop("layout_data", None)
                return await sb.insert("projects", attempt, user_token=user_token)
            raise

    async def _update_project_row(
        self, sb, project_id: str, user_id: str, update_data: Dict[str, Any], user_token: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        attempt = dict(update_data)
        try:
            return await sb.update("projects", attempt, match={"id": project_id, "user_id": user_id}, user_token=user_token)
        except RuntimeError as e:
            err_msg = str(e)
            if "layout_data" in err_msg and "layout_data" in attempt:
                attempt.pop("layout_data", None)
                return await sb.update("projects", attempt, match={"id": project_id, "user_id": user_id}, user_token=user_token)
            raise

    async def get_projects_for_user(self, user_id: str, user_token: Optional[str] = None) -> list[dict]:
        sb = self._client()
        rows = await sb.select(
            "projects",
            match={"user_id": user_id},
            order="created_at.desc",
            limit=100,
            user_token=user_token,
        )
        return [_format_supabase_project(r) for r in rows]

    async def get_project_by_id(self, project_id: str, user_id: str, user_token: Optional[str] = None) -> dict | None:
        if not is_valid_uuid(project_id):
            return None
        sb = self._client()
        rows = await sb.select(
            "projects",
            match={"id": project_id, "user_id": user_id},
            limit=1,
            user_token=user_token,
        )
        return _format_supabase_project(rows[0]) if rows else None

    async def create_project(self, project_doc: dict, user_token: Optional[str] = None) -> str:
        sb = self._client()
        layout_data = project_doc.get("layout_data") or {}
        form = layout_data.get("form") or {}

        plot_w = float(
            project_doc.get("plot_width")
            or layout_data.get("plot_width")
            or form.get("width")
            or 30.0
        )
        plot_l = float(
            project_doc.get("plot_length")
            or layout_data.get("plot_height")
            or layout_data.get("plot_length")
            or form.get("length")
            or 40.0
        )

        raw_entry = str(project_doc.get("entry_direction") or form.get("entryDir") or "east").strip().lower()
        entry_dir = raw_entry if raw_entry in ("north", "south", "east", "west") else "east"

        raw_unit = str(project_doc.get("measurement_unit") or form.get("measurement_unit") or "ft").strip().lower()
        measurement_unit = raw_unit if raw_unit in ("ft", "m") else "ft"

        budget_val = project_doc.get("budget_target") or form.get("budget")
        budget_target = float(budget_val) if budget_val is not None and str(budget_val).strip() != "" else None

        row_data: Dict[str, Any] = {
            "user_id": project_doc["user_id"],
            "name": project_doc.get("name", "Untitled Plan"),
            "plot_width": plot_w,
            "plot_length": plot_l,
            "measurement_unit": measurement_unit,
            "entry_direction": entry_dir,
            "budget_target": budget_target,
            "layout_data": layout_data,
            "building_preferences": {
                "layout_data": layout_data,
                "image_url": project_doc.get("image_url"),
                "form": form,
            },
        }
        if project_doc.get("image_url"):
            row_data["image_url"] = project_doc.get("image_url")
        if project_doc.get("description"):
            row_data["description"] = project_doc.get("description")

        rows = await self._insert_project_row(sb, row_data, user_token=user_token)
        inserted_id = str(rows[0]["id"])

        # Persist initial version snapshot (version 1) in public.project_versions
        await self.create_project_version(
            project_id=inserted_id,
            snapshot=layout_data,
            user_id=project_doc["user_id"],
            commit_message="Initial plan generated",
            version_number=1,
            user_token=user_token,
        )

        # Synchronize placed furniture and lighting fixtures to public tables
        await self._sync_furniture_and_lighting(sb, inserted_id, layout_data, user_token=user_token)

        return inserted_id

    async def update_project(
        self,
        project_id: str,
        project_doc: dict,
        user_id: str,
        commit_message: str = "Layout updated via editor",
        user_token: Optional[str] = None,
    ) -> bool:
        if not is_valid_uuid(project_id):
            return False
        sb = self._client()
        layout_data = project_doc.get("layout_data") or {}
        form = layout_data.get("form") or {}

        plot_w = float(
            project_doc.get("plot_width")
            or layout_data.get("plot_width")
            or form.get("width")
            or 30.0
        )
        plot_l = float(
            project_doc.get("plot_length")
            or layout_data.get("plot_height")
            or layout_data.get("plot_length")
            or form.get("length")
            or 40.0
        )

        raw_entry = str(project_doc.get("entry_direction") or form.get("entryDir") or "east").strip().lower()
        entry_dir = raw_entry if raw_entry in ("north", "south", "east", "west") else "east"

        raw_unit = str(project_doc.get("measurement_unit") or form.get("measurement_unit") or "ft").strip().lower()
        measurement_unit = raw_unit if raw_unit in ("ft", "m") else "ft"

        budget_val = project_doc.get("budget_target") or form.get("budget")
        budget_target = float(budget_val) if budget_val is not None and str(budget_val).strip() != "" else None

        update_data: Dict[str, Any] = {
            "name": project_doc.get("name", "Untitled Plan"),
            "plot_width": plot_w,
            "plot_length": plot_l,
            "measurement_unit": measurement_unit,
            "entry_direction": entry_dir,
            "layout_data": layout_data,
            "building_preferences": {
                "layout_data": layout_data,
                "image_url": project_doc.get("image_url"),
                "form": form,
            },
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if budget_target is not None:
            update_data["budget_target"] = budget_target
        if project_doc.get("image_url"):
            update_data["image_url"] = project_doc.get("image_url")
        if project_doc.get("description"):
            update_data["description"] = project_doc.get("description")

        rows = await self._update_project_row(sb, project_id, user_id, update_data, user_token=user_token)
        if not rows:
            return False

        # Persist immutable version snapshot in public.project_versions
        await self.create_project_version(
            project_id=project_id,
            snapshot=layout_data,
            user_id=user_id,
            commit_message=commit_message,
            user_token=user_token,
        )

        # Synchronize placed furniture and lighting fixtures to public tables
        await self._sync_furniture_and_lighting(sb, project_id, layout_data, user_token=user_token)

        return True

    async def _sync_furniture_and_lighting(
        self, sb, project_id: str, layout_data: dict, user_token: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Synchronize placed furniture and lighting fixtures as downstream projections.
        Invariant: projects.layout_data is the canonical source of truth.
        Failed optional projections are logged and reported in diagnostic status,
        and never corrupt the canonical document or crash the project save.
        """
        status: Dict[str, Any] = {
            "furniture_synced": False,
            "lighting_synced": False,
            "warnings": [],
        }
        try:
            furniture_rows: list[dict] = []
            lighting_rows: list[dict] = []

            floors = layout_data.get("floors") or []
            if not floors and layout_data.get("rooms"):
                floors = [{"level": 0, "name": "Ground Floor", "rooms": layout_data.get("rooms")}]

            for floor in floors:
                # Floor level items
                for furn in floor.get("furniture", []):
                    room_id = furn.get("room_id")
                    if room_id and is_valid_uuid(room_id):
                        furniture_rows.append({
                            "room_id": str(room_id),
                            "name": furn.get("name", "Furniture"),
                            "x": float(furn.get("x", 0)),
                            "y": float(furn.get("y", 0)),
                            "z": float(furn.get("z", 0)),
                            "width": float(furn.get("width", 1)),
                            "height": float(furn.get("height", 1)),
                            "depth": float(furn.get("depth", 1)),
                        })

                for light in floor.get("lighting", []):
                    light_row: Dict[str, Any] = {
                        "project_id": project_id,
                        "name": light.get("name", "Light"),
                        "fixture_type": light.get("fixture_type") or light.get("type") or "ceiling",
                        "x": float(light.get("x", 0)),
                        "y": float(light.get("y", 0)),
                        "z": float(light.get("z", 0)),
                    }
                    if is_valid_uuid(light.get("room_id")):
                        light_row["room_id"] = str(light["room_id"])
                    if is_valid_uuid(light.get("floor_id")):
                        light_row["floor_id"] = str(light["floor_id"])
                    lighting_rows.append(light_row)

                # Room level items
                for room in floor.get("rooms", []):
                    raw_room_id = room.get("id")
                    valid_room_uuid = str(raw_room_id) if is_valid_uuid(raw_room_id) else None

                    for furn in room.get("furniture", []):
                        if furn.get("isLight"):
                            light_row = {
                                "project_id": project_id,
                                "name": furn.get("name", "Light"),
                                "fixture_type": furn.get("fixture_type") or furn.get("type") or "ceiling",
                                "x": float(furn.get("x", 0)),
                                "y": float(furn.get("y", 0)),
                                "z": float(furn.get("z", 0)),
                            }
                            if valid_room_uuid:
                                light_row["room_id"] = valid_room_uuid
                            lighting_rows.append(light_row)
                        else:
                            if valid_room_uuid:
                                furniture_rows.append({
                                    "room_id": valid_room_uuid,
                                    "name": furn.get("name", "Furniture"),
                                    "x": float(furn.get("x", 0)),
                                    "y": float(furn.get("y", 0)),
                                    "z": float(furn.get("z", 0)),
                                    "width": float(furn.get("width", 1)),
                                    "height": float(furn.get("height", 1)),
                                    "depth": float(furn.get("depth", 1)),
                                })

                    for light in room.get("lighting", []):
                        light_row = {
                            "project_id": project_id,
                            "name": light.get("name", "Light"),
                            "fixture_type": light.get("fixture_type") or light.get("type") or "ceiling",
                            "x": float(light.get("x", 0)),
                            "y": float(light.get("y", 0)),
                            "z": float(light.get("z", 0)),
                        }
                        if valid_room_uuid:
                            light_row["room_id"] = valid_room_uuid
                        lighting_rows.append(light_row)

            # Sync lighting_fixtures
            try:
                await sb.delete("lighting_fixtures", match={"project_id": project_id}, user_token=user_token)
                for row in lighting_rows:
                    await sb.insert("lighting_fixtures", row, user_token=user_token)
                status["lighting_synced"] = True
            except Exception as e:
                warn_msg = f"Could not sync to public.lighting_fixtures: {e}"
                logger.warning(warn_msg)
                status["warnings"].append(warn_msg)

            # Sync furniture_placements
            if furniture_rows:
                try:
                    for row in furniture_rows:
                        await sb.insert("furniture_placements", row, user_token=user_token)
                    status["furniture_synced"] = True
                except Exception as e:
                    warn_msg = f"Could not sync to public.furniture_placements: {e}"
                    logger.warning(warn_msg)
                    status["warnings"].append(warn_msg)
            else:
                status["furniture_synced"] = True

        except Exception as e:
            warn_msg = f"Furniture & lighting projection extraction warning: {e}"
            logger.warning(warn_msg)
            status["warnings"].append(warn_msg)

        return status

    async def create_project_version(
        self,
        project_id: str,
        snapshot: dict,
        user_id: str,
        commit_message: str = "Layout updated via editor",
        version_number: Optional[int] = None,
        user_token: Optional[str] = None,
    ) -> int:
        """Create a new design snapshot in public.project_versions with sequential versioning."""
        sb = self._client()
        if version_number is None:
            try:
                versions = await sb.select(
                    "project_versions",
                    select="version_number",
                    match={"project_id": project_id},
                    order="version_number.desc",
                    limit=1,
                    user_token=user_token,
                )
                if versions and "version_number" in versions[0]:
                    version_number = int(versions[0]["version_number"]) + 1
                else:
                    version_number = 1
            except Exception as e:
                logger.warning(f"[supabase] Failed to query latest version number: {e}")
                version_number = 1

        version_doc = {
            "project_id": project_id,
            "version_number": version_number,
            "commit_message": commit_message,
            "snapshot": snapshot,
            "created_by": user_id,
        }
        try:
            await sb.insert("project_versions", version_doc, user_token=user_token)
            return version_number
        except Exception as e:
            logger.warning(f"[supabase] Note: project_versions insert skipped: {e}")
            return version_number

    async def delete_project(self, project_id: str, user_id: str, user_token: Optional[str] = None) -> int:
        if not is_valid_uuid(project_id):
            if project_id in _in_memory_projects:
                proj = _in_memory_projects[project_id]
                if proj.get("user_id") == user_id:
                    del _in_memory_projects[project_id]
                    return 1
            return 0

        sb = self._client()
        try:
            await sb.delete("lighting_fixtures", match={"project_id": project_id}, user_token=user_token)
        except Exception as e:
            logger.warning(f"Note: Could not cascade delete lighting_fixtures: {e}")
        try:
            convs = await sb.select(
                "design_conversations",
                match={"project_id": project_id, "user_id": user_id},
                user_token=user_token,
            )
            for c in convs:
                if "id" in c:
                    try:
                        await sb.delete("conversation_messages", match={"conversation_id": c["id"]}, user_token=user_token)
                    except Exception:
                        pass
            await sb.delete("design_conversations", match={"project_id": project_id, "user_id": user_id}, user_token=user_token)
        except Exception as e:
            logger.warning(f"Note: Could not cascade delete design_conversations: {e}")
        try:
            await sb.delete("project_versions", match={"project_id": project_id}, user_token=user_token)
        except Exception as e:
            logger.warning(f"Note: Could not cascade delete project_versions: {e}")

        deleted_count = await sb.delete("projects", match={"id": project_id, "user_id": user_id}, user_token=user_token)
        _in_memory_projects.pop(project_id, None)
        return deleted_count

    async def get_project_versions(self, project_id: str, user_id: str, user_token: Optional[str] = None) -> list[dict]:
        if not is_valid_uuid(project_id):
            return []
        sb = self._client()
        proj = await self.get_project_by_id(project_id, user_id, user_token=user_token)
        if not proj:
            return []
        rows = await sb.select(
            "project_versions",
            match={"project_id": project_id},
            order="version_number.desc",
            limit=50,
            user_token=user_token,
        )
        return [
            {
                "id": str(r.get("id", "")),
                "project_id": str(r["project_id"]),
                "version_number": int(r["version_number"]),
                "commit_message": r.get("commit_message"),
                "snapshot": r.get("snapshot", {}),
                "created_by": str(r.get("created_by") or user_id),
                "created_at": r.get("created_at"),
            }
            for r in rows
        ]

    async def get_or_create_conversation(self, project_id: str, user_id: str, user_token: Optional[str] = None) -> dict:
        if project_id and project_id != "standalone" and is_valid_uuid(project_id):
            proj = await self.get_project_by_id(project_id, user_id, user_token=user_token)
            if not proj:
                logger.warning(f"Cannot get/create conversation: user '{user_id}' does not own project '{project_id}'")
                return {}

        sb = self._client()
        try:
            rows = await sb.select(
                "design_conversations",
                match={"project_id": project_id, "user_id": user_id},
                limit=1,
                user_token=user_token,
            )
            if rows:
                return rows[0]
            new_conv = {
                "project_id": project_id,
                "user_id": user_id,
                "title": "Design Assistant",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            inserted = await sb.insert("design_conversations", new_conv, user_token=user_token)
            return inserted[0] if inserted else new_conv
        except Exception as e:
            logger.warning(f"Note: Could not query design_conversations in Supabase: {e}")
            return {"id": f"conv_{project_id}_{user_id}", "project_id": project_id, "user_id": user_id, "title": "Design Assistant"}

    async def get_conversation_by_id(self, conversation_id: str, user_id: str, user_token: Optional[str] = None) -> Optional[dict]:
        if not is_valid_uuid(conversation_id):
            for c in _in_memory_conversations.values():
                if c.get("id") == conversation_id and str(c.get("user_id")) == str(user_id):
                    return c
            if conversation_id in (f"session_{user_id[:8]}", f"session_{user_id}"):
                return {"id": conversation_id, "user_id": user_id, "title": "Design Assistant"}
            return None
        sb = self._client()
        try:
            rows = await sb.select(
                "design_conversations",
                match={"id": conversation_id, "user_id": user_id},
                limit=1,
                user_token=user_token,
            )
            return rows[0] if rows else None
        except Exception as e:
            logger.warning(f"Note: Could not query design_conversations by ID in Supabase: {e}")
            return None

    async def get_conversation_messages(
        self,
        conversation_id: str,
        user_id: Optional[str] = None,
        user_token: Optional[str] = None,
    ) -> list[dict]:
        if user_id is not None:
            conv = await self.get_conversation_by_id(conversation_id, user_id, user_token=user_token)
            if not conv:
                return []
        sb = self._client()
        try:
            return await sb.select(
                "conversation_messages",
                match={"conversation_id": conversation_id},
                order="created_at.asc",
                limit=100,
                user_token=user_token,
            )
        except Exception as e:
            logger.warning(f"Note: Could not query conversation_messages in Supabase: {e}")
            return []

    async def add_conversation_message(
        self,
        conversation_id: str,
        sender: str,
        content: str,
        operation: Optional[dict] = None,
        user_id: Optional[str] = None,
        user_token: Optional[str] = None,
    ) -> dict:
        if user_id is not None:
            conv = await self.get_conversation_by_id(conversation_id, user_id, user_token=user_token)
            if not conv:
                logger.warning(f"Unauthorized message insert: user '{user_id}' does not own conversation '{conversation_id}'")
                return {}
        sb = self._client()
        now_iso = datetime.now(timezone.utc).isoformat()
        full_msg = {
            "conversation_id": conversation_id,
            "sender": sender,
            "content": content,
            "operation": operation,
            "created_at": now_iso,
        }

        # Audited schema for conversation_messages: id, conversation_id, sender, content, created_at
        # If 'operation' column does not exist in Supabase table, insert with operation will fail.
        # We attempt with operation first; on column error fallback to pruned row.
        payload = dict(full_msg)
        if operation is None:
            payload.pop("operation", None)

        try:
            inserted = await sb.insert("conversation_messages", payload, user_token=user_token)
            result = inserted[0] if inserted else full_msg
            if operation is not None and "operation" not in result:
                result["operation"] = operation
            return result
        except RuntimeError as e:
            err_str = str(e)
            if "operation" in err_str:
                logger.info("conversation_messages table does not have 'operation' column. Retrying without it.")
                pruned = {
                    "conversation_id": conversation_id,
                    "sender": sender,
                    "content": content,
                    "created_at": now_iso,
                }
                try:
                    inserted = await sb.insert("conversation_messages", pruned, user_token=user_token)
                    result = inserted[0] if inserted else pruned
                    result["operation"] = operation
                    return result
                except Exception as inner_e:
                    logger.warning(f"Note: Could not insert conversation_message in Supabase: {inner_e}")
                    return full_msg
            logger.warning(f"Note: Could not insert conversation_message in Supabase: {e}")
            return full_msg
        except Exception as e:
            logger.warning(f"Note: Could not insert conversation_message in Supabase: {e}")
            return full_msg


# ── Repository Instances & Dispatching ───────────────────────────────────────

mongo_project_repo = MongoProjectRepository()
supabase_project_repo = SupabaseProjectRepository()

def get_project_repository():
    """Returns the active project repository according to DATABASE_PROVIDER."""
    if DATABASE_PROVIDER == "supabase":
        return supabase_project_repo
    return mongo_project_repo


# ── Module-Level Function Interfaces (Backward Compatibility) ────────────────

async def get_projects_for_user(user_id: str, user_token: Optional[str] = None) -> list[dict]:
    """Return all projects owned by user_id, sorted newest-first."""
    return await get_project_repository().get_projects_for_user(user_id, user_token=user_token)


async def get_project_by_id(project_id: str, user_id: str, user_token: Optional[str] = None) -> dict | None:
    """Return a single project owned by user_id, or None."""
    return await get_project_repository().get_project_by_id(project_id, user_id, user_token=user_token)


async def create_project(project_doc: dict, user_token: Optional[str] = None) -> str:
    """Insert a new project document. Returns the inserted id as a string."""
    return await get_project_repository().create_project(project_doc, user_token=user_token)


async def update_project(
    project_id: str,
    project_doc: dict,
    user_id: str,
    commit_message: str = "Layout updated via editor",
    user_token: Optional[str] = None,
) -> bool:
    """Update an existing project document. Returns True if updated."""
    return await get_project_repository().update_project(
        project_id, project_doc, user_id, commit_message=commit_message, user_token=user_token
    )


async def delete_project(project_id: str, user_id: str, user_token: Optional[str] = None) -> int:
    """Delete a project owned by user_id. Returns deleted count (0 or 1)."""
    return await get_project_repository().delete_project(project_id, user_id, user_token=user_token)


async def get_project_versions(project_id: str, user_id: str, user_token: Optional[str] = None) -> list[dict]:
    """Return version history snapshots for a project."""
    return await get_project_repository().get_project_versions(project_id, user_id, user_token=user_token)


async def get_or_create_conversation(project_id: str, user_id: str, user_token: Optional[str] = None) -> dict:
    """Return or create a design conversation for the project and user."""
    return await get_project_repository().get_or_create_conversation(project_id, user_id, user_token=user_token)


async def get_conversation_by_id(conversation_id: str, user_id: str, user_token: Optional[str] = None) -> Optional[dict]:
    """Return a single design conversation if owned by user_id, or None."""
    return await get_project_repository().get_conversation_by_id(conversation_id, user_id, user_token=user_token)


async def get_conversation_messages(conversation_id: str, user_id: Optional[str] = None, user_token: Optional[str] = None) -> list[dict]:
    """Return messages for a conversation ordered by created_at, verifying user ownership when user_id is provided."""
    return await get_project_repository().get_conversation_messages(conversation_id, user_id=user_id, user_token=user_token)


async def add_conversation_message(
    conversation_id: str,
    sender: str,
    content: str,
    operation: Optional[dict] = None,
    user_id: Optional[str] = None,
    user_token: Optional[str] = None,
) -> dict:
    """Add a message to a design conversation, verifying user ownership when user_id is provided."""
    return await get_project_repository().add_conversation_message(
        conversation_id, sender, content, operation=operation, user_id=user_id, user_token=user_token
    )


async def record_generated_asset(
    project_id: Optional[str],
    asset_type: str,
    file_name: str,
    file_size: int,
    user_id: Optional[str] = None,
    user_token: Optional[str] = None,
    verify_ownership: bool = False,
) -> Optional[dict]:
    """
    Record asset metadata in public.generated_assets (Supabase) or generated_assets (MongoDB).
    Maps to audited Supabase schema:
      storage_path -> file_name
      metadata -> {file_name, file_size, user_id}
    """
    if not project_id:
        return None

    if verify_ownership and user_id:
        proj = await get_project_by_id(str(project_id), str(user_id), user_token=user_token)
        if not proj:
            logger.warning(
                f"Unauthorized asset association attempt: user '{user_id}' does not own project '{project_id}'"
            )
            return None

    now_iso = datetime.now(timezone.utc).isoformat()

    if DATABASE_PROVIDER == "supabase":
        if not is_valid_uuid(project_id):
            logger.warning(f"Skipping Supabase generated_assets record: invalid project UUID '{project_id}'")
            return None
        metadata: Dict[str, Any] = {
            "file_name": file_name,
            "file_size": file_size,
        }
        if user_id:
            metadata["user_id"] = str(user_id)

        row = {
            "project_id": str(project_id),
            "asset_type": asset_type,
            "storage_path": file_name,
            "metadata": metadata,
            "created_at": now_iso,
        }
        try:
            sb = get_supabase_client()
            inserted = await sb.insert("generated_assets", row, user_token=user_token)
            return inserted[0] if inserted else row
        except Exception as e:
            logger.warning(f"Note: could not insert to Supabase generated_assets: {e}")
            return None
    else:
        # MongoDB
        effective_user_id = await resolve_effective_user_id(user_id) if user_id else None
        if user_id and not effective_user_id:
            logger.warning(f"Unmapped or invalid user '{user_id}' cannot record generated asset")
            return None
        record: Dict[str, Any] = {
            "project_id": str(project_id),
            "asset_type": asset_type,
            "file_name": file_name,
            "file_size": file_size,
            "created_at": now_iso,
        }
        if effective_user_id:
            record["user_id"] = effective_user_id
        try:
            if db is not None:
                res = await db["generated_assets"].insert_one(record)
                record["id"] = str(res.inserted_id)
                return record
        except Exception as e:
            logger.warning(f"Note: MongoDB asset recording skipped: {e}")
            return record
        return record
