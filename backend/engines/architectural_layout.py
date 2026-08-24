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
    W = int(length)  # length is Depth (Y-axis)
    L = int(width)   # width is Width (X-axis)
    result_floors = []

    # P6: Apply setbacks if the plot is sufficiently large
    front_setback, rear_setback, side_setback = 0.0, 0.0, 0.0
    if L >= 32 and W >= 25:
        front_setback = 9.84
        rear_setback = 6.56
        side_setback = 4.92

    # L gets side, W gets front/rear
    buildable_W = W - front_setback - rear_setback
    buildable_L = L - 2 * side_setback
    
    if buildable_L < MIN_ROOM_DIM * 3 or buildable_W < MIN_ROOM_DIM * 3:
        raise ValueError(f"Buildable envelope {buildable_W}x{buildable_L} is too small to build on.")

    # Global allocation (P2)
    # Rooms stack along the y axis, which the builders drive from buildable_W --
    # this estimate must use the same axis or the allocator hands a floor more
    # rooms than it can physically stack.
    stair_h = min(STAIR_H, max(6, int(buildable_W) // 3))
    stair_y = buildable_W - stair_h
    # The builders shrink front_h down to MIN_ROOM_DIM when the rear zone needs
    # the depth, so the best-case rear depth is what capacity must be based on.
    rear_h = max(0, stair_y - MIN_ROOM_DIM)

    gf_capacity = int(rear_h // MIN_ROOM_DIM) * 2
    # Each floor stacks rooms down two side bays, so it offers 2 * stair_y of
    # stack depth. Capacity must be measured in depth, not in flat MIN_ROOM_DIM
    # slots: a bedroom consumes MIN_BED_H (2x MIN_ROOM_DIM), so slot-counting
    # overestimated an upper floor by 2x and told the ground floor to absorb no
    # overflow while it sat empty (measured: 40x60 3bed/3bath lost a bathroom).
    upper_depth = max(0.0, stair_y) * 2

    def _needed_depth(nb: int, nba: int) -> float:
        return MIN_BED_H * nb + MIN_BATH_H * nba

    bed_num = [0]
    bath_num = [0]
    
    remaining_baths = bathrooms
    remaining_beds = bedrooms

    for floor_idx in range(floors):
        if floor_idx == 0:
            if floors == 1:
                gf_beds = remaining_beds
                gf_baths = remaining_baths
            else:
                # Push items down to the ground floor until what is left
                # genuinely fits in the upper floors' stack depth. Bedrooms
                # belong in the upper private zone, so shed bathrooms first
                # (a ground-floor powder room is the conventional answer).
                max_upper_depth = upper_depth * (floors - 1)
                gf_beds = gf_baths = 0
                need = _needed_depth(remaining_beds, remaining_baths)
                while need > max_upper_depth and gf_baths < remaining_baths:
                    gf_baths += 1
                    need -= MIN_BATH_H
                while need > max_upper_depth and gf_beds < remaining_beds:
                    gf_beds += 1
                    need -= MIN_BED_H

            fl = _build_ground_floor(
                buildable_L, buildable_W, topology, gf_beds, gf_baths,
                balcony, lift, vastu, entry_dir, bed_num, bath_num,
                single_floor=(floors == 1)
            )
            gf_baths_used = sum(1 for r in fl["rooms"] if "bathroom" in r["name"].lower())
            gf_beds_used = sum(1 for r in fl["rooms"] if "bedroom" in r["name"].lower())
            remaining_baths = max(0, remaining_baths - gf_baths_used)
            remaining_beds = max(0, remaining_beds - gf_beds_used)
        else:
            is_top = (floor_idx == floors - 1)
            if is_top:
                # Last chance to honour the request; a residual shortfall
                # becomes an explicit 422 via the invariant check below.
                f_beds, f_baths = remaining_beds, remaining_baths
            else:
                # Fill this floor by depth, bedrooms first.
                f_beds = f_baths = 0
                slack = upper_depth
                while f_beds < remaining_beds and slack >= MIN_BED_H:
                    f_beds += 1
                    slack -= MIN_BED_H
                while f_baths < remaining_baths and slack >= MIN_BATH_H:
                    f_baths += 1
                    slack -= MIN_BATH_H
            f_terrace = terrace if is_top else 0
                
            fl = _build_upper_floor(
                buildable_L, buildable_W, floor_idx + 1, f_beds, f_baths,
                topology, f_terrace, lift, bed_num, bath_num
            )
            f_baths_used = sum(1 for r in fl["rooms"] if "bathroom" in r["name"].lower())
            f_beds_used = sum(1 for r in fl["rooms"] if "bedroom" in r["name"].lower())
            remaining_baths = max(0, remaining_baths - f_baths_used)
            remaining_beds = max(0, remaining_beds - f_beds_used)

        # Apply setback shift
        if side_setback > 0 or front_setback > 0:
            for r in fl["rooms"]:
                # x was reduced by 2*side_setback, so offset by side_setback
                # y was reduced by front_setback+rear_setback, so offset by front_setback
                r["x"] = round(r["x"] + side_setback, 2)
                r["y"] = round(r["y"] + front_setback, 2)
                
        # Emit plot_width/plot_height so the exporters can draw the boundary
        fl["plot_width"] = L
        fl["plot_height"] = W

        result_floors.append(fl)

    layout = {"floors": result_floors}

    # Assert totals matched request
    got_beds = sum(1 for f in layout["floors"] for r in f["rooms"] if "bedroom" in r["name"].lower())
    if got_beds != bedrooms:
        raise ValueError(f"drafter emitted {got_beds} bedrooms, requested {bedrooms}")

    # Bathrooms were never asserted, so a plan that silently dropped every
    # bathroom still returned HTTP 200 (measured: 4bed/3bath/2floor -> 0 baths).
    got_baths = sum(1 for f in layout["floors"] for r in f["rooms"] if "bathroom" in r["name"].lower())
    if got_baths != bathrooms:
        raise ValueError(f"drafter emitted {got_baths} bathrooms, requested {bathrooms}")

    for f in layout["floors"]:
        for r in f["rooms"]:
            if r["width"] < MIN_ROOM_DIM or r["height"] < MIN_ROOM_DIM:
                raise ValueError(f"drafter emitted {r['name']} at {r['width']}x{r['height']}")

    # A room's name is its identity for /regenerate-room and for the frontend
    # room list, so two "Balcony" rooms on one floor make an edit ambiguous --
    # the left-bay filler and the left stair companion can both land on that
    # name. Suffix repeats per floor, skipping any suffix already in use.
    for f in layout["floors"]:
        used: set[str] = set()
        for r in f["rooms"]:
            if r["name"] not in used:
                used.add(r["name"])
                continue
            k = 2
            while f"{r['name']} {k}" in used:
                k += 1
            r["name"] = f"{r['name']} {k}"
            used.add(r["name"])

    place_windows(layout, plot_w=float(L), plot_h=float(W))
    compute_paths(layout)

    layout["circulation_warnings"] = []
    layout["validation_report"] = []
    import itertools
    for floor in layout["floors"]:
        lvl = floor.get("level", "Floor")
        unreachable = floor.get("circulation", {}).get("unreachable", [])
        for u in unreachable:
            layout["circulation_warnings"].append(f"{lvl}: {u} is unreachable.")

        # Validation report checks (R6)
        rs = floor.get("rooms", [])
        names = [r["name"] for r in rs]
        for a, b in itertools.combinations(rs, 2):
            ox = min(a["x"]+a["width"], b["x"]+b["width"]) - max(a["x"], b["x"])
            oy = min(a["y"]+a["height"], b["y"]+b["height"]) - max(a["y"], b["y"])
            if ox > 0.01 and oy > 0.01:
                layout["validation_report"].append({"severity": "error", "room": f"{a['name']}, {b['name']}", "message": f"Rooms overlap by {ox:.1f}x{oy:.1f}ft."})
        
        for r in rs:
            if r["x"] < -0.01 or r["y"] < -0.01 or r["x"] + r["width"] > float(L) + 0.01 or r["y"] + r["height"] > float(W) + 0.01:
                layout["validation_report"].append({"severity": "error", "room": r["name"], "message": f"Room is outside plot envelope ({L}x{W})."})
            if r["width"] < MIN_ROOM_DIM or r["height"] < MIN_ROOM_DIM:
                layout["validation_report"].append({"severity": "warn", "room": r["name"], "message": f"Room dimension below minimum {MIN_ROOM_DIM}ft."})
            if not r.get("doors") and r["name"].lower() not in ["parking", "balcony", "terrace", "open area"]:
                layout["validation_report"].append({"severity": "error", "room": r["name"], "message": "Room has no door."})
        
        for n in set(names):
            if names.count(n) > 1:
                layout["validation_report"].append({"severity": "warn", "room": n, "message": f"Duplicate room name ({names.count(n)} instances)."})

    if not layout["validation_report"]:
        layout["validation_report"].append({"severity": "info", "room": "-", "message": "No issues found."})

    return layout


# ── Bay width calculator ──────────────────────────────────────────────────────

def _bay_widths(L: int):
    """
    Returns (left_w, spine_w, right_w) ensuring:
      - spine is STAIR_W, narrowing only when L cannot spare it
      - left gets ~40% of non-spine space
      - right gets the rest
      - no bay is ever narrower than MIN_ROOM_DIM. The preferred minimums are
        left 10 / right 12, but they degrade to MIN_ROOM_DIM on tight plots:
        holding left at 10 on a 19-ft bay used to leave right at 0.6 ft.
    """
    spine_w = min(STAIR_W, max(MIN_ROOM_DIM, L - 2 * MIN_ROOM_DIM))
    avail   = L - spine_w
    min_l, min_r = (10, 12) if avail >= 22 else (MIN_ROOM_DIM, MIN_ROOM_DIM)
    left_w  = max(min_l, round(avail * 0.40))
    right_w = avail - left_w
    if right_w < min_r:
        right_w = min_r
        left_w  = avail - right_w
    return left_w, spine_w, right_w


# ── Door helper ───────────────────────────────────────────────────────────────

def _door(wall: str, position: float, width: float = DOOR_W) -> dict:
    return {"wall": wall, "position": round(position), "width": width}


# ── Ground Floor Drafter ──────────────────────────────────────────────────────

def _build_ground_floor(
    L: int, W: int, topology: Any,
    beds: int, baths: int, balcony: int,
    lift: int, vastu: bool, entry_dir: str,
    bed_num: list, bath_num: list,
    single_floor: bool = False
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
    
    # R7: use LLM topology if available, fallback otherwise
    llm_left_rooms = topo_left.rooms
    llm_right_rooms = topo_right.rooms
    
    if not llm_left_rooms and not llm_right_rooms:
        if not open_plan:
            right_items.append("Dining Room")
        if kitchen_in_right:
            right_items.append("Kitchen")
        else:
            left_items.append("Kitchen")
            
        if baths > 0:
            right_items.append("Guest Bathroom")
            baths -= 1

        for i in range(beds):
            if i % 2 == 0:
                right_items.append("Bedroom")
                if baths > 0: right_items.append("Bathroom"); baths -= 1
            else:
                left_items.append("Bedroom")
                if baths > 0: left_items.append("Bathroom"); baths -= 1
                
        while baths > 0:
            left_items.append("Bathroom")
            baths -= 1
    else:
        to_exclude = {"parking", "living room", "living / dining", "foyer", "corridor", "staircase"}
        left_items = [r for r in llm_left_rooms if r.lower() not in to_exclude]
        right_items = [r for r in llm_right_rooms if r.lower() not in to_exclude]
        
        llm_beds = sum(1 for r in left_items + right_items if "bedroom" in r.lower())
        llm_baths = sum(1 for r in left_items + right_items if "bathroom" in r.lower())
        
        while llm_beds > beds:
            for it_list in (right_items, left_items):
                for i in range(len(it_list)-1, -1, -1):
                    if "bedroom" in it_list[i].lower():
                        it_list.pop(i)
                        llm_beds -= 1
                        break
                if llm_beds == beds: break

        while llm_baths > baths:
            for it_list in (right_items, left_items):
                for i in range(len(it_list)-1, -1, -1):
                    if "bathroom" in it_list[i].lower():
                        it_list.pop(i)
                        llm_baths -= 1
                        break
                if llm_baths == baths: break
        
        missing_beds = max(0, beds - llm_beds)
        missing_baths = max(0, baths - llm_baths)
        
        for i in range(missing_beds):
            if i % 2 == 0: right_items.append("Bedroom")
            else: left_items.append("Bedroom")
        for i in range(missing_baths):
            if i % 2 == 0: right_items.append("Bathroom")
            else: left_items.append("Bathroom")

    # Shrink front_h to fit rear items if needed
    # On a single-floor plan the side bays have no upper floor to land on, so the
    # stair band there is pure filler ("Landing"/"Utility"). Give that depth to
    # the rooms instead -- reserving it is why a 30x80 ft bungalow could not fit
    # 2 bedrooms. The spine keeps its staircase (roof access) either way.
    bay_bottom = W if single_floor else stair_y
    if single_floor and balcony:
        # The Balcony had its own band; as a rear item it still gets a real slot.
        right_items.append("Balcony")
    max_items = max(len(left_items), len(right_items))
    required_rear_h = max_items * MIN_ROOM_DIM
    front_h = min(16, max(10, round(W * 0.38)))
    if bay_bottom - front_h < required_rear_h:
        front_h = max(MIN_ROOM_DIM, bay_bottom - required_rear_h)

    rear_h = max(0, bay_bottom - front_h)
    # The spine always stops at the staircase, whatever the side bays do.
    spine_rear_h = max(0, stair_y - front_h)

    # Spine (Foyer, Corridor, Staircase)
    topo_spine = topology.topology.spine
    spine_rooms = list(topo_spine.rooms) if topo_spine.rooms else ["Foyer", "Corridor", "Staircase"]
    
    rooms.append({
        "name": spine_rooms[0] if len(spine_rooms) > 0 else "Foyer",
        "x": spine_x, "y": 0, "width": spine_w, "height": front_h,
        "doors": [_door("top", spine_w * 0.5), _door("left", front_h * 0.4), _door("right", front_h * 0.4), _door("bottom", spine_w * 0.3)],
        "furniture": []
    })
    if spine_rear_h >= MIN_ROOM_DIM:
        rooms.append({
            "name": spine_rooms[1] if len(spine_rooms) > 1 else "Corridor",
            "x": spine_x, "y": front_h, "width": spine_w, "height": spine_rear_h,
            "doors": [_door("top", spine_w * 0.3)],
            "furniture": []
        })
    else:
        rooms[-1]["height"] += spine_rear_h
    rooms.append({
        # The staircase fills the spine bay. It must use spine_w, not STAIR_W:
        # _bay_widths narrows the spine below STAIR_W on plots that cannot spare
        # 8 ft, and a hardcoded 8 there punches the stair into the right bay.
        "name": "Staircase",
        "x": spine_x, "y": stair_y, "width": spine_w, "height": stair_h,
        "doors": [_door("top", spine_w * 0.3)],
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
        
        # Sort logic removed — we strictly follow the topological array order (R7).
        # We still drop rooms if they physically cannot fit, dropping from the end.
        while len(items) * MIN_ROOM_DIM > rear_h and len(items) > 0:
            # Drop the first non-bedroom we find starting from the end
            dropped = False
            for i in range(len(items)-1, -1, -1):
                if "bedroom" not in items[i].lower() and "bathroom" not in items[i].lower():
                    items.pop(i)
                    dropped = True
                    break
            if not dropped:
                # If only beds/baths are left, drop a bath
                for i in range(len(items)-1, -1, -1):
                    if "bathroom" in items[i].lower():
                        items.pop(i)
                        dropped = True
                        break
            if not dropped:
                # We have to drop a bed
                items.pop()

        for i, item in enumerate(items):
            remaining = bay_bottom - y_cursor
            if remaining < MIN_ROOM_DIM:
                break
            is_last = (i == len(items) - 1)
            
            pref = MIN_BED_H if "bedroom" in item.lower() else (MIN_BATH_H if "bathroom" in item.lower() else MIN_ROOM_DIM)
            h = max(MIN_ROOM_DIM, min(pref, remaining - MIN_ROOM_DIM * (len(items) - 1 - i)))
            if is_last:
                h = remaining
            
            if "bedroom" in item.lower():
                bed_num[0] += 1
                item_name = f"Bedroom {bed_num[0]}"
            elif "bathroom" in item.lower():
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
            
        if y_cursor < bay_bottom and len(zone_rooms) > 0:
            zone_rooms[-1]["height"] += (bay_bottom - y_cursor)
        elif y_cursor < bay_bottom:
            # Empty rear zone, merge to front
            front_room = next(r for r in rooms if r["x"] == bay_x and r["y"] == 0)
            front_room["height"] += (bay_bottom - front_h)

        return zone_rooms

    rooms.extend(_fill_rear_zone(0, left_w, left_items, True))
    rooms.extend(_fill_rear_zone(right_x, right_w, right_items, False))

    # Stair companions -- only when a stair band was reserved (multi-floor).
    # Single-floor plans gave that depth to the rooms instead, so a "Landing"
    # there would overlap them, and a landing serves no purpose with no floor above.
    if not single_floor:
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
        # Must be spine_w, not STAIR_W -- see the ground-floor staircase note.
        "name": "Staircase",
        "x": spine_x, "y": stair_y, "width": spine_w, "height": stair_h,
        "doors": [_door("top", spine_w * 0.3)],
        "furniture": []
    })

    topo_left  = topology.topology.left_bay
    left_baths_alloc  = min(topo_left.bathrooms_allocated, baths)

    # Split by stack depth, not by count. A bedroom consumes MIN_BED_H and a
    # bathroom MIN_BATH_H, so halving bedrooms then capping each bay's baths at
    # its bedroom count both overfilled one bay and silently discarded the
    # leftover bathrooms (measured: 40x60 3bed/3bath emitted 2 baths).
    # Greedy largest-first into whichever bay has more depth left; the LLM's
    # bathrooms_allocated only breaks ties so its intent still shows through.
    _cap = [float(stair_y), float(stair_y)]
    _beds = [0, 0]
    _baths = [0, 0]
    for _size, _bucket in [(MIN_BED_H, _beds)] * beds + [(MIN_BATH_H, _baths)] * baths:
        if _cap[0] == _cap[1]:
            _i = 0 if (_bucket is _baths and left_baths_alloc > _baths[0]) or _bucket is _beds else 1
        else:
            _i = 0 if _cap[0] > _cap[1] else 1
        _cap[_i] -= _size
        _bucket[_i] += 1

    left_beds, right_beds = _beds
    left_baths, right_baths = _baths

    is_first_floor = (floor_idx == 1)

    def _fill_bay(
        bay_x: int, bay_w: int,
        n_beds: int, n_baths: int,
        is_left: bool,
    ) -> list[dict]:
        bay_rooms = []
        door_wall = "right" if is_left else "left"
        y_cursor  = 0

        topo_bay = topo_left if is_left else topology.topology.right_bay
        llm_rooms = list(topo_bay.rooms)
        
        # Determine items list
        items = []
        if llm_rooms:
            items = list(llm_rooms)
            # Append missing
            llm_beds = sum(1 for r in items if "bedroom" in r.lower())
            llm_baths = sum(1 for r in items if "bathroom" in r.lower())
            
            while llm_beds > n_beds:
                for i in range(len(items)-1, -1, -1):
                    if "bedroom" in items[i].lower():
                        items.pop(i)
                        llm_beds -= 1
                        break

            while llm_baths > n_baths:
                for i in range(len(items)-1, -1, -1):
                    if "bathroom" in items[i].lower():
                        items.pop(i)
                        llm_baths -= 1
                        break

            for i in range(max(0, n_beds - llm_beds)): items.append("Bedroom")
            for i in range(max(0, n_baths - llm_baths)): items.append("Bathroom")
        else:
            for i in range(n_beds):
                items.append("Bedroom")
                if i < n_baths: items.append("Bathroom")
        
        if not items:
            label = "Terrace" if (terrace and not is_left) else ("Balcony" if is_left else "Open Area")
            bay_rooms.append({
                "name": label,
                "x": bay_x, "y": 0, "width": bay_w, "height": stair_y,
                "doors": [_door(door_wall, 4)],
                "furniture": []
            })
        else:
            while len(items) * MIN_ROOM_DIM > stair_y and len(items) > 0:
                dropped = False
                for i in range(len(items)-1, -1, -1):
                    if "bedroom" not in items[i].lower() and "bathroom" not in items[i].lower():
                        items.pop(i)
                        dropped = True
                        break
                if not dropped:
                    for i in range(len(items)-1, -1, -1):
                        if "bathroom" in items[i].lower():
                            items.pop(i)
                            dropped = True
                            break
                if not dropped:
                    items.pop()

            for i, item in enumerate(items):
                remaining = stair_y - y_cursor
                if remaining < MIN_ROOM_DIM:
                    break
                is_last = (i == len(items) - 1)
                
                pref = MIN_BED_H if "bedroom" in item.lower() else (MIN_BATH_H if "bathroom" in item.lower() else MIN_ROOM_DIM)
                h = max(MIN_ROOM_DIM, min(pref, remaining - MIN_ROOM_DIM * (len(items) - 1 - i)))
                if is_last:
                    h = remaining
                
                if "bedroom" in item.lower():
                    bed_num[0] += 1
                    # Ensure Master is named correctly
                    if is_first_floor and is_left and bed_num[0] == 1:
                        item_name = "Master Bedroom"
                    else:
                        item_name = f"Bedroom {bed_num[0]}"
                elif "bathroom" in item.lower():
                    bath_num[0] += 1
                    item_name = f"Bathroom {bath_num[0]}"
                else:
                    item_name = item
                
                bay_rooms.append({
                    "name": item_name,
                    "x": bay_x, "y": y_cursor, "width": bay_w, "height": h,
                    "doors": [_door(door_wall, h * 0.4)],
                    "furniture": []
                })
                y_cursor += h

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
