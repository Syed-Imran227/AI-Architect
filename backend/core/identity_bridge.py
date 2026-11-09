"""
identity_bridge.py
==================
Identity Bridge Domain Specification and Validation Engine.

Defines the explicit, fail-closed identity resolution contract between Supabase Auth
UUIDs (36-character hyphenated strings) and MongoDB ObjectIds (24-character hex strings)
for dual-provider transitional operations.

INVARIANTS:
1. EXPLICIT MAPPING ONLY:
   Mappings must be explicitly registered and cryptographically/administratively verified.
   Identity is NEVER inferred from email alone (preventing account takeover across federations).
2. STRICT FORMAT VALIDATION:
   supabase_uid must be a valid, hyphenated RFC 4122 UUID.
   mongo_user_id must be a valid 24-character hexadecimal BSON ObjectId string.
3. BI-DIRECTIONAL ONE-TO-ONE UNIQUENESS:
   One Supabase UUID maps to exactly one MongoDB ObjectId.
   One MongoDB ObjectId maps to exactly one Supabase UUID.
   Any duplicate or conflicting mapping is strictly rejected with a conflict error.
4. FAIL-CLOSED RUNTIME RESOLUTION:
   If a valid Supabase UUID has no explicit mapping in the ledger, resolution returns None.
   The system MUST NEVER:
     - Substitute a Supabase UUID into MongoDB queries as if it were an ObjectId.
     - Silently invent a synthetic or minimal user account without an established mapping.
     - Fall back to email matching.
5. ISOLATION:
   The identity bridge is completely decoupled from the local custom JWT path.
   Local JWT users continue to authenticate directly with their native MongoDB identity.

ARCHITECTURAL DECISION REQUIRING USER APPROVAL:
Persistent storage of this mapping ledger requires a schema decision:
  Option A: MongoDB collection `user_identity_mappings` (fastest for Mongo runtime).
  Option B: Supabase PostgreSQL table `public.user_identity_mappings` (RLS-secured).
  Option C: Signed, immutable offline ledger file loaded at startup.
Until the user formally approves one of these options, no production schema changes
or automatic account-linking migrations are applied.
"""

from __future__ import annotations

import re
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple


HEX_24_REGEX = re.compile(r"^[0-9a-fA-F]{24}$")


def is_valid_uuid_string(val: Any) -> bool:
    """Validate RFC 4122 UUID string format."""
    if not isinstance(val, str):
        return False
    try:
        parsed = uuid.UUID(val.strip())
        return str(parsed).lower() == val.strip().lower()
    except (ValueError, AttributeError):
        return False


def is_valid_mongo_object_id_string(val: Any) -> bool:
    """Validate 24-character hexadecimal ObjectId string format."""
    if not isinstance(val, str):
        return False
    return bool(HEX_24_REGEX.match(val.strip()))


class IdentityBridgeError(Exception):
    """Base exception for identity bridge operations."""
    pass


class InvalidIdentityFormatError(IdentityBridgeError):
    """Raised when an identity string does not conform to UUID or ObjectId specifications."""
    pass


class ConflictingIdentityMappingError(IdentityBridgeError):
    """Raised when a mapping conflicts with an existing entry (duplicate UUID or ObjectId)."""
    pass


class EmailInferenceForbiddenError(IdentityBridgeError):
    """Raised when an attempt is made to link accounts by email alone without explicit IDs."""
    pass


ALLOWED_STATUSES = frozenset({"active", "revoked", "pending_verification", "quarantined"})

# ── Documented Index Specifications for user_identity_mappings ────────────────
USER_IDENTITY_MAPPINGS_COLLECTION = "user_identity_mappings"

USER_IDENTITY_MAPPINGS_INDEX_SPECS = [
    {
        "name": "uniq_supabase_user_id",
        "keys": [("supabase_user_id", 1)],
        "unique": True,
        "description": "Enforces strict one-to-one uniqueness for Supabase Auth UUIDs.",
    },
    {
        "name": "uniq_mongodb_user_id",
        "keys": [("mongodb_user_id", 1)],
        "unique": True,
        "description": "Enforces strict one-to-one uniqueness for MongoDB ObjectIds.",
    },
    {
        "name": "idx_status_supabase",
        "keys": [("supabase_user_id", 1), ("status", 1)],
        "unique": False,
        "description": "Optimizes active identity resolution lookups.",
    },
    {
        "name": "idx_migration_batch",
        "keys": [("migration_batch_id", 1)],
        "unique": False,
        "description": "Supports atomic batch validation and scoped recovery/rollback.",
    },
]


@dataclass(frozen=True)
class IdentityMappingRecord:
    """Immutable domain representation of an explicit identity mapping."""
    supabase_uid: str
    mongo_user_id: str
    email_at_link: Optional[str] = None
    status: str = "active"
    linked_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    verification_source: str = "offline_migration_plan"

    def __post_init__(self) -> None:
        if not is_valid_uuid_string(self.supabase_uid):
            raise InvalidIdentityFormatError(
                f"supabase_uid '{self.supabase_uid}' is not a valid 36-char hyphenated UUID."
            )
        if not is_valid_mongo_object_id_string(self.mongo_user_id):
            raise InvalidIdentityFormatError(
                f"mongo_user_id '{self.mongo_user_id}' is not a valid 24-character hex ObjectId."
            )
        if self.status not in ALLOWED_STATUSES:
            raise ValueError(
                f"Invalid mapping status: '{self.status}'. Must be one of {sorted(ALLOWED_STATUSES)}."
            )

    @property
    def supabase_user_id(self) -> str:
        """Alias for compatibility with collection schema field name."""
        return self.supabase_uid

    @property
    def mongodb_user_id(self) -> str:
        """Alias for compatibility with collection schema field name."""
        return self.mongo_user_id


class IdentityBridgeLedger:
    """
    In-memory validated identity bridge registry enforcing strict one-to-one invariants.
    """

    def __init__(self) -> None:
        self._by_supabase_uid: Dict[str, IdentityMappingRecord] = {}
        self._by_mongo_id: Dict[str, IdentityMappingRecord] = {}

    def register_mapping(self, record: IdentityMappingRecord) -> None:
        """
        Registers an explicit mapping record.
        Fails if either identity is already mapped to a different counterparty.
        """
        sb_uid = record.supabase_uid.strip().lower()
        mongo_id = record.mongo_user_id.strip().lower()

        # Check existing Supabase UID mapping
        if sb_uid in self._by_supabase_uid:
            existing = self._by_supabase_uid[sb_uid]
            if existing.mongo_user_id.lower() != mongo_id:
                raise ConflictingIdentityMappingError(
                    f"Conflict: Supabase UUID '{sb_uid}' is already mapped to MongoDB ID "
                    f"'{existing.mongo_user_id}', cannot re-map to '{mongo_id}'."
                )
            return  # Idempotent re-registration of exact match

        # Check existing MongoDB ID mapping
        if mongo_id in self._by_mongo_id:
            existing = self._by_mongo_id[mongo_id]
            if existing.supabase_uid.lower() != sb_uid:
                raise ConflictingIdentityMappingError(
                    f"Conflict: MongoDB ObjectId '{mongo_id}' is already mapped to Supabase UUID "
                    f"'{existing.supabase_uid}', cannot re-map to '{sb_uid}'."
                )
            return

        # Store validated mapping
        self._by_supabase_uid[sb_uid] = record
        self._by_mongo_id[mongo_id] = record

    def resolve_mongo_id(self, supabase_uid: str) -> Optional[str]:
        """
        Resolves a Supabase Auth UUID to the corresponding MongoDB ObjectId.
        Returns None if no mapping exists (Strictly fail-closed).
        NEVER returns the input UUID or an unverified synthetic ID.
        """
        if not is_valid_uuid_string(supabase_uid):
            return None
        norm_sb = supabase_uid.strip().lower()
        rec = self._by_supabase_uid.get(norm_sb)
        if rec and rec.status == "active":
            return rec.mongo_user_id
        return None

    def resolve_supabase_uid(self, mongo_user_id: str) -> Optional[str]:
        """
        Resolves a MongoDB ObjectId to the corresponding Supabase Auth UUID.
        Returns None if no mapping exists (Strictly fail-closed).
        """
        if not is_valid_mongo_object_id_string(mongo_user_id):
            return None
        norm_mongo = mongo_user_id.strip().lower()
        rec = self._by_mongo_id.get(norm_mongo)
        if rec and rec.status == "active":
            return rec.supabase_uid
        return None

    def total_mappings(self) -> int:
        return len(self._by_supabase_uid)

    def clear(self) -> None:
        self._by_supabase_uid.clear()
        self._by_mongo_id.clear()


def validate_and_build_ledger(records: List[Dict[str, Any]]) -> Tuple[IdentityBridgeLedger, List[str]]:
    """
    Validates a raw list of mapping dictionaries and compiles them into a verified IdentityBridgeLedger.
    Accepts both 'supabase_uid' / 'supabase_user_id' and 'mongo_user_id' / 'mongodb_user_id'.
    Collects validation errors and rejects ambiguous, duplicate, conflicting, or email-only entries.
    """
    ledger = IdentityBridgeLedger()
    errors: List[str] = []

    for idx, raw in enumerate(records):
        sb_uid = raw.get("supabase_uid") or raw.get("supabase_user_id")
        mongo_id = raw.get("mongo_user_id") or raw.get("mongodb_user_id")
        email = raw.get("email")

        # Reject email-only attempts
        if email and (not sb_uid or not mongo_id):
            errors.append(
                f"Record #{idx}: Rejected email-only linking attempt for '{email}'. "
                f"Both 'supabase_uid' and 'mongo_user_id' must be explicitly provided."
            )
            continue

        if not sb_uid:
            errors.append(f"Record #{idx}: Missing required 'supabase_uid' or 'supabase_user_id'.")
            continue
        if not mongo_id:
            errors.append(f"Record #{idx}: Missing required 'mongo_user_id' or 'mongodb_user_id'.")
            continue

        try:
            record = IdentityMappingRecord(
                supabase_uid=str(sb_uid),
                mongo_user_id=str(mongo_id),
                email_at_link=str(email) if email else None,
                status=str(raw.get("status", "active")),
                verification_source=str(raw.get("verification_source", "manual_import")),
            )
            ledger.register_mapping(record)
        except (InvalidIdentityFormatError, ConflictingIdentityMappingError, ValueError) as err:
            errors.append(f"Record #{idx}: {str(err)}")

    return ledger, errors


def resolve_supabase_uuid_to_mongo_id(
    supabase_uid: str,
    ledger: Optional[IdentityBridgeLedger] = None,
) -> Optional[str]:
    """
    Pure fail-closed helper to resolve a Supabase UUID to an active MongoDB ObjectId string.
    Returns None if:
    - supabase_uid is invalid or malformed
    - ledger is None or mapping not found
    - mapping status is not 'active' (e.g. revoked, quarantined, pending_verification)
    Never returns the raw UUID or a synthetic ObjectId.
    """
    if ledger is None or not is_valid_uuid_string(supabase_uid):
        return None
    return ledger.resolve_mongo_id(supabase_uid)
