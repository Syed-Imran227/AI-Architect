"""
supabase_client.py
==================
Supabase configuration and PostgREST client driver layer.
Provides clean async methods for interacting with Supabase PostgreSQL and Auth
via PostgREST when DATABASE_PROVIDER=supabase or AUTH_PROVIDER=supabase.
"""

from __future__ import annotations

import os
from typing import Any, Optional, Dict, List
import httpx

import json
from urllib.parse import urlparse

def get_database_provider() -> str:
    """Return the active database provider ('mongodb' or 'supabase'). Default: 'mongodb'."""
    return os.getenv("DATABASE_PROVIDER", "mongodb").strip().lower()

def get_auth_provider() -> str:
    """Return the active auth provider ('jwt' or 'supabase'). Default: 'jwt'."""
    return os.getenv("AUTH_PROVIDER", "jwt").strip().lower()

def get_supabase_url() -> str:
    return os.getenv("SUPABASE_URL", "").strip().rstrip("/")

def get_supabase_publishable_key() -> str:
    return (os.getenv("SUPABASE_PUBLISHABLE_KEY") or os.getenv("SUPABASE_ANON_KEY") or "").strip()

def get_supabase_service_role_key() -> str:
    return os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()

def get_supabase_api_key() -> str:
    """Return the active Supabase API key (service-role key if available, otherwise publishable key)."""
    return get_supabase_service_role_key() or get_supabase_publishable_key()

def get_supabase_jwt_secret() -> str:
    return os.getenv("SUPABASE_JWT_SECRET", "").strip()

def get_supabase_db_url() -> str:
    return os.getenv("SUPABASE_DB_URL", "").strip()

def get_expected_supabase_issuer() -> str:
    """
    Establish the trusted expected Supabase token issuer.
    Priority:
    1. Explicit SUPABASE_EXPECTED_ISSUER environment variable.
    2. Derived from validated SUPABASE_URL: f"{url}/auth/v1".
    Returns empty string if neither is established or valid.
    """
    explicit = os.getenv("SUPABASE_EXPECTED_ISSUER", "").strip().rstrip("/")
    if explicit:
        return explicit

    url = get_supabase_url()
    if url:
        try:
            parsed = urlparse(url)
            if parsed.scheme in ("http", "https") and parsed.netloc:
                return f"{url}/auth/v1"
        except Exception:
            pass
    return ""

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicKey

def validate_rsa_public_key_pem(key_pem: str, key_name: str = "key") -> str:
    """Validate that the given string is a valid PEM-encoded RSA public key."""
    if not isinstance(key_pem, str) or not key_pem.strip():
        raise ValueError(f"Invalid {key_name}: key material is empty.")
    try:
        loaded_key = serialization.load_pem_public_key(key_pem.strip().encode("utf-8"))
        if not isinstance(loaded_key, RSAPublicKey):
            raise ValueError(f"Invalid {key_name}: expected RSA public key, got {type(loaded_key).__name__}.")
    except Exception as e:
        raise ValueError(f"Invalid {key_name}: not a valid PEM RSA public key ({e}).")
    return key_pem.strip()

def get_supabase_keyring() -> Dict[str, str]:
    """
    Load explicitly configured trusted key ring mapping key ID ('kid') to public key PEM.
    Configured via SUPABASE_JWT_KEYRING_JSON environment variable.
    Format: {"kid_1": "<rsa_public_key_pem>", "kid_2": "<rsa_public_key_pem>"}
    Rejects malformed JSON, empty key IDs, empty key values, and invalid key material.
    Returns an empty dict if not configured.
    """
    raw = os.getenv("SUPABASE_JWT_KEYRING_JSON", "").strip()
    if not raw:
        return {}
    try:
        data = json.loads(raw)
    except Exception as e:
        raise ValueError(f"Invalid SUPABASE_JWT_KEYRING_JSON: malformed JSON ({e}).")

    if not isinstance(data, dict):
        raise ValueError("Invalid SUPABASE_JWT_KEYRING_JSON: root value must be a JSON object.")

    if not data:
        raise ValueError("Invalid SUPABASE_JWT_KEYRING_JSON: keyring object cannot be empty.")

    keyring: Dict[str, str] = {}
    for k, v in data.items():
        if not isinstance(k, str) or not k.strip():
            raise ValueError(f"Invalid SUPABASE_JWT_KEYRING_JSON: key ID '{k}' is empty or not a string.")
        kid = k.strip()

        if not isinstance(v, str) or not v.strip():
            raise ValueError(f"Invalid SUPABASE_JWT_KEYRING_JSON: key material for '{kid}' is empty or not a string.")
        key_val = v.strip()

        validate_rsa_public_key_pem(key_val, f"keyring key '{kid}'")
        keyring[kid] = key_val

    return keyring

def validate_supabase_config(for_db: bool = True, for_auth: bool = False) -> None:
    """
    Validate that required Supabase environment variables are present.
    Fails fast with a clear, descriptive ValueError if missing.
    Does NOT fall back to MongoDB.
    """
    url = get_supabase_url()
    api_key = get_supabase_api_key()
    service_key = get_supabase_service_role_key()
    db_url = get_supabase_db_url()
    jwt_secret = get_supabase_jwt_secret()

    if for_db:
        if not url:
            raise ValueError(
                "CRITICAL: DATABASE_PROVIDER is set to 'supabase', but SUPABASE_URL is missing. "
                "Please configure SUPABASE_URL in backend/.env"
            )
        if not api_key and not db_url:
            raise ValueError(
                "CRITICAL: DATABASE_PROVIDER is set to 'supabase', but neither SUPABASE_PUBLISHABLE_KEY "
                "(or SUPABASE_SERVICE_ROLE_KEY) nor SUPABASE_DB_URL is configured. Cannot connect to Supabase PostgreSQL."
            )

    if for_auth:
        expected_iss = get_expected_supabase_issuer()
        if not expected_iss:
            raise ValueError(
                "CRITICAL: AUTH_PROVIDER is set to 'supabase', but a valid expected issuer could not be established. "
                "Set SUPABASE_EXPECTED_ISSUER or configure a valid SUPABASE_URL (e.g. 'https://<project-ref>.supabase.co')."
            )

        alg = os.getenv("SUPABASE_JWT_ALGORITHM", "").strip().upper()
        if alg and alg not in ("HS256", "RS256"):
            raise ValueError(
                f"CRITICAL: Unsupported SUPABASE_JWT_ALGORITHM='{alg}'. Must be 'HS256' or 'RS256'."
            )

        pub_key_raw = os.getenv("SUPABASE_JWT_PUBLIC_KEY", "").strip()
        keyring_raw = os.getenv("SUPABASE_JWT_KEYRING_JSON", "").strip()

        if pub_key_raw:
            validate_rsa_public_key_pem(pub_key_raw, "SUPABASE_JWT_PUBLIC_KEY")

        if keyring_raw:
            # Validates JSON structure and all key materials
            get_supabase_keyring()

        has_rsa = bool(pub_key_raw or keyring_raw)
        has_hmac = bool(jwt_secret)

        service_key = get_supabase_service_role_key()
        publishable_key = get_supabase_publishable_key()
        if jwt_secret and ((service_key and jwt_secret == service_key) or (publishable_key and jwt_secret == publishable_key)):
            raise ValueError(
                "CRITICAL: SUPABASE_JWT_SECRET cannot be identical to SUPABASE_SERVICE_ROLE_KEY or SUPABASE_PUBLISHABLE_KEY. "
                "Service-role and publishable API keys must never be used as signing or verification secrets."
            )

        if not alg:
            if has_rsa and has_hmac:
                raise ValueError(
                    "CRITICAL: Ambiguous Supabase Auth configuration: both RS256 public key/keyring and "
                    "HS256 secret (SUPABASE_JWT_SECRET) are configured without specifying SUPABASE_JWT_ALGORITHM."
                )
            if has_hmac:
                raise ValueError(
                    "CRITICAL: SUPABASE_JWT_SECRET is configured, but SUPABASE_JWT_ALGORITHM is not explicitly set to 'HS256'. "
                    "A secret alone cannot silently select HS256."
                )
            if not has_rsa and not has_hmac:
                raise ValueError(
                    "CRITICAL: AUTH_PROVIDER is set to 'supabase', but no verification key (SUPABASE_JWT_PUBLIC_KEY, "
                    "SUPABASE_JWT_KEYRING_JSON, or SUPABASE_JWT_SECRET) is configured. "
                    "SUPABASE_SERVICE_ROLE_KEY cannot satisfy token verification."
                )
        elif alg == "RS256":
            if not has_rsa:
                raise ValueError(
                    "CRITICAL: SUPABASE_JWT_ALGORITHM is set to 'RS256', but no trusted RSA public key "
                    "(SUPABASE_JWT_PUBLIC_KEY or SUPABASE_JWT_KEYRING_JSON) is configured."
                )
            if has_hmac:
                raise ValueError(
                    "CRITICAL: Ambiguous Supabase Auth configuration: SUPABASE_JWT_ALGORITHM is set to 'RS256', "
                    "but SUPABASE_JWT_SECRET is also configured."
                )
        elif alg == "HS256":
            if not has_hmac:
                raise ValueError(
                    "CRITICAL: SUPABASE_JWT_ALGORITHM is set to 'HS256', but SUPABASE_JWT_SECRET is not configured. "
                    "SUPABASE_SERVICE_ROLE_KEY cannot be used as an HMAC verification secret."
                )
            if has_rsa:
                raise ValueError(
                    "CRITICAL: Ambiguous Supabase Auth configuration: SUPABASE_JWT_ALGORITHM is set to 'HS256', "
                    "but RSA public key/keyring is also configured."
                )

class SupabaseClient:
    """Async client interacting with Supabase PostgREST & Auth endpoints."""

    def __init__(self):
        self.url = get_supabase_url()
        self.publishable_key = get_supabase_publishable_key()
        self.service_key = get_supabase_api_key()

    def _headers(self, user_token: Optional[str] = None, allow_admin: bool = False) -> Dict[str, str]:
        """
        Build PostgREST HTTP headers.
        Security contract:
        - When user_token is provided: passes user access token for RLS evaluation with publishable apikey.
        - When user_token is absent and allow_admin=False: passes publishable/anon key. NEVER silently bypasses RLS.
        - When allow_admin=True: explicitly requires and uses SUPABASE_SERVICE_ROLE_KEY for administrative tasks only.
        """
        if user_token:
            return {
                "apikey": self.publishable_key or self.service_key,
                "Authorization": f"Bearer {user_token}",
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            }

        if allow_admin:
            service_key = get_supabase_service_role_key()
            if not service_key:
                raise ValueError(
                    "CRITICAL: Administrative operation requested but SUPABASE_SERVICE_ROLE_KEY is not configured."
                )
            return {
                "apikey": service_key,
                "Authorization": f"Bearer {service_key}",
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            }

        # Ordinary unauthenticated / anonymous user context. Evaluates under PostgREST anon role.
        anon_key = self.publishable_key or self.service_key
        return {
            "apikey": anon_key,
            "Authorization": f"Bearer {anon_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    async def select(
        self,
        table: str,
        select: str = "*",
        match: Optional[Dict[str, Any]] = None,
        order: Optional[str] = None,
        limit: Optional[int] = None,
        user_token: Optional[str] = None,
        allow_admin: bool = False,
    ) -> List[Dict[str, Any]]:
        """Query rows from a Supabase table using PostgREST."""
        params: Dict[str, Any] = {"select": select}
        if match:
            for k, v in match.items():
                params[f"{k}"] = f"eq.{v}"
        if order:
            params["order"] = order
        if limit:
            params["limit"] = str(limit)

        endpoint = f"{self.url}/rest/v1/{table}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(endpoint, headers=self._headers(user_token, allow_admin=allow_admin), params=params)
            if resp.status_code >= 400:
                raise RuntimeError(f"Supabase PostgREST select error ({resp.status_code}): {resp.text}")
            return resp.json()

    async def insert(
        self,
        table: str,
        data: Dict[str, Any],
        user_token: Optional[str] = None,
        allow_admin: bool = False,
    ) -> List[Dict[str, Any]]:
        """Insert a row into a Supabase table."""
        endpoint = f"{self.url}/rest/v1/{table}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(endpoint, headers=self._headers(user_token, allow_admin=allow_admin), json=data)
            if resp.status_code >= 400:
                raise RuntimeError(f"Supabase PostgREST insert error ({resp.status_code}): {resp.text}")
            return resp.json()

    async def update(
        self,
        table: str,
        data: Dict[str, Any],
        match: Dict[str, Any],
        user_token: Optional[str] = None,
        allow_admin: bool = False,
    ) -> List[Dict[str, Any]]:
        """Update rows in a Supabase table matching given criteria."""
        params: Dict[str, Any] = {}
        for k, v in match.items():
            params[f"{k}"] = f"eq.{v}"

        endpoint = f"{self.url}/rest/v1/{table}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.patch(endpoint, headers=self._headers(user_token, allow_admin=allow_admin), params=params, json=data)
            if resp.status_code >= 400:
                raise RuntimeError(f"Supabase PostgREST update error ({resp.status_code}): {resp.text}")
            return resp.json()

    async def delete(
        self,
        table: str,
        match: Dict[str, Any],
        user_token: Optional[str] = None,
        allow_admin: bool = False,
    ) -> int:
        """Delete rows matching criteria. Returns count of deleted rows."""
        params: Dict[str, Any] = {}
        for k, v in match.items():
            params[f"{k}"] = f"eq.{v}"

        endpoint = f"{self.url}/rest/v1/{table}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.delete(endpoint, headers=self._headers(user_token, allow_admin=allow_admin), params=params)
            if resp.status_code >= 400:
                raise RuntimeError(f"Supabase PostgREST delete error ({resp.status_code}): {resp.text}")
            res_data = resp.json()
            return len(res_data) if isinstance(res_data, list) else 1

    async def get_user_from_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Fetch user record from Supabase Auth API using a Bearer token."""
        endpoint = f"{self.url}/auth/v1/user"
        api_key = self.publishable_key or self.service_key
        headers = {
            "apikey": api_key,
            "Authorization": f"Bearer {token}",
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(endpoint, headers=headers)
            if resp.status_code == 200:
                return resp.json()
            return None

# Singleton client instance
_supabase_client_instance: Optional[SupabaseClient] = None

def get_supabase_client() -> SupabaseClient:
    global _supabase_client_instance
    if _supabase_client_instance is None:
        validate_supabase_config(for_db=True)
        _supabase_client_instance = SupabaseClient()
    return _supabase_client_instance
