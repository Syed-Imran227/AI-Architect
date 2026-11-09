# AI Architectural Copilot: Audit Report

**Date:** October 24, 2026  
**Workspace:** `AI-Architect` (Local Environment)  
**Database Provider:** MongoDB (`DATABASE_PROVIDER=mongodb`)  
**Auth Provider:** JWT (`AUTH_PROVIDER=jwt`)  
**Target Milestone:** Milestone 3 — Intelligent Architectural Copilot  

---

## 1. Executive Summary

This audit assesses the existing conversational AI and architectural editing capabilities across frontend UI components, backend routes, model providers, command schemas, geometric validation, project context propagation, and authorization controls.

The application possesses a functioning foundational architecture:
1. A frontend panel component (`CopilotAgentPanel.tsx`) mounted inside the `ArchitecturalInspectorDrawer.tsx` under the `COPILOT` tab.
2. A dedicated FastAPI router (`backend/routers/agent_routes.py`) providing `/api/agent/chat` and `/api/agent/history`.
3. A multi-model fallback chain (`backend/engines/inference.py`) supporting Google Gemini (`gemini-3.1-pro-preview`, `gemini-3.8-flash`, `gemini-3.5-flash-lite`), Hugging Face DeepSeek, and Groq Qwen, backed by a deterministic regex parser fallback (`_rule_based_fallback`).
4. A deterministic geometric layout modifier (`backend/services/layout_modifier.py`) executing 2D collision and boundary checks in Python.
5. An authoritative client-side geometry command engine (`CommandEngine` in `frontend/src/modules/editor/geometry/commandEngine.ts`) managing the `CanonicalBuildingDocument` with reversible undo/redo snapshots.

However, several critical architectural gaps and safety risks exist:
- **Instant Auto-Apply without User Confirmation:** The Copilot frontend panel immediately commits agent responses to the active layout without an intermediate **Preview / Confirm / Reject** workflow.
- **Bypassing the Canonical CommandEngine:** The Copilot update handler (`handleAgentLayoutUpdate` in `Editor.tsx`) mutates legacy React state `floors` via `handleLayoutUpdate`, bypassing `executeGeometryCommand`. Consequently, AI-assisted modifications are not tracked in `CommandEngine`, breaking `Ctrl+Z` undo/redo consistency.
- **Ambiguous Request Handling:** When user instructions are ambiguous (e.g. "make it bigger", "change room"), the fallback parser returns a canned general-advice string rather than signaling ambiguity and requesting specific parameters.
- **Destructive Operation Safety:** Actions like `remove_room` execute immediately without a specialized destructive confirmation dialog or safety check.
- **Project Ownership Verification:** While `agent_routes.py` verifies conversation ownership, explicit ownership of `project_id` on the `/api/agent/chat` endpoint is not validated when a conversation does not yet exist or when `conversation_id` is supplied independently.

---

## 2. Audit of Existing Components & Routes

### A. Frontend Architecture
- **Mount Point:** `frontend/src/modules/editor/components/ArchitecturalInspectorDrawer.tsx` (Lines 532–545).
  - Rendered when `activeTab === 'copilot'`.
  - Passes `currentLayout`, `activeFloorLevel`, `activeFloorName`, `selectedRoomName`, `plotContext`, and `onApplyLayout`.
- **Copilot Panel:** `frontend/src/modules/editor/components/CopilotAgentPanel.tsx`.
  - Contains chat history thread, quick suggestion buttons, Level/Selected Room/Plot context pills, warning banners, and text input area.
  - Calls `sendAgentChat` and `getAgentHistory` from `frontend/src/shared/api-client/api.ts`.
  - On receiving `response.updated_layout`, immediately calls `onApplyLayout(response.updated_layout, response.imageUrl, response.compliance)`.
- **Editor Integration:** `frontend/src/modules/editor/pages/Editor.tsx`.
  - Defines `handleAgentLayoutUpdate(updatedLayout, imageUrl, compliance)` (Lines 933–970).
  - Calls `handleLayoutUpdate(...)` which sets legacy `floors` state and pushes into legacy `history` array.
  - **Defect:** Does not create a command or update `commandEngineRef.current`. Canonical document and CommandEngine are bypassed.

### B. Backend Architecture
- **Router:** `backend/routers/agent_routes.py`.
  - `POST /api/agent/chat`: Authenticated via `get_current_user` and `get_raw_bearer_token`.
  - Resolves or creates conversation session.
  - Invokes `process_agent_request` in `services/agent_service.py`.
  - Records chat turns in database repository (`add_conversation_message`).
  - Returns `conversation_id`, `reply`, `operation`, `success`, `updated_layout`, `imageUrl`, `warnings`, `compliance`.
  - `GET /api/agent/history`: Returns stored message history for authorized conversations.
- **Service Layer:** `backend/services/agent_service.py`.
  - Schema: `ArchitecturalOperation` with actions: `resize_room`, `move_room`, `add_room`, `remove_room`, `place_furniture`, `remove_furniture`, `swap_rooms`, `change_room_type`, `general_advice`.
  - Prompt: `AGENT_SYSTEM_PROMPT` enforces tool-calling JSON schema.
  - Fallback parser: `_rule_based_fallback` uses regular expressions to parse instructions when LLMs are unconfigured or fail.
  - Engine invocation: `apply_architectural_operation` in `services/layout_modifier.py`.
  - Secondary calculations: Computes Vastu, NBC, Energy, Sunlight, and BOM metrics after layout changes and renders thumbnail PNG.
- **Geometry Engine:** `backend/services/layout_modifier.py`.
  - `check_overlap(r1, r2, epsilon=0.05)`: Tests 2D AABB polygon collision.
  - `check_in_bounds(room, plot_w, plot_h, epsilon=0.1)`: Tests plot boundary limits.
  - Implements room resizing, moving, swapping, renaming, partitioning, deletion, and furniture placement.
- **Model Providers:** `backend/engines/inference.py`.
  - `FALLBACK_MODELS` configured with:
    1. Google GenAI SDK: `gemini-3.1-pro-preview`, `gemini-3.8-flash`, `gemini-3.5-flash-lite`.
    2. OpenAI-compatible Hugging Face: `deepseek-ai/DeepSeek-V3-0324`.
    3. OpenAI-compatible Groq: `qwen/qwen3.8-27b`.
  - Deterministic fallback allows full offline operation without paid API keys.

---

## 3. Verified Behavior vs. Identified Gaps

| Capability | Current State | Identified Gap | Required Improvement |
|---|---|---|---|
| **Natural-Language Understanding** | Supported via Gemini/HF/Groq with regex fallback. | Ambiguous instructions default to generic layout commentary. | Explicitly detect ambiguous/unsupported requests (`ambiguous_request`), explain what is missing, and request clarification without changing geometry. |
| **Preview & Confirmation** | Auto-applies immediately on API response. | No user confirmation; no preview before committing changes. | Introduce Pending Proposal lifecycle with explicit **Preview**, **Apply**, and **Reject** controls. |
| **Undo / Redo Consistency** | Legacy state array updated; `CommandEngine` bypassed. | `Ctrl+Z` in editor does not revert AI modifications. | Route all applied AI proposals through `CommandEngine` using `createApplyGeneratedPlanCommand`. Provide a 1-click Undo button in the Copilot panel. |
| **Destructive Operation Safety** | `remove_room` removes room immediately. | No warning or confirmation step before deleting a room and its items. | Require explicit confirmation dialog before executing destructive room removal. |
| **Change Visualization** | Text description only. | No structured diff showing dimensions/positions before vs. after. | Add `change_summary` to API response and render structured diff badges (Before vs After) in the proposal card. |
| **Multi-Floor Awareness** | `target_floor_level` passed in request. | Instruction regex parser occasionally ignores explicit floor mentions (e.g. "on Floor 1"). | Enhance parser to extract floor level from instructions and update active floor targeting. |
| **Project Authorization** | Verifies conversation user ID. | Does not verify ownership of `project_id` when supplied directly on `/chat` or `/history`. | Add direct `get_project_by_id(project_id, user_id)` verification in `agent_routes.py`. |
| **Door / Window Clamping** | Resizing adjusts room boundaries. | Openings may fall outside wall if dimensions shrink drastically. | Clamp existing room openings to new wall boundaries inside `layout_modifier.py`. |

---

## 4. Exact Files Requiring Changes

1. **`backend/routers/agent_routes.py`**
   - Enforce explicit project ownership on `project_id` for both `/chat` and `/history`.
   - Ensure sanitized error responses and prevent state leaks.
2. **`backend/services/agent_service.py`**
   - Add `ambiguous_request` action to `ArchitecturalOperation`.
   - Add structured `change_summary` generation to response payload.
   - Enhance `_rule_based_fallback` for multi-floor references, ambiguity detection, and destructive actions.
3. **`backend/services/layout_modifier.py`**
   - Add opening and furniture clamping when resizing or moving rooms.
   - Return structured change metadata (`before`, `after`, `delta`).
   - Prevent out-of-bounds geometry and provide clear constraint violation messages.
4. **`frontend/src/modules/editor/components/CopilotAgentPanel.tsx`**
   - Implement Pending Proposal lifecycle with Preview, Apply, Reject, and 1-click Undo.
   - Add structured change summary card with Before/After tags.
   - Add destructive confirmation step for room deletions.
   - Refine Studio Desk visual design and accessibility.
5. **`frontend/src/modules/editor/pages/Editor.tsx`**
   - Wire `handleAgentProposalApply` to `executeGeometryCommand` with `createApplyGeneratedPlanCommand`.
   - Wire live preview via `handlePreviewPlan` and `handleCancelPreview`.
   - Pass undo status and callback to `ArchitecturalInspectorDrawer`.
6. **`frontend/src/modules/editor/components/ArchitecturalInspectorDrawer.tsx`**
   - Pass preview, apply, and undo handlers into `CopilotAgentPanel`.
7. **`backend/tests/test_agent_copilot_suite.py`** (New File)
   - Focused unit and integration tests covering operations, authorization, ambiguity, validation, multi-floor targeting, and error handling.
8. **`frontend/src/modules/editor/geometry/test_copilot_pipeline_suite.ts`** (New File)
   - Focused TypeScript acceptance tests for Copilot command dispatch, preview/apply lifecycle, undo/redo, and canonical state invariance.
