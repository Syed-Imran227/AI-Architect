# AI Architect — Staging Cutover Runbook & Release Gate

**Document Version:** 1.0.0  
**Phase:** Milestone 5C.6  
**Status:** DRAFT / PENDING OPERATOR SIGN-OFF  
**Scope:** MongoDB to Supabase PostgreSQL & Supabase Auth Staging Cutover  

---

> [!IMPORTANT]
> **SAFETY CONTRACT & DEMARCATION:**
> This runbook is an offline, reviewed technical procedure. It **must not** be executed until all preconditions, backup requirements, and operator verifications are formally satisfied and signed off by the engineering lead. All live staging configurations and credentials remain **UNVERIFIED / PENDING** until real staging execution.

---

## 1. Preconditions & Approval Gates

Before initiating cutover in the staging environment, the following operational gates must be satisfied:

| Gate ID | Requirement | Responsible Role | Status |
| :--- | :--- | :--- | :--- |
| **GATE-01** | Offline Test Suite Pass (125/125 backend tests, 0 TS build errors) | Agent / CI | **VERIFIED OFFLINE** |
| **GATE-02** | Staging Infrastructure Provisioned (Supabase Project, PostgreSQL 15+, Auth Service) | Cloud/DevOps Operator | **PENDING OPERATOR** |
| **GATE-03** | Operator Credential Review (Zero secrets committed to VCS, `.env` isolated) | Security Operator | **PENDING OPERATOR** |
| **GATE-04** | Change Window Authorized & Maintenance Notice Scheduled | Release Manager | **PENDING OPERATOR** |
| **GATE-05** | Rollback Operator Assigned with Active Root Database Access | Database Operator | **PENDING OPERATOR** |

---

## 2. Backup & Recovery Protocol (Pre-Cutover)

Do not alter application settings or begin data transfer until full recovery capability is confirmed.

### 2.1 MongoDB Pre-Migration Snapshot
1. Freeze client writes by establishing a maintenance window or enabling read-only application middleware.
2. Generate an atomic, compressed BSON archive of the staging MongoDB instance:
   ```bash
   mongodump --uri="${STAGING_MONGO_URI}" --archive="staging_mongo_pre_cutover_$(date +%Y%m%d_%H%M%S).archive.gz" --gzip
   ```
3. Generate and record SHA-256 checksum of the archive:
   ```bash
   sha256sum staging_mongo_pre_cutover_*.archive.gz > staging_mongo_pre_cutover.sha256
   ```
4. **Mandatory Restoration Drill:**
   Restore the archive to an isolated staging scratch database instance (`mongo_scratch_verify`) to guarantee backup uncorrupted recovery before proceeding:
   ```bash
   mongorestore --uri="${STAGING_MONGO_SCRATCH_URI}" --archive="staging_mongo_pre_cutover_*.archive.gz" --gzip --drop
   ```
5. Confirm record counts in scratch replica match source collections exactly:
   - `users`
   - `projects`
   - `conversations`
   - `messages`
   - `user_identity_mappings`

### 2.2 Supabase PostgreSQL State Snapshot
1. Capture clean schema state and verify PostgreSQL Point-in-Time Recovery (PITR) is active.
2. In Supabase Dashboard: Navigate to **Database** -> **Backups** -> Confirm an on-demand snapshot is created prior to schema creation.

---

## 3. Cryptographic Key Material & Auth Verification

Live Supabase Auth configuration must be strictly validated by the IAM operator prior to pointing the backend at Supabase.

### 3.1 Verification Checklist
- [ ] **Expected Issuer (`SUPABASE_EXPECTED_ISSUER`):**
  Must equal the exact canonical project endpoint:
  `https://<project-ref>.supabase.co/auth/v1` (with no trailing slash mismatch).
- [ ] **Token Verification Algorithm (`SUPABASE_JWT_ALGORITHM`):**
  Must be set explicitly to `RS256`. (Note: `HS256` is strictly restricted to legacy HMAC secrets and must never be inferred).
- [ ] **RSA Public Key Material (`SUPABASE_JWT_PUBLIC_KEY` or `SUPABASE_JWT_KEYRING_JSON`):**
  - Download public keys directly from the trusted Supabase JWKS endpoint: `https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json`.
  - Format keys as standard PEM: `-----BEGIN PUBLIC KEY----- ... -----END PUBLIC KEY-----`.
  - Validate PEM structure offline using OpenSSL:
    ```bash
    openssl rsa -pubin -in supabase_pubkey.pem -text -noout
    ```
  - If rotating keys, populate `SUPABASE_JWT_KEYRING_JSON` mapping `kid` identifiers to PEM strings:
    ```json
    {"key_id_staging_v1": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"}
    ```
- [ ] **Audience Claim (`SUPABASE_EXPECTED_AUDIENCE`):**
  Must default to or be configured as `"authenticated"`. Tokens presenting `aud="anon"` or `aud="service_role"` must be rejected.
- [ ] **Administrative Key Boundary:**
  - `SUPABASE_SERVICE_ROLE_KEY` must **NEVER** be set as `SUPABASE_JWT_SECRET` or used for token verification.
  - Verify `SUPABASE_PUBLISHABLE_KEY` (or anon key) is used only as PostgREST API identification header (`apikey`), never as signing secret.

---

## 4. Identity-Mapping Reconciliation & Index Verification

Dual-provider transitional integrity requires strict one-to-one mapping between MongoDB `ObjectId` (24 hex characters) and Supabase Auth `UUID` (36 hyphenated characters).

### 4.1 MongoDB Schema & Unique Index Enforcement
In the staging MongoDB instance, run index creation script for `user_identity_mappings`:

```javascript
// MongoDB Shell script: create_identity_mapping_indexes.js
db.user_identity_mappings.createIndex(
  { "supabase_user_id": 1 },
  { unique: true, name: "uniq_supabase_user_id" }
);

db.user_identity_mappings.createIndex(
  { "mongodb_user_id": 1 },
  { unique: true, name: "uniq_mongodb_user_id" }
);

db.user_identity_mappings.createIndex(
  { "supabase_user_id": 1, "status": 1 },
  { name: "idx_status_supabase" }
);

db.user_identity_mappings.createIndex(
  { "migration_batch_id": 1 },
  { name: "idx_migration_batch" }
);
```

### 4.2 Operator Verification of Index Specs
Verify indexes via Mongo shell:
```javascript
db.user_identity_mappings.getIndexes();
```
**Gate Requirement:** `uniq_supabase_user_id` and `uniq_mongodb_user_id` must report `"unique": true`. If non-unique mappings exist, the process fails closed immediately.

### 4.3 Zero-Email-Inference Rule
Mappings must be explicitly established and recorded. Accounts must **never** be linked automatically by matching email addresses alone, preventing federated account takeover.

---

## 5. Dry-Run Migration Plan & Data Integrity Checks

Before writing any records to PostgreSQL, run the migration planning CLI in dry-run mode against staging data exports.

### 5.1 Dry-Run Execution
```bash
python backend/scripts/migrate_mongo_to_supabase.py \
  --dry-run \
  --user-ledger=staging_exports/user_ledger.json \
  --projects=staging_exports/projects.json \
  --output-json=staging_migration_plan.json \
  --output-report=staging_migration_report.txt
```

### 5.2 Pass/Fail Criteria for Migration Plan
Inspect the output report:
- `OVERALL RESULT` must equal `PASS (CLEAN PLAN)`.
- `BLOCKING ERRORS` must equal `0`.
- `BLOCKED RECORDS` must equal `0`.
- `Unresolved User IDs` must equal `0`.
- `CANONICAL GEOMETRY PRESERVATION`: 100% exact semantic match for all `layout_data` blobs. Zero dropped vertices, walls, or rooms.

---

## 6. Staging Authentication Smoke Tests

Perform end-to-end token validation tests on the deployed staging backend.

### 6.1 Test Scenarios
1. **Valid User Token (Positive Smoke Test):**
   - Acquire valid Bearer JWT from staging Supabase Auth.
   - Send `GET /auth/me` (or `/api/auth/me` if reverse-proxied) with header `Authorization: Bearer <token>`.
   - Verify `HTTP 200 OK`, returned user ID matches Supabase UUID, provider is `"supabase"`.
2. **Expired Token:**
   - Present an expired JWT -> Verify `HTTP 401 Unauthorized` with `Could not validate credentials`.
3. **Invalid Signature / Wrong Key:**
   - Present a JWT signed by an unauthorized key -> Verify `HTTP 401 Unauthorized`.
4. **Invalid Audience:**
   - Present token with `aud: "anon"` -> Verify `HTTP 401 Unauthorized`.
5. **Invalid Role:**
   - Present token with `role: "anon"` or custom role -> Verify `HTTP 401 Unauthorized`.
6. **Non-UUID Subject:**
   - Present token with non-UUID `sub` -> Verify `HTTP 401 Unauthorized`.
7. **Algorithm Substitution Attempt:**
   - Present HS256 token to an RS256-configured verifier -> Verify `HTTP 401 Unauthorized`.
8. **Unknown Key Identifier (`kid`):**
   - Present RS256 token with unrecognized `kid` not in `SUPABASE_JWT_KEYRING_JSON` -> Verify `HTTP 401 Unauthorized`.

---

## 7. Cross-User Authorization Matrix (Multi-Tenant Isolation)

Deploy two synthetic test users in staging: `User_A` (`UUID_A`) and `User_B` (`UUID_B`).

| Action | Executed By | Target Resource Owned By | Expected Result | Verified Offline | Staging Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET /projects/{proj_A}` | `User_A` | `User_A` | `HTTP 200 OK` | Yes | PENDING |
| `GET /projects/{proj_B}` | `User_A` | `User_B` | `HTTP 404 Not Found` | Yes | PENDING |
| `PUT /projects/{proj_B}` | `User_A` | `User_B` | `HTTP 404 Not Found` | Yes | PENDING |
| `DELETE /projects/{proj_B}` | `User_A` | `User_B` | `HTTP 404 Not Found` | Yes | PENDING |
| `GET /projects/{proj_B}/versions` | `User_A` | `User_B` | `[]` (Empty list / 404) | Yes | PENDING |
| `GET /api/agent/history?conversation_id={conv_B}` | `User_A` | `User_B` | `HTTP 404 Not Found` | Yes | PENDING |
| `GET /api/agent/history?project_id={proj_B}` | `User_A` | `User_B` | `HTTP 404 Not Found` | Yes | PENDING |
| `POST /api/agent/chat` (body `{"conversation_id": conv_B}`) | `User_A` | `User_B` | `HTTP 404 Not Found` | Yes | PENDING |
| `POST /api/export/dxf` (body `{"project_id": proj_B}`) | `User_A` | `User_B` | CAD generated; asset metadata recording refused (`None`) | Yes | PENDING |
| `POST /api/export/pdf` (body `{"project_id": proj_B}`) | `User_A` | `User_B` | PDF generated; asset metadata recording refused (`None`) | Yes | PENDING |

---

## 8. Logging, Telemetry & PII Leak Prevention

Verify logs during authentication and API requests:
- [ ] Authorization headers (`Bearer <token>`) are stripped or redacted in logs.
- [ ] No plaintext passwords or password hashes appear in logs or error traces.
- [ ] Database connection strings and service role keys are masked (`***`).
- [ ] 401/403 exceptions emit structured, generic failure reasons without internal server paths or private keys.

---

## 9. Objective Go / No-Go Decision Criteria

At the release gate meeting, the team evaluates the following checklist. Any single **NO-GO** trigger halts the cutover.

```
+-----------------------------------------------------------------------------------+
| GO CRITERIA (ALL MUST BE TRUE)                                                    |
+-----------------------------------------------------------------------------------+
| [ ] 1. MongoDB backup verified with successful restore test to scratch instance.  |
| [ ] 2. 125/125 offline backend tests pass cleanly.                                |
| [ ] 3. Frontend production build compiles with zero TypeScript errors.           |
| [ ] 4. Staging dry-run migration plan reports 0 blocking errors and 0 orphans.    |
| [ ] 5. Supabase Auth configuration verified: RS256, explicit issuer, PEM pubkey.  |
| [ ] 6. Bi-directional unique indexes verified in user_identity_mappings.          |
| [ ] 7. Cross-tenant isolation matrix passes 100% in staging.                      |
| [ ] 8. Zero PII/token leaks in logs under request load.                           |
+-----------------------------------------------------------------------------------+
| NO-GO TRIGGERS (ANY ONE HALTS CUTOVER)                                            |
+-----------------------------------------------------------------------------------+
| [!] 1. Missing or unverified MongoDB pre-migration backup.                        |
| [!] 2. Unresolved user ID mappings in migration dry-run.                          |
| [!] 3. Ambiguous auth configuration (e.g. secret present without explicit HS256). |
| [!] 4. Service role key accepted as verification secret.                          |
| [!] 5. Any cross-tenant read/write leakage observed.                              |
| [!] 6. Layout geometry mutation or property loss detected.                        |
+-----------------------------------------------------------------------------------+
```

---

## 10. Rollback Protection & Split-Brain Prevention

> [!CAUTION]
> **WHY CHANGING AN ENVIRONMENT VARIABLE IS NOT SUFFICIENT FOR ROLLBACK:**
> If `DATABASE_PROVIDER=supabase` and `AUTH_PROVIDER=supabase` are activated and staging users create or edit projects in Supabase PostgreSQL, reverting `DATABASE_PROVIDER=mongodb` will immediately produce a **split-brain state**:
> 1. New projects and design changes created in Supabase PostgreSQL will not exist in MongoDB.
> 2. Newly registered Supabase users will have no counterpart MongoDB records.
> 3. Existing MongoDB documents will become stale relative to the active PostgreSQL edits.

### 10.1 Write-Quiesce Protocol
During cutover and post-cutover verification:
1. Restrict staging access to the QA verification team only.
2. If cutover aborts or fails verification within the maintenance window, zero live customer writes will have been accepted, permitting a clean restore.

### 10.2 Reverse Reconciliation Ledger (If Writes Occurred)
If staging writes were committed to Supabase before a rollback trigger:
1. Immediately place application in maintenance mode (`MAINTENANCE_MODE=true`).
2. Run reverse delta extraction:
   ```bash
   python backend/scripts/extract_supabase_delta.py \
     --since="${CUTOVER_START_TIMESTAMP}" \
     --output=rollback_delta.json
   ```
3. Reconcile delta projects into MongoDB before restoring `DATABASE_PROVIDER=mongodb` traffic.

### 10.3 Step-by-Step Rollback Execution
1. **Halt Application Traffic:** Route staging traffic to a static 503 Maintenance page.
2. **Revert Provider Settings:**
   ```bash
   DATABASE_PROVIDER=mongodb
   AUTH_PROVIDER=jwt
   ```
3. **Restore Database from Snapshot (If Unreconciled Writes Occurred):**
   ```bash
   mongorestore --uri="${STAGING_MONGO_URI}" --archive="staging_mongo_pre_cutover_*.archive.gz" --gzip --drop
   ```
4. **Restart Backend Service:**
   ```bash
   systemctl restart ai-architect-backend # or docker-compose restart backend
   ```
5. **Verify Local JWT Operation:**
   Run native JWT smoke test: confirm legacy user login and project retrieval operate normally.
6. **Lift Maintenance Mode:** Restore traffic to MongoDB/JWT application.

---

## 11. Post-Cutover Verification & Monitoring

Once cutover to Supabase is complete:
1. **24-Hour Soak Period:** Monitor application error rates, response latencies, and token verification failures.
2. **Key Rotation Readiness:** Confirm `SUPABASE_JWT_KEYRING_JSON` can accommodate a secondary public key without restarting or downtime.
3. **Database Health:** Monitor connection pool limits and PostgREST latency.
