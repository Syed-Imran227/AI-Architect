"""
architectural_layout.py
=======================
Phase 2 — The Deterministic Drafter

Accepts a TopologyResponse (from inference.py's LLM Architect) and builds
exact, overlap-free room coordinates using a parametric 3-bay grid.

Key geometric guarantees (by construction, not post-hoc fixing):
  1. Zero overlaps — rooms are stacked using a y-cursor per bay; each room
     starts exactly where the previous one ends.
  2. Bathroom adjacency — bathrooms are appended immediately after their
     parent bedroom in the same bay column. The cursor ensures no gap.
  3. Plot boundary — all bounding boxes are clamped to [0,L] x [0,W] at
     allocation time, never after.
  4. Staircase hard-stop — y >= (W - STAIR_H) is reserved for the stair/
     companion zone; the bedroom cursor is clamped to this boundary.

Output format is unchanged so floor_renderer.py, dxf_exporter.py, and the
frontend InteractiveBlueprint.tsx require no changes.
"""

from __future__ import annotations
import math
from typing import Any
from engines.window_placer import place_windows
from engines.circulation import compute_paths

# ── Constants ─────────────────────────────────────────────────────────────────
DOOR_W     = 3    # ft door width (standard 3-ft interior door)
STAIR_W    = 8    # ft staircase width
STAIR_H    = 10   # ft staircase depth (plan view)
MIN_BED_H  = 10   # ft absolute minimum bedroom depth
MIN_BATH_H = 5    # ft absolute minimum bathroom depth
MIN_ROOM_H = 8    # ft generic minimum room depth
MIN_ROOM_DIM = 5.0 # ft absolute minimum any room can be


# ── Default topology fallback (used when LLM fails) ──────────────────────────

def default_topology(bedrooms: int, bathrooms: int) -> Any:
    """Returns a sensible default TopologyResponse when the LLM is unavailable."""
    # Import here to avoid circular imports
    from engines.inference import TopologyResponse, TopologyBody, LeftBayTopology, RightBayTopology, SpineTopology

    left_beds  = math.ceil(bedrooms / 2)
    left_baths  = min(left_beds, bathrooms)

    left_rooms  = ["Master Bedroom"] + [f"Bedroom {i+1}" for i in range(1, left_beds)]
    right_rooms = ["Living Room", "Dining Room", "Kitchen"] + [f"Bedroom {i+1}" for i in range(left_beds, bedrooms)]

    return TopologyResponse(
        topology=TopologyBody(
            left_bay=LeftBayTopology(rooms=left_rooms, bathrooms_allocated=left_baths),
            right_bay=RightBayTopology(rooms=right_rooms, open_plan_living_dining=False, kitchen_position="rear"),
            spine=SpineTopology(rooms=["Foyer", "Corridor", "Staircase"]),
        ),
        design_rationale="Default layout: Master Bedroom SW, Living/Dining/Kitchen in right bay."
    )


# ── Public entry point ────────────────────────────────────────────────────────

def build_layout_from_topology(
    topology: Any,
    length: float, width: float,
    bedrooms: int, bathrooms: int, floors: int,
    balcony: int, terrace: int, lift: int,
    vastu: bool, entry_dir: str,
) -> dict:
    """
    Build a full multi-floor plan from an LLM-generated topology.
    Returns {floors: [{level, rooms}, ...]}.
    """
    L = int(length)
    W = int(width)
    result_floors = []

    # P6: Apply setbacks if the plot is sufficiently large
    front_setback, rear_setback, side_setback = 0.0, 0.0, 0.0
    if L >= 32 and W >= 25:
        front_setback = 9.84
        rear_setback = 6.56
        side_setback = 4.92

    buildable_L = max(15.0, L - front_setback - rear_setback)
    buildable_W = max(15.0, W - 2 * side_setback)

    # Global allocation (P2)
    # If floors > 1, try to skip ground floor for bedrooms.
    if floors == 1:
        gf_beds = bedrooms
        upper_beds_per_floor = 0
    else:
        gf_beds = 0
        upper_beds_per_floor = math.ceil(bedrooms / (floors - 1)) if floors > 1 else 0
    
    bed_num = [0]
    bath_num = [0]
    
    remaining_baths = bathrooms
    remaining_beds = bedrooms

    for floor_idx in range(floors):
        if floor_idx == 0:
            fl = _build_ground_floor(
                buildable_L, buildable_W, topology, gf_beds, remaining_baths,
                balcony, lift, vastu, entry_dir, bed_num, bath_num
            )
            gf_baths_used = sum(1 for r in fl["rooms"] if "bathroom" in r["name"].lower())
            gf_beds_used = sum(1 for r in fl["rooms"] if "bedroom" in r["name"].lower())
            remaining_baths = max(0, remaining_baths - gf_baths_used)
            remaining_beds = max(0, remaining_beds - gf_beds_used)
        else:
            is_top = (floor_idx == floors - 1)
            f_beds = min(remaining_beds, upper_beds_per_floor)
            f_baths = min(remaining_baths, f_beds) if remaining_baths > 0 else 0
            if is_top:
                f_beds = remaining_beds
                f_baths = remaining_baths
                
            fl = _build_upper_floor(
                buildable_L, buildable_W, floor_idx, f_beds, f_baths,
                topology, terrace if is_top else 0, lift, bed_num, bath_num
            )
            f_baths_used = sum(1 for r in fl["rooms"] if "bathroom" in r["name"].lower())
            f_beds_used = sum(1 for r in fl["rooms"] if "bedroom" in r["name"].lower())
            remaining_baths = max(0, remaining_baths - f_baths_used)
            remaining_beds = max(0, remaining_beds - f_beds_used)

        # Apply setback shift
        if side_setback > 0 or rear_setback > 0:
            for r in fl["rooms"]:
                r["x"] = round(r["x"] + side_setback, 2)
                r["y"] = round(r["y"] + rear_setback, 2)
                
        # Emit plot_width/plot_height so the exporters can draw the boundary
        fl["plot_width"] = L
        fl["plot_height"] = W

        result_floors.append(fl)

    layout = {"floors": result_floors}

    # Assert totals matched request
    got_beds = sum(1 for f in layout["floors"] for r in f["rooms"] if "bedroom" in r["name"].lower())
    assert got_beds == bedrooms, f"requested {bedrooms} bedrooms, drafted {got_beds}"

    for f in layout["floors"]:
        for r in f["rooms"]:
            assert r["width"] > 0 and r["height"] >= MIN_ROOM_DIM, \
                f"drafter emitted {r['name']} at {r['width']}x{r['height']}"

    place_windows(layout, plot_w=float(L), plot_h=float(W))
    compute_paths(layout)

    layout["circulation_warnings"] = []
    layout["validation_report"] = []
    for floor in layout["floors"]:
        lvl = floor.get("level", "Floor")
        unreachable = floor.get("circulation", {}).get("unreachable", [])
        for u in unreachable:
            layout["circulation_warnings"].append(f"{lvl}: {u} is unreachable.")

    return layout


# ── Bay width calculator ──────────────────────────────────────────────────────

def _bay_widths(L: int):
    """
    Returns (left_w, spine_w, right_w) ensuring:
      - spine is always STAIR_W
      - left gets ~35% of non-spine space
      - right gets the rest (minimum 12 ft)
    """
    spine_w = STAIR_W
    avail   = L - spine_w
    left_w  = max(10, round(avail * 0.40))
    right_w = avail - left_w
    if right_w < 12:
        left_w  = max(10, avail - 12)
        right_w = avail - left_w
    return left_w, spine_w, right_w


# ── Door helper ───────────────────────────────────────────────────────────────

def _door(wall: str, position: float, width: float = DOOR_W) -> dict:
    return {"wall": wall, "position": round(position), "width": width}


# ── Ground Floor Drafter ──────────────────────────────────────────────────────

def _build_ground_floor(
    L: int, W: int, topology: Any,
    beds: int, baths: int, balcony: int,
    lift: int, vastu: bool, entry_dir: str,
    bed_num: list, bath_num: list
) -> dict:
    rooms = []
    left_w, spine_w, right_w = _bay_widths(L)
    spine_x = left_w
    right_x = spine_x + spine_w

    stair_h = min(STAIR_H, max(6, W // 3))
    stair_y = W - stair_h

    # Honor topology
    topo_right = topology.topology.right_bay
    topo_left = topology.topology.left_bay

    k_pos = topo_right.kitchen_position.lower()
    open_plan = topo_right.open_plan_living_dining
    kitchen_in_right = ("right" in k_pos or "east" in k_pos)

    # Distribute items
    left_items = []
    right_items = []
    
    if not open_plan:
        right_items.append("Dining Room")
    if kitchen_in_right:
        right_items.append("Kitchen")
    else:
        left_items.append("Kitchen")
        
    if baths > 0:
        right_items.append("Guest Bathroom")
        baths -= 1

    # Distribute beds
    for i in range(beds):
        if i % 2 == 0:
            right_items.append("Bedroom")
        else:
            left_items.append("Bedroom")

    # Shrink front_h to fit rear items if needed
    max_items = max(len(left_items), len(right_items))
    required_rear_h = max_items * MIN_ROOM_DIM
    front_h = min(16, max(10, round(W * 0.38)))
    if stair_y - front_h < required_rear_h:
        front_h = max(MIN_ROOM_DIM, stair_y - required_rear_h)
    
    rear_h = max(0, stair_y - front_h)

    # Spine (Foyer, Corridor, Staircase)
    rooms.append({
        "name": "Foyer",
        "x": spine_x, "y": 0, "width": spine_w, "height": front_h,
        "doors": [_door("top", spine_w * 0.5), _door("left", front_h * 0.4), _door("right", front_h * 0.4), _door("bottom", spine_w * 0.3)],
        "furniture": []
    })
    if rear_h >= MIN_ROOM_DIM:
        rooms.append({
            "name": "Corridor",
            "x": spine_x, "y": front_h, "width": spine_w, "height": rear_h,
            "doors": [_door("top", spine_w * 0.3)],
            "furniture": []
        })
    else:
        rooms[-1]["height"] += rear_h
    rooms.append({
        "name": "Staircase",
        "x": spine_x, "y": stair_y, "width": STAIR_W, "height": stair_h,
        "doors": [_door("top", STAIR_W * 0.3)],
        "furniture": []
    })

    # Left Bay Front
    rooms.append({
        "name": "Parking",
        "x": 0, "y": 0, "width": left_w, "height": front_h,
        "doors": [_door("right", front_h * 0.4)],
        "furniture": []
    })
    
    # Right Bay Front
    living_name = "Living / Dining" if open_plan else "Living Room"
    rooms.append({
        "name": living_name,
        "x": right_x, "y": 0, "width": right_w, "height": front_h,
        "doors": [_door("left", front_h * 0.4), _door("bottom", right_w * 0.4)],
        "furniture": []
    })

    def _fill_rear_zone(bay_x, bay_w, items, is_left):
        zone_rooms = []
        y_cursor = front_h
        door_wall = "right" if is_left else "left"
        
        # Priority sort: Bedrooms first if space is tight, else topological
        def _get_order(name):
            topo_rooms = topo_left.rooms if is_left else topo_right.rooms
            for i, r in enumerate(topo_rooms):
                if name.lower() in r.lower():
                    return i
            return 999
            
        items.sort(key=_get_order)
        
        # If we have too many items to fit MIN_ROOM_DIM, we MUST drop non-bedrooms
        while len(items) * MIN_ROOM_DIM > rear_h and len(items) > 0:
            # Drop the first non-bedroom we find starting from the end
            dropped = False
            for i in range(len(items)-1, -1, -1):
                if "Bedroom" not in items[i] and "Bathroom" not in items[i]:
                    items.pop(i)
                    dropped = True
                    break
            if not dropped:
                # If only beds/baths are left, drop a bath
                for i in range(len(items)-1, -1, -1):
                    if "Bathroom" in items[i]:
                        items.pop(i)
                        dropped = True
                        break
            if not dropped:
                # We have to drop a bed (will violate assert, but physically unavoidable)
                items.pop()

        for i, item in enumerate(items):
            remaining = stair_y - y_cursor
            if remaining < MIN_ROOM_DIM:
                break
            is_last = (i == len(items) - 1)
            
            pref = MIN_BED_H if "Bedroom" in item else MIN_ROOM_DIM
            h = max(MIN_ROOM_DIM, min(pref, remaining - MIN_ROOM_DIM * (len(items) - 1 - i)))
            if is_last:
                h = remaining
            
            if "Bedroom" in item:
                bed_num[0] += 1
                item_name = f"Bedroom {bed_num[0]}"
            elif "Bathroom" in item:
                bath_num[0] += 1
                item_name = f"Bathroom {bath_num[0]}"
            else:
                item_name = item

            zone_rooms.append({
                "name": item_name,
                "x": bay_x, "y": y_cursor, "width": bay_w, "height": h,
                "doors": [_door(door_wall, h * 0.3)],
                "furniture": []
            })
            y_cursor += h
            
        if y_cursor < stair_y and len(zone_rooms) > 0:
            zone_rooms[-1]["height"] += (stair_y - y_cursor)
        elif y_cursor < stair_y:
            # Empty rear zone, merge to front
            front_room = next(r for r in rooms if r["x"] == bay_x and r["y"] == 0)
            front_room["height"] += (stair_y - front_h)

        return zone_rooms

    rooms.extend(_fill_rear_zone(0, left_w, left_items, True))
    rooms.extend(_fill_rear_zone(right_x, right_w, right_items, False))

    # Stair companions
    left_companion = "Balcony" if balcony else "Utility"
    rooms.append({
        "name": left_companion,
        "x": 0, "y": stair_y, "width": left_w, "height": stair_h,
        "doors": [_door("right", stair_h * 0.3)],
        "furniture": []
    })
    rooms.append({
        "name": "Landing",
        "x": right_x, "y": stair_y, "width": right_w, "height": stair_h,
        "doors": [_door("left", stair_h * 0.3)],
        "furniture": []
    })

    return {"level": "Ground Floor", "rooms": rooms}

# ── Upper Floor Drafter ───────────────────────────────────────────────────────

def _build_upper_floor(
    L: int, W: int, floor_idx: int,
    beds: int, baths: int,
    topology: Any, terrace: int, lift: int,
    bed_num: list, bath_num: list
) -> dict:
    rooms = []
    level = "Floor 1" if floor_idx == 1 else f"Floor {floor_idx}"

    left_w, spine_w, right_w = _bay_widths(L)
    spine_x = left_w
    right_x = spine_x + spine_w
    stair_h = min(STAIR_H, max(6, W // 3))
    stair_y = W - stair_h

    # Spine
    rooms.append({
        "name": "Corridor",
        "x": spine_x, "y": 0, "width": spine_w, "height": stair_y,
        "doors": [],
        "furniture": []
    })
    rooms.append({
        "name": "Staircase",
        "x": spine_x, "y": stair_y, "width": STAIR_W, "height": stair_h,
        "doors": [_door("top", STAIR_W * 0.3)],
        "furniture": []
    })

    topo_left  = topology.topology.left_bay
    left_baths_alloc  = min(topo_left.bathrooms_allocated, baths)

    left_beds  = max(0, math.ceil(beds / 2))
    right_beds = max(0, beds - left_beds)
    left_baths  = min(left_beds, left_baths_alloc)
    right_baths = min(right_beds, max(0, baths - left_baths))

    is_first_floor = (floor_idx == 1)

    def _fill_bay(
        bay_x: int, bay_w: int,
        n_beds: int, n_baths: int,
        is_left: bool,
    ) -> list[dict]:
        bay_rooms = []
        door_wall = "right" if is_left else "left"
        y_cursor  = 0

        if n_beds == 0:
            label = "Terrace" if (terrace and not is_left) else ("Balcony" if is_left else "Open Area")
            bay_rooms.append({
                "name": label,
                "x": bay_x, "y": 0, "width": bay_w, "height": stair_y,
                "doors": [_door(door_wall, 4)],
                "furniture": []
            })
        else:
            # We must fit n_beds and n_baths.
            # If they don't fit at MIN_ROOM_DIM, we have to drop them to satisfy geometric reality.
            # The test will fail assert got_beds == bedrooms, but physically we cannot stack them.
            # So we will just fit as many as possible.
            total_min = n_beds * MIN_ROOM_DIM + n_baths * MIN_ROOM_DIM
            
            for b in range(n_beds):
                has_bath = (b < n_baths)
                is_last  = (b == n_beds - 1)

                remaining = stair_y - y_cursor
                # Need at least MIN_ROOM_DIM for the bed, and maybe bath
                needed_for_this = MIN_ROOM_DIM + (MIN_ROOM_DIM if has_bath else 0)
                if remaining < needed_for_this and remaining >= MIN_ROOM_DIM:
                    # Drop the bath
                    has_bath = False
                
                if remaining < MIN_ROOM_DIM:
                    break

                bed_num[0] += 1

                if is_last:
                    max_bed_h = remaining if not has_bath else remaining - MIN_ROOM_DIM
                    bath_h = min(7, remaining - MIN_ROOM_DIM) if has_bath else 0
                    bed_h = remaining - bath_h
                else:
                    bath_h = MIN_ROOM_DIM if has_bath else 0
                    bed_h = max(MIN_ROOM_DIM, min(MIN_BED_H, remaining - bath_h - (n_beds - 1 - b)*MIN_ROOM_DIM))

                if y_cursor + bed_h + bath_h > stair_y:
                    # Squeeze
                    bed_h = stair_y - y_cursor - bath_h
                
                if bed_h < MIN_ROOM_DIM:
                    break

                # Master Bedroom naming logic
                if is_first_floor and is_left and bed_num[0] == 1:
                    bed_name = "Master Bedroom"
                else:
                    bed_name = f"Bedroom {bed_num[0]}"

                bay_rooms.append({
                    "name": bed_name,
                    "x": bay_x, "y": y_cursor, "width": bay_w, "height": bed_h,
                    "doors": [_door(door_wall, bed_h * 0.4)],
                    "furniture": []
                })
                y_cursor += bed_h

                if bath_h > 0:
                    bath_num[0] += 1
                    bay_rooms.append({
                        "name": f"Bathroom {bath_num[0]}",
                        "x": bay_x, "y": y_cursor, "width": bay_w, "height": bath_h,
                        "doors": [_door(door_wall, bath_h * 0.3)],
                        "furniture": []
                    })
                    y_cursor += bath_h

            gap = stair_y - y_cursor
            if gap >= MIN_ROOM_DIM:
                bay_rooms.append({
                    "name": "Utility",
                    "x": bay_x, "y": y_cursor, "width": bay_w, "height": gap,
                    "doors": [_door(door_wall, gap * 0.4)],
                    "furniture": []
                })
                y_cursor += gap
            elif gap > 0 and bay_rooms:
                bay_rooms[-1]["height"] += gap
                y_cursor += gap

        companion = "Balcony" if is_left else ("Terrace" if terrace else "Landing")
        bay_rooms.append({
            "name": companion,
            "x": bay_x, "y": stair_y, "width": bay_w, "height": stair_h,
            "doors": [_door(door_wall, stair_h * 0.3)],
            "furniture": []
        })
        return bay_rooms

    rooms.extend(_fill_bay(0, left_w, left_beds, left_baths, True))
    rooms.extend(_fill_bay(right_x, right_w, right_beds, right_baths, False))

    return {"level": level, "rooms": rooms}



# ── Legacy build_layout shim (keeps old callers working) ─────────────────────

def build_layout(
    length: float, width: float, bedrooms: int, bathrooms: int,
    floors: int = 1, balcony: int = 0, terrace: int = 0, lift: int = 0,
    vastu: bool = False, entry_dir: str = "East"
) -> dict:
    """Legacy shim for tests/fallback that don't have an LLM topology yet."""
    from engines.inference import LeftBayTopology, RightBayTopology, SpineTopology, TopologyBody, TopologyResponse

    left_beds  = math.ceil(bedrooms / 2)
    left_baths  = min(left_beds, bathrooms)

    left_rooms = ["Master Bedroom"] + [f"Bedroom {i+2}" for i in range(left_beds - 1)]
    right_rooms = ["Living Room", "Dining Room", "Kitchen"]

    topo = TopologyResponse(
        topology=TopologyBody(
            left_bay=LeftBayTopology(rooms=left_rooms, bathrooms_allocated=left_baths),
            right_bay=RightBayTopology(rooms=right_rooms, open_plan_living_dining=False, kitchen_position="rear"),
            spine=SpineTopology(rooms=["Foyer", "Corridor", "Staircase"]),
        ),
        design_rationale="Shim-generated default topology."
    )

    return build_layout_from_topology(
        topology=topo, length=length, width=width,
        bedrooms=bedrooms, bathrooms=bathrooms, floors=floors,
        balcony=balcony, terrace=terrace, lift=lift,
        vastu=vastu, entry_dir=entry_dir,
    )


# ── Furniture injection (Phase 6 — unchanged from original but validated) ─────

FURNITURE_CATALOG: dict[str, list[tuple]] = {
    # ── Living / Lounge ─────────────────────────────────────────────────────────
    "living": [
        ("3-Seat Sofa",    7, 3),
        ("Coffee Table",   3, 2),
        ("TV Unit",        5, 1),
        ("Armchair",       2.5, 2.5),
        ("Side Table",     1.5, 1.5),
        ("Floor Lamp",     1, 1),
    ],
    # ── Dining Room ──────────────────────────────────────────────────────────────
    "dining": [
        ("Dining Table",   5, 3),
        ("Dining Chair",   1.5, 1.5),
        ("Dining Chair",   1.5, 1.5),
        ("Dining Chair",   1.5, 1.5),
        ("Dining Chair",   1.5, 1.5),
        ("Sideboard",      4, 1.5),
    ],
    # ── Kitchen ──────────────────────────────────────────────────────────────────
    "kitchen": [
        ("Counter Top",    8, 2),
        ("Kitchen Island", 4, 2.5),
        ("Refrigerator",   2.5, 2),
        ("Oven",           2, 2),
        ("Sink",           2, 1.5),
    ],
    # ── Master Bedroom ───────────────────────────────────────────────────────────
    "master bedroom": [
        ("King Bed",        7, 6),
        ("Bedside Table",   1.5, 1.5),
        ("Bedside Table",   1.5, 1.5),
        ("Wardrobe",        6, 2),
        ("Dressing Table",  4, 1.5),
        ("Vanity Mirror",   2, 0.5),
        ("Bench",           4, 1.5),
    ],
    # ── Regular Bedrooms ─────────────────────────────────────────────────────────
    "bedroom": [
        ("Double Bed",     6, 5),
        ("Bedside Table",  1.5, 1.5),
        ("Wardrobe",       5, 2),
        ("Study Desk",     4, 2),
        ("Study Chair",    2, 2),
        ("Bookshelf",      3, 1),
    ],
    # ── Bathrooms ────────────────────────────────────────────────────────────────
    "bathroom": [
        ("WC",             2, 2.5),
        ("Bathtub",        5, 3),
        ("Vanity Sink",    2.5, 1.5),
        ("Shower",         2.5, 2.5),
    ],
    "guest bathroom": [
        ("WC",             2, 2.5),
        ("Pedestal Sink",  2, 1.5),
        ("Shower",         2.5, 2.5),
    ],

    # ── Corridors / Foyer ────────────────────────────────────────────────────────
    "foyer": [
        ("Shoe Rack",      3, 1),
        ("Console Table",  3, 1),
        ("Coat Hanger",    1, 1),
    ],
    "corridor": [
        ("Wall Art",       2, 0.2),
    ],
    # ── Balcony / Terrace ────────────────────────────────────────────────────────
    "balcony": [
        ("Outdoor Chair",  2, 2),
        ("Outdoor Chair",  2, 2),
        ("Outdoor Table",  2, 2),
        ("Plant Pot",      1, 1),
        ("Plant Pot",      1, 1),
    ],
    "terrace": [
        ("Patio Sofa",     4, 2),
        ("Patio Table",    3, 3),
        ("Patio Chair",    2, 2),
        ("Plant Pot",      1, 1),
        ("BBQ Grill",      2, 1.5),
        ("Sun Lounger",    2, 5),
    ],
    # ── Parking / Utility ────────────────────────────────────────────────────────
    "parking": [
        ("Car",            8, 16),
        ("Storage Shelf", 4, 1),
    ],
    "utility": [
        ("Washing Machine", 2, 2),
        ("Dryer",           2, 2),
        ("Shelf Unit",      4, 1),
    ],
    "landing": [
        ("Bookshelf",      3, 1),
        ("Bench",          3, 1.5),
    ],
}

SWING = 3.0   # door swing radius in ft


def inject_furniture(layout: dict) -> dict:
    """
    Place furniture using wall-hugging strategy (architecturally correct):
      - Beds:    against the wall opposite the door, centred.
      - Sofas:   against the back wall, facing toward the room centre.
      - Counters: against the walls (L-shape for kitchen).
      - Tables:  centred in the room with chairs arranged around.
      - WC/Bath: against walls adjacent to plumbing (rear/side).
      - Wardrobes: against the side wall next to the bed.
    Falls back to margin-based row packing for any item that doesn't fit.
    """
    MARGIN = 1.2

    def _door_wall(room: dict) -> str:
        doors = room.get("doors", [])
        return doors[0].get("wall", "right") if doors else "right"

    def _swing_zones(room: dict) -> list[tuple]:
        zones = []
        rw, rh = room["width"], room["height"]
        n = room.get("name", "").lower()
        # Increased clearance for bedrooms and bathrooms
        swing_dist = 5.0 if ("bed" in n or "bath" in n or "toilet" in n or "wc" in n) else 3.0
        
        for door in room.get("doors", []):
            wall = door.get("wall", "")
            pos  = door.get("position", 0)
            if wall == "bottom":  zones.append((pos - 1.5, 0,               pos + swing_dist, swing_dist))
            elif wall == "top":   zones.append((pos - 1.5, rh - swing_dist, pos + swing_dist, rh))
            elif wall == "left":  zones.append((0,         pos - 1.5,       swing_dist,       pos + swing_dist))
            elif wall == "right": zones.append((rw - swing_dist, pos - 1.5, rw,               pos + swing_dist))
        return zones

    def _overlaps(fx, fy, fw, fh, zones, placed):
        for (zx0, zy0, zx1, zy1) in zones:
            if fx < zx1 and fx + fw > zx0 and fy < zy1 and fy + fh > zy0:
                return True
        for p in placed:
            if (fx < p["x"] + p["width"] and fx + fw > p["x"] and
                fy < p["y"] + p["height"] and fy + fh > p["y"]):
                return True
        return False

    def _try_place(fname: str, fx: float, fy: float, fw: float, fh: float, rw: float, rh: float, zones: list, placed: list) -> bool:
        """Return True and append to placed if the position is valid."""
        if fx < MARGIN or fy < MARGIN:
            return False
        if fx + fw + MARGIN > rw or fy + fh + MARGIN > rh:
            return False
        if _overlaps(fx, fy, fw, fh, zones, placed):
            return False
        placed.append({"name": fname, "x": round(fx, 1), "y": round(fy, 1),
                        "width": fw, "height": fh})
        return True

    def _wall_place(fname, fw, fh, rw, rh, dwall, zones, placed) -> bool:
        """Try to hug a wall appropriate for this furniture type."""
        n = fname.lower()
        cx = rw / 2
        cy = rh / 2

        # Compute wall-hugged positions for each cardinal wall
        candidates: list[tuple[float, float]] = []

        # Bed: opposite wall to door, centred horizontally
        if any(k in n for k in ('bed', 'king', 'double', 'single')):
            opp = {"right": "left", "left": "right", "top": "bottom", "bottom": "top"}.get(dwall, "left")
            if opp == "left":    candidates = [(MARGIN,          cy - fh / 2)]
            elif opp == "right": candidates = [(rw - fw - MARGIN, cy - fh / 2)]
            elif opp == "top":   candidates = [(cx - fw / 2,      MARGIN)]
            else:                candidates = [(cx - fw / 2,      rh - fh - MARGIN)]

        # Sofa: back wall (opposite door), centred
        elif any(k in n for k in ('sofa', 'couch')):
            if dwall == "bottom": candidates = [(cx - fw/2, MARGIN)]
            elif dwall == "top":  candidates = [(cx - fw/2, rh - fh - MARGIN)]
            elif dwall == "left": candidates = [(rw - fw - MARGIN, cy - fh/2)]
            else:                 candidates = [(MARGIN, cy - fh/2)]

        # TV unit: wall opposite sofa (same as door wall side)
        elif 'tv' in n:
            if dwall == "bottom": candidates = [(cx - fw/2, rh - fh - MARGIN)]
            elif dwall == "top":  candidates = [(cx - fw/2, MARGIN)]
            elif dwall == "left": candidates = [(MARGIN, cy - fh/2)]
            else:                 candidates = [(rw - fw - MARGIN, cy - fh/2)]

        # Counter/island/sink: back wall or side wall
        elif any(k in n for k in ('counter', 'island', 'sink', 'oven', 'refrigerator', 'fridge')):
            candidates = [
                (MARGIN, rh - fh - MARGIN),          # back wall
                (rw - fw - MARGIN, rh - fh - MARGIN), # right-back corner
                (MARGIN, MARGIN),                      # front wall
                (rw - fw - MARGIN, MARGIN),
            ]

        # WC / toilet: corner of bathroom
        elif any(k in n for k in ('wc', 'toilet')):
            candidates = [
                (MARGIN, MARGIN),
                (rw - fw - MARGIN, MARGIN),
                (MARGIN, rh - fh - MARGIN),
                (rw - fw - MARGIN, rh - fh - MARGIN),
            ]

        # Bathtub: long wall
        elif any(k in n for k in ('bathtub', 'bath tub')):
            if rw >= rh:  # wider room → along bottom or top
                candidates = [(MARGIN, rh - fh - MARGIN), (MARGIN, MARGIN)]
            else:
                candidates = [(rw - fw - MARGIN, MARGIN), (MARGIN, MARGIN)]

        # Shower: corner
        elif 'shower' in n:
            candidates = [
                (rw - fw - MARGIN, rh - fh - MARGIN),
                (MARGIN, rh - fh - MARGIN),
                (rw - fw - MARGIN, MARGIN),
            ]

        # Wardrobe: side wall
        elif any(k in n for k in ('wardrobe', 'cabinet', 'bookshelf', 'shelf')):
            candidates = [
                (rw - fw - MARGIN, MARGIN),
                (MARGIN, MARGIN),
                (rw - fw - MARGIN, rh - fh - MARGIN),
            ]

        # Dining/coffee table: centred
        elif 'table' in n:
            candidates = [(cx - fw/2, cy - fh/2)]

        # Chairs: around dining table (inferred from placed items)
        elif 'chair' in n:
            tbl = next((p for p in placed if 'table' in p.get('name','').lower()), None)
            if tbl:
                tx, ty, tw, th = tbl['x'], tbl['y'], tbl['width'], tbl['height']
                candidates = [
                    (tx + tw/2 - fw/2, ty - fh - 0.5),           # top
                    (tx + tw/2 - fw/2, ty + th + 0.5),            # bottom
                    (tx - fw - 0.5,    ty + th/2 - fh/2),         # left
                    (tx + tw + 0.5,    ty + th/2 - fh/2),         # right
                ]
            else:
                candidates = [(cx - fw/2, cy - fh/2)]

        # Desk: side wall
        elif any(k in n for k in ('desk', 'dressing', 'console', 'vanity', 'sideboard', 'bench', 'shoe rack', 'coat')):
            candidates = [
                (MARGIN, MARGIN),
                (rw - fw - MARGIN, MARGIN),
                (MARGIN, rh - fh - MARGIN),
            ]

        # Car: centred
        elif 'car' in n:
            candidates = [(cx - fw/2, cy - fh/2)]

        # Plant / Floor lamp: corners
        elif any(k in n for k in ('plant', 'pot', 'lamp', 'floor lamp')):
            candidates = [
                (rw - fw - MARGIN, MARGIN),
                (MARGIN, MARGIN),
                (rw - fw - MARGIN, rh - fh - MARGIN),
                (MARGIN, rh - fh - MARGIN),
            ]

        else:
            candidates = [
                (MARGIN, MARGIN),
                (cx - fw/2, MARGIN),
                (rw - fw - MARGIN, MARGIN),
            ]

        for (fx, fy) in candidates:
            fx, fy = round(fx, 1), round(fy, 1)
            if (fx >= MARGIN and fy >= MARGIN and
                    fx + fw + MARGIN <= rw and fy + fh + MARGIN <= rh and
                    not _overlaps(fx, fy, fw, fh, zones, placed)):
                placed.append({"name": fname, "x": fx, "y": fy, "width": fw, "height": fh})
                return True
        return False

    for floor in layout.get("floors", []):
        for room in floor.get("rooms", []):
            name_l = room["name"].lower()
            rw, rh = room["width"], room["height"]
            catalog = []
            for key in sorted(FURNITURE_CATALOG, key=len, reverse=True):
                if key in name_l:
                    catalog = FURNITURE_CATALOG[key]
                    break

            dwall      = _door_wall(room)
            swing_zones = _swing_zones(room)
            placed: list[dict] = []

            for (fname, fw, fh) in catalog:
                # Try architectural wall-hugging placement first
                if _wall_place(fname, fw, fh, rw, rh, dwall, swing_zones, placed):
                    continue
                # Fallback: row-based scan
                x_cur, y_cur, row_h = MARGIN, MARGIN, 0
                for _ in range(8):
                    if x_cur + fw + MARGIN > rw:
                        x_cur  = MARGIN
                        y_cur += row_h + 0.8
                        row_h  = 0
                    if y_cur + fh + MARGIN > rh:
                        break
                    if not _overlaps(x_cur, y_cur, fw, fh, swing_zones, placed):
                        placed.append({"name": fname, "x": round(x_cur, 1), "y": round(y_cur, 1),
                                        "width": fw, "height": fh})
                        row_h  = max(row_h, fh)
                        x_cur += fw + 0.8
                        break
                    x_cur += fw + 0.8

            room["furniture"] = placed

    return layout
