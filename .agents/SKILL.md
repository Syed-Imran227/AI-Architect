---
name: e2e-project-audit
description: Use when asked for a full end-to-end health check of AI Architect — "audit everything", "make sure the whole project works", "check from A to Z", "verify nothing is broken". Traces every route, every frontend screen, and every place they touch, confirms the app actually does what it's supposed to, and reports pass/fail per area rather than a vague summary.
---

# End-to-End Project Audit — AI Architect

## Role

Act as both the developer and the architect on this project at once:

- **As developer:** you own correctness, error handling, and the contract between frontend and backend. Nothing gets marked "working" because it looks fine — it's working because you traced the request, read the response, and confirmed it matches what the other side expects.
- **As architect:** you own whether the *domain logic* is actually right — does a generated floor plan make architectural sense (no overlaps, bathrooms adjacent to their bedrooms, doors that open into free space, CAD exports that match what the customer saw on screen).

Do not summarize or skim. Open the files. Trace the calls. If you assert something works, say how you checked.

## Scope — go through all of this, in order

### 1. Backend routes (`backend/main.py` and anything it imports)

For **every** route:
- What auth does it require, and is `Depends(get_current_user)` (or equivalent) actually applied — not just present elsewhere in the file?
- What's the expected request schema (`models.py`)? Does the route validate against it, or trust raw input?
- What's the response shape? Does it match what the frontend's `services/` layer expects to receive?
- What happens on error — does it return a sanitized message, or leak internals (stack traces, prompt text, DB details) to the client?
- Is there any remaining place where the LLM's raw output reaches a Mongo write, a file path, or a shell/subprocess call without validation first?

### 2. Core domain pipeline

Trace one full request through the system, start to finish, for `/generate`:
- `inference.py` → does the Architect (LLM) still only emit topology, never coordinates?
- `architectural_layout.py` (the Drafter) → does it actually produce zero-overlap, boundary-safe, bathroom-adjacent geometry for a range of inputs (small plot, large plot, high bedroom count, Vastu on/off)?
- `layout_validator.py` → confirm it's acting as a safety net, not silently mutating already-correct geometry from the Drafter.
- `vastu_engine.py` and the `/vastu-fix` route → confirm fixes go through the topology, not raw coordinate edits.
- `/regenerate-room` → confirm room-resize requests go through topology weights, not hand-edited coordinates.
- `floor_renderer.py` → does the rendered PNG actually match the coordinates that were computed, including after a Vastu fix or a room regenerate?
- `dxf_exporter.py` → do exported door arcs match the direction/position shown in the frontend's `InteractiveBlueprint.tsx`, for more than one generated layout, not just the first one you try?

If any of the above hasn't actually been implemented yet (e.g. still mid-refactor), say exactly which piece is missing rather than reporting the pipeline as broken or working as a whole.

### 3. Frontend (`frontend/src/`)

- `pages/` — Landing, Dashboard, Canvas Studio: does every action a user can take actually call the right backend route with the right payload? Any dead buttons, broken links, or routes that 404?
- `components/` — especially the floorplan canvas / `InteractiveBlueprint.tsx`: does drag-and-drop, room selection, and the Vastu/regenerate flow correctly reflect what the backend returns, including error and loading states?
- `context/` — Auth and Theme: does the JWT actually get attached to every authenticated request? What happens on token expiry — silent failure, or a redirect to login?
- `services/` — do the Axios wrappers' expected response types match what the backend routes above actually return today (not what they returned before the last refactor)?

### 4. Data layer

- `database.py` / `auth.py`: confirm MongoDB connection handling — is `MONGO_URI` required (fails loud if missing), and is `JWT_SECRET` required with no fallback?
- Any place a user-supplied string reaches a Mongo query, a file path, or gets written to disk unsanitized?

### 5. Config, environment, and housekeeping

- Is `backend/.env` actually gitignored?
- Do `requirements.txt` and `frontend/package.json` have any known-vulnerable or wildly outdated dependencies worth flagging?
- Is there an existing test suite? Run it. If there isn't one, say so explicitly rather than treating "no tests failing" as "no tests exist."
- Does `memory/CLAUDE.md` (build commands, style guide) still match how the project actually builds and runs today?

## Output format

Report findings grouped by the five scope areas above. For each area, give:

1. **Pass / Fail / Partial** — a clear verdict, not just a list of observations.
2. For anything not a clean pass: the specific file/route/component, what's wrong, and the fix.
3. For anything you couldn't verify (no test suite, no way to run it in this environment, etc.), say so explicitly instead of guessing it's fine.

Close with a **single prioritized list** of everything that needs fixing before this could be called "done," ordered by how badly it would embarrass you if a customer or investor hit it first.

## Constraints

- Don't re-implement fixes as part of this audit unless asked — this is a verification pass. Flag issues; don't silently patch them.
- Don't mark something "working" based on reading the code alone if you can actually run it (start the backend, hit the route, inspect the response) — prefer runtime verification over static reading wherever the environment allows it.
- Be specific about severity — a typo in a label and an unauthenticated route that triggers billable LLM calls are not the same tier of "issue."
