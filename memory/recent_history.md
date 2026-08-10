# Recent History & Conversations

## August 2026: Full-Stack Audit & Remediation
- Replaced the LLM geometry generator with a **Deterministic Python Engine** (`architectural_layout.py`) that strictly enforces boundaries and tiling.
- **Security & DB**: Corrected project documentation to reflect the actual MongoDB usage (was mistakenly documented as SQLite). Secured `/generate` and `/export/dxf` endpoints with JWT auth, and removed fallback JWT secrets.
- **UX & Architecture**: Added circulation reachability detection, reporting landlocked rooms to the UI via a warning banner.
- **Geometry Fixes**: Implemented a 3x3 ft door swing exclusion zone so furniture doesn't block doors. Fixed the DXF exporter to correctly map real door arcs instead of hardcoding a bottom-wall arc.

## UI Refinements
- Modified the glassmorphism layout to ensure all cards have the exact same color variables.
- Integrated a Uiverse `namecho` design toggle switch for the UI. Replaced static dark/purple states with `--toggle-off-bg` to correctly represent an "off-white" switch in light mode and "off-dark" switch in dark mode.
- Adjusted the Master Bedroom test data inside `frontend/src/pages/Editor.tsx` to read exactly 14x12 ft as per user request to align the text and sizing.
- Adjusted concept sketch image container styles (`.plan-img`) inside `frontend/src/App.css` to fix layout glitches.

## LinkedIn Profile Prep
- Wrote two highly tailored ~40 word per bullet point LinkedIn project summaries for the user's profile:
  1. **AI Architect**: Describing the generative AI floor plan system.
  2. **EchoAI / Voice Assistant**: Describing a Python (Gemini+Selenium) based voice assistant for blind users to navigate Web and WhatsApp.

## Academic Publication (IEEE Paper)
- Formatted `ieee_paper_formatted.tex` into a strict IEEE two-column, 10pt format.
- Expanded the paper length by 36% (increasing from 678 lines to 924 lines) to comfortably pass a 7-page minimum constraint.
- Seamlessly wove in details about MongoDB Atlas, JWT authentication, UI frame rates (60FPS), ezdxf layers (WALLS, DOORS, LABELS), and a robust Per-Rule Vastu Convergence Table.
- Pushed all modified files (`App.css`, `ieee_paper_formatted.tex`) to GitHub (`Syed-Imran227/AI-Architect`).
