# Figures Directory & Visual Artifacts Catalog

This directory houses the authoritative visual documentation, benchmarks, architecture schematics, and live browser verification evidence for **AI Architect (V2 Atelier)**.

> [!IMPORTANT]
> The filenames `architecture.jpg`, `flowchart.jpg`, `ui_editor.png`, and `vastu_analysis.png` are referenced directly by `ieee_paper.tex`. **Do not rename or delete these 4 files.**

---

## 1. IEEE Research Paper Figures

| Filename | Resolution | Description & Context |
| :--- | :--- | :--- |
| `architecture.jpg` | 1200×896 | System architecture diagram depicting the Presentation Layer (React 19 SVG Canvas), API/Processing Layer (Chain-of-Thought Prompt Constructor + Multi-LLM priority chain), Infrastructure/Integration Layer (JSON topology output), and Core Drafter/Output Layer (`architectural_layout.py`, Vastu engine, BOM engine, DXF exporter). |
| `flowchart.jpg` | 1200×896 | Deterministic fallback chain flow diagram: Gemini 3.1 Pro Preview $\rightarrow$ DeepSeek-V3-0324 (671B) $\rightarrow$ Gemini 3.8 Flash $\rightarrow$ Gemini 3.7 Flash $\rightarrow$ Qwen 3.8-27B $\rightarrow$ Valid JSON Topology or API Error. |
| `ui_editor.png` | 1919×911 | Authoritative 2D Blueprint Editor interface showing the CAD canvas, room partition graph, boundary dimensions, zoning overlay, and inspector panel. |
| `vastu_analysis.png` | 1919×909 | Vastu Shastra compliance heatmap and directional analysis grid (Mandala quadrant overlay, solar harmony score, and rule verification). |

---

## 2. Algorithmic Benchmarks & Performance Metrics

| Filename | Resolution | Description & Context |
| :--- | :--- | :--- |
| `algorithm_accuracy.jpeg` | 3000×1800 (300 DPI) | Grouped bar chart comparing Floor Plan Viability rates across **Zero Overlaps** (15% vs 85% vs 100%), **Valid Door Adjacency** (20% vs 75% vs 100%), **Vastu Adherence** (60% vs 40% vs 95%), and **NBC Compliance** (40% vs 60% vs 100%) for Pure LLM Coordinates, Genetic Algorithm (GA), and Hybrid AI + CSP Drafter (AI Architect). |
| `algorithm_latency.jpeg` | 3000×1650 (300 DPI) | Log-scale horizontal bar chart showing computational time-to-draft: Genetic Algorithm Optimization (180.0s), Pure LLM Regressive Prompts (45.0s), and Hybrid AI + BSP Drafter (2.5s). |

---

## 3. Live Architectural Interface & 3D ArchViz Figures

| Figure | Filename | Workspace / Feature | Key Architectural Capabilities Illustrated |
| :---: | :--- | :--- | :--- |
| **01** | `fig_01_atelier_landing_hero.png` | Landing Page Hero | *Every place begins with a line* — Interactive 5-tab atelier sketch sequence (Concept, Logic, Stack, Section, Craft) with live parametric SVG redraw. |
| **02** | `fig_02_studio_enrollment_auth.png` | Authentication Suite | Studio Enrollment modal (*Join the Atelier*), integrated with Supabase PostgreSQL Auth / JWT session management. |
| **03** | `fig_03_landing_concept_massing.png` | Volumetric Concept | Preliminary massing study illustrating cantilevered upper study, vertical service core datum lines, and site footprint. |
| **04** | `fig_04_studio_dashboard_archive.png` | Architect Desk Archive | Studio dashboard displaying plan archive counters (0 plans, 0 rooms, 0 Vastu compliant), Multi-Floor Wizard trigger, and New Drawing action. |
| **05** | `fig_05_multifloor_wizard_step1_massing.png` | Multi-Floor Wizard (Step 1) | **Global Plot & Massing**: 30×40 ft footprint, 4 stacked levels, duplex open-to-below void toggle, 2.5D live axonometric elevation diagram, and FAR estimation. |
| **06** | `fig_06_multifloor_wizard_step2_programs.png` | Multi-Floor Wizard (Step 2) | **Floor Programs & Cores**: Per-floor room toggles (Living, Dining, Kitchen, Pooja, Guest Bed + Bath, Lawn, Parking) and Vertical Core Lock (internal spine vs external shaft). |
| **07** | `fig_07_multifloor_wizard_step3_dossier.png` | Multi-Floor Wizard (Step 3) | **Executive Blueprint Dossier**: Pre-generation constraint audit verifying NBC-2016 setbacks, staircase shaft alignment, 3,456 sq.ft built-up area, and FAR 2.88. |
| **08** | `fig_08_2d_drafting_cad_workspace.png` | 2D Blueprint Editor | Multi-floor candidate preview (Linear Core & Balanced Wings), Level 01 Ground Floor active, selected staircase HUD, door opening schedule, and solar arc overlay. |
| **09** | `fig_09_3d_dollhouse_night_luminaires.png` | 3D Dollhouse (Night ArchViz) | Full 4-level stacked dollhouse at night featuring 2700K incandescent interior room point lights, dark slate cutaway caps (`#1e293b`), swimming pool, and site boundary. |
| **10** | `fig_10_3d_dollhouse_daylight_am_sun.png` | 3D Dollhouse (Morning Sun) | Dynamic morning sun simulation (azimuth/elevation shadow casting), exterior landscaping (palm trees, perimeter boundary wall), and rooftop pergola. |
| **11** | `fig_11_3d_xray_vertical_core_shaft.png` | 3D X-Ray Inspection | Translucent wireframe walls (10% cyan opacity) highlighting the continuous vertical circulation core shaft spanning Ground to Rooftop. |
| **12** | `fig_12_3d_section_vertical_cutaway.png` | 3D Section Plane | Dynamic front architectural section cut with adjustable depth slider, exposing multi-floor vertical room relationships and ceiling heights. |
| **13** | `fig_13_3d_dollhouse_noon_perspective.png` | 3D Perspective (Noon Sun) | Overhead perspective at solar noon demonstrating daylight penetration, open-to-below duplex volume, and rooftop terrace deck. |
| **14** | `fig_14_3d_orthographic_topdown_plan.png` | 3D Orthographic Top-Down | True plan projection mode with CAD floating labels, showing precise room centroids and staircase flight orientation. |
| **15** | `fig_15_3d_dollhouse_materials_furniture.png` | 3D Dollhouse (Clean Materials) | Labels toggled off revealing procedural oak plank floor textures, ceramic kitchen tiles, furniture layout, and staircase riser/tread geometry. |
| **16** | `fig_16_3d_isolated_ground_floor.png` | Single Floor Isolation (L0) | Single-floor isolation mode isolating Level 0 Ground Floor with active site lawn, parking, and perimeter landscaping while upper floors are hidden. |
| **17** | `fig_17_3d_isolated_rooftop_terrace.png` | Single Floor Isolation (L3) | Single-floor isolation mode isolating Level 3 Rooftop Terrace with timber pergola, outdoor seating, and utility zone. |
| **18** | `fig_18_3d_night_staircase_void.png` | 3D Night Stacking View | Top-angle night perspective peering down through the illuminated multi-story vertical stairwell and duplex void. |
