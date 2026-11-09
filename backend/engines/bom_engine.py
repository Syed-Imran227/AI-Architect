"""
bom_engine.py
=============
Phase 3 / Milestone C — Bill of Materials (BOM) Cost Estimation Engine.

Takes a layout dict (or list of rooms) and produces a detailed room-by-room
cost breakdown in INR, integrating:
  1. Construction materials (RCC frame, masonry, plaster, flooring, ceiling,
     electrical, plumbing for wet rooms, painting, doors, windows).
  2. Construction labour (30% CPWD standard labour ratio on materials).
  3. Placed furniture and architectural fixtures (itemized by placed instance,
     using verified catalog rates without duplicating on rotation/movement).
  4. Editable project budget target tracking (remaining budget, overrun amount,
     percentage consumed, over-budget alert status).
"""

from __future__ import annotations
import re
from typing import Any, Dict, List, Optional
from engines.cost_rates import (
    STRUCTURE_RCC_PER_SQFT, BRICK_WALL_PER_SQFT, PLASTER_PER_SQFT,
    FLOORING_TILE_PER_SQFT, FLOORING_MARBLE_PER_SQFT,
    CEILING_PER_SQFT,
    ELECTRICAL_PER_SQFT, PLUMBING_PER_SQFT, PAINTING_PER_SQFT,
    DOOR_UNIT_COST, WINDOW_UNIT_COST,
    LABOUR_RATIO, CEILING_HEIGHT_FT,
    WET_ROOM_KEYWORDS, PREMIUM_FLOOR_KEYWORDS,
    TIER_MULTIPLIERS,
    FURNITURE_RATES, get_furniture_rate,
)


def _is_wet_room(name: str) -> bool:
    n = name.lower()
    return any(k in n for k in WET_ROOM_KEYWORDS)


def _is_premium_floor(name: str) -> bool:
    n = name.lower()
    return any(k in n for k in PREMIUM_FLOOR_KEYWORDS)


def _resolve_furniture_catalog_id(item: dict) -> str:
    """Resolve the canonical catalog ID for a placed furniture item."""
    cat_id = item.get("catalogId") or item.get("catalog_id") or item.get("assetId")
    if cat_id and isinstance(cat_id, str) and cat_id.strip():
        cleaned = cat_id.strip().lower()
        if cleaned in FURNITURE_RATES:
            return cleaned

    # Fallback to item ID or name
    raw_id = item.get("id") or item.get("name") or ""
    if isinstance(raw_id, str) and raw_id.strip():
        cleaned = raw_id.strip().lower()
        if cleaned in FURNITURE_RATES:
            return cleaned
        # Strip trailing numeric or instance suffixes (e.g., 'sofa_3_seater_1', 'bed_king_copy')
        base_id = re.sub(r'(_\d+|_copy.*|-instance.*)$', '', cleaned)
        if base_id in FURNITURE_RATES:
            return base_id
        for key in FURNITURE_RATES:
            if key in cleaned:
                return key

    return str(cat_id or raw_id or "").strip()


def _room_bom(room: dict, tier: str = "standard") -> dict:
    """Compute the BOM breakdown for a single room dict including construction and placed furniture."""
    name        = room.get("name", "Room")
    width_ft    = float(room.get("width",  0) or 0)
    height_ft   = float(room.get("height", 0) or 0)
    num_doors   = len(room.get("doors",   []) or [])
    num_windows = len(room.get("windows", []) or [])
    furniture_list = room.get("furniture", []) or []

    area_sqft      = width_ft * height_ft
    perimeter_ft   = 2 * (width_ft + height_ft)
    wall_area_sqft = perimeter_ft * CEILING_HEIGHT_FT
    
    tier_mult = TIER_MULTIPLIERS.get(tier, 1.0)

    # ── Material costs ────────────────────────────────────────────────────────
    structure_cost  = area_sqft * STRUCTURE_RCC_PER_SQFT * tier_mult
    wall_cost       = wall_area_sqft * (BRICK_WALL_PER_SQFT + PLASTER_PER_SQFT) * tier_mult
    floor_rate      = FLOORING_MARBLE_PER_SQFT if _is_premium_floor(name) else FLOORING_TILE_PER_SQFT
    flooring_cost   = area_sqft   * floor_rate * tier_mult
    ceiling_cost    = area_sqft   * CEILING_PER_SQFT * tier_mult
    electrical_cost = area_sqft   * ELECTRICAL_PER_SQFT * tier_mult
    plumbing_cost   = (area_sqft   * PLUMBING_PER_SQFT * tier_mult) if _is_wet_room(name) else 0.0
    painting_cost   = area_sqft   * PAINTING_PER_SQFT * tier_mult
    door_cost       = num_doors   * DOOR_UNIT_COST * tier_mult
    window_cost     = num_windows * WINDOW_UNIT_COST * tier_mult

    material_total     = (
        structure_cost + wall_cost + flooring_cost + ceiling_cost
        + electrical_cost + plumbing_cost + painting_cost
        + door_cost + window_cost
    )
    labour_cost        = round(material_total * LABOUR_RATIO, 2)
    construction_total = round(material_total + labour_cost,  2)

    # ── Placed Furniture Costs ────────────────────────────────────────────────
    furniture_items_detail: list[dict] = []
    furniture_total = 0.0

    for item in furniture_list:
        if not isinstance(item, dict):
            continue
        cat_id = _resolve_furniture_catalog_id(item)
        base_rate = get_furniture_rate(cat_id)
        item_id = str(item.get("id") or cat_id or "item")
        item_name = str(item.get("name") or (cat_id.replace("_", " ").title() if cat_id else "Furniture"))

        if base_rate is not None:
            unit_price = round(base_rate * tier_mult, 2)
            furniture_total += unit_price
            furniture_items_detail.append({
                "id": item_id,
                "catalog_id": cat_id,
                "name": item_name,
                "unit_price": unit_price,
                "is_available": True,
            })
        else:
            # Mark unlisted/custom prices as unavailable rather than fabricating an arbitrary number
            furniture_items_detail.append({
                "id": item_id,
                "catalog_id": cat_id,
                "name": item_name,
                "unit_price": None,
                "is_available": False,
            })

    room_total = round(construction_total + furniture_total, 2)

    return {
        "name":           name,
        "area_sqft":      round(area_sqft,      2),
        "wall_area_sqft": round(wall_area_sqft, 2),
        "num_doors":      num_doors,
        "num_windows":    num_windows,
        "furniture_count": len(furniture_items_detail),
        "furniture_items": furniture_items_detail,
        "costs": {
            "structure":          round(structure_cost,  2),
            "wall":               round(wall_cost,       2),
            "flooring":           round(flooring_cost,   2),
            "ceiling":            round(ceiling_cost,    2),
            "electrical":         round(electrical_cost, 2),
            "plumbing":           round(plumbing_cost,   2),
            "painting":           round(painting_cost,   2),
            "doors":              round(door_cost,       2),
            "windows":            round(window_cost,     2),
            "material":           round(material_total,  2),
            "labour":             labour_cost,
            "construction_total": construction_total,
            "furniture":          round(furniture_total, 2),
            "total":              room_total,
        },
    }


def compute_bom(
    layout_or_rooms: dict | list,
    sqft: float = 0.0,
    tier: str = "standard",
    target_budget: float = 0.0
) -> dict:
    """
    Compute a full authoritative BOM across all rooms and floors.

    Args:
        layout_or_rooms: The full {floors: [{rooms: [...]}]} dict, or {rooms: [...]}, or list of room dicts.
        sqft: Optional square footage float.
        tier: Material quality tier ("economy", "standard", "premium").
        target_budget: Optional user-defined target budget in INR.

    Returns:
        Authoritative BOM dict with per-room breakdown, furniture schedule,
        category breakdowns, and budget overrun analytics.
    """
    all_room_boms: list[dict] = []
    inferred_target_budget = target_budget

    if isinstance(layout_or_rooms, dict):
        # Extract target budget from layout if present
        if not inferred_target_budget:
            raw_b = (
                layout_or_rooms.get("budget_target")
                or layout_or_rooms.get("target_budget")
                or layout_or_rooms.get("form", {}).get("budget_target")
            )
            if raw_b:
                try:
                    inferred_target_budget = float(raw_b)
                except (ValueError, TypeError):
                    pass

        floors = layout_or_rooms.get("floors", [])
        if floors:
            for floor in floors:
                for room in floor.get("rooms", []):
                    all_room_boms.append(_room_bom(room, tier))
        elif "rooms" in layout_or_rooms:
            for room in layout_or_rooms.get("rooms", []):
                all_room_boms.append(_room_bom(room, tier))
    elif isinstance(layout_or_rooms, list):
        for room in layout_or_rooms:
            all_room_boms.append(_room_bom(room, tier))

    # ── Summary Calculations ──────────────────────────────────────────────────
    total_area         = sum(r["area_sqft"]                 for r in all_room_boms)
    material_total     = sum(r["costs"]["material"]         for r in all_room_boms)
    labour_total       = sum(r["costs"]["labour"]           for r in all_room_boms)
    construction_total = sum(r["costs"]["construction_total"] for r in all_room_boms)
    furniture_total    = sum(r["costs"]["furniture"]        for r in all_room_boms)
    grand_total        = sum(r["costs"]["total"]            for r in all_room_boms)
    rate_per_sqft      = round(grand_total / total_area, 2) if total_area > 0 else 0.0

    # ── Category-level Breakdowns ─────────────────────────────────────────────
    categories = {
        "structural": round(sum(r["costs"]["structure"] for r in all_room_boms), 2),
        "masonry_and_plaster": round(sum(r["costs"]["wall"] for r in all_room_boms), 2),
        "flooring": round(sum(r["costs"]["flooring"] for r in all_room_boms), 2),
        "ceiling": round(sum(r["costs"]["ceiling"] for r in all_room_boms), 2),
        "electrical": round(sum(r["costs"]["electrical"] for r in all_room_boms), 2),
        "plumbing": round(sum(r["costs"]["plumbing"] for r in all_room_boms), 2),
        "painting": round(sum(r["costs"]["painting"] for r in all_room_boms), 2),
        "doors_and_windows": round(sum(r["costs"]["doors"] + r["costs"]["windows"] for r in all_room_boms), 2),
        "labour": round(labour_total, 2),
        "furniture": round(furniture_total, 2),
    }

    # ── Aggregated Placed Furniture Schedule ──────────────────────────────────
    schedule_map: dict[str, dict] = {}
    for room in all_room_boms:
        for f_item in room.get("furniture_items", []):
            cat_id = f_item.get("catalog_id") or "unspecified"
            unit_price = f_item.get("unit_price")
            is_avail = f_item.get("is_available", False)
            display_name = f_item.get("name") or cat_id

            if cat_id not in schedule_map:
                schedule_map[cat_id] = {
                    "catalog_id": cat_id,
                    "name": display_name,
                    "quantity": 0,
                    "unit_price": unit_price,
                    "total_cost": 0.0 if is_avail else None,
                    "is_price_available": is_avail,
                }
            schedule_map[cat_id]["quantity"] += 1
            if is_avail and unit_price is not None:
                schedule_map[cat_id]["total_cost"] = round(
                    (schedule_map[cat_id]["total_cost"] or 0.0) + unit_price, 2
                )

    furniture_schedule = sorted(schedule_map.values(), key=lambda x: x["quantity"], reverse=True)

    # ── Budget & Overrun Analytics ────────────────────────────────────────────
    eff_budget = round(float(inferred_target_budget or 0.0), 2)
    has_target = eff_budget > 0
    remaining_budget = round(max(0.0, eff_budget - grand_total), 2) if has_target else 0.0
    overrun_amount   = round(max(0.0, grand_total - eff_budget), 2) if has_target else 0.0
    budget_pct       = round((grand_total / eff_budget) * 100.0, 1) if has_target else 0.0
    is_over_budget   = (grand_total > eff_budget) if has_target else False

    budget_summary = {
        "target_budget": eff_budget,
        "estimated_total": round(grand_total, 2),
        "construction_total": round(construction_total, 2),
        "furniture_total": round(furniture_total, 2),
        "remaining_budget": remaining_budget,
        "overrun_amount": overrun_amount,
        "budget_consumed_pct": budget_pct,
        "is_over_budget": is_over_budget,
        "currency": "INR",
        "currency_symbol": "₹",
    }

    return {
        "rooms": all_room_boms,
        "summary": {
            "total_area_sqft":    round(total_area,         2),
            "material_total":     round(material_total,     2),
            "labour_total":       round(labour_total,       2),
            "construction_total": round(construction_total, 2),
            "furniture_total":    round(furniture_total,    2),
            "grand_total":        round(grand_total,        2),
            "rate_per_sqft":      rate_per_sqft,
        },
        "furniture_schedule": furniture_schedule,
        "categories": categories,
        "budget": budget_summary,
    }

