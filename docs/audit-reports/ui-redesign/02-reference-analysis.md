# Stage 2: Reference Analysis — Observed vs Recommended

**Document**: `docs/ui-redesign/02-reference-analysis.md`  
**Author**: Creative Director & Staff Frontend Engineer  
**Methodology Note & Limitation**:  
Reference sites were analyzed via textual and semantic structure descriptions. External live browser URLs were not directly specified as active domain targets; rendered live WebGL shaders, proprietary fonts, canvas interactions, and device-calibrated scroll choreography were NOT directly observed in an external browser session. As required by the specification, this limitation is explicitly noted, and no unverified details are invented.

---

## 1. Reference A: Editorial Studio Site

### Observed Characteristics
1. **Header & Status**: Single-line status ("Booking from January 2027"), minimal text-led navigation, and a single prominent action ("Start a project →").
2. **Hero Presentation**: Built around one declarative sentence plus one short supporting paragraph, with exactly two actions: one primary, one secondary text link with an arrow affordance.
3. **Continuous Strip**: A quiet looping strip of project/work imagery beneath the hero.
4. **Curated Work & View Modes**: "Selected work" section with an eyebrow label, categorical filter chips, and an explicit **List / Grid** view toggle. Entries feature year, project name, one-line editorial headline, and discipline tags.
5. **Featured Case Surface**: A single prominent case study highlighting three concrete metrics beside an action link.
6. **Numeric Counters**: Numeric counters that count up smoothly from zero on view with small explanatory captions.
7. **Expandable Rows**: Expandable service/feature rows (+ affordance) displaying price, duration, and deliverables accompanied by 4:3 image framing.
8. **Numbered Process Flow**: Stepwise sequence ("01 / 05") with dedicated imagery per step.
9. **Before/After Affordance**: Drag comparison ("Draft 03" vs "Final", with a ↔ comparison slider).
10. **Voice & Copy**: Understated, specific, concrete numbers, sentence-case headlines, completely devoid of generic SaaS superlatives.

### Recommended for AI Architect Dashboard
1. **Studio Header**: Clean, text-led top bar (`Studio`, `Archive`, `Create`, `Financial Studio`) with a persistent "New design" primary button and real user status.
2. **The Studio Opening (Stage Zone)**: Declarative, architectural headline ("Design a house. Then walk through it.") paired with a visible, multi-line brief input and immediate generation action.
3. **Continue Strip**: A quiet, single-row strip of recently modified designs (max 3) allowing returning architects to resume editing in 1 click without navigating through the full archive.
4. **Curated Portfolio with List/Grid Toggle**:
   - Explicit List / Grid toggle persisted in `localStorage`.
   - Grid mode: 8-column featured card followed by 12-column rhythm with deterministic ratios (3:2, 4:3, 4:5 based on plot aspect ratio/floors).
   - List mode: Dense tabular ledger with real dimensions, area, cost, budget state, and hover thumbnail preview.
5. **Numbered Generation Flow**: Five-stage architectural progression: `01 Brief · 02 Plot · 03 Rooms · 04 Floors · 05 Generate`.
6. **Financial Intelligence**: Ledger presentation with real BOM figures, a stacked category bar, and single-pass counter animation (≤ 800ms) on first mount.

---

## 2. Reference B: Cinematic AI-Site Library

### Observed Characteristics
1. **Atmospheric Dark Canvas**: Near-black foundational tone (`#060606` to `#0B0C0D`).
2. **Image-Led Hierarchy**: Large visuals with category tag, name, and item counts organized cleanly.
3. **Restrained Effect Vocabulary**: Depth through subtle lighting falloff and grain textures rather than aggressive multi-colored neon gradients or stacked glassmorphism.
4. **Deferred Heaviness**: Media displayed with poster/blueprint images first; heavy 3D canvases, video, or WebGL contexts deferred until explicit user intent.
5. **Per-Device Layout Discipline**: Responsive structures tailored for mobile (360px), tablet (768px), and wide desktop (1440px+).

### Recommended for AI Architect Dashboard
1. **Two-Zone Atmosphere ("The Studio Desk")**:
   - **Stage Zone (Dark, Cinematic)**: For the hero opening and 3D preview moments (`#0B0C0D` background, `#15171A` surface, hairline borders).
   - **Paper Zone (Warm, Tactile)**: For the archive, creation console, and financial ledger (`#F4F1EA` paper background, `#FAF8F2` card surface, `#252622` primary ink).
2. **Zero Initial 3D Bundle Overhead**:
   - Neither Three.js nor `@react-three/fiber` will be initialized on initial dashboard page paint.
   - Vector SVG blueprints or static plan posters render instantly with zero layout shift.
   - 3D viewports are activated strictly on explicit user click ("Explore in 3D") or intent.
3. **Single WebGL Context Invariant**:
   - When the 3D preview is active, exactly one WebGL context is created.
   - Geometries, materials, textures, and renderer are explicitly disposed upon modal/panel close.
4. **Truthful Geometry**:
   - All visual posters and previews are generated directly from the project's real room coordinates and wall boundaries. No stock photography or fabricated renderings.

---

## 3. Principles to Extract & Apply

| Principle | Application in AI Architect |
|---|---|
| **1. Typography carries hierarchy** | Newsreader serif for headlines/titles, Plus Jakarta Sans for UI, JetBrains Mono with tabular figures for dimensions and monetary figures. Minimal box boundaries. |
| **2. Image-led composition** | The project's actual architectural plan or 3D form is the hero of every card and section. |
| **3. Quiet chrome** | Navigation and controls recede into 1px hairlines; one primary accent color (Oxide Orange `#C8501E` or Drafting Blue `#2F5BEA`). |
| **4. Specific, truthful copy** | Real numbers derived from the canonical document and BOM engine. No fake testimonials or vanity metrics. |
| **5. Depth through restraint** | Subtle paper texture, crisp architectural hairlines, and restrained dark stage falloff. |
| **6. Deferred heaviness** | Fast SVG vector previews on initial load; Three.js loaded strictly via `React.lazy` on intent. |
| **7. Explicit view modes** | Grid and List modes with fluid transitions and `localStorage` persistence. |
| **8. Process as sequence** | Generation structured as a clear architectural sequence (`01 Brief` to `05 Generate`). |
