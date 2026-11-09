"""
auth.py
=======
Authentication core supporting both custom JWT (default) and Supabase Auth.
Selected via AUTH_PROVIDER=jwt (default) vs AUTH_PROVIDER=supabase.
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from jose import JWTError, jwt  # type: ignore
from passlib.context import CryptContext  # type: ignore
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
try:
    from bson import ObjectId
    from bson.errors import InvalidId
except ImportError:
    ObjectId = None  # type: ignore
    InvalidId = Exception  # type: ignore

from db.supabase_client import (
    get_auth_provider,
    get_database_provider,
    get_supabase_jwt_secret,
    get_supabase_service_role_key,
    get_supabase_publishable_key,
    get_supabase_url,
    get_supabase_client,
    validate_supabase_config,
    get_expected_supabase_issuer,
    get_supabase_keyring,
    validate_rsa_public_key_pem,
)
from db.database import users_collection, DATABASE_PROVIDER

AUTH_PROVIDER = get_auth_provider()

# ── Key validation ────────────────────────────────────────────────────────────
JWT_SECRET = os.getenv("JWT_SECRET")
SUPABASE_JWT_SECRET = get_supabase_jwt_secret()

if AUTH_PROVIDER == "jwt":
    if not JWT_SECRET:
        raise ValueError(
            "CRITICAL: JWT_SECRET environment variable is missing for AUTH_PROVIDER=jwt. "
            "Please configure JWT_SECRET in backend/.env"
        )
elif AUTH_PROVIDER == "supabase":
    # If Supabase is selected, ensure we have the secret or credentials to validate tokens
    validate_supabase_config(for_db=False, for_auth=True)
else:
    raise ValueError(f"CRITICAL: Unknown AUTH_PROVIDER='{AUTH_PROVIDER}'. Must be 'jwt' or 'supabase'.")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

import bcrypt

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        pw_bytes = plain_password.encode("utf-8")[:72]
        hash_bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(pw_bytes, hash_bytes)
    except Exception:
        try:
            return pwd_context.verify(plain_password, hashed_password)
        except Exception:
            return False


def get_password_hash(password: str) -> str:
    try:
        pw_bytes = password.encode("utf-8")[:72]
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(pw_bytes, salt).decode("utf-8")
    except Exception:
        return pwd_context.hash(password)


def is_valid_uuid(val: Any) -> bool:
    """Validate standard 36-character hyphenated UUID."""
    if not isinstance(val, str):
        return False
    try:
        uuid_obj = uuid.UUID(val.strip())
        return str(uuid_obj) == val.strip().lower()
    except (ValueError, AttributeError):
        return False


async def verify_supabase_token(
    token: str,
    jwt_secret: Optional[str] = None,
    public_key: Optional[str] = None,
    keyring: Optional[Dict[str, str]] = None,
    algorithm: Optional[str] = None,
    expected_issuer: Optional[str] = None,
    expected_audience: Optional[str] = None,
    require_issuer: Optional[bool] = None,
    supabase_client: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Independently verifies a Supabase Auth JWT token with pinned algorithm and key/keyring.

    Supported Algorithms:
    - 'HS256': Symmetric HMAC verification using SUPABASE_JWT_SECRET or passed jwt_secret.
    - 'RS256': Asymmetric RSA verification using explicit PEM public key (SUPABASE_JWT_PUBLIC_KEY
      or passed public_key) or explicitly configured keyring (SUPABASE_JWT_KEYRING_JSON or passed keyring).
      NEVER fetches remote JWKS on the request path.

    SECURITY INVARIANTS:
    1. Single Pinned Algorithm:
       Algorithms list is strictly pinned to exactly one algorithm ([configured_alg]).
       Rejects 'none', algorithm substitution (e.g. HS256 presented to RS256 verifier),
       and unconfigured algorithms. Verified on unverified header prior to decode.
    2. Explicit Verification Key / Keyring:
       Key must match the pinned algorithm.
       When keyring is configured, 'kid' must be present in token header and match a trusted key in the keyring.
       Never falls back to local JWT_SECRET.
    3. Mandatory Issuer Validation:
       When Supabase Auth is selected (or when require_issuer is enabled or issuer is configured),
       expected issuer must be established from trusted configuration (explicit SUPABASE_EXPECTED_ISSUER
       or derived from validated SUPABASE_URL: f"{url}/auth/v1"). Rejects mismatched or missing issuers.
    4. Strict Claim Validation:
       - Signature and expiration ('exp') verified by cryptographic decode.
       - Audience ('aud') strictly verified against expected_audience or 'authenticated'.
       - Role ('role') strictly verified to be 'authenticated'.
       - Subject ('sub') verified to be a non-empty RFC 4122 UUID.
    5. Remote Verification:
       Remote fallback (/auth/v1/user) is ONLY attempted when neither secret nor public_key/keyring is configured
       and Supabase URL is present (or supabase_client passed). NEVER executes JWKS network requests.
    6. Fail Closed:
       Any cryptographic, format, claim, or algorithm failure raises HTTPException(401).
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # Determine algorithm and reject ambiguous or unsupported algorithms
    raw_alg = algorithm or os.getenv("SUPABASE_JWT_ALGORITHM")
    has_rsa_key = bool(public_key or os.getenv("SUPABASE_JWT_PUBLIC_KEY") or keyring or os.getenv("SUPABASE_JWT_KEYRING_JSON"))
    has_hmac_secret = bool(jwt_secret or get_supabase_jwt_secret())

    if raw_alg:
        configured_alg = raw_alg.strip().upper()
        if configured_alg not in ("HS256", "RS256"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Unsupported token verification algorithm '{configured_alg}'. Allowed: 'HS256', 'RS256'.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if configured_alg == "HS256" and has_rsa_key and not has_hmac_secret:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Algorithm/key mismatch: configured for HS256 but provided key is an RSA public key, not an HMAC secret.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if configured_alg == "RS256" and has_hmac_secret and not has_rsa_key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Algorithm/key mismatch: configured for RS256 but provided key is an HMAC secret, not an RSA public key.",
                headers={"WWW-Authenticate": "Bearer"},
            )
    else:
        if has_rsa_key and has_hmac_secret:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Ambiguous token verification configuration: both RS256 public key/keyring and HS256 secret configured without explicit SUPABASE_JWT_ALGORITHM.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        elif has_hmac_secret:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token verification failed: HMAC secret provided without explicitly configured algorithm 'HS256'. An explicit algorithm configuration is required.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        elif has_rsa_key:
            configured_alg = "RS256"
        else:
            configured_alg = "RS256"

    # Establish trusted expected issuer
    is_supabase_auth_selected = (get_auth_provider() == "supabase")
    must_require_iss = (
        require_issuer
        if require_issuer is not None
        else (is_supabase_auth_selected or expected_issuer is not None)
    )

    target_iss: Optional[str] = None
    if must_require_iss:
        target_iss = (expected_issuer or get_expected_supabase_issuer() or "").strip()
        if not target_iss:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token verification failed: trusted expected issuer is not configured",
                headers={"WWW-Authenticate": "Bearer"},
            )
    else:
        explicit_env_iss = os.getenv("SUPABASE_EXPECTED_ISSUER", "").strip().rstrip("/")
        if explicit_env_iss:
            target_iss = explicit_env_iss

    user_id: Optional[str] = None
    user_email: Optional[str] = None
    user_name: Optional[str] = None

    # Key and Keyring resolution
    active_keyring: Optional[Dict[str, str]] = None
    if keyring is not None:
        if not isinstance(keyring, dict) or not keyring:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token verification failed: keyring cannot be empty",
                headers={"WWW-Authenticate": "Bearer"},
            )
        validated_keyring: Dict[str, str] = {}
        for k, v in keyring.items():
            if not isinstance(k, str) or not k.strip():
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token verification failed: empty key ID in keyring",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            if not isinstance(v, str) or not v.strip():
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token verification failed: empty key material in keyring",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            if configured_alg == "RS256":
                try:
                    validate_rsa_public_key_pem(v.strip(), f"keyring key '{k.strip()}'")
                except ValueError as e:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail=f"Token verification failed: {e}",
                        headers={"WWW-Authenticate": "Bearer"},
                    )
            validated_keyring[k.strip()] = v.strip()
        active_keyring = validated_keyring
    else:
        try:
            active_keyring = get_supabase_keyring()
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Token verification failed: invalid keyring configuration ({e})",
                headers={"WWW-Authenticate": "Bearer"},
            )

    key: Optional[str] = None

    if configured_alg == "RS256":
        if active_keyring:
            try:
                unverified_header = jwt.get_unverified_header(token)
            except JWTError:
                raise credentials_exception

            header_alg = unverified_header.get("alg")
            if not header_alg or header_alg.strip().upper() != "RS256":
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Invalid token algorithm: expected 'RS256', got '{header_alg}'",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            kid = unverified_header.get("kid")
            if not kid or kid not in active_keyring:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Token verification failed: unknown or missing key identifier (kid: '{kid or ''}')",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            key = active_keyring[kid]
        else:
            key = public_key or os.getenv("SUPABASE_JWT_PUBLIC_KEY")
            if not key:
                if has_hmac_secret:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Algorithm/key mismatch: configured for RS256 but provided key is an HMAC secret, not an RSA public key.",
                        headers={"WWW-Authenticate": "Bearer"},
                    )
                if supabase_client is None:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Token verification failed: algorithm RS256 configured but no RSA public key or keyring provided.",
                        headers={"WWW-Authenticate": "Bearer"},
                    )
            else:
                try:
                    validate_rsa_public_key_pem(key, "SUPABASE_JWT_PUBLIC_KEY")
                except ValueError as e:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail=f"Invalid verification key material: {e}",
                        headers={"WWW-Authenticate": "Bearer"},
                    )

                try:
                    unverified_header = jwt.get_unverified_header(token)
                    header_alg = unverified_header.get("alg")
                    if header_alg and header_alg.strip().upper() != "RS256":
                        raise HTTPException(
                            status_code=status.HTTP_401_UNAUTHORIZED,
                            detail=f"Invalid token algorithm: expected 'RS256', got '{header_alg}'",
                            headers={"WWW-Authenticate": "Bearer"},
                        )
                except JWTError:
                    raise credentials_exception

    elif configured_alg == "HS256":
        if has_rsa_key and not (jwt_secret or get_supabase_jwt_secret()):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Algorithm/key mismatch: configured for HS256 but provided key is an RSA public key, not an HMAC secret.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        key = jwt_secret if jwt_secret is not None else get_supabase_jwt_secret()
        if not key:
            if supabase_client is None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token verification failed: algorithm HS256 requires an explicitly configured HMAC verification secret (SUPABASE_JWT_SECRET). "
                           "Administrative keys (SUPABASE_SERVICE_ROLE_KEY) cannot be used as verification secrets.",
                    headers={"WWW-Authenticate": "Bearer"},
                )
        else:
            service_key = get_supabase_service_role_key()
            publishable_key = get_supabase_publishable_key()
            if (service_key and key == service_key) or (publishable_key and key == publishable_key):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token verification failed: service-role and publishable API keys cannot be used as verification secrets.",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            if key.strip().startswith("-----BEGIN"):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Algorithm/key mismatch: HMAC verification secret cannot be an asymmetric PEM key.",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            try:
                unverified_header = jwt.get_unverified_header(token)
                header_alg = unverified_header.get("alg")
                if header_alg and header_alg.strip().upper() != "HS256":
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail=f"Invalid token algorithm: expected 'HS256', got '{header_alg}'",
                        headers={"WWW-Authenticate": "Bearer"},
                    )
            except JWTError:
                raise credentials_exception

    # 1. Local cryptographic signature and claim verification
    if key:
        try:
            # Single pinned algorithm list enforces no algorithm confusion or substitution
            payload = jwt.decode(
                token,
                key,
                algorithms=[configured_alg],
                options={"verify_aud": False},
            )

            # A. Audience claim validation
            target_aud = expected_audience or os.getenv("SUPABASE_EXPECTED_AUDIENCE") or "authenticated"
            aud = payload.get("aud")
            if aud != target_aud:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Invalid token audience: expected '{target_aud}'",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            # B. Role claim validation
            role = payload.get("role")
            if role != "authenticated":
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token role: expected 'authenticated'",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            # C. Subject claim validation (must be valid UUID)
            sub = payload.get("sub")
            if not sub or not is_valid_uuid(str(sub)):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token subject: must be a valid UUID",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            # D. Issuer claim validation
            if target_iss or must_require_iss:
                iss = payload.get("iss")
                if not iss or iss.rstrip("/") != target_iss.rstrip("/"):
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail=f"Invalid or missing token issuer: expected '{target_iss}'",
                        headers={"WWW-Authenticate": "Bearer"},
                    )

            user_id = str(sub)
            user_email = payload.get("email")
            metadata = payload.get("user_metadata") or {}
            user_name = metadata.get("full_name") or metadata.get("name") or user_email

        except JWTError:
            user_id = None
        except HTTPException:
            raise

    # 2. Remote verification via Supabase Auth API (/auth/v1/user) if local key was not configured
    if not user_id and (supabase_client is not None or (not key and get_supabase_url())):
        try:
            sb = supabase_client or get_supabase_client()
            sb_user = await sb.get_user_from_token(token)
            if sb_user:
                sub = sb_user.get("id")
                aud = sb_user.get("aud")
                role = sb_user.get("role")

                if (
                    sub
                    and is_valid_uuid(str(sub))
                    and (aud is None or aud == "authenticated")
                    and (role is None or role == "authenticated")
                ):
                    user_id = str(sub)
                    user_email = sb_user.get("email")
                    metadata = sb_user.get("user_metadata") or {}
                    user_name = metadata.get("full_name") or metadata.get("name") or user_email
        except Exception:
            user_id = None

    if not user_id:
        raise credentials_exception

    return {
        "id": user_id,
        "email": user_email or "",
        "name": user_name or "Architect",
        "token": token,
        "provider": "supabase",
    }


def create_access_token(data: dict) -> str:
    """Create a standard JWT token for AUTH_PROVIDER=jwt."""
    active_jwt_secret = os.getenv("JWT_SECRET") or JWT_SECRET
    secret = active_jwt_secret if get_auth_provider() == "jwt" else (get_supabase_jwt_secret() or active_jwt_secret)
    if not secret:
        raise ValueError("Cannot sign JWT without a configured secret key.")
    service_key = get_supabase_service_role_key()
    publishable_key = get_supabase_publishable_key()
    if (service_key and secret == service_key) or (publishable_key and secret == publishable_key):
        raise ValueError("Service-role and publishable API keys must never be used as signing or verification secrets.")
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, secret, algorithm=ALGORITHM)


async def get_current_user(token: str = Depends(oauth2_scheme)) -> Dict[str, Any]:
    """
    Validate the incoming Bearer token and return the authenticated user dict.
    Supports custom JWT tokens as well as Supabase Auth tokens.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    current_provider = get_auth_provider()

    # ── Supabase Auth Verification ────────────────────────────────────────────
    if current_provider == "supabase":
        return await verify_supabase_token(token)

    # ── Standard Custom JWT Verification (AUTH_PROVIDER=jwt) ──────────────────
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        user_id_str: str = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    from db.repositories import get_user_by_id
    user = await get_user_by_id(user_id_str)
    if user is None:
        return {
            "id": user_id_str,
            "email": payload.get("email", ""),
            "name": payload.get("name", "Architect"),
            "token": token,
        }
    user["id"] = str(user.get("_id") or user.get("id", user_id_str))
    user["token"] = token
    return user


# ── Explicit Token Extraction Dependencies ────────────────────────────────────

oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)


async def get_raw_bearer_token(
    token: str = Depends(oauth2_scheme),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> str:
    """
    Safely extract and verify the raw Bearer token from the HTTP Authorization header.
    Guarantees that the token has been authenticated by get_current_user before handoff.
    Never logs token content.
    """
    return token


async def get_optional_raw_bearer_token(
    token: Optional[str] = Depends(oauth2_scheme_optional),
) -> Optional[str]:
    """
    Safely extracts the raw Bearer token if present, or returns None if omitted.
    Never logs token content.
    """
    return token
