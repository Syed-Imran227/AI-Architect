# AI Architect V2 (Atelier): Project Overview

## What is AI Architect?
AI Architect (V2 Atelier) is an advanced, production-grade generative platform that transforms natural language and parametric architectural requirements into mathematically precise, regulation-compliant, and buildable multi-floor architectural blueprints.

It combines a multi-model LLM inference fallback chain for spatial topology planning with a deterministic Python geometric drafter and canonical building document model, guaranteeing zero room overlaps, perfect wall alignment, and complete structural integrity across up to 4 stacked floors.

---

## Core Invariants & Product Principles

1. **One Canonical Building Document**:
   All plot boundaries, levels, wall graphs, openings, rooms, stairs, furniture items, and finishes are unified in `CanonicalBuildingDocument`. 2D blueprints, 3D WebGL scenes, CPWD financial schedules, and AutoCAD DXF files are projections of this single source of truth.
2. **All Edits Are Commands**:
   Every mutation passes through `CommandEngine.execute()`: `Candidate Document -> Validators -> Commit or Reject with HUD toast -> Inverse Patch for Undo/Redo`. No floating UI handle or script mutates state directly.
3. **Architect-Drafter Hybrid Division**:
   - **The AI Architect (LLM Chain):** Google Gemini 3.1 Pro / DeepSeek-V3-0324 / Gemini 3.8 Flash decides topological room programs, functional bay allocations, and spatial adjacencies. It does **not** generate raw coordinates.
   - **The Deterministic Drafter (`architectural_layout.py` & `intelligent_generator.py`):** A strictly mathematical Python engine partitions the plot canvas into exact parametric rectangles, enforces NBC setbacks, aligns vertical shafts, and generates buildable coordinates.
4. **Dimensional Accuracy**:
   All internal dimensions are stored in decimal feet ($1\text{ ft} = 0.3048\text{ m}$). Conversions occur strictly at the UI display or export boundary.

---

## Key Subsystems & Features

### 1. Multi-Floor Generation & Vertical Pinning
- Supports up to 4 floors: **Level 0 (Ground Floor)**, **Level 1 (First Floor / Duplex Upper)**, **Level 2 (Floor 2)**, and **Level 3 (Rooftop Terrace)**.
- **Vertical Core Locking**: Automatically locks the staircase and MEP shaft footprint across all floors ($X, Y$ alignment guaranteed).
- **Duplex Open-to-Below Voids**: First Floor dynamically accommodates double-height spatial voids over the Living Room.

### 2. Multi-Candidate Synthesis (`intelligent_generator.py`)
- Automatically synthesizes 3 distinct architectural typologies:
  1. **Central Core**: Public living and dining encircle a central foyer and spine staircase.
  2. **Lateral Spine**: Linear service corridor with rooms branching symmetrically north and south.
  3. **Garden Buffer**: Courtyard-centric layout optimizing cross-ventilation, green buffers, and solar penetration.
- Objective ranking based on Vastu harmony, circulation efficiency, daylight index, and structural coverage.

### 3. Cinematic 3D ArchViz & Solar Simulation (`FloorPlan3D.tsx`)
- WebGL rendering via Three.js / React Three Fiber:
  - **Dollhouse Cutaway**: 4.5 ft and 10 ft sliced views with dark slate wall caps.
  - **Stacked vs Isolated vs Exploded**: Inspect individual floor plates or the full 4-story stack.
  - **Solar Daylighting**: Dynamic AM, Noon, Golden Hour, and Night timeline with realistic shadow casting based on plot azimuth.
  - **Night Mode Luminaires**: 2700K warm incandescent point lights placed in room centroids.
  - **X-Ray Mode**: Cyan translucent walls (10% opacity) displaying vertical stair and duct shafts.
  - **Architectural Section Plane**: Dynamic front/side section cuts with adjustable depth slider.
  - **Procedural Landscaping**: Swimming pools, perimeter boundary walls, timber pergolas, and palm trees.

### 4. 2D CAD Blueprint Workspace (`InteractiveBlueprint.tsx`)
- 60FPS vector SVG canvas with warm architectural paper styling (`#FAF8F5`).
- **8-Handle CAD Resizing**: 8 directional handles (`nw`, `ne`, `se`, `sw`, `n`, `s`, `e`, `w`) with stationary anchor vector math.
- **Partition Sync Toggle**: Switch between stretching shared walls or independent pavilion resizing.
- **Live Dimension HUD**: Floating badges showing real-time imperial and metric dimensions.
- **Circulation & Solar Overlays**: Visualized BFS egress paths and sun azimuth arc.

### 5. Regulatory & Cultural Compliance
- **Vastu Shastra Engine (`vastu_engine.py`)**: 10-rule geometric scoring engine using a 3×3 compass mandala grid and centroid mathematics. Exempts transitional spaces (corridors, stairs) to achieve valid 70+/100 baseline scores.
- **NBC 2016 Compliance (`nbc_engine.py`)**: Validates front/rear/side setbacks, Floor Area Ratio (FAR), minimum room dimensions, and window ventilation percentages.

### 6. Financial Studio & CPWD BOM Engine (`bom_engine.py`)
- Official Delhi Schedule of Rates (CPWD DSR 2026) cost estimation:
  - Structural RCC concrete frame, masonry brickwork, premium flooring, MEP wiring/plumbing, and labor (30%).
  - Real-time interactive budget strip with Indian Lakh/Crore formatting.

### 7. Conversational Copilot Agent (`agent_service.py`, `CopilotAgentPanel.tsx`)
- Context-aware architectural assistant that interprets natural language instructions (*"Make kitchen 2ft wider"*, *"Swap guest room and pooja"*), generates non-destructive geometry patches via `layout_modifier.py`, and presents visual preview diffs before committing.

### 8. Production Exports
- **AutoCAD DXF**: Multi-floor layered DXF files with millimeter-accurate walls, inward swing door arcs, windows, and labels.
- **Executive PDF Dossier**: 4-page client report containing project brief, floor blueprints, Vastu radar analysis, and CPWD BOM schedules.
- **High-Res Concept Sketch**: Pillow-rendered presentation drawing with title block and north arrow.

### 9. Dual-Database Cloud Persistence
- **Primary:** Supabase PostgreSQL with Row Level Security (RLS) policies isolating user projects.
- **Fallback:** MongoDB Atlas via Motor async driver.
- **Identity Bridge:** Seamless session translation between Supabase Auth JWT and internal JWT.

---

## Academic Context & Research Paper
AI Architect represents a novel contribution in automated architectural CAD synthesis. Its hybrid architecture, mathematical convergence, and regulation verification are formally documented in `ieee_paper.tex` (strictly preserved in IEEE 6-page two-column format).
