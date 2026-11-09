# AI Architect (Frontend Atelier)

The web frontend for **AI Architect (V2 Atelier)**: a React 19 + TypeScript architectural drafting platform with interactive 2D vector CAD blueprinting, Three.js 3D WebGL ArchViz, and natural language AI Copilot layout editing.

---

## 🎨 Architectural Design System

AI Architect features a **Warm Architectural Paper** aesthetic inspired by classical architectural drafting ateliers, physical drawing boards, and technical CAD software:
- **Canvas / Paper**: Warm cream `#FAF8F5` / `#FAF7F2`
- **Structural Ink**: Deep slate `#252622` and technical charcoal `#1E293B`
- **Drafting Accents**: Terracotta `#C85A32`, Blueprint Cobalt `#2A4365`, Sage Green `#4A6B5D`
- **Typography**: Editorial serif headings paired with monospace CAD coordinate displays

---

## 🏛 Atelier Workspace Modes

The main editor (`src/modules/editor/pages/Editor.tsx`) provides 5 dedicated studio modes:

1. **01 Brief & Plot**: Parametric site dimension inputs (Length × Width), compass orientation (N/E/S/W), setback constraints, and program requirements.
2. **02 2D Drafting**: Production vector SVG blueprint editor:
   - 8-handle CAD resizing (`nw`, `ne`, `se`, `sw`, `n`, `s`, `e`, `w`) with stationary anchor vector math.
   - Partition sync toggle: `[ 🔗 Sync Partition | ⤢ Independent Room ]`.
   - Live floating dimension HUD badge ($W \times H\text{ ft} \cdot W \times H\text{ m}$).
   - Circulation path overlay (BFS egress graph).
   - Solar orientation arc overlay.
3. **03 3D Massing (`FloorPlan3D.tsx`)**:
   - WebGL extrusion via Three.js and `@react-three/fiber`.
   - Camera modes: Dollhouse Cutaways (4.5ft & 10ft with slate wall caps), Axonometric, Top-Down Orthographic, Fit, Tour.
   - Floor controls: Stacked (up to 4 floors), Single Floor Isolation (L0, L1, L2, L3), and Exploded View.
   - Daylighting simulation: Dynamic AM, Noon, Golden Hour, and Night 2700K interior luminaires.
   - X-Ray mode: Translucent cyan walls (10% opacity) revealing continuous vertical core stair/MEP shafts.
   - Architectural section plane: Interactive clipping depth slider.
   - Procedural landscaping: Perimeter boundary walls, lawn turf, swimming pools, and palm trees.
4. **04 Compliance Studio (`ComplianceSidebar.tsx`)**:
   - Vastu Shastra 10-rule geometric radar analysis and quadrant heatmap.
   - NBC 2016 building code scorecard (FAR, setbacks, ventilation percentages).
5. **05 Comparison Studio (`ComparePlansStudio.tsx`)**:
   - Side-by-side inspection of generated layout typologies (Central Core vs Lateral Spine vs Garden Buffer).

---

## 📂 Project Structure

```text
frontend/src/
├── modules/
│   ├── auth/                        # Studio enrollment, login, Supabase auth bridge
│   ├── dashboard/                   # Architect desk, project archive, financial strip, hero sequence
│   └── editor/
│       ├── components/              # 2D CAD canvas, 3D WebGL viewport, Multi-Floor Wizard, Copilot
│       ├── constants/               # Furniture catalog, material definitions
│       └── geometry/                # CommandEngine, validators, selectors, migrations, 3D builders
└── shared/
    └── api-client/                  # FastAPI & Supabase typed clients
```

---

## 🚀 Development & Build

### Prerequisites
- Node.js `^20.19.0` or `>=22.12.0`

### Setup & Run
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run production build & type check
npm run build
```

### Environment Variables (`.env`)
```env
VITE_API_URL=http://127.0.0.1:8000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=ey...
```
