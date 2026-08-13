# Future Enhancements & Ideas

This document outlines the strategic roadmap for the AI Architect platform.

---

## 🐛 Known Issues & Bugs (Priority Fixes)

### 1. The "Stale Concept Sketch / Stale PDF" Bug (Critical Feature Issue)
- **The Problem:** When the user clicks "Auto-Fix Vastu" or prompts the AI to resize a room, the backend modifies the rooms array and sends back the new JSON geometry. However, it never calls `render_floor_plan()` to re-generate the Base64 PNG. Because of this, the `imageUrl` in the application state goes completely out of sync with the true physical layout.
- **The Impact:**
  - **The UI Breaks:** The interactive 2D blueprint and 3D view update perfectly (they read JSON), but the large "Concept Sketch" image card at the bottom of the Editor page remains frozen on the original generated layout.
  - **The PDF Export Breaks:** The `pdf_report.py` script relies directly on the Base64 `imageUrl` embedded in the layout payload. If you auto-fix the Vastu and then export a PDF, the document will professionally print out the old, un-fixed floor plan image alongside the new correct scores.
  - **Database Saves Break:** Clicking "Save to My Plans" writes the stale `activePlan.imageUrl` into MongoDB, so the dashboard gallery will also show the incorrect preview.
- **The Fix:** `/vastu/fix` and `/regenerate-room` in `engine_routes.py` must invoke `render_floor_plan()`, encode the new image, and return it. The frontend `handleLayoutUpdate` must then merge this new `imageUrl` into the `activePlan` state.

### 2. Missing Payload Propagation for `imageUrl` in Room Editor
- **The Problem:** Even if we fix the backend to return a new image, the frontend's `handleLayoutUpdate()` function in `Editor.tsx` currently only accepts an array of `Room[]`. It hardcodes the state update to just touch rooms and ignores any other root-level properties (like `imageUrl`).
- **The Fix:** `handleLayoutUpdate` needs to be refactored to accept an optional `newImageUrl` string alongside the updated rooms, and patch that into `activePlan.imageUrl` and `floors[activeFloorIndex].imageUrl`.

### 3. Redundant State Data Risk
- **The Problem:** The `/generate` endpoint takes `plotSize`, `length`, and `width` in its request body. `plotSize` is calculated on the frontend. If those fall out of sync, the backend's Cost/BOM engine will use incorrect math because it relies on the pre-calculated `plotSize` instead of deriving it from `length * width`.
- **The Fix:** Drop `plotSize` from the `GenerateRequest` model and let the backend compute it dynamically where needed (`sqft = length * width`).

**1. File Path & Line Number(s):** `frontend/src/pages/Editor.tsx` (Global) & `frontend/src/context/ThemeContext.tsx`
- **Issue Title & Summary:** Missing Theme Toggle UI (Context Mismatch)
- **Exact Root Cause:** The `ThemeContext` provides a `toggleTheme` function and `index.css` has full support for both dark and light modes. However, the UI in `Editor.tsx` completely lacks a toggle button to trigger this state change.
- **User Impact:** Users are trapped in the default dark mode. This directly contradicts the pinned conversation's explicit requirement that "it should have both dark and white mode" and prevents the user from viewing the light mode aesthetic.

**3. File Path & Line Number(s):** `backend/routers/engine_routes.py` (Lines 43-56)
- **Issue Title & Summary:** Unhandled HuggingFace API Exceptions
- **Exact Root Cause:** `ai_generator.generate_floorplan_json()` executes synchronous network calls to the Hugging Face Inference API. There is no `try/except` block wrapping this network call.
- **User Impact:** If the HuggingFace API rate-limits, times out, or experiences downtime, the backend raises an unhandled HTTP/Connection error, resulting in a raw 500 Server Error and a frozen loading state on the frontend.

**5. File Path & Line Number(s):** `backend/routers/engine_routes.py` (Lines 302-311)
- **Issue Title & Summary:** Stubbed Room Regeneration Fallback
- **Exact Root Cause:** If the LLM fails to converge during a `regenerate_room` call, the system falls back to a hardcoded logic block that naively multiplies the room's width and height by 1.2 or 0.8 depending on keywords like "larger" or "smaller".
- **User Impact:** If the LLM fails, users attempting complex topological edits (e.g., "Change the shape to fit a walk-in closet") will silently receive a slightly scaled rectangular room that doesn't respect their prompt, leading to confusion and poor UX.

**7. File Path & Line Number(s):** `frontend/src/pages/Editor.tsx` (Lines 104-112)
- **Issue Title & Summary:** Suppressed Exhaustive-Deps Linter Warning
- **Exact Root Cause:** The `useEffect` that loads saved projects uses `// eslint-disable-next-line react-hooks/exhaustive-deps` to ignore the missing `loadSavedProject` dependency (which isn't memoized with `useCallback`). 
- **User Impact:** While currently stable, any future architectural changes that trigger a re-evaluation of `loadSavedProject` will cause an infinite re-render loop or stale closures when switching projects.

**8. File Path & Line Number(s):** `backend/db/repositories.py` (Lines 26-29 & 51-56)
- **Issue Title & Summary:** Swallowed Exceptions in DB Repositories
- **Exact Root Cause:** The `get_user_by_id` and `get_project_by_id` functions wrap their queries in a broad `try/except Exception:` block and silently return `None`.
- **User Impact:** While this successfully catches `InvalidId` errors from `ObjectId(id)`, it silently masks genuine database connection failures or timeouts, returning `404 Not Found` to the user instead of an appropriate `500` error.
