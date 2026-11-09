# AI Architect — Milestone 6: Security Audit & Vulnerability Assessment

**Date:** 2026-10-26  
**Auditor:** AI Architect Security & Reliability Audit Team  
**Scope:** Authentication, Authorization, Cross-User Isolation, Input Validation, AI Guardrails, CORS, Headers, and Dependency Risks  
**Target Codebase:** FastAPI Backend (`backend/`) & React Client (`frontend/`)  

---

## 1. Executive Summary

A comprehensive, evidence-based security audit was conducted across the AI Architect application. The application handles architectural blueprints, CAD vector layouts, financial estimates (BOM), and multi-turn architectural design conversations.

The audit identified **1 High**, **3 Medium**, and **1 Low** security findings, alongside multiple verified security strengths where defenses are robust.

### Summary of Findings Matrix

| Finding ID | Severity | Category | Description | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | **High** | Authentication Bypass | Unauthenticated arbitrary file write endpoint (`/api/export/save-audit-file`) | Confirmed Defect |
| **SEC-02** | **Medium** | CORS Configuration | Permissive localhost regex allowed with credentials in production mode | Confirmed Defect |
| **SEC-03** | **Medium** | Defense in Depth | Missing standard HTTP security headers (CSP, HSTS, X-Frame-Options) | Confirmed Defect |
| **SEC-04** | **Medium** | Denial of Service | Absence of request body size limits on API endpoints | Confirmed Defect |
| **SEC-05** | **Low** | Configuration | Real project URL / publishable key in `.env.example` templates | Confirmed |
| **SEC-06** | **N/A (Pass)** | Access Control | Cross-user project isolation and IDOR protection | **Verified Secure** |
| **SEC-07** | **N/A (Pass)** | AI Safety | AI Copilot prompt injection guardrails and boundary validation | **Verified Secure** |
| **SEC-08** | **N/A (Pass)** | Cryptography | JWT signature verification, expiration, and algorithm pinning | **Verified Secure** |

---

## 2. Confirmed Vulnerabilities and Detailed Analysis

### Finding SEC-01 (High): Unauthenticated File Persistence Endpoint (`/api/export/save-audit-file`)

- **Affected File:** [`backend/routers/export_routes.py`](file:///c:/Users/yoges/OneDrive/Desktop/architect/AI-Architect/backend/routers/export_routes.py#L200-L229)
- **Code Inspection:**
  ```python
  @router.post("/api/export/save-audit-file")
  @router.post("/export/save-audit-file")
  @router.post("/save-audit-file")
  async def save_audit_file(req: SaveAuditFileRequest):
      safe_name = os.path.basename(req.filename)
      dest_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "scratch", "exports"))
      ...
      with open(dest_path, "wb") as f:
          f.write(file_bytes)
  ```
- **Vulnerability Mechanism:**
  The endpoint was introduced as an audit helper for browser testing sessions to save exported files. However, it lacks any authentication dependency (`current_user: dict = Depends(get_current_user)`). Any unauthenticated user or script on the network can POST arbitrary base64-encoded binary content or text strings that are written directly into the filesystem under `scratch/exports/`.
- **Impact:**
  - Potential denial of service by exhausting server disk storage.
  - Overwriting legitimate audit exports or test artifacts.
  - Unauthenticated file creation risk.
- **Recommended Safe Correction:**
  1. Add authentication requirement (`current_user: dict = Depends(get_current_user)`).
  2. Restrict allowed file extensions strictly to safe export formats (`.dxf`, `.pdf`, `.svg`, `.json`, `.png`).
  3. Enforce maximum payload size limit (e.g., 10MB).
  4. Restrict availability to development/test environments or authenticated administrator sessions.

---

### Finding SEC-02 (Medium): Permissive Localhost CORS Origin Regex in Production

- **Affected File:** [`backend/main.py`](file:///c:/Users/yoges/OneDrive/Desktop/architect/AI-Architect/backend/main.py#L64-L71)
- **Code Inspection:**
  ```python
  app.add_middleware(
      CORSMiddleware,
      allow_origins=[o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()],
      allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
      allow_credentials=True,
      allow_methods=["*"],
      allow_headers=["*"],
  )
  ```
- **Vulnerability Mechanism:**
  FastAPI's `CORSMiddleware` evaluates `allow_origin_regex` alongside `allow_origins`. Because `allow_origin_regex` matches any port on `localhost` or `127.0.0.1` and `allow_credentials=True` is enabled, any arbitrary process, rogue extension, or untrusted local script can make authenticated API requests with browser cookies or credentials if deployed in a multi-tenant cloud VM or container.
- **Impact:**
  Unintended cross-origin access from arbitrary local services in production environments.
- **Recommended Safe Correction:**
  Conditionally apply `allow_origin_regex` only when running in development mode (`ENVIRONMENT != "production"`). In production mode, strictly honor explicit domains in `CORS_ORIGINS`.

---

### Finding SEC-03 (Medium): Missing Standard HTTP Security Headers

- **Affected File:** [`backend/main.py`](file:///c:/Users/yoges/OneDrive/Desktop/architect/AI-Architect/backend/main.py#L59-L85)
- **Inspection Findings:**
  Inspection of HTTP response headers from `/health`, `/projects`, and `/api/agent/chat` shows that no security headers are emitted by the server. Missing headers include:
  - `X-Content-Type-Options: nosniff` (Prevents MIME-sniffing attacks)
  - `X-Frame-Options: DENY` (Prevents clickjacking via malicious iframe embeds)
  - `Referrer-Policy: strict-origin-when-cross-origin` (Prevents leaking project IDs in referrers)
  - `Permissions-Policy: geolocation=(), camera=(), microphone=()` (Restricts browser features)
  - `Strict-Transport-Security` (Enforces HTTPS in production)
- **Recommended Safe Correction:**
  Implement a lightweight ASGI middleware in `backend/main.py` that automatically sets these headers on all outgoing responses.

---

### Finding SEC-04 (Medium): Lack of Request Payload Body Size Limit (DoS Risk)

- **Affected File:** [`backend/main.py`](file:///c:/Users/yoges/OneDrive/Desktop/architect/AI-Architect/backend/main.py)
- **Vulnerability Mechanism:**
  FastAPI parses incoming request streams in memory without an explicit request body limit. An attacker can transmit multi-hundred-megabyte JSON payloads to `/api/projects` or `/generate`, causing memory exhaustion and worker process crashes.
- **Recommended Safe Correction:**
  Add a request size limiter middleware that checks `Content-Length` and chunks, rejecting payloads exceeding 15MB with `413 Payload Too Large`. (15MB comfortably accommodates large multi-floor canonical models with itemized schedules while blocking memory exhaustion attacks).

---

### Finding SEC-05 (Low): Example Configuration Contains Active Domain String

- **Affected Files:**
  - [`backend/.env.example`](file:///c:/Users/yoges/OneDrive/Desktop/architect/AI-Architect/backend/.env.example#L3-L4)
  - [`frontend/.env.example`](file:///c:/Users/yoges/OneDrive/Desktop/architect/AI-Architect/frontend/.env.example#L8-L9)
- **Inspection Findings:**
  Both example files specify `https://dxkehvifctxccwqgbpwb.supabase.co` and a publishable key string. While publishable keys are public by design, production best practice dictates using neutral placeholders (`https://your-project.supabase.co`, `sb_publishable_your_key_here`) in distributed example templates.
- **Recommended Correction:**
  Replace with generic placeholder strings in `.env.example`.

---

## 3. Audited and Verified Security Strengths

### SEC-06: Cross-User Project Isolation & IDOR Defense (VERIFIED SECURE)
- **Routes Audited:**
  - `GET /projects`: Scoped to `current_user["id"]`
  - `POST /projects`: Automatically sets `user_id = current_user["id"]`
  - `GET /projects/{id}`: Rejects requests where `project.user_id != current_user["id"]` (HTTP 404)
  - `PUT /projects/{id}`: Rejects unauthorized modification attempts (HTTP 404)
  - `DELETE /projects/{id}`: Rejects unauthorized deletion attempts (HTTP 404)
  - `GET /projects/{id}/versions`: Enforces owner validation
  - `POST /api/agent/chat`: Validates conversation and project ownership before processing turns
- **Evidence:** Automated test suite `backend/tests/test_authorization_hardening.py` executes 10 comprehensive tests proving that cross-user access attempts are rejected fail-closed.

### SEC-07: AI Copilot Guardrails & Deterministic Geometry Verification (VERIFIED SECURE)
- **Architecture Audited:** [`backend/services/agent_service.py`](file:///c:/Users/yoges/OneDrive/Desktop/architect/AI-Architect/backend/services/agent_service.py) and [`backend/services/layout_modifier.py`](file:///c:/Users/yoges/OneDrive/Desktop/architect/AI-Architect/backend/services/layout_modifier.py)
- **Safety Mechanisms:**
  - The LLM does **not** execute arbitrary code and cannot directly emit unverified coordinates.
  - Natural language input is parsed into a strictly typed `ArchitecturalOperation` schema.
  - The geometry modifier deterministically validates:
    - Boundary containment (`check_in_bounds()`) against the plot boundary.
    - Zero room overlap (`check_overlap()`).
  - Destructive operations (`remove_room`, `remove_furniture`) require explicit room targeting.
  - Invalid edits are rejected with an actionable architectural explanation, leaving the canonical document 100% unchanged.

### SEC-08: JWT Cryptographic Verification & Algorithm Pinning (VERIFIED SECURE)
- **Architecture Audited:** [`backend/core/auth.py`](file:///c:/Users/yoges/OneDrive/Desktop/architect/AI-Architect/backend/core/auth.py)
- **Safety Mechanisms:**
  - Algorithm is strictly pinned to `HS256` (or `RS256` in Supabase asymmetric mode).
  - Algorithm confusion attacks ('none', public key as HMAC secret) are explicitly tested and rejected.
  - Token claims (`exp`, `sub`, `aud`, `role`) are validated on every request.
  - 22 isolated tests in `test_isolated_supabase_auth.py` and 17 tests in `test_auth_token_passthrough.py` confirm cryptographic enforcement.

---

## 4. Dependency Vulnerability Analysis

### 4.1 Frontend Dependencies (`npm audit`)
- **Audit Findings:** 10 vulnerabilities (2 moderate, 8 high).
- **Context & Risk Assessment:**
  - `vite` (8.0.0 - 8.1.5): Vulnerabilities relate to `server.fs.deny` bypass and `launch-editor` UNC path handling on Windows. These affect developer workstations running `vite dev` and are **not present** in the compiled production static bundle (`dist/`).
  - `react-router` (6.0.0 - 7.18.1): SSR deserialization and constructor injection vulnerabilities. AI Architect is an SPA without server-side rendering, mitigating these execution vectors.
  - `zod` (<4.6.6): Memory exhaustion on oversized collections. Client-side schemas are constrained to small fixed models.
- **Policy Compliance:** In accordance with non-negotiable rules, automatic dependency overhauls were avoided to protect application stability. Upgrades are queued for human review.

### 4.2 Backend Dependencies
- Python 3.12 packages audited via `pip list`.
- Key packages pinned: `fastapi==0.143.0`, `pydantic==2.14.0`, `python-jose==3.5.0`, `bcrypt==5.0.0`, `motor==3.7.1`, `pymongo==4.18.3`, `uvicorn==0.54.0`.
- All cryptographic libraries are modern versions.
