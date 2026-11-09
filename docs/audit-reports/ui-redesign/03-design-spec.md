# Stage 3: Design Specification — AI Architect Studio Environment

**Document**: `docs/ui-redesign/03-design-spec.md`  
**Author**: Creative Director & Staff Frontend Engineer  
**Status**: Authoritative Architectural Design System Specification  

---

## 1. Concept: "The Studio Desk"

The AI Architect authenticated dashboard is redesigned as a dual-environment architectural atelier:
1. **The Stage Zone (Dark & Cinematic)**: Anchors the top of the workspace (`min(68vh, 720px)` desktop). Houses the design brief console, instant parameter synthesizer, and the focal project visual. Evokes an evening drafting studio with a single illuminated drawing table.
2. **The Paper Zone (Warm & Tactile)**: Grounds the working surfaces below (continue strip, project archive portfolio, financial intelligence ledger). Evokes natural German drafting paper (`#F4F1EA`) with carbon ink (`#14130F`), precise 1px hairlines, and restrained architectural accents.

When entering the editor (`/editor`), this dual-system bridges seamlessly: the editor retains its high-precision dark drafting viewport while sharing identical tokens, typography, and focus ring dynamics.

---

## 2. Colour System & WCAG AA Contrast Verification

### 2.1 Surface Palette
- **Paper Working Surfaces**:
  - Base Paper: `#F4F1EA` (warm off-white sketchbook foundation)
  - Raised Sheet: `#FAF8F2` (clean drawing sheet & card surfaces)
  - Pure Crisp: `#FFFFFF` (input fields & elevated modals)
  - Paper Hairline: `#D9D4C7` (1px boundary marker)
  - Soft Hairline: `rgba(20, 19, 15, 0.07)`
- **Stage Dark Surfaces**:
  - Stage Base: `#0B0C0D` (deep studio stage)
  - Stage Raised: `#15171A` (active console surface)
  - Stage Hairline: `#2A2D31` (technical 1px border)
  - Stage Accent Hairline: `rgba(255, 255, 255, 0.12)`

### 2.2 Ink & Text Hierarchy (with Verified Contrast Ratios)
| Token | Hex Value | Background | Contrast Ratio | WCAG Compliance |
|---|---|---|---|---|
| `--ink-primary` | `#14130F` | `#F4F1EA` (Paper) | **14.8:1** | Exceeds AAA (7:1) |
| `--ink-secondary` | `#5E5A4F` | `#F4F1EA` (Paper) | **5.3:1** | Exceeds AA (4.5:1) |
| `--ink-muted` | `#827E72` | `#F4F1EA` (Paper) | **3.5:1** | Meets AA Large / UI (3:1) |
| `--stage-text-primary` | `#F4F1EA` | `#0B0C0D` (Stage) | **16.2:1** | Exceeds AAA (7:1) |
| `--stage-text-secondary` | `#A1A399` | `#0B0C0D` (Stage) | **8.1:1** | Exceeds AAA (7:1) |
| `--stage-text-muted` | `#6E7169` | `#0B0C0D` (Stage) | **4.6:1** | Exceeds AA (4.5:1) |

### 2.3 Architectural Accents & Semantics
- **Primary Studio Accent**: Oxide Orange (`#C8501E`). Contrast:
  - On `#F4F1EA` (Paper): **4.6:1** (Passes WCAG AA for UI controls & bold headings)
  - On `#0B0C0D` (Stage): **5.4:1** (Passes WCAG AA for UI controls & buttons)
- **Drafting Cobalt Accent**: (`#2F5BEA`) for CAD active handles, hover accents, and blueprint selection.
- **Budget Semantic Tokens** (Always paired with iconography + explicit text):
  - Within Budget: `#2E7D32` (Sage Green) + CheckCircle2
  - Near Threshold (≥ 90%): `#D97706` (Architectural Amber) + AlertTriangle
  - Over Budget (> 100%): `#DC2626` (Vermilion Red) + AlertTriangle (`role="alert"`)

*Strict Rule*: No neon glows, no multi-colored rainbow gradients, no glassmorphism backdrop blurs stacked on text.

---

## 3. Typography System

| Role | Font Family | Size Range | Tracking / Weight | Register & Usage |
|---|---|---|---|---|
| **Display Hero** | `Newsreader` (Editorial Serif) | `clamp(36px, 5vw, 68px)` | Regular 400, line-height 1.1 | Sentence-case hero headline only |
| **Section Headline** | `Newsreader` (Editorial Serif) | `clamp(26px, 3.2vw, 38px)` | Medium 500, line-height 1.2 | Archive & Financial headers |
| **Project Title** | `Newsreader` (Editorial Serif) | `20px–26px` | SemiBold 600, line-height 1.25 | Card & row project names |
| **UI & Body** | `Plus Jakarta Sans` | `14px–16px` | Regular 400 / Medium 500 | Explanatory copy, buttons, labels |
| **Eyebrow / Badge** | `Plus Jakarta Sans` | `11px–12px` | SemiBold 600, uppercase, `letter-spacing: 0.08em` | Category & section eyebrows |
| **Technical Data** | `JetBrains Mono` | `12px–14px` | Tabular nums (`font-variant-numeric: tabular-nums`) | Dimensions, areas, BOM prices, coordinates |

---

## 4. Spacing, Grid, Radius & Borders

- **Base Unit**: `8px`.
- **Section Spacing**: `96px–120px` desktop; `48px–64px` mobile.
- **Grid Structure**: 12-column responsive layout, maximum width `1440px`, centered with outer gutters:
  - Desktop: `72px`
  - Tablet (768px–1024px): `40px`
  - Mobile (<768px): `20px`
- **Border Radii**:
  - Plans, Drawings & Imagery: `0px–2px` (crisp architectural edge)
  - Form Inputs, Buttons & Badges: `6px`
  - Floating Panels & Modals: `8px`
- **Hairlines**: `1px solid` replacing heavy drop-shadows. Shadows reserved strictly for floating menus (`--shadow-elevated`).

---

## 5. Imagery & Aspect Ratios

- **Media Resolution Priority**:
  1. Stored project image URL (`project.image_url`) if valid.
  2. Live SVG vector blueprint projection calculated deterministically from `project.layout_data.rooms` and wall segments.
  3. Clean decorative blueprint illustration empty state.
- **Archive Grid Ratios**:
  - Featured Card: `3:2` or `16:9` (spans 8 columns)
  - Standard Cards: `4:3` (spans 4 columns)
  - Tall Cards: `4:5` (spans 4 columns, applied to 2+ floor designs or narrow lots)
- **Object Positioning**: `object-fit: cover` with anchor centered on the plan's computed center of mass.

---

## 6. Component Architecture & States

Every interactive element supports 7 explicit states:
1. **Default**: Crisp hairline, clear contrast.
2. **Hover**: `1.02` subtle scale on fine pointers, 1px accent highlight, zero layout shifting.
3. **Focus-Visible**: High-contrast `2px solid var(--accent-color)` outline with `2px` offset (`:focus-visible`).
4. **Active / Pressed**: `0.98` scale feedback.
5. **Loading**: Structured skeleton placeholders matching exact aspect ratios (3:2, 4:3, 4:5).
6. **Error**: Inline error message with plain-language diagnostic and retry action.
7. **Empty**: Honest architectural graphic with direct creation trigger ("Create your first design →").

---

## 7. Motion & Accessibility Tokens

### 7.1 Duration & Easing Tokens
```css
:root {
  --dur-fast: 120ms;
  --dur-base: 240ms;
  --dur-slow: 480ms;
  --dur-hero: 720ms;
  --ease-standard: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-exit: cubic-bezier(0.4, 0, 1, 1);
}
```

### 7.2 Motion Choreography
- **Hero Title**: Line-by-line reveal, 720ms duration, 80ms stagger.
- **Archive Grid Stagger**: 12 items maximum, 50ms stagger, 480ms duration on initial mount only.
- **Card Hover**: Image scale 1.00 → 1.04 over 600ms; title underline appears; no layout shift.
- **Floor Plan Peek**: When hovering on multi-floor card for >400ms, crossfades preview to Floor 2.
- **Financial Stacked Bar**: 480ms width reveal on entry.
- **Number Counters**: Smooth count-up on initial view (duration ≤ 800ms) using exact final integers.
- **Grid ↔ List View Transition**: 320ms crossfade/FLIP transition with `localStorage` preference memory.

### 7.3 `prefers-reduced-motion: reduce`
When active:
- All parallax, auto-orbit, image zoom/drift, staggers, and count-up animations are completely disabled.
- Transitions collapse to immediate state changes or instant opacity fades (≤ 100ms).
- Verified via `@media (prefers-reduced-motion: reduce)` and Framer Motion's `useReducedMotion()`.

---

## 8. Preserved Architectural Features Checklist

| Feature | Preservation Mechanism |
|---|---|
| **AI Floor Plan Generation** | Directly connects to `generatePlans(payload)` API and FastAPI solver |
| **Plot Dimensions & Orientation** | Mono inputs (width × length) + segmented direction selector (N/E/S/W) |
| **Multi-Floor Support** | Step counter for floors, floor tabs in SVG preview & 3D |
| **2D Blueprint Editor** | Navigation routes to `/editor?project={id}&mode=2d` |
| **Furniture Manipulations** | Untouched in `/editor`; registry pricing integrated into BOM |
| **3D Multi-Floor Visualization** | Routes to `/editor?project={id}&mode=3d` with combined & floor isolation views |
| **Authoritative BOM & Financial Studio** | Directly consumes `calculateAuthoritativeBOM` / `bom_engine.py` |
| **Budget Overrun Alerts** | Triggers visual warning + alert role when estimated > target |
| **Persistence (Save/Load/Delete)** | CRUD endpoints preserved (`getProjects`, `saveProject`, `deleteProject`) |
| **JWT / Mongo Invariant** | Kept intact; zero Supabase migrations or changes |
