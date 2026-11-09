"""
cost_rates.py
=============
INR material rate constants for the BOM engine (Phase 3).

All rates are per square foot (sqft) or per unit, based on Indian market
estimates (August 2026). These are baseline figures — users should add a
10–15% contingency for actual project budgeting.

Sources:
  - General residential construction: ₹1,800–₹2,500 / sqft (standard finish)
  - Regional market surveys (2026 estimates)
"""

from __future__ import annotations

# ── Structural & Core (per sqft of floor area) ─────────────────────────────
STRUCTURE_RCC_PER_SQFT = 400.0   # ₹/sqft — RCC framework and slab

# ── Wall construction (per sqft of wall face area) ────────────────────────────
BRICK_WALL_PER_SQFT   = 55.0   # ₹/sqft — 9-inch brick masonry
PLASTER_PER_SQFT      = 18.0   # ₹/sqft — both sides (internal + external)

# ── Flooring (per sqft of floor area) ────────────────────────────────────────
FLOORING_TILE_PER_SQFT    = 45.0   # ₹/sqft — standard vitrified tiles
FLOORING_MARBLE_PER_SQFT  = 120.0  # ₹/sqft — marble / granite (premium rooms)

# ── Ceiling (per sqft of floor area) ─────────────────────────────────────────
CEILING_PER_SQFT      = 35.0   # ₹/sqft — POP / gypsum false ceiling

# ── MEP: Electrical & Plumbing (per sqft of floor area) ──────────────────────
ELECTRICAL_PER_SQFT   = 80.0   # ₹/sqft — full wiring + fixtures
PLUMBING_PER_SQFT     = 60.0   # ₹/sqft — applies only to wet rooms (bathroom / kitchen)

# ── Painting (per sqft of floor area) ────────────────────────────────────────
PAINTING_PER_SQFT     = 22.0   # ₹/sqft — 2 coats emulsion

# ── Openings (per unit) ───────────────────────────────────────────────────────
DOOR_UNIT_COST        = 8_000.0   # ₹ per standard interior door
WINDOW_UNIT_COST      = 5_500.0   # ₹ per standard aluminium window

# ── Labour rate ───────────────────────────────────────────────────────────────
LABOUR_RATIO          = 0.30   # 30% of all material costs

# ── Tiers Multiplier ────────────────────────────────────────────────────────
TIER_MULTIPLIERS = {
    "economy": 0.8,
    "standard": 1.0,
    "premium": 1.5,
    "luxury": 2.0,
}

# ── Ceiling height assumed throughout ─────────────────────────────────────────
CEILING_HEIGHT_FT     = 10.0

# ── Wet rooms (rooms that incur plumbing costs) ───────────────────────────────
WET_ROOM_KEYWORDS: tuple[str, ...] = (
    "bathroom", "toilet", "wc", "bath", "kitchen", "wash",
)

# ── Premium-flooring rooms (marble/granite instead of tiles) ─────────────────
PREMIUM_FLOOR_KEYWORDS: tuple[str, ...] = (
    "master bedroom", "living", "dining",
)

# ── Furniture & Fixture Rates (INR per unit, 2026 market baseline) ────────────
# Explicitly maps all 32 assets in the AI Architect furniture catalog.
# Unlisted/custom items default to None (marked as unavailable rather than fabricating arbitrary prices).
FURNITURE_RATES: dict[str, float] = {
    # Living Room
    "sofa_3_seater": 38_000.0,
    "sectional_l_shape": 65_000.0,
    "armchair": 16_000.0,
    "coffee_table": 12_000.0,
    "tv_console": 22_000.0,
    "bookshelf": 18_000.0,

    # Bedroom
    "bed_king": 48_000.0,
    "bed_queen": 36_000.0,
    "wardrobe_3_door": 42_000.0,
    "wardrobe_2_door": 28_000.0,
    "desk_study": 15_000.0,
    "dressing_table": 19_000.0,

    # Kitchen & Dining
    "dining_table_6": 45_000.0,
    "dining_table_4": 28_000.0,
    "kitchen_island": 35_000.0,
    "cooking_range": 26_000.0,
    "refrigerator": 52_000.0,
    "sink_counter": 24_000.0,

    # Bathroom
    "vanity_sink": 14_000.0,
    "toilet_wc": 12_000.0,
    "shower_enclosure": 25_000.0,
    "bathtub": 38_000.0,

    # Outdoor / Terrace
    "patio_lounge": 32_000.0,
    "sunbed_lounger": 14_000.0,
    "bistro_table": 9_000.0,
    "planter_box": 4_500.0,
    "bbq_grill": 22_000.0,

    # Lighting Fixtures
    "chandelier_warm": 18_000.0,
    "downlight_recessed": 1_200.0,
    "wall_sconce": 2_800.0,
    "floor_lamp": 6_500.0,
    "terrace_lantern": 4_200.0,
}


def get_furniture_rate(catalog_id: str | None) -> float | None:
    """
    Retrieve verified baseline unit cost in INR for a furniture catalog asset.
    Returns None if catalog_id is missing or not present in the rate schedule.
    """
    if not catalog_id or not isinstance(catalog_id, str):
        return None
    cleaned_id = catalog_id.strip().lower()
    return FURNITURE_RATES.get(cleaned_id)

