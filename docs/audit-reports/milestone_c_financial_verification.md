# Milestone C Verification: Financial and Budget Integration

**Milestone:** C — Financial and Budget Integration  
**Date:** October 2026  
**Status:** COMPLETE & VERIFIED  
**Safety Profile:** Fully Offline (Zero Live DB/Supabase Calls, Zero Migrations, Zero Secret Exposure)  
**Active Providers:** `DATABASE_PROVIDER=mongodb`, `AUTH_PROVIDER=jwt`  

---

## 1. Executive Summary

Milestone C establishes a single authoritative financial and budget calculation model across AI Architect. Prior to this milestone, construction estimates omitted placed furniture, furniture items had no consistent unit rates, the target budget was unpersisted, and the dashboard lacked functional financial cards.

This milestone unifies the backend Python engine and frontend TypeScript engine into a deterministic calculation model based on the 2026 Indian CPWD / market rate baseline (INR), correctly tracking placed furniture instances, movement/rotation invariance, addition/deletion behavior, unlisted catalog handling, persisted target budgets, and live overrun alerts across both the Editor and Dashboard.

---

## 2. Calculation Model & Cost Assumptions

### 2.1 Construction Trades Baseline (2026 Indian Market Estimates)
Rates are calculated per square foot (sqft) of floor area or wall face area:

| Trade / Material Component | Basis | Baseline Rate (INR) | Applicability & Notes |
| :--- | :--- | :--- | :--- |
| **RCC Structural Frame & Slab** | Floor Area (sqft) | ₹400 / sqft | Reinforced concrete columns, beams, foundation, and roof/floor slabs |
| **Brickwork Masonry (9" Walls)** | Wall Face Area (sqft) | ₹55 / sqft | Computed as $\text{Perimeter} \times \text{Ceiling Height (10ft)}$ |
| **Cement Plaster (Both Faces)** | Wall Face Area (sqft) | ₹18 / sqft | Internal and external surface plastering |
| **Vitrified Tile Flooring** | Floor Area (sqft) | ₹45 / sqft | Standard rooms (kitchen, utility, bedrooms, corridors) |
| **Marble / Granite Flooring** | Floor Area (sqft) | ₹120 / sqft | Premium rooms (Master Bedroom, Living, Dining) |
| **False Ceiling (POP / Gypsum)** | Floor Area (sqft) | ₹35 / sqft | All habitable spaces |
| **Electrical Infrastructure** | Floor Area (sqft) | ₹80 / sqft | Conduit, wiring, distribution board, switchboards, fixtures |
| **Plumbing & Sanitary** | Floor Area (sqft) | ₹60 / sqft | Strictly restricted to wet rooms (`bathroom`, `toilet`, `wc`, `kitchen`, `wash`) |
| **Internal & External Painting** | Floor Area (sqft) | ₹22 / sqft | 2 coats acrylic emulsion over primer |
| **Doors (Standard Interior)** | Unit Count | ₹8,000 / door | Flush wood / engineered panel doors with frame and hardware |
| **Windows (Aluminium Glazed)** | Unit Count | ₹5,500 / window | Two-track aluminium sliding windows with clear glazing |

### 2.2 Labour Cost Separation Rule
- **Construction Labour Ratio:** Strictly $30\%$ (`LABOUR_RATIO = 0.30`) applied to physical masonry, structural, finishes, openings, and MEP material totals:
  $$\text{Labour Total} = \text{Material Total} \times 0.30$$
  $$\text{Construction Total} = \text{Material Total} + \text{Labour Total}$$
- **Retail Furniture Separation:** Placed architectural furniture items are manufactured retail items procured from vendors. They are aggregated directly into `furniture_total` and are **not** inflated with masonry labour.
  $$\text{Grand Total} = \text{Construction Total} + \text{Furniture Total}$$

### 2.3 Quality Finish Tier Multipliers
Multipliers scale material and labour rates across specifications:
- **Economy:** $0.80\times$ (Budget vitrified tiles, basic distemper, minimal false ceiling)
- **Standard:** $1.00\times$ (Standard vitrified tiles, premium emulsion, gypsum ceiling)
- **Premium:** $1.50\times$ (Italian marble in key areas, textured paint, designer ceiling)
- **Luxury:** $2.00\times$ (Full marble/hardwood, smart electricals, high-end sanitary fittings)

### 2.4 Category-Level Breakdown
The financial model derives 10 mutually exclusive categories whose sum strictly equals `grand_total`:
1. `structural`: RCC slab and frame materials
2. `masonry_and_plaster`: Brick walling and plaster
3. `flooring`: Tile and marble materials
4. `ceiling`: Gypsum/POP false ceiling
5. `electrical`: Wiring, conduits, and light points
6. `plumbing`: Wet-wall pipes and sanitary infrastructure
7. `painting`: Emulsion coats
8. `doors_and_windows`: Factory doors and glazed windows
9. `labour`: $30\%$ skilled and unskilled construction labour
10. `furniture`: Sum of placed catalog furniture instances

### 2.5 Placed Furniture Cost Model & Invariance
- **Catalog Coverage:** 32 curated architectural assets across 6 categories (Living Room, Bedroom, Kitchen & Dining, Bathroom, Outdoor, Lighting Fixtures) mapped to verified baseline INR retail prices (e.g., King Bed ₹48,000, 3-Seater Sofa ₹38,000, 6-Seater Dining Table ₹45,000, Recessed Downlight ₹1,200).
- **Movement & Rotation Invariance:** Spatial transforms (`x, y, rotation`) do not modify asset identity or instance count. Costs remain 100% stable during dragging or rotating.
- **Instance Counting:** Duplicate operations create a new instance with a unique ID, properly incrementing quantity and cost. Deletion decrements quantity and deducts cost.
- **Missing / Custom Assets:** Unlisted catalog items are given `unit_price: null` and `is_available: false`. They appear in the itemized schedule as "Price unavailable" rather than fabricating fictitious prices.

### 2.6 Target Budget & Overrun Thresholds
- **Target Budget ($T$):** Persisted in INR; $0$ denotes no target budget set.
- **Remaining Budget ($R$):** $\max(0, T - \text{Grand Total})$
- **Overrun Amount ($O$):** $\max(0, \text{Grand Total} - T)$ when $T > 0$
- **Consumption Percentage ($P$):** $(\text{Grand Total} / T) \times 100\%$ when $T > 0$
- **Overrun Indicator:** `is_over_budget = (T > 0 && Grand Total > T)`. Triggers visual warning banner in both Editor (`ComplianceSidebar`, `AnalysisStudioView`) and Dashboard.

---

## 3. Changed Files & Data Sources

| File Path | Role | Key Changes |
| :--- | :--- | :--- |
| `backend/engines/cost_rates.py` | Backend Rates | Added `FURNITURE_RATES` mapping all 32 assets; added `get_furniture_rate()`; added `luxury: 2.0` tier multiplier. |
| `backend/engines/bom_engine.py` | Backend BOM Engine | Updated `_room_bom` and `compute_bom` to aggregate placed furniture from `room.get("furniture", [])`; added `target_budget` handling, `categories` breakdown, `furniture_schedule`, and `budget` metrics. |
| `backend/routers/engine_routes.py` | Backend API Routes | Updated `BomRecalculateRequest` to accept `target_budget: Optional[float] = 0.0` and forward to `compute_bom`. |
| `backend/tests/test_bom_financial_engine.py` | Backend Unit Tests | 9 unit tests covering construction BOM, plumbing, finish tiers, furniture placement, movement invariance, duplicate/delete, unlisted assets, budget overrun math, and zero-area safety. |
| `frontend/src/shared/api-client/api.ts` | Shared API Types | Added `BomFurnitureItemDetail`, `BomScheduleItem`, `BomCategories`, `BomBudgetSummary`; updated `BomRoomCost`, `BomRoom`, `BomSummary`, `BomResult`, `SaveProjectPayload`, `LayoutData`, `FurnitureItem` (`catalog_id`, `category`), and `recalculateBOM`. |
| `frontend/src/modules/editor/geometry/furnitureRegistry.ts` | Furniture Registry | Added `unitCostINR` to `FurnitureAssetDefinition`; exported `FURNITURE_PRICES_INR` for all 32 assets and `getFurniturePriceINR()`. |
| `frontend/src/modules/editor/constants/furnitureCatalog.ts` | Catalog Constants | Added `unitCostINR` to `FurnitureCatalogItem` and exported enriched `FURNITURE_CATALOG`. |
| `frontend/src/modules/editor/geometry/bomCalculator.ts` | Client Calculation Engine | Created single authoritative client calculation engine (`calculateAuthoritativeBOM`, `calculateRoomBOM`, `resolveFurnitureCatalogId`) matching backend formulas with zero drift. |
| `frontend/src/modules/editor/geometry/index.ts` | Geometry Exports | Exported `bomCalculator` symbols (`calculateAuthoritativeBOM`, `calculateRoomBOM`, `FURNITURE_PRICES_INR`, `resolveFurnitureCatalogId`). |
| `frontend/src/modules/editor/components/ComplianceSidebar.tsx` | Editor Inspector (Tab 2) | Added Target Budget Controller (numeric INR input + Set Budget), progress bar, overrun alert ribbon, construction vs furniture cost split, and placed furniture schedule table. |
| `frontend/src/modules/editor/components/AnalysisStudioView.tsx` | Performance Studio (Mode 4) | Replaced mock financial schedule with Trade Schedule table (RCC, masonry, flooring, ceiling, electrical, plumbing, paint, openings, labour), Placed Furniture Schedule table, Target Budget Controller with "Apply", and Overrun Alert Ribbon. |
| `frontend/src/modules/editor/pages/Editor.tsx` | Editor Page | Synchronously derives `authoritativeBom` from `effectiveFloors` and `targetBudget`; persists `budget_target` and `bomResult` in auto-save; passes `effectiveLayout` and `authoritativeBom` to inspector drawer and analysis studio. |
| `frontend/src/modules/dashboard/pages/Dashboard.tsx` | Dashboard Page | Added `projectFinancials` map using `calculateAuthoritativeBOM`; 5-column Metrics Counter Ribbon with "Portfolio Valuation" and "Budget Status"; Featured Project BOM badge, budget badge, overrun alert, and "Financial Studio" button; Grid card BOM cost and overrun badges with direct click-through to `/editor?project=${id}&mode=analysis`. |
| `frontend/src/modules/editor/geometry/test_financial_bom_suite.ts` | Frontend Test Suite | 53 unit tests validating construction quantities, labour ratio, finish tiers, furniture placement, movement invariance, duplication, deletion, unlisted pricing, budget overruns, category sums, and edge cases. |

---

## 4. Test Results

### 4.1 Frontend TypeScript Financial Suite (`test_financial_bom_suite.ts`)
Command: `npx tsx frontend/src/modules/editor/geometry/test_financial_bom_suite.ts`
- **Total Tests:** 53
- **Passed:** 53
- **Failed:** 0
- **Execution Time:** 0.28s

```
================================================================
AI ARCHITECT — MILESTONE C: FINANCIAL & BOM TEST SUITE
================================================================
--- TEST GROUP 1: Construction Calculations & Labour Ratio ---
  ✓ PASS: Room area matches exact dimensions (168 sqft)
  ✓ PASS: Wall area matches perimeter × 10ft height (520 sqft)
  ✓ PASS: Materials cost is non-zero
  ✓ PASS: Labour is strictly 30% of construction materials cost
  ✓ PASS: Room construction total equals materials + labour
  ✓ PASS: RCC slab cost populated
  ✓ PASS: Brickwork masonry cost populated
  ✓ PASS: Flooring cost populated
  ✓ PASS: Paint finish cost populated
  ✓ PASS: Electrical wiring & fixtures cost populated
  ✓ PASS: Bedroom has no wet-wall plumbing

--- TEST GROUP 2: Wet Room Plumbing Cost Inclusion ---
  ✓ PASS: Bathroom includes wet-wall plumbing infrastructure cost

--- TEST GROUP 3: Finish Tier Variations (Economy, Standard, Premium, Luxury) ---
  ✓ PASS: Economy total is less than Standard total
  ✓ PASS: Standard total is less than Premium total
  ✓ PASS: Premium total is less than Luxury total

--- TEST GROUP 4: Placed Furniture Cost Integration & Invariance ---
  ✓ PASS: King Bed rate is ₹48,000
  ✓ PASS: 3-Seater Sofa rate is ₹38,000
  ✓ PASS: 6-Seater Dining Table rate is ₹45,000
  ✓ PASS: Empty room has 0 furniture total
  ✓ PASS: Empty room has empty furniture schedule
  ✓ PASS: Furniture total matches exact sum of placed items (₹86000)
  ✓ PASS: Grand total equals construction_total + furniture_total
  ✓ PASS: Furniture schedule reports 2 distinct items
  ✓ PASS: Furniture cost is invariant under movement and rotation
  ✓ PASS: Grand total is invariant under movement and rotation
  ✓ PASS: Duplicating sofa increments total by sofa rate (₹124000)
  ✓ PASS: Furniture schedule groups identical items with quantity 2
  ✓ PASS: Deleting bed removes cost from BOM (remaining: ₹38000)
  ✓ PASS: Schedule reflects 1 item remaining

--- TEST GROUP 5: Handling of Missing / Unlisted Catalog Items ---
  ✓ PASS: Unlisted item does not fabricate arbitrary price; total remains 0
  ✓ PASS: Unlisted item is still present in schedule
  ✓ PASS: Unlisted item unit_price is explicitly null
  ✓ PASS: Unlisted item is_available flag is false

--- TEST GROUP 6: Target Budget, Overruns, & Threshold Alerts ---
  ✓ PASS: Target budget is 0
  ✓ PASS: No overrun triggered when target is 0
  ✓ PASS: Overrun amount is 0
  ✓ PASS: Consumed percent is 0
  ✓ PASS: Under budget: is_over_budget is false
  ✓ PASS: Remaining budget equals target - total
  ✓ PASS: Overrun amount is 0 when within budget
  ✓ PASS: Consumed percentage correctly computed (~67%)
  ✓ PASS: Over budget: is_over_budget is true
  ✓ PASS: Remaining budget clamped to 0 when in overrun
  ✓ PASS: Overrun amount correctly equals grand_total - target_budget
  ✓ PASS: Consumed percentage exceeds 100%

--- TEST GROUP 7: Category Breakdown Sum Integrity ---
  ✓ PASS: Sum of all categories (₹506510) matches grand total (₹506510)
  ✓ PASS: Services (electrical + plumbing) populated
  ✓ PASS: Finishes (flooring, ceiling, paint) populated
  ✓ PASS: Structural RCC + masonry populated

--- TEST GROUP 8: Empty Layout & Zero Area Resilience ---
  ✓ PASS: Empty floors yields 0 total
  ✓ PASS: Empty floors yields 0 rooms
  ✓ PASS: Empty floors yields empty schedule
  ✓ PASS: Zero area space yields 0 total safely without NaN or throw
================================================================
TOTAL TESTS: 53 | PASSED: 53 | FAILED: 0
================================================================
```

### 4.2 Backend Python BOM Financial Suite (`test_bom_financial_engine.py`)
Command: `python -m unittest backend.tests.test_bom_financial_engine`
- **Total Tests:** 9
- **Passed:** 9
- **Failed:** 0
- **Execution Time:** 0.001s

### 4.3 Backend Canonical Geometry Suite (`test_canonical_geometry.py`)
Command: `python -m unittest backend.tests.test_canonical_geometry`
- **Total Tests:** 5
- **Passed:** 5
- **Failed:** 0
- **Execution Time:** 0.001s

### 4.4 Milestone B Shaft & Viewport Regression Suite (`test_shaft_and_viewport_suite.ts`)
Command: `npx tsx frontend/src/modules/editor/geometry/test_shaft_and_viewport_suite.ts`
- **Total Tests:** 11
- **Passed:** 11
- **Failed:** 0
- **Execution Time:** 0.31s

### 4.5 Production Frontend Build
Command: `npm run build` (in `frontend/`)
- **Status:** **PASSED in 5.01s (0 errors)**
- **Output:** Clean bundle generated into `frontend/dist/`.

---

## 5. Known Limitations & Operating Boundaries

1. **Regional Baseline Estimates:** Rates represent standard urban Indian construction (2026 CPWD / market survey estimates). They provide architectural guidance and comparative estimation; they are advisory estimates rather than binding contractor bids.
2. **Offline Environment:** Database operations utilize local MongoDB / JWT offline mocks during development. Live Supabase database cutover is gated per persistent repository safety rules.
3. **Dashboard Structure:** The existing layout structure and navigation of `Dashboard.tsx` was preserved for Milestone C, adding functional financial overview counters and project cards. The full cinematic UI redesign (AIHom / Coohom aesthetic) is reserved for the next milestone.

---

## 6. Verification Status Matrix

| Requirement | Implementation Detail | Status |
| :--- | :--- | :--- |
| **Audit Existing Implementation** | Inspected `bom_engine.py`, `cost_rates.py`, `Dashboard.tsx`, furniture registry, and API schemas. Identified omissions in furniture costing and dashboard integration. | **VERIFIED FIXED** |
| **Consistent Financial Model** | Established deterministic CPWD / Indian rate model in Python and TypeScript. Separated construction materials, 30% labour markup, and retail manufactured furniture. | **VERIFIED FIXED** |
| **Furniture Cost Integration** | All 32 catalog items mapped to verified INR rates. Instance-based tracking, movement/rotation invariance, duplicate/delete reactivity, and explicit null for unlisted items. | **VERIFIED FIXED** |
| **Editable Project Budget** | Persisted `budget_target` schema. Live computation of remaining budget, overrun amount, percentage consumed, and visual warning banner. | **VERIFIED FIXED** |
| **Editor & Dashboard Consistency** | Single authoritative calculation used in `ComplianceSidebar.tsx`, `AnalysisStudioView.tsx`, and `Dashboard.tsx`. Direct link from dashboard cards to Financial Studio (`mode=analysis`). | **VERIFIED FIXED** |
| **Automated Testing** | 53 frontend TS tests passing, 9 backend Python BOM tests passing, 5 canonical tests passing, 11 shaft/viewport regression tests passing, 0 build errors. | **VERIFIED FIXED** |
| **End-to-End Live Persistence** | Tested against local schemas and CommandEngine auto-save payloads. Live database cluster sync not tested due to offline mock environment. | **NOT TESTED (Live DB)** |

---

## 7. Next Steps

With Milestone C complete and verified:
1. Review this verification report and the passing test suites.
2. Proceed to **Milestone D: Cinematic Studio Dashboard Redesign (AIHom & Coohom Inspired UI)**.
