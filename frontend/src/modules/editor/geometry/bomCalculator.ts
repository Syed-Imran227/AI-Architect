/**
 * bomCalculator.ts
 * ============================================================================
 * Authoritative Client-Side Bill of Materials (BOM) & Financial Model Engine.
 *
 * Implements the exact same deterministic calculation rules as the backend
 * `bom_engine.py` and `cost_rates.py`. Ensures instant, synchronous reactivity
 * across 2D/3D edits (furniture placement, room dimension changes, finish tier
 * adjustments, budget updates) without competing formulas or network lag.
 * ============================================================================
 */

import type {
  BomResult,
  BomRoom,
  BomRoomCost,
  BomSummary,
  BomScheduleItem,
  BomCategories,
  BomBudgetSummary,
  BomFurnitureItemDetail,
  Floor,
  Room,
  LayoutData,
} from '../../../shared/api-client/api';
import { FURNITURE_PRICES_INR, getFurniturePriceINR } from './furnitureRegistry';

// ── Baseline Construction Rates (INR per unit / sqft, 2026 Baseline) ────────
export const STRUCTURE_RCC_PER_SQFT = 400.0;
export const BRICK_WALL_PER_SQFT = 55.0;
export const PLASTER_PER_SQFT = 18.0;
export const FLOORING_TILE_PER_SQFT = 45.0;
export const FLOORING_MARBLE_PER_SQFT = 120.0;
export const CEILING_PER_SQFT = 35.0;
export const ELECTRICAL_PER_SQFT = 80.0;
export const PLUMBING_PER_SQFT = 60.0;
export const PAINTING_PER_SQFT = 22.0;
export const DOOR_UNIT_COST = 8000.0;
export const WINDOW_UNIT_COST = 5500.0;
export const LABOUR_RATIO = 0.30;
export const CEILING_HEIGHT_FT = 10.0;

export const TIER_MULTIPLIERS: Record<string, number> = {
  economy: 0.8,
  standard: 1.0,
  premium: 1.5,
  luxury: 2.0,
};

const WET_ROOM_KEYWORDS = ['bathroom', 'toilet', 'wc', 'bath', 'kitchen', 'wash'];
const PREMIUM_FLOOR_KEYWORDS = ['master bedroom', 'living', 'dining'];

function isWetRoom(name: string): boolean {
  const n = (name || '').toLowerCase();
  return WET_ROOM_KEYWORDS.some(k => n.includes(k));
}

function isPremiumFloor(name: string): boolean {
  const n = (name || '').toLowerCase();
  return PREMIUM_FLOOR_KEYWORDS.some(k => n.includes(k));
}

export function resolveFurnitureCatalogId(item: {
  id?: string;
  catalogId?: string;
  catalog_id?: string;
  assetId?: string;
  name?: string;
}): string {
  const catId = item.catalogId || item.catalog_id || item.assetId;
  const rawId = item.id || item.name || '';
  const candidates = [catId, rawId].filter(Boolean) as string[];

  for (const cand of candidates) {
    const cleaned = cand.trim().toLowerCase();
    if (FURNITURE_PRICES_INR[cleaned] !== undefined) return cleaned;
    const base = cleaned.replace(/(_\d+|_copy.*|-instance.*)$/, '');
    if (FURNITURE_PRICES_INR[base] !== undefined) return base;
  }

  // Normalized alphanumeric match (ignores underscores vs hyphens vs spaces)
  const normMap = new Map<string, string>();
  for (const key of Object.keys(FURNITURE_PRICES_INR)) {
    normMap.set(key.replace(/[^a-z0-9]/g, ''), key);
  }

  for (const cand of candidates) {
    const norm = cand.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normMap.has(norm)) return normMap.get(norm)!;
    for (const [keyNorm, originalKey] of normMap.entries()) {
      if (norm.includes(keyNorm)) return originalKey;
    }
  }

  return String(catId || rawId || '').trim();
}

/**
 * Calculates BOM for a single room dictionary.
 */
export function calculateRoomBOM(room: Room, tier: string = 'standard'): BomRoom {
  const name = room.name || 'Room';
  const widthFt = Number(room.width || 0);
  const heightFt = Number(room.height || 0);
  const numDoors = (room.doors || []).length;
  const numWindows = (room.windows || []).length;
  const furnitureList = room.furniture || [];

  const areaSqft = widthFt * heightFt;
  const perimFt = 2 * (widthFt + heightFt);
  const wallAreaSqft = perimFt * CEILING_HEIGHT_FT;
  const tierMult = TIER_MULTIPLIERS[tier] || 1.0;

  // Construction Materials
  const structureCost = areaSqft * STRUCTURE_RCC_PER_SQFT * tierMult;
  const wallCost = wallAreaSqft * (BRICK_WALL_PER_SQFT + PLASTER_PER_SQFT) * tierMult;
  const floorRate = isPremiumFloor(name) ? FLOORING_MARBLE_PER_SQFT : FLOORING_TILE_PER_SQFT;
  const flooringCost = areaSqft * floorRate * tierMult;
  const ceilingCost = areaSqft * CEILING_PER_SQFT * tierMult;
  const electricalCost = areaSqft * ELECTRICAL_PER_SQFT * tierMult;
  const plumbingCost = isWetRoom(name) ? areaSqft * PLUMBING_PER_SQFT * tierMult : 0.0;
  const paintingCost = areaSqft * PAINTING_PER_SQFT * tierMult;
  const doorCost = numDoors * DOOR_UNIT_COST * tierMult;
  const windowCost = numWindows * WINDOW_UNIT_COST * tierMult;

  const materialTotal =
    structureCost + wallCost + flooringCost + ceilingCost +
    electricalCost + plumbingCost + paintingCost + doorCost + windowCost;

  const labourCost = Math.round(materialTotal * LABOUR_RATIO * 100) / 100;
  const constructionTotal = Math.round((materialTotal + labourCost) * 100) / 100;

  // Placed Furniture
  const furnitureItemsDetail: BomFurnitureItemDetail[] = [];
  let furnitureTotal = 0;

  for (const item of furnitureList) {
    if (!item) continue;
    const catId = resolveFurnitureCatalogId(item);
    const baseRate = getFurniturePriceINR(catId);
    const itemId = String(item.id || catId || 'item');
    const itemName = String(item.name || catId.replace(/_/g, ' '));

    if (baseRate !== undefined) {
      const unitPrice = Math.round(baseRate * tierMult * 100) / 100;
      furnitureTotal += unitPrice;
      furnitureItemsDetail.push({
        id: itemId,
        catalog_id: catId,
        name: itemName,
        unit_price: unitPrice,
        is_available: true,
      });
    } else {
      furnitureItemsDetail.push({
        id: itemId,
        catalog_id: catId,
        name: itemName,
        unit_price: null,
        is_available: false,
      });
    }
  }

  const roomTotal = Math.round((constructionTotal + furnitureTotal) * 100) / 100;

  const costs: BomRoomCost = {
    structure: Math.round(structureCost * 100) / 100,
    wall: Math.round(wallCost * 100) / 100,
    flooring: Math.round(flooringCost * 100) / 100,
    ceiling: Math.round(ceilingCost * 100) / 100,
    electrical: Math.round(electricalCost * 100) / 100,
    plumbing: Math.round(plumbingCost * 100) / 100,
    painting: Math.round(paintingCost * 100) / 100,
    doors: Math.round(doorCost * 100) / 100,
    windows: Math.round(windowCost * 100) / 100,
    material: Math.round(materialTotal * 100) / 100,
    labour: labourCost,
    construction_total: constructionTotal,
    furniture: Math.round(furnitureTotal * 100) / 100,
    total: roomTotal,
  };

  return {
    name,
    area_sqft: Math.round(areaSqft * 100) / 100,
    wall_area_sqft: Math.round(wallAreaSqft * 100) / 100,
    num_doors: numDoors,
    num_windows: numWindows,
    furniture_count: furnitureItemsDetail.length,
    furniture_items: furnitureItemsDetail,
    costs,
  };
}

export interface CalculateBOMOptions {
  tier?: string;
  targetBudget?: number;
}

/**
 * Calculates a complete authoritative BOM across all floors/rooms in a layout.
 */
export function calculateAuthoritativeBOM(
  layoutOrFloors: LayoutData | Floor[] | Room[],
  options: CalculateBOMOptions = {}
): BomResult {
  const tier = options.tier || 'standard';
  let targetBudget = Number(options.targetBudget || 0);

  const roomsToProcess: Room[] = [];

  if (Array.isArray(layoutOrFloors)) {
    if (layoutOrFloors.length > 0 && 'rooms' in layoutOrFloors[0]) {
      // Array of Floor objects
      for (const fl of layoutOrFloors as Floor[]) {
        if (fl.rooms) roomsToProcess.push(...fl.rooms);
      }
    } else {
      // Array of Room objects
      roomsToProcess.push(...(layoutOrFloors as Room[]));
    }
  } else if (layoutOrFloors && typeof layoutOrFloors === 'object') {
    const layout = layoutOrFloors as LayoutData;
    if (!targetBudget) {
      targetBudget = Number(layout.budget_target || layout.target_budget || (layout.form as any)?.budget_target || 0);
    }
    if (layout.floors && layout.floors.length > 0) {
      for (const fl of layout.floors) {
        if (fl.rooms) roomsToProcess.push(...fl.rooms);
      }
    } else if (layout.rooms) {
      roomsToProcess.push(...layout.rooms);
    }
  }

  const roomBoms = roomsToProcess.map(r => calculateRoomBOM(r, tier));

  const totalArea = roomBoms.reduce((sum, r) => sum + r.area_sqft, 0);
  const materialTotal = roomBoms.reduce((sum, r) => sum + r.costs.material, 0);
  const labourTotal = roomBoms.reduce((sum, r) => sum + r.costs.labour, 0);
  const constructionTotal = roomBoms.reduce((sum, r) => sum + (r.costs.construction_total || 0), 0);
  const furnitureTotal = roomBoms.reduce((sum, r) => sum + (r.costs.furniture || 0), 0);
  const grandTotal = roomBoms.reduce((sum, r) => sum + r.costs.total, 0);
  const ratePerSqft = totalArea > 0 ? Math.round((grandTotal / totalArea) * 100) / 100 : 0;

  // Categories Breakdown
  const categories: BomCategories = {
    structural: Math.round(roomBoms.reduce((sum, r) => sum + r.costs.structure, 0) * 100) / 100,
    masonry_and_plaster: Math.round(roomBoms.reduce((sum, r) => sum + r.costs.wall, 0) * 100) / 100,
    flooring: Math.round(roomBoms.reduce((sum, r) => sum + r.costs.flooring, 0) * 100) / 100,
    ceiling: Math.round(roomBoms.reduce((sum, r) => sum + r.costs.ceiling, 0) * 100) / 100,
    electrical: Math.round(roomBoms.reduce((sum, r) => sum + r.costs.electrical, 0) * 100) / 100,
    plumbing: Math.round(roomBoms.reduce((sum, r) => sum + r.costs.plumbing, 0) * 100) / 100,
    painting: Math.round(roomBoms.reduce((sum, r) => sum + r.costs.painting, 0) * 100) / 100,
    doors_and_windows: Math.round(roomBoms.reduce((sum, r) => sum + r.costs.doors + r.costs.windows, 0) * 100) / 100,
    labour: Math.round(labourTotal * 100) / 100,
    furniture: Math.round(furnitureTotal * 100) / 100,
  };

  // Placed Furniture Schedule
  const scheduleMap = new Map<string, BomScheduleItem>();
  for (const rb of roomBoms) {
    for (const fItem of rb.furniture_items || []) {
      const catId = fItem.catalog_id || 'unspecified';
      const existing = scheduleMap.get(catId);
      if (!existing) {
        scheduleMap.set(catId, {
          catalog_id: catId,
          name: fItem.name,
          quantity: 1,
          unit_price: fItem.unit_price,
          total_cost: fItem.unit_price,
          is_price_available: fItem.is_available,
          is_available: fItem.is_available,
        } as any);
      } else {
        existing.quantity += 1;
        if (fItem.is_available && fItem.unit_price !== null) {
          existing.total_cost = Math.round(((existing.total_cost || 0) + fItem.unit_price) * 100) / 100;
        }
      }
    }
  }

  const furnitureSchedule = Array.from(scheduleMap.values()).sort((a, b) => b.quantity - a.quantity);

  // Budget Summary
  const effBudget = Math.round(Number(targetBudget || 0) * 100) / 100;
  const hasTarget = effBudget > 0;
  const remainingBudget = hasTarget ? Math.round(Math.max(0, effBudget - grandTotal) * 100) / 100 : 0;
  const overrunAmount = hasTarget ? Math.round(Math.max(0, grandTotal - effBudget) * 100) / 100 : 0;
  const budgetConsumedPct = hasTarget ? Math.round((grandTotal / effBudget) * 1000) / 10 : 0;
  const isOverBudget = hasTarget ? grandTotal > effBudget : false;

  const budget: BomBudgetSummary = {
    target_budget: effBudget,
    estimated_total: Math.round(grandTotal * 100) / 100,
    construction_total: Math.round(constructionTotal * 100) / 100,
    furniture_total: Math.round(furnitureTotal * 100) / 100,
    remaining_budget: remainingBudget,
    overrun_amount: overrunAmount,
    budget_consumed_pct: budgetConsumedPct,
    is_over_budget: isOverBudget,
    currency: 'INR',
    currency_symbol: '₹',
  };

  const summary: BomSummary = {
    total_area_sqft: Math.round(totalArea * 100) / 100,
    material_total: Math.round(materialTotal * 100) / 100,
    labour_total: Math.round(labourTotal * 100) / 100,
    construction_total: Math.round(constructionTotal * 100) / 100,
    furniture_total: Math.round(furnitureTotal * 100) / 100,
    grand_total: Math.round(grandTotal * 100) / 100,
    rate_per_sqft: ratePerSqft,
  };

  return {
    rooms: roomBoms,
    summary,
    furniture_schedule: furnitureSchedule,
    categories,
    budget,
  };
}
