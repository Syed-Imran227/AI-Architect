"""
architectural_layout.py
=======================
Deterministic architectural layout engine for AI Architect.

Python computes ALL room coordinates, corridor spines, and doors.
The LLM is only used to fill furniture inside rooms - it never decides geometry.

Zone model:
  Ground Floor: Public zone (Living, Dining, Kitchen, Guest Bath, Stair, Balcony)
  Upper Floors: Private zone (Bedrooms + attached Bathrooms, central Corridor, Stair)

Adjacency rules encoded:
  Living -> Dining -> Kitchen -> (Guest Bath)
  Corridor -> Bedrooms -> attached Bathrooms (each bedroom directly connects to its bath)

Doors are placed on shared walls at mid-point of shared edge, 3ft wide.
"""

from __future__ import annotations
import math
from typing import Any

# -----------------------------------------------------------------------------
WALL_T     = 1    # 1 ft wall gap between rooms
DOOR_W     = 3    # ft door width
CORRIDOR_W = 4    # ft corridor width
MIN_ROOM_H = 8    # ft absolute minimum room height
STAIR_W    = 8    # ft staircase width
STAIR_H    = 10   # ft staircase depth


def build_layout(
    length: float, width: float,
    bedrooms: int, bathrooms: int, floors: int,
    balcony: int, terrace: int, lift: int,
    vastu: bool, entry_dir: str,
) -> dict:
    """Build full floor plan. Returns {floors: [...]}"""
    L = int(length)
    W = int(width)
    result_floors = []
    remaining_beds  = bedrooms
    remaining_baths = bathrooms
    gf_col_a: int | None = None  # ground-floor column split for structural continuity

    for floor_idx in range(floors):
        if floor_idx == 0:
            fl = _build_ground_floor(L, W, remaining_baths, balcony, lift, vastu, entry_dir)
            # Record ground-floor structural column split for upper-floor alignment (#8)
            gf_col_a = max(12, round(L * 0.55))
            gf_baths = sum(1 for r in fl["rooms"] if "bathroom" in r["name"].lower())
            remaining_baths = max(0, remaining_baths - gf_baths)
        else:
            upper_left = floors - floor_idx
            beds_this  = max(1, math.ceil(remaining_beds / upper_left))
            beds_this  = min(beds_this, remaining_beds)
            baths_this = min(beds_this, remaining_baths)
            is_top     = (floor_idx == floors - 1)
            fl = _build_upper_floor(L, W, floor_idx, beds_this, baths_this,
                                    terrace if is_top else 0, lift)
            # #8: verify upper floor corridor x matches ground-floor column split
            if gf_col_a is not None:
                upper_corr_x = max(12, round(L * 0.55))  # from _build_upper_floor
                if abs(upper_corr_x - gf_col_a) > 4:
                    print(
                        f"[structural] WARNING Floor {floor_idx}: upper corridor x={upper_corr_x} "
                        f"deviates from ground col_a={gf_col_a} by {abs(upper_corr_x-gf_col_a)}ft. "
                        "Load-bearing walls may not align."
                    )
            remaining_beds  -= beds_this
            remaining_baths -= baths_this
        result_floors.append(fl)

    return {"floors": result_floors}


def _build_ground_floor(L, W, remaining_baths, balcony, lift, vastu, entry_dir):
    rooms = []
    
    # 3-Bay Grid Layout for structural integrity
    # Spine is exactly STAIR_W wide
    spine_w = STAIR_W
    left_w = max(10, round(L * 0.35))
    right_w = L - left_w - spine_w
    if right_w < 12:
        left_w = max(10, round(L * 0.3))
        right_w = L - left_w - spine_w
        
    spine_x = left_w
    right_x = spine_x + spine_w
    
    parking_h = 16
    living_h = 16
    
    # --- Front Zone ---
    # Left Front: Parking
    rooms.append({
        "name": "Parking",
        "x": 0, "y": 0, "width": left_w, "height": parking_h,
        "doors": [], "furniture": []
    })
    
    # Center Front: Foyer
    rooms.append({
        "name": "Foyer",
        "x": spine_x, "y": 0, "width": spine_w, "height": parking_h,
        "doors": [
            {"wall": "left", "position": round(parking_h * 0.4), "width": DOOR_W}, # Main Door from Parking
        ],
        "furniture": []
    })
    
    # Right Front: Living Room
    rooms.append({
        "name": "Living Room",
        "x": right_x, "y": 0, "width": right_w, "height": living_h,
        "doors": [
            {"wall": "left", "position": round(living_h * 0.4), "width": DOOR_W} # Door to Foyer
        ],
        "furniture": []
    })
    
    # --- Rear Zone ---
    y_cursor = living_h
    rem_h = W - living_h
    stair_y = W - STAIR_H
    
    # Left Rear: Kitchen & Utility
    kitchen_h = max(10, rem_h - 6)
    util_h = rem_h - kitchen_h
    
    rooms.append({
        "name": "Kitchen",
        "x": 0, "y": y_cursor, "width": left_w, "height": kitchen_h,
        "doors": [{"wall": "right", "position": round(kitchen_h * 0.3), "width": DOOR_W}],
        "furniture": []
    })
    if util_h >= 4:
        rooms.append({
            "name": "Utility / Store",
            "x": 0, "y": y_cursor + kitchen_h, "width": left_w, "height": util_h,
            "doors": [{"wall": "top", "position": 2, "width": DOOR_W}],
            "furniture": []
        })
    else:
        rooms[-1]["height"] += util_h

    # Center Rear: Corridor & Staircase
    if stair_y > y_cursor:
        rooms.append({
            "name": "Corridor",
            "x": spine_x, "y": y_cursor, "width": spine_w, "height": stair_y - y_cursor,
            "doors": [
                {"wall": "top", "position": 2, "width": DOOR_W} # Door to Foyer
            ],
            "furniture": []
        })
    rooms.append({
        "name": "Staircase",
        "x": spine_x, "y": stair_y, "width": STAIR_W, "height": STAIR_H,
        "doors": [{"wall": "top", "position": 2, "width": DOOR_W}],
        "furniture": []
    })
    
    # Right Rear: Dining & Guest Bath
    guest_bath_h = 6 if remaining_baths > 0 else 0
    dining_h = rem_h - guest_bath_h
    
    rooms.append({
        "name": "Dining Room",
        "x": right_x, "y": y_cursor, "width": right_w, "height": dining_h,
        "doors": [
            {"wall": "left", "position": round(dining_h * 0.3), "width": DOOR_W}, # Door to Corridor
            {"wall": "top", "position": round(right_w * 0.5), "width": DOOR_W} # Open to Living
        ],
        "furniture": []
    })
    if guest_bath_h > 0:
        rooms.append({
            "name": "Guest Bathroom",
            "x": right_x, "y": y_cursor + dining_h, "width": right_w, "height": guest_bath_h,
            "doors": [{"wall": "top", "position": round(right_w * 0.2), "width": DOOR_W}],
            "furniture": []
        })
        
    return {"level": "Ground Floor", "rooms": rooms}


def _build_upper_floor(L, W, floor_idx, beds, baths, terrace, lift):
    rooms = []
    level = f"Floor {floor_idx}"
    
    spine_w = STAIR_W
    left_w = max(10, round(L * 0.35))
    right_w = L - left_w - spine_w
    if right_w < 12:
        left_w = max(10, round(L * 0.3))
        right_w = L - left_w - spine_w
        
    spine_x = left_w
    right_x = spine_x + spine_w
    
    stair_y = W - STAIR_H
    
    # Center Spine
    rooms.append({
        "name": "Corridor",
        "x": spine_x, "y": 0, "width": spine_w, "height": stair_y,
        "doors": [
            {"wall": "left", "position": round(stair_y * 0.25), "width": DOOR_W},
            {"wall": "right", "position": round(stair_y * 0.25), "width": DOOR_W},
            {"wall": "left", "position": round(stair_y * 0.75), "width": DOOR_W},
            {"wall": "right", "position": round(stair_y * 0.75), "width": DOOR_W}
        ],
        "furniture": []
    })
    rooms.append({
        "name": "Staircase",
        "x": spine_x, "y": stair_y, "width": STAIR_W, "height": STAIR_H,
        "doors": [{"wall": "top", "position": 2, "width": DOOR_W}],
        "furniture": []
    })
    
    # Distribute beds
    left_beds  = math.ceil(beds / 2)
    right_beds = beds - left_beds
    left_baths  = min(left_beds, baths)
    right_baths = min(right_beds, max(0, baths - left_baths))
    
    bed_counter = [0]
    
    def fill_bay(bay_x, bay_w, n_beds, n_baths, is_master, is_left):
        bay_rooms = []
        door_wall = "right" if is_left else "left"

        if n_beds == 0:
            bay_rooms.append({
                "name": "Terrace" if (terrace and not is_left) else "Open Area",
                "x": bay_x, "y": 0, "width": bay_w, "height": W,
                "doors": [{"wall": door_wall, "position": 4, "width": DOOR_W}],
                "furniture": []
            })
            return bay_rooms
            
        slot_h = stair_y // n_beds
        y = 0
        for b in range(n_beds):
            bed_counter[0] += 1
            has_bath = b < n_baths
            is_last = b == n_beds - 1
            
            rem_h = stair_y - y
            bed_slot = rem_h if is_last else slot_h
            if is_last and n_beds == 1 and not is_master:
                bed_slot = min(bed_slot, 16) # cap solitary bed
            
            if has_bath:
                bath_h = min(8, max(4, bed_slot - 12)) # Aim for 12ft bed, give rest to bath up to 8ft
                if bed_slot - bath_h < MIN_ROOM_H:
                    bath_h = 0
                bed_h = bed_slot - bath_h
            else:
                bath_h = 0
                bed_h = bed_slot
                
            name = "Master Bedroom" if (is_master and b==0 and floor_idx==1) else f"Bedroom {bed_counter[0]}"
            
            bay_rooms.append({
                "name": name,
                "x": bay_x, "y": y, "width": bay_w, "height": bed_h,
                "doors": [{"wall": door_wall, "position": round(bed_h * 0.4), "width": DOOR_W}],
                "furniture": []
            })
            y += bed_h
            
            if bath_h > 0:
                bay_rooms.append({
                    "name": f"Bathroom {bed_counter[0]}",
                    "x": bay_x, "y": y, "width": bay_w, "height": bath_h,
                    "doors": [{"wall": door_wall, "position": round(bath_h * 0.3), "width": DOOR_W}],
                    "furniture": []
                })
                y += bath_h
                
        # Fill gap before staircase zone
        if y < stair_y:
            bay_rooms.append({
                "name": "Terrace" if (terrace and not is_left) else "Landing",
                "x": bay_x, "y": y, "width": bay_w, "height": stair_y - y,
                "doors": [{"wall": door_wall, "position": 2, "width": DOOR_W}],
                "furniture": []
            })
            
        # Add open space alongside stairs
        bay_rooms.append({
            "name": "Balcony" if is_left else ("Terrace" if terrace else "Landing"),
            "x": bay_x, "y": stair_y, "width": bay_w, "height": STAIR_H,
            "doors": [{"wall": door_wall, "position": 2, "width": DOOR_W} if not is_left else {"wall": "top", "position": 2, "width": DOOR_W}],
            "furniture": []
        })
        
        return bay_rooms

    rooms += fill_bay(0, left_w, left_beds, left_baths, True, True)
    rooms += fill_bay(right_x, right_w, right_beds, right_baths, False, False)
    
    return {"level": level, "rooms": rooms}



# -----------------------------------------------------------------------------
# Deterministic furniture injection (no LLM)
# -----------------------------------------------------------------------------

FURNITURE_CATALOG: dict[str, list[tuple]] = {
    "living":        [("Sofa", 7, 3), ("Coffee Table", 4, 2), ("TV Unit", 5, 1), ("Armchair", 3, 3)],
    "dining":        [("Dining Table", 5, 3), ("Dining Chair", 2, 2)],
    "kitchen":       [("Kitchen Counter", 8, 2), ("Kitchen Island", 4, 2), ("Refrigerator", 2, 2)],
    "master bedroom":[("Double Bed", 7, 5), ("Wardrobe", 5, 2), ("Dressing Table", 4, 2)],
    "bedroom":       [("Single Bed", 6, 4), ("Wardrobe", 4, 2), ("Study Desk", 4, 2)],
    "bathroom":      [("Toilet", 3, 2), ("Bathtub", 4, 3), ("Sink", 2, 1)],
    "guest bathroom":[("Toilet", 3, 2), ("Sink", 2, 1)],
    "balcony":       [("Garden Chair", 2, 2), ("Plant Pot", 1, 1)],
    "terrace":       [("Patio Chair", 2, 2), ("Patio Table", 2, 2)],
}


def inject_furniture(layout: dict) -> dict:
    """Place furniture inside each room with 1.5ft wall margin.
    Respects a 3x3 ft door-swing exclusion zone so furniture doesn't block doors.
    """
    MARGIN = 1.5
    SWING  = 3.0  # door swing radius in ft

    def _swing_zones(room: dict) -> list[tuple[float, float, float, float]]:
        """Return list of (x0,y0,x1,y1) exclusion boxes in room-local coords."""
        zones = []
        rw, rh = room["width"], room["height"]
        for door in room.get("doors", []):
            wall = door.get("wall", "")
            pos  = door.get("position", 0)
            if wall == "bottom":
                zones.append((pos, 0, pos + SWING, SWING))
            elif wall == "top":
                zones.append((pos, rh - SWING, pos + SWING, rh))
            elif wall == "left":
                zones.append((0, pos, SWING, pos + SWING))
            elif wall == "right":
                zones.append((rw - SWING, pos, rw, pos + SWING))
        return zones

    def _overlaps_zone(fx: float, fy: float, fw: float, fh: float,
                       zones: list) -> bool:
        for (zx0, zy0, zx1, zy1) in zones:
            if fx < zx1 and fx + fw > zx0 and fy < zy1 and fy + fh > zy0:
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

            swing_zones = _swing_zones(room)
            placed = []
            x_cur, y_cur = MARGIN, MARGIN
            for (fname, fw, fh) in catalog:
                if x_cur + fw + MARGIN > rw:
                    x_cur = MARGIN
                    y_cur += fh + 1.0
                if y_cur + fh + MARGIN > rh:
                    break
                # Skip position if it overlaps a door-swing exclusion zone
                if _overlaps_zone(x_cur, y_cur, fw, fh, swing_zones):
                    x_cur += fw + 1.0  # advance and try next slot
                    if x_cur + fw + MARGIN > rw:
                        x_cur = MARGIN
                        y_cur += fh + 1.0
                    if y_cur + fh + MARGIN > rh:
                        break
                    if _overlaps_zone(x_cur, y_cur, fw, fh, swing_zones):
                        continue  # give up on this item
                placed.append({"name": fname, "x": round(x_cur, 1), "y": round(y_cur, 1),
                                "width": fw, "height": fh})
                x_cur += fw + 1.0
            room["furniture"] = placed
    return layout
