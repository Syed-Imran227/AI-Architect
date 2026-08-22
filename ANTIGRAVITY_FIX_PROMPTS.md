# AI Architect — Audit Fix Prompts for Antigravity

Generated 2026-08-23 from a full static audit (every source file read) plus 5
measurement harnesses run against the real drafter and exporters.

**How to use:** hand Antigravity one section at a time, in order. Each section is
self-contained: *why it's broken*, *the measured evidence*, *the solution to use*,
and *acceptance criteria*. The order matters — P1 and P2 gate almost everything else.

**Out of scope by owner's decision — do not touch:**
- Base64 PNG payloads embedded in JSON/MongoDB (deliberate).
- `memory/future.md` (deliberate).
- `ieee_paper.tex`, `ieee_paper_formatted.tex` (submitted artifacts).
- `memory/recent_history.md` Groq/Llama references (historically accurate).
- `CLAUDE.md` (prompt file, not build instructions).
- Landing's "1:100 scale" claim — flag only, needs an owner decision (see P10).

---

## P1 — Reject or clamp infeasible plots (fixes an HTTP 500 + all narrow-plot geometry)

**Why:** `POST /generate` returns **HTTP 500 "Floor Plan Rendering Failed"** for any
plot 12 ft deep or shallower. Measured: 40×10 and 40×12 both raise
`ValueError: y1 must be greater than or equal to y0` from
`backend/exporters/floor_renderer.py` at `draw.rectangle([rx0, ry0, rx1, ry1])`,
because the drafter emits rooms with **negative height**. At 40×14 heights land on
exactly 0 — no crash, but degenerate zero-area rooms.

The root cause is upstream of the renderer: `build_layout_from_topology` stacks rooms
with a per-bay y-cursor and never checks that the remaining depth is positive. Every
one of these is the *same* bug surfacing in a different consumer:

| Consumer | Symptom on W ≤ 14 |
|---|---|
| Pillow renderer | raises → **HTTP 500** |
| SVG `InteractiveBlueprint` | `<rect height="-4">` → room silently not rendered |
| `FloorPlan3D.WallWithOpenings` | `wallLen ≤ 0` → **no walls emitted at all** (measured 6 cases) |
| door placement | 3-ft door on a 1-ft wall (measured 12 cases at 40×15) |
| overlap invariant | real overlaps: Parking×Utility, Foyer×Staircase, Living Room×Landing |

Measured: **66 of 126** plot configurations violate at least one geometry invariant.

**Solution — fix once, at the two real boundaries. Do not patch the three consumers.**

1. **API validation** in `backend/routers/engine_routes.py`. `GenerateRequest` currently
   has no bounds on any field. Add Pydantic constraints so infeasible input is a clean
   422, not a 500:
   ```python
   length: float = Field(..., ge=15, le=500)
   width:  float = Field(..., ge=15, le=500)
   floors: int   = Field(1, ge=1, le=10)
   bedrooms: int = Field(..., ge=0, le=20)
   bathrooms: int = Field(..., ge=0, le=20)
   ```
   Use `ge=15` for the two plot dims because 15 ft is the measured threshold at which
   the 3-bay partitioner stops producing non-positive rooms. Apply the same bounds to
   `VastuFixRequest`, `NbcFixRequest` and `RegenerateRoomRequest` plot context.

2. **Drafter invariant** in `backend/engines/architectural_layout.py`. Define
   `MIN_ROOM_DIM = 5.0` (ft). Before emitting each room, if the remaining depth in a
   bay is `< MIN_ROOM_DIM`, do **not** emit a squeezed/negative room — stop stacking
   that bay and merge the leftover into the previous room. At the end of
   `build_layout_from_functionally`, assert the invariant so it can never regress:
   ```python
   for f in layout["floors"]:
       for r in f["rooms"]:
           assert r["width"] >= MIN_ROOM_DIM and r["height"] >= MIN_ROOM_DIM, \
               f"drafter emitted {r['name']} at {r['width']}x{r['height']}"
   ```

3. **UI guard** in `frontend/src/pages/Editor.tsx`. The `length` and `width` number
   inputs (~lines 377 and 381) have **no `min` attribute** while `floors`, `bedrooms`
   and `balcony` all do. Add `min={15}` to both so zero/negative plots aren't typeable.

**Acceptance:** `/generate` returns 422 (not 500) for 40×10; the invariant sweep across
L∈{20,25,30,40,50,60} × W∈{10,12,14,15,20,30,40} reports **0** non-positive rooms and
**0** overlaps for every accepted plot.

---

## P2 — Deliver the bedroom and bathroom counts the user actually asked for

**Why:** this is the most damaging defect in the project — the product does not deliver
what was ordered. Measured on a healthy 40×30 plot:

| Requested | Delivered |
|---|---|
| 3 bed / 2 bath / **1 floor** | **0 bedrooms, 0 bathrooms** |
| 3 bed / 2 bath / 2 floors | 2 bedrooms (with a numbering gap: "Bedroom 1", "Bedroom 3") |
| 3 bed / 3 bath / 4 floors | **8** bedrooms |
| any bathrooms ≥ 2 floors | **always exactly 2**, regardless of request |

40×30 is the API's own default plot, so the single most likely first request a user
makes returns a house with no bedrooms.

**Root cause:** bedrooms are placed opportunistically per-floor as the bay y-cursor
allows, with no global budget. The ground floor is consumed by Parking / Foyer /
Staircase / Kitchen / Living / Dining, leaving no room, and nothing carries the
shortfall to upper floors.

**Solution — allocate before you place.** In `architectural_layout.py`, before drafting:

1. Compute a **global allocation plan**: distribute `bedrooms` and `bathrooms` across
   `floors`, skipping the ground floor for bedrooms when `floors > 1` (correct for
   Indian residential practice — ground floor carries parking + public rooms).
   For `floors == 1`, bedrooms **must** fit on the ground floor: shrink the public
   rooms rather than dropping bedrooms.
2. Draft against that plan, and after drafting **assert the totals match**:
   ```python
   got_beds = sum(1 for f in layout["floors"] for r in f["rooms"]
                  if "bedroom" in r["name"].lower())
   assert got_beds == bedrooms, f"requested {bedrooms} bedrooms, drafted {got_beds}"
   ```
3. Number bedrooms from a single counter as they are placed, so numbering is
   contiguous (no "Bedroom 1, Bedroom 3" gap).
4. Name rooms uniquely — the sweep found duplicate `Utility` on the same floor, which
   breaks every name-keyed lookup in the frontend (see P8).

**Acceptance:** for every combination of bedrooms ∈ 1..6, bathrooms ∈ 1..4,
floors ∈ 1..4 on a 40×30 plot, the drafted totals equal the requested totals, and
bedroom numbering is contiguous.

---

## P3 — Make the Architect–Drafter split real (the project's core claim)

**Why:** the thesis is that the LLM emits topology only and a deterministic drafter
computes coordinates. Measured, the drafter consumes **exactly one** of the LLM's seven
topology fields (`left_bay.bathrooms_allocated`) — and immediately clamps it. Proof:
holding the plot fixed and varying the topology produces a **byte-identical** ground
floor:

```
kitchen_position = left_rear  vs  right_rear  vs  north_east_corner   -> identical
bathrooms_allocated = 0       vs  2           vs  9                   -> identical
```

Three consequences, all user-visible:
- **Auto-Fix Vastu / Auto-Fix NBC cannot work by construction.** They ask the LLM for a
  revised topology, and the drafter then ignores it. The score cannot move.
- **RoomEditor's "Ask AI" is unanswerable.** "Make the Master Bedroom 3 ft wider" sends
  `allRooms` (which the backend never reads) and gets back a topology the drafter drops.
- The headline academic novelty is not implemented.

**Solution — consume the topology in the drafter.** In `build_layout_from_topology`,
actually read and honour:
- `right_bay.kitchen_position` → choose which corner of the right bay the kitchen
  occupies (`left_rear`, `right_rear`, `north_east_corner`, …).
- `right_bay.open_plan_living_dining` → when true, emit one merged `Living / Dining`
  room instead of two.
- `left_bay.rooms` / `right_bay.rooms` / `spine.rooms` → use the **given order** as the
  stacking order within each bay, instead of a hardcoded sequence.
- `left_bay.bathrooms_allocated` → respect it as a split hint between bays (still
  bounded by P2's global allocation, which wins on totals).

Keep the drafter fully deterministic — same topology + same plot ⇒ same coordinates.
The LLM must still never emit x/y/w/h.

**Acceptance:** varying `kitchen_position` across its allowed values changes the ground
floor geometry; toggling `open_plan_living_dining` changes the room count; a
before/after Vastu auto-fix produces a **different** layout and a different score.

---

## P4 — Auto-Fix overwrites the wrong floor (data corruption)

**Why:** `/vastu-fix` and `/nbc-fix` return `fixed_layout` = **ground-floor rooms only**
(`new_layout["floors"][0]["rooms"]`). The frontend writes that array into
**whichever floor is currently being viewed**:

- `frontend/src/components/ComplianceSidebar.tsx:55` — `onLayoutUpdate(result.fixed_layout, …)`
- `Editor.handleLayoutUpdate` writes into `newFloors[activeFloorIndexRef.current]`

So clicking **Auto-Fix Vastu while viewing Floor 2 replaces Floor 2 with the
regenerated ground floor** — parking and foyer appear upstairs, and the real Floor 2 is
gone. The backend already returns `full_layout` (all floors); the frontend throws it
away. Same pattern in `RoomEditor.handleAskAI` and `Editor.handleCopilotSubmit`.

**Solution:** prefer `full_layout`. In `Editor.tsx`, change the update handler to accept
a whole-layout replacement:
```ts
// if the backend sent every floor, replace all floors; never splice a
// ground-floor array into the active floor slot
if (result.full_layout?.floors?.length) {
  setActivePlan(p => ({ ...p, floors: result.full_layout.floors }));
} else {
  // single-floor response: it is ALWAYS the ground floor, index 0
  setActivePlan(p => { const f = [...p.floors]; f[0] = { ...f[0], rooms: result.fixed_layout }; return { ...p, floors: f }; });
}
```
Do the same for `nbcFix` and `regenerateRoom`. The key rule: **a ground-floor payload
may only ever be written to index 0**, never to `activeFloorIndex`.

**Acceptance:** switch to Floor 2, click Auto-Fix Vastu — Floor 2 keeps its own rooms,
and no floor contains Parking except floor 0.

---

## P5 — Stop losing plot size and form state (saved projects regenerate as 40×30)

**Why:** two separate leaks, same consequence — the app forgets how big the house is.

1. **`plotContext` omits three fields.** `Editor.tsx:304-311` builds:
   ```ts
   const plotContext = { plotWidth, plotHeight, entryDir, bedrooms, bathrooms, floors };
   ```
   `balcony`, `terrace` and `lift` are missing, and the backend defaults them to 0. So
   **any Auto-Fix or Copilot edit silently deletes every balcony and the terrace.**

2. **Saved projects persist almost nothing.** `handleSaveToDatabase` stores only
   `{ floors, vastuScore, vastuResult, nbcResult }` — no plot dimensions, no form state,
   no `energyResult`. `loadSavedProject` restores rooms but leaves the form at
   `INITIAL_FORM` (40×30, 2BHK). Load a saved 60×40 5BHK, click Auto-Fix, and it is
   **regenerated as a 40×30 2BHK**, destroying the design.

**Solution:**
- Add `balcony`, `terrace`, `lift` to the `plotContext` object and to the `PlotContext`
  interface in `ComplianceSidebar.tsx:6-13`.
- Persist the full form plus derived results in `layout_data`:
  ```ts
  layout_data: { floors, form: formData, vastuScore, vastuResult, nbcResult, energyResult }
  ```
- In `loadSavedProject`, `setFormData(saved.layout_data.form ?? INITIAL_FORM)` and restore
  `energyResult`. Keep the `?? INITIAL_FORM` fallback so projects saved before this change
  still load.
- While here: `frontend/src/services/api.ts` `ProjectMeta` is missing `length` and `width`,
  even though `Editor.handleExportReport` sends both at runtime. The PDF is correct today
  — this is a type-accuracy fix only, so the compiler catches it if the call site changes.

**Acceptance:** save a 60×40 5BHK with 2 balconies and a terrace, reload it, click
Auto-Fix — the plot stays 60×40, the balconies and terrace survive.

---

## P6 — NBC compliance is unwinnable, and its Auto-Fix always fails

**Why:** three compounding problems.

1. **35 of 100 points are structurally unreachable.** The setback rules require the
   building footprint to be inset from the plot boundary, but the drafter makes the
   footprint **exactly equal** to the plot. Measured maximum NBC score over 360
   configurations: **65/100**. No user input can ever score higher.
2. **The badge is therefore always red.** `ComplianceSidebar.tsx:193` uses
   `nbcResult.score >= 65 ? 'pass' : 'fail'` — 65 is the exact measured ceiling, and a
   real 40×30 plan scores 40. Every plan shows a red "fail" badge.
3. **`/nbc-fix` returns HTTP 400 at every floor count**, and `/vastu-fix` returns 400
   when `floors == 1`. Both buttons are gated on `score < 100`, so they are always
   visible and always fail.

**Solution — pick the honest option and make it consistent:**
- Preferred: **apply real setbacks in the drafter.** Inset the footprint from the plot by
  the NBC minimum (front 3 m / rear 1.5 m / sides 1.5 m, scaled to the plot), draft
  inside that inset rectangle, and emit `plot_width`/`plot_height` alongside the
  footprint so the SVG and PNG can draw the plot boundary. This makes the 35 points
  winnable and makes the drawings architecturally correct.
- Then fix the 400s: trace `/nbc-fix` and `/vastu-fix` and make the failing validation
  return a specific message. Both currently fail for *all* input, which means the
  endpoint contract is wrong, not the input.
- Re-derive the badge thresholds from the achievable range once setbacks land — don't
  leave a threshold equal to the maximum.

**Acceptance:** a 60×40 single-floor plan scores > 65 NBC; `/nbc-fix` returns 200 and a
changed layout; the badge shows amber/green for a compliant plan.

---

## P7 — The Energy score is a hardcoded constant

**Why:** measured across 360 configurations, the set of distinct energy scores is
literally `[80]`. Grade is always "A". `ComplianceSidebar.tsx:257` uses
`energyResult.score >= 80 ? 'pass'`, so the panel is **always green** — it is decoration,
not analysis. The three thermal rules in `backend/engines/energy_engine.py` (weighted
35/35/30) do not vary with geometry or orientation.

**Solution:** make each rule a real function of the layout:
- **Solar gain** — score west-facing glazing area negatively, north-facing positively.
  Use the actual `windows` arrays and each room's wall orientation.
- **Cross-ventilation** — score rooms that have openings on two different walls.
- **Thermal buffering** — score service rooms (bath, utility, stair) placed on the
  west/south-west envelope where they shield habitable rooms.

Each must produce a different number for a north-facing vs a west-facing plan.

**Acceptance:** the same plot scored with `entry_dir` = north / east / west / south
yields at least three distinct energy scores; the sidebar badge can show amber.

---

## P8 — Manual edits and drags bypass every validation, and desync the exports

**Why:** the project's central claim is "guaranteed overlap-free by construction". Both
direct-manipulation paths defeat it:

- `frontend/src/components/RoomEditor.tsx` — `handleApply` calls `onRoomUpdate(local)`
  with arbitrary x/y/width/height and **no bounds or overlap check**.
  `handleFieldChange(field, parseFloat(e.target.value) || 0)` yields **0** for garbage
  input, and `min={4}` on the input is only a browser hint.
- `frontend/src/components/InteractiveBlueprint.tsx` — `handlePointerMove` produces
  `{ ...r, x: r.x + dx, y: r.y + dy }` with **no clamp to the plot and no collision
  test**, and `handlePointerUp` commits it via `onRoomDrop`. A room can be dragged
  clean off the plot and that becomes the exported design.
- **The exports then disagree with each other.** `onRoomDrop` does not refresh
  `imageUrl`, so after a drag: DXF export uses the **live** rooms, PDF export embeds the
  **stale** pre-drag PNG. Two exports of "the same plan" describe different buildings.
- Both paths match rooms by `r.name === …`. With the duplicate names P2 fixes, **two
  rooms move together**.

**Solution:**
1. Add one shared validator in the frontend, e.g. `src/utils/validateRooms.ts`:
   `bounds check + pairwise overlap`, returning a list of violations. Call it from both
   `RoomEditor.handleApply` and `InteractiveBlueprint.handlePointerUp`. On violation,
   reject the commit and `toast.error` the reason. (The backend already has an
   equivalent check — reuse its rules so the two agree.)
2. Snap dragged coordinates to 0.5 ft (`Math.round(v * 2) / 2`) so the DXF stops
   receiving 12.34567-ft origins.
3. Key rooms by **index or a stable id**, not `name`, in both drag and update paths.
4. On any manual mutation, **invalidate `imageUrl`** so the PDF cannot embed a stale
   sketch — either clear it (and re-render on export) or re-request the PNG.

**Acceptance:** dragging a room onto its neighbour is rejected with a toast; dragging
one of two same-named rooms moves only that one; exporting PDF after a drag shows the
post-drag plan.

---

## P9 — `entry_dir` is decorative, and the DXF is a mirror image

**Why:** four related findings that all say "the compass is not real".
- The main entrance is **always placed on the top wall**, whatever `entry_dir` says.
- The north arrow is hardcoded pointing up in **all three** renderers:
  `floor_renderer.py`, `InteractiveBlueprint.tsx`, `FloorPlan3D.tsx`.
- The Vastu engine scores **absolute** zones (NE, SW, …) against a plan whose
  orientation never changes, so every direction verdict rests on an assumption the
  geometry doesn't honour.
- **The DXF applies no y-flip.** `backend/exporters/dxf_exporter.py` writes
  `ry = room["y"] * SCALE` directly. JSON/SVG use y-increases-**down**; AutoCAD uses
  y-**up**. Measured: JSON y=0 (`Parking`) lands at DXF y=0, the *bottom* in AutoCAD.
  The exported CAD file is a faithful **vertical mirror** of the approved on-screen plan
  — north and south inverted — which silently invalidates every Vastu and Energy
  direction claim in the deliverable the user hands to a builder. The function's own
  docstring claims a flip exists ("*bottom wall = y=room_y … since y flipped*"), but
  `export_to_dxf(rooms)` never receives the plot height, so a flip is currently
  **impossible**.

**Solution:**
1. `export_to_dxf(rooms, plot_height)` — add the parameter, and emit
   `ry = (plot_height - room["y"] - room["height"]) * SCALE`. Flip doors, windows,
   furniture and dimension anchors with the same transform. Update the docstring to
   match what the code does.
2. Make `entry_dir` real: rotate the drafted plan so the entrance lands on the
   requested façade (rotating the plot rectangle by 0/90/180/270 and swapping L/W is the
   smallest correct approach), **or** keep the geometry fixed and rotate the north
   reference used by the arrow and by the Vastu engine. Pick one and apply it in all
   three renderers plus `vastu_engine`.

**Acceptance:** open the DXF in a y-up CAD viewer — the plan matches the on-screen SVG,
not its mirror. Setting `entry_dir=west` moves the entrance to the west wall and rotates
the north arrow consistently in PNG, SVG and 3D.

---

## P10 — PDF and DXF output defects

**Why (all measured):**
1. **Every special glyph in the PDF renders as a black square ■.** ReportLab's Type1
   base fonts use WinAnsiEncoding, which cannot encode `₹` U+20B9, `✅` U+2705,
   `❌` U+274C, `⚠` U+26A0 or `⬡` U+2B21. ReportLab does not raise — it silently
   substitutes `n` in **ZapfDingbats** (a filled square) and injects a
   `/BaseFont /ZapfDingbats` font object to do it. Confirmed by decompressing the
   content stream and reading the `Tj` operators. Affected: `_inr()` (every price in the
   cost table), the pass/warn/fail Status column (all three become identical squares —
   colour is the only surviving differentiator), the page header, the disclaimer.
2. **The floor-plan image is stretched.** `RLImage(img_buf, width=w-4*cm, height=(w-4*cm)*0.75)`
   hardcodes a 0.75 aspect while the PNG's real aspect varies with the plot. Measured
   distortion: 40×30 → 15%, 60×20 → 32%, 80×25 → 40%, **20×60 → 224%**.
3. **DXF dimension text is illegible.** `dimtxt` is 2.5 mm on a 12,192 mm-wide drawing —
   **0.021%** of the width, and 73× smaller than the room labels (182.9 mm).
   (`add_linear_dim(dimstyle="EZ_INSIDE")` also silently falls back to `Standard`
   because the doc isn't created with `setup=True`.)
4. **The title block claims a scale it never uses.** `floor_renderer.py:317` hardcodes
   `Scale 1:50`, but the scale is computed per-plot
   (`max(min(SCALE, (TARGET_W - 2*PADDING)/max(plan_w, plan_h, 1)), 14)`) — at 150 dpi
   that's roughly 1:60 to 1:128, never 1:50.
5. **Fonts are hardcoded to Windows paths.** `_font()` uses
   `C:\Windows\Fonts\arial.ttf`; on Linux it falls through to
   `ImageFont.load_default()`, making every label tiny.

**Solution:**
1. Register a Unicode TTF once at import in `pdf_report.py` and use it everywhere:
   ```python
   from reportlab.pdfbase import pdfmetrics
   from reportlab.pdfbase.ttfonts import TTFont
   pdfmetrics.registerFont(TTFont("DejaVuSans", <path>))
   ```
   DejaVuSans covers ₹ and the dingbats. If you'd rather not ship a font file, use
   ASCII `"Rs. "` and `"PASS"/"WARN"/"FAIL"` — but do **not** leave ■ in the flagship
   deliverable.
2. Read the PNG's real aspect and use it:
   ```python
   iw, ih = PIL.Image.open(img_buf).size
   img_w = w - 4*cm
   RLImage(img_buf, width=img_w, height=img_w * ih / iw)
   ```
3. Create the DXF doc with `ezdxf.new(setup=True)` so `EZ_INSIDE` exists, and set
   `dimtxt` proportional to the plot (≈ 0.5 ft in drawing units, i.e. `0.5 * SCALE`).
4. Either compute the true ratio into the title-block string, or drop the claim and keep
   only the graphic scale bar. **Note for the owner:** the project now states three
   different scales — `Scale 1:50` (PNG title block), "1:100" (Landing page), and
   1 ft = 304.8 mm (DXF, which is full scale in mm, not a plotting scale). The DXF unit
   scale is correct and should not change; the two marketing/label claims need an
   owner decision.
5. Make `_font()` try a list of candidate paths (Windows Arial, then
   `/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf`, then bundled) before falling back
   to `load_default()`.

**Acceptance:** open the PDF — prices show a real ₹ (or "Rs."), the Status column shows
three distinguishable markers, and the floor plan is not stretched on a 20×60 plot.

---

## P11 — Remove phantom UI and dead code

**Why:** several panels and parameters exist but can never do anything.
- **Two permanently empty panels.** `engine_routes.py:131-132` reads
  `json_layout.get("validation_report", [])` and `("circulation_warnings", [])` — both
  are **top-level** keys that nothing in the codebase ever writes. (Per-floor
  `circulation` data *is* written; the top-level keys are not.) The Editor renders
  panels for both, so they are always empty.
- **Unreachable-room warnings all stack at the plot origin.**
  `frontend/src/components/CirculationOverlay.tsx` renders every warning at
  `x={0} y={0}`, so they overlap into one illegible blob. Look up each room's centre.
- **Upper-floor `Corridor` has zero doors** yet the circulation BFS reports it reachable
   — the BFS treats adjacency as connectivity. Require a shared door.
- **Dead parameters and code:** `req.kitchen` and `req.parking` are accepted and never
  used; `RegenerateRoomRequest.rooms: List[Any]` is accepted and never read (which is
  *why* "make this room 3 ft wider" can't work — see P3); `_ROOM_SIZE_VOCAB`,
  `_count_beds` and `repositories.get_user_by_id` are unused; ~440 orphaned lines in
  `backend/engines/layout_validator.py`; a dead `win_w < WIN_MIN` branch in
  `window_placer`.
- **`main.py`'s startup validation is unreachable.** The `lifespan` handler checks
  `JWT_SECRET` / `GROQ_API_KEY` / `HF_API_KEY`, but `inference.py:29-32` raises on those
  same variables **at import time**, before `lifespan` ever runs. Either move the check
  into `lifespan` (so the app starts and reports a clean error) or delete the dead check.
- **`_bay_widths` docstring says 35%** while the code uses `0.40`.
- **`_classify`-style substring bugs:** `vastu_engine._classify`,
  `InteractiveBlueprint.getRoomStyle` and `FloorPlan3D.getRoomColor` all test
  `name.includes('bedroom') && name.includes('1')`, which also matches **Bedroom 10, 11,
  12**. Match on an exact parsed index instead.

**Solution:** either write the two top-level keys (aggregate the per-floor data the
validator already produces) **or** delete both panels. Do not ship an empty panel.
Delete the dead code. Fix the substring matching and the docstring.

**Acceptance:** no rendered panel is unconditionally empty; `grep` finds no reader of a
key nothing writes; a plan with 12 bedrooms styles Bedroom 10 as a normal bedroom.

---

## P12 — The 3D view hard-depends on a third-party CDN and can white-screen the Editor

**Why:** `frontend/src/components/FloorPlan3D.tsx:913` renders
`<Environment preset="city" />`. Traced through the installed packages:

```
Environment preset="city"
  -> drei/core/useEnvironment.js: files = 'potsdamer_platz_1k.hdr',
     path = 'https://raw.githack.com/pmndrs/drei-assets/456060a2.../hdri/'
  -> useLoader(RGBELoader, …)            // suspends
  -> R3F Canvas inner <Suspense fallback={<Block set={setBlock}/>}>
  -> react-three-fiber.esm.js:58  if (block) throw block;
     react-three-fiber.esm.js:60  if (error) throw error;
```

Those two `throw`s are in the **Canvas component body — outside** R3F's own boundary, so
they propagate into the app tree. There is **no `<Suspense>` and no error boundary
anywhere in the frontend** (verified: zero matches for `Suspense` in `src/`). Result: a
failed or slow HDRI fetch — offline, corporate proxy, or `raw.githack.com` rate-limiting,
which it does aggressively — **unmounts the whole Editor page and loses the generated
plan**, since plan state lives in Editor and isn't persisted until Save.

This is the only network dependency in an otherwise entirely-localhost app, and it sits
in an uncommitted file.

**Solution — delete one line.** The scene already has `<Sky>`, `<ambientLight>` and two
`<directionalLight>`s; `Environment` only adds image-based reflections that are barely
visible on matte architectural surfaces. Remove `<Environment preset="city" />` and drop
`Environment` from the import on line 2. That removes the CDN dependency outright.

If the reflections are wanted, the alternative is: ship the `.hdr` locally in `public/`
and pass `files="/hdri/city.hdr"` (no `preset`), **and** wrap `<FloorPlan3D>` in a
`<Suspense fallback={…}>` plus an error boundary. But per the ladder, deleting the line
is the smaller and safer fix.

**Separately — add one app-level error boundary.** `App.tsx` has none, so *any* render
throw anywhere white-screens the app. Wrap `<AppRoutes />` in a minimal class-component
error boundary that shows a retry button. This is cheap insurance for a 700-line Editor
holding unsaved work.

**Acceptance:** disconnect the network, open the 3D tab — the plan still renders and the
Editor does not blank. No request to `raw.githack.com` appears in the network log.

---

## P13 — Small correctness and honesty fixes

Low severity, quick, and they remove misleading output.

- **`Editor.tsx` `handleRoomUpdate` matches by name**
  (`rooms.map(r => r.name === updated.name ? updated : r)`) — with duplicate names both
  rooms mutate. Key by index/id (same fix as P8).
- **Unreachable UI state:** `Editor.tsx:542` branches on
  `activePlan.vastuScore >= 90 ? 'high' : 'medium'`; the measured maximum Vastu score is
  **63**, so the `'high'` branch is dead. Re-derive the thresholds from the achievable
  range (see P6/P7 — same class of bug in three places).
- **Stale marketing copy:** `Editor.tsx:699` says *"Llama-3 calculates precise rooms."*
  Wrong on two counts — the model chain is DeepSeek-V3 → Qwen3-Coder → gpt-oss-120b, and
  the entire thesis is that the **LLM does not calculate rooms**, the drafter does. Fix
  the sentence to describe the Architect–Drafter split.
- **`Dashboard.tsx`: the "Vastu Projects" stat is `projects.length`** — identical to
  "Total Designs", counting every project as a Vastu project regardless of the toggle.
  Either count `layout_data.form.vastuToggle` honestly or remove the card.
- **`Dashboard.tsx`: `fetchProjects` swallows errors** into `console.error`, so an expired
  token renders "No designs yet" — indistinguishable from real data loss. Add a
  `toast.error` and, on 401, call `logout()`.
- **Dead hover effect:** Dashboard's project cards set `el.style.borderColor` on
  `onMouseEnter` while the card has `border: 'none'` — nothing happens. Set a border or
  drop the handler.
- **Pointless `setTimeout(…, 0)`** wrappers in `Dashboard.tsx:43` and
  `AuthContext.tsx:34`. Remove; `Dashboard`'s also never clears on unmount.
- **`res.candidates as Plan[]` double cast** in `Editor.tsx` papers over a real
  return-type mismatch in `api.ts`. Fix the `api.ts` signature and delete the cast.
- **Password policy is UI-only.** `Register.tsx:60` enforces `minLength={6}`; the backend
  has no length validation and no `EmailStr`, so the API accepts a 1-character password.
  Add `Field(min_length=8)` and `EmailStr` to the register model, and a unique index on
  the users' `email` collection (currently absent — duplicate accounts are possible).
- **Pin `reportlab` and `certifi`** in `backend/requirements.txt`; everything else is
  pinned, so these two break reproducibility.
- **`floor_renderer.py:106-108` comment contradicts the code**: it says
  *"(Y flipped so Y=0 is at bottom …)"* directly above `def py(y_ft)` which does **no**
  flip. The code is correct (it matches the SVG) — delete the wrong comment.

---

## Verification gates — all currently green, keep them green

Run after every section:

```bash
cd backend && python -m compileall -q . && cd ../frontend && npx tsc --noEmit && npm run lint
```

Plus the external pytest suite (2 tests, ~1.5 s) at `~/Downloads/ai_architect_tests`.
Note it hardcodes `sys.path` and calls `load_dotenv` on `backend/.env`, so it reads real
secrets into the test process — don't add CI for it without moving to fixtures.

**The suite is far too thin for the changes above.** P1, P2 and P3 in particular need
tests, or they will regress silently. Add to the backend suite:
- an invariant sweep (no non-positive rooms, no overlaps, all rooms inside the plot)
  across a grid of plot sizes — this is what caught 66/126 failures;
- a count assertion (requested bedrooms/bathrooms == drafted) across bed/bath/floor
  combinations;
- a determinism test (same topology + plot ⇒ identical coordinates) and a sensitivity
  test (different topology ⇒ different coordinates) — together these are exactly the
  Architect–Drafter claim, expressed as a test.
