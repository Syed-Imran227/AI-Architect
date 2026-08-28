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
MIN_BED_H  = 8.5  # ft absolute minimum bedroom depth (realistic minimum for tight spaces)
MIN_BATH_H = 5    # ft absolute minimum bathroom depth
MIN_ROOM_H = 7    # ft generic minimum room depth
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
    duplex: bool = False,
) -> dict:
    """
    Build a full multi-floor plan from an LLM-generated topology.
    Returns {floors: [{level, rooms}, ...]}.
    """
    W = int(length)  # length is Depth (Y-axis)
    L = int(width)   # width is Width (X-axis)
    result_floors = []

    # Apply setbacks if the plot is sufficiently large
    front_setback, rear_setback, side_setback = 0.0, 0.0, 0.0
    if L >= 32 and W >= 25:
        front_setback = 9.84
        rear_setback = 6.56
        side_setback = 4.92

    buildable_W = W - front_setback - rear_setback
    buildable_L = L - 2 * side_setback

    if buildable_L < MIN_ROOM_DIM * 3 or buildable_W < MIN_ROOM_DIM * 3:
        # Setbacks made the plot unbuildable — retry without setbacks
        print(f"[drafter] Setbacks produce {buildable_W:.1f}x{buildable_L:.1f} ft — too small. Retrying without setbacks.")
        front_setback = rear_setback = side_setback = 0.0
        buildable_W = W
        buildable_L = L
        if buildable_L < MIN_ROOM_DIM * 3 or buildable_W < MIN_ROOM_DIM * 3:
            raise ValueError(f"Plot {W}x{L} ft is too small to build on (minimum ~{int(MIN_ROOM_DIM * 3)}x{int(MIN_ROOM_DIM * 3)} ft required).")

    remaining_baths = bathrooms
    remaining_beds  = bedrooms

    for floor_idx in range(floors):
        if floor_idx == 0:
            fl = _build_ground_floor(
                int(buildable_L), int(buildable_W), topology,
                remaining_baths, balcony, lift, vastu, entry_dir, duplex
            )
            gf_baths = sum(1 for r in fl["rooms"] if "bathroom" in r["name"].lower())
            gf_beds  = sum(1 for r in fl["rooms"] if "bedroom"  in r["name"].lower())
            remaining_baths = max(0, remaining_baths - gf_baths)
            remaining_beds  = max(0, remaining_beds  - gf_beds)
        else:
            is_top      = (floor_idx == floors - 1)
            upper_beds  = remaining_beds   # only bedrooms not yet placed
            upper_baths = remaining_baths
            fl = _build_upper_floor(
                int(buildable_L), int(buildable_W), floor_idx, upper_beds, upper_baths,
                topology, terrace if is_top else 0, lift
            )
            remaining_baths = 0
            remaining_beds  = 0


        # Apply setback shift
        if side_setback > 0 or front_setback > 0:
            for r in fl["rooms"]:
                r["x"] = round(r["x"] + side_setback, 2)
                r["y"] = round(r["y"] + front_setback, 2)
                
        # Emit plot_width/plot_height so the exporters can draw the boundary
        fl["plot_width"] = L
        fl["plot_height"] = W
        result_floors.append(fl)

    layout = {"floors": result_floors}

    # Rename duplicates across the floor so they have unique identities
    for f in layout["floors"]:
        used = set()
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
            if not r.get("doors") and r["name"].lower() not in ["parking", "balcony", "terrace", "open area", "corridor"]:
                layout["validation_report"].append({"severity": "error", "room": r["name"], "message": "Room has no door."})
        
        for n in set(names):
            if names.count(n) > 1:
                layout["validation_report"].append({"severity": "warn", "room": n, "message": f"Duplicate room name ({names.count(n)} instances)."})

    if not layout["validation_report"]:
        layout["validation_report"].append({"severity": "info", "room": "-", "message": "No issues found."})

    return layout



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


# ΓöÇΓöÇ Door helper ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

def _door(wall: str, position: float, width: float = DOOR_W) -> dict:
    return {"wall": wall, "position": round(position), "width": width}


# ΓöÇΓöÇ Ground Floor Drafter ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

def _build_ground_floor(
    L: int, W: int, topology: Any,
    remaining_baths: int, balcony: int,
    lift: int, vastu: bool, entry_dir: str,
    duplex: bool
) -> dict:
    """
    Ground Floor 3-bay layout with dynamic packing based on LLM topology.

    Guarantees:
      - Living Room / Dining Room / Kitchen are ALWAYS in the right bay.
      - Bathrooms are injected immediately after each bedroom in both bays,
        using the bathrooms_allocated count from the topology (same mechanic
        as _build_upper_floor / _fill_bay).
    """
    rooms = []
    left_w, spine_w, right_w = _bay_widths(L)
    spine_x = left_w
    right_x = spine_x + spine_w

    stair_h = min(STAIR_H, max(6, W // 3))
    stair_y = W - stair_h
    front_h = min(16, max(10, round(W * 0.38)))
    if stair_y <= front_h:
        front_h = max(8, stair_y - 4)

    # ── Topology Extraction ──────────────────────────────────────────────────
    left_rooms  = list(topology.topology.left_bay.rooms)
    right_rooms = list(topology.topology.right_bay.rooms)
    spine_rooms = list(topology.topology.spine.rooms)

    # ── ARCHITECTURAL ZONE RULE ──────────────────────────────────────────────
    # DUPLEX:     Ground floor = PUBLIC zone (zero bedrooms, zero bathrooms).
    #             All bedrooms belong on the upper floor (private zone).
    #             Left bay gets Parking + Utility instead of bedrooms.
    # SINGLE-FLOOR: Ground floor has all bedrooms (no upper floor).
    BEDROOM_NAMES = {"Master Bedroom", "Bedroom", "Bedroom 2", "Bedroom 3", "Bedroom 4"}
    is_bedroom = lambda r: "bedroom" in r.lower()

    if duplex:
        # Strip ALL bedrooms from both bays — they go upstairs
        left_rooms  = [r for r in left_rooms  if not is_bedroom(r)]
        right_rooms = [r for r in right_rooms if not is_bedroom(r)]
        # Left bay public-zone rooms for ground floor
        has_parking = "Parking" in left_rooms
        if not left_rooms:
            left_rooms = ["Parking", "Utility"] if not has_parking else ["Parking", "Utility"]
        elif "Utility" not in left_rooms and "Study" not in left_rooms:
            left_rooms.append("Utility")
        left_baths_alloc = 0   # no bathrooms on duplex ground floor
    else:
        left_baths_alloc = min(topology.topology.left_bay.bathrooms_allocated, remaining_baths)

    # ── GUARDRAIL: Living/Dining/Kitchen MUST occupy the right bay ───────────
    LIVING_SPACES = {"Living Room", "Dining Room", "Kitchen"}
    if "Living Room" not in right_rooms:
        left_rooms  = [r for r in left_rooms  if r not in LIVING_SPACES]
        right_rooms = [r for r in right_rooms if r not in LIVING_SPACES]
        right_rooms = ["Living Room", "Dining Room", "Kitchen"] + [r for r in right_rooms if not is_bedroom(r)]

    # Strip any stray bedrooms from right bay on duplex (living space only)
    if duplex:
        right_rooms = [r for r in right_rooms if not is_bedroom(r)]

    # ── GUARDRAIL: pin anchor rooms to front of each bay ─────────────────────
    if "Parking" in left_rooms:
        left_rooms.remove("Parking")
        left_rooms.insert(0, "Parking")
    if "Foyer" in spine_rooms:
        spine_rooms.remove("Foyer")
        spine_rooms.insert(0, "Foyer")
    if "Living Room" in right_rooms:
        right_rooms.remove("Living Room")
        right_rooms.insert(0, "Living Room")


    bath_num = [0]  # shared mutable counter so bathrooms are numbered 1,2,3… globally

    def _pack_bay(bay_x: int, bay_w: int, room_names: list[str], is_left: bool, n_baths: int) -> list[dict]:
        """Pack a bay column with rooms + inline bathrooms after each bedroom."""
        packed = []
        door_wall = "right" if is_left else "left"
        y_cursor  = 0
        baths_left = n_baths

        n_beds = sum(1 for r in room_names if "bedroom" in r.lower())
        # Total vertical slots to budget: rooms + bathrooms
        total_slots = len(room_names) + n_baths

        for idx, r_name in enumerate(room_names):
            is_anchor  = r_name in ("Parking", "Living Room") and idx == 0
            remaining_y = stair_y - y_cursor
            remaining_slots = (len(room_names) - idx) + baths_left

            if remaining_y < 4:
                break

            if is_anchor:
                h = front_h
            else:
                h = max(MIN_ROOM_H, remaining_y // max(1, remaining_slots))

            h = min(h, remaining_y)

            # Assign door
            if r_name == "Parking":
                doors = [_door(door_wall, h * 0.4)]
            elif r_name == "Living Room":
                doors = [_door("left", h * 0.4), _door("bottom", bay_w * 0.4)]
            else:
                doors = [_door(door_wall, h * 0.3)]

            packed.append({
                "name": r_name,
                "x": bay_x, "y": y_cursor, "width": bay_w, "height": h,
                "doors": doors, "furniture": []
            })
            y_cursor += h

            # Inject one bathroom immediately after this bedroom
            if "bedroom" in r_name.lower() and baths_left > 0:
                bath_remaining = stair_y - y_cursor
                bath_h = max(MIN_BATH_H, min(7, bath_remaining - MIN_BED_H * max(0, n_beds - idx - 1)))
                bath_h = min(bath_h, bath_remaining)
                if bath_h >= MIN_BATH_H:
                    bath_num[0] += 1
                    baths_left  -= 1
                    packed.append({
                        "name": f"Bathroom {bath_num[0]}",
                        "x": bay_x, "y": y_cursor, "width": bay_w, "height": bath_h,
                        "doors": [_door(door_wall, bath_h * 0.3)], "furniture": []
                    })
                    y_cursor += bath_h

        return packed

    # ── Pack left bay ────────────────────────────────────────────────────────
    left_result = _pack_bay(0, left_w, left_rooms, True, left_baths_alloc)
    rooms.extend(left_result)

    left_baths_placed = sum(1 for r in left_result if "bathroom" in r["name"].lower())
    right_baths_alloc = max(0, remaining_baths - left_baths_placed)

    # ── Left bay companion (Balcony / Utility at rear) ───────────────────────
    left_companion = "Balcony" if balcony else "Utility"
    rooms.append({
        "name": left_companion,
        "x": 0, "y": stair_y, "width": left_w, "height": stair_h,
        "doors": [_door("right", stair_h * 0.3)], "furniture": []
    })

    # ── Pack right bay ───────────────────────────────────────────────────────
    rooms.extend(_pack_bay(right_x, right_w, right_rooms, False, right_baths_alloc))

    # ── Right bay companion (Landing at rear) ────────────────────────────────
    rooms.append({
        "name": "Landing",
        "x": right_x, "y": stair_y, "width": right_w, "height": stair_h,
        "doors": [_door("left", stair_h * 0.3)], "furniture": []
    })

    # ── Spine: Foyer ─────────────────────────────────────────────────────────
    foyer_h = front_h
    rooms.append({
        "name": "Foyer",
        "x": spine_x, "y": 0, "width": spine_w, "height": foyer_h,
        "doors": [
            _door("top",    spine_w * 0.5),
            _door("left",   foyer_h * 0.4),
            _door("right",  foyer_h * 0.4),
            _door("bottom", spine_w * 0.3),
        ],
        "furniture": []
    })

    # ── Spine: Corridor (only if meaningful depth remains) ───────────────────
    corr_h = max(0, stair_y - foyer_h)
    if corr_h >= 4:
        rooms.append({
            "name": "Corridor",
            "x": spine_x, "y": foyer_h, "width": spine_w, "height": corr_h,
            "doors": [_door("top", spine_w * 0.3)], "furniture": []
        })

    # ── Spine rear: Staircase (duplex) or Store Room (single floor) ──────────
    if duplex:
        rooms.append({
            "name": "Staircase",
            "x": spine_x, "y": stair_y, "width": STAIR_W, "height": stair_h,
            "doors": [_door("top", STAIR_W * 0.3)], "furniture": []
        })
    else:
        rooms.append({
            "name": "Store Room",
            "x": spine_x, "y": stair_y, "width": spine_w, "height": stair_h,
            "doors": [_door("top", spine_w * 0.3)], "furniture": []
        })

    return {"level": "Ground Floor", "rooms": rooms}



# ΓöÇΓöÇ Upper Floor Drafter ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

def _build_upper_floor(
    L: int, W: int, floor_idx: int,
    beds: int, baths: int,
    topology: Any, terrace: int, lift: int,
) -> dict:
    """
    Upper Floor 3-bay layout using topology zoning.

    OVERLAP GUARANTEE: Each bay uses a y-cursor. Every room starts at y_cursor
    and advances cursor by room height. Cursor is clamped at stair_y.
    Bathrooms are placed immediately after their bedroom ΓÇö no gap, no reorder.
    """
    rooms = []
    level = "Floor 1" if floor_idx == 1 else f"Floor {floor_idx}"

    left_w, spine_w, right_w = _bay_widths(L)
    spine_x = left_w
    right_x = spine_x + spine_w
    stair_h = min(STAIR_H, max(6, W // 3))   # adaptive on tiny plots
    stair_y = W - stair_h

    # ΓöÇΓöÇ SPINE ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    rooms.append({
        "name": "Corridor",
        "x": spine_x, "y": 0, "width": spine_w, "height": stair_y,
        "doors": [], # Adjacent rooms (Bedrooms, Bathrooms, Utility) already generate doors leading into the corridor
        "furniture": []
    })
    rooms.append({
        "name": "Staircase",
        "x": spine_x, "y": stair_y, "width": STAIR_W, "height": stair_h,
        "doors": [_door("top", STAIR_W * 0.3)],
        "furniture": []
    })

    # ΓöÇΓöÇ Distribute beds and baths across bays using topology ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    topo_left  = topology.topology.left_bay

    left_baths_alloc  = min(topo_left.bathrooms_allocated,  baths)

    # Count bedroom-type rooms in each bay from topology
    def _count_beds(bay_rooms: list[str]) -> int:
        return sum(1 for r in bay_rooms if "bedroom" in r.lower())

    left_beds  = max(0, math.ceil(beds / 2))
    right_beds = max(0, beds - left_beds)
    left_baths  = min(left_beds, left_baths_alloc)
    right_baths = min(right_beds, max(0, baths - left_baths))

    # Shared bedroom counter (1-based, incremented as beds are placed)
    bed_num   = [0]
    bath_num  = [0]
    is_first_floor = (floor_idx == 1)

    def _fill_bay(
        bay_x: int, bay_w: int,
        n_beds: int, n_baths: int,
        is_left: bool,
    ) -> list[dict]:
        """
        Fill a bay column with (bedroom + optional bathroom) units stacked top-to-bottom.
        Returns list of room dicts.
        OVERLAP GUARANTEE: y_cursor advances strictly by each room's exact height.
        """
        bay_rooms = []
        door_wall = "right" if is_left else "left"
        y_cursor  = 0

        if n_beds == 0:
            # Empty bay: open terrace/balcony
            label = "Terrace" if (terrace and not is_left) else ("Balcony" if is_left else "Open Area")
            bay_rooms.append({
                "name": label,
                "x": bay_x, "y": 0, "width": bay_w, "height": stair_y,
                "doors": [_door(door_wall, 4)],
                "furniture": []
            })
        else:
            total_min = n_beds * MIN_BED_H + n_baths * MIN_BATH_H
            slack = max(0, stair_y - total_min)
            bed_bonus = slack // n_beds if n_beds else 0

            for b in range(n_beds):
                bed_num[0] += 1
                has_bath = (b < n_baths)
                is_last  = (b == n_beds - 1)

                remaining = stair_y - y_cursor
                if remaining < MIN_BED_H:
                    break

                # Absolute hard cap on bedroom depth to prevent 25ft long halls
                ABSOLUTE_MAX_BED_H = 15

                # Distribute space fairly, but enforce absolute max
                bed_h = MIN_BED_H + bed_bonus
                if bed_h > ABSOLUTE_MAX_BED_H:
                    bed_h = ABSOLUTE_MAX_BED_H
                
                bath_h = min(7, MIN_BATH_H + 1) if has_bath else 0
                
                # If this is the last bedroom, it can claim some remaining space up to max
                if is_last and remaining > (bed_h + bath_h):
                    extra = remaining - (bed_h + bath_h)
                    if bed_h + extra <= ABSOLUTE_MAX_BED_H:
                        bed_h += extra

                # Safety clamp against boundary
                if y_cursor + bed_h + bath_h > stair_y:
                    diff = (y_cursor + bed_h + bath_h) - stair_y
                    bed_h -= diff
                    if bed_h < MIN_BED_H and has_bath:
                        bath_h = 0
                        bed_h = min(stair_y - y_cursor, ABSOLUTE_MAX_BED_H)
                
                if bed_h < 6:
                    break

                # Name: Master Bedroom for first bed on Floor 1 left bay
                if is_first_floor and is_left and b == 0:
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

                if bath_h > 0 and y_cursor + bath_h <= stair_y:
                    bath_num[0] += 1
                    bay_rooms.append({
                        "name": f"Bathroom {bath_num[0]}",
                        "x": bay_x, "y": y_cursor, "width": bay_w, "height": bath_h,
                        "doors": [_door(door_wall, bath_h * 0.3)],
                        "furniture": []
                    })
                    y_cursor += bath_h

            # Gap fill: remaining space above stair_y becomes Family Lounge
            gap = stair_y - y_cursor
            if gap >= 7:
                label = "Family Lounge" if not is_left else "Study"
                bay_rooms.append({
                    "name": label,
                    "x": bay_x, "y": y_cursor, "width": bay_w, "height": gap,
                    "doors": [_door(door_wall, gap * 0.4)],
                    "furniture": []
                })
            elif gap > 0:
                 # Small gap becomes Walk-in Closet
                bay_rooms.append({
                    "name": "Walk-in Closet",
                    "x": bay_x, "y": y_cursor, "width": bay_w, "height": gap,
                    "doors": [_door(door_wall, gap * 0.4)],
                    "furniture": []
                })

        # Stair companion zone (always stair_h deep at the bottom)
        companion = "Balcony" if is_left else ("Terrace" if terrace else "Landing")
        bay_rooms.append({
            "name": companion,
            "x": bay_x, "y": stair_y, "width": bay_w, "height": stair_h,
            "doors": [_door(door_wall, stair_h * 0.3)],
            "furniture": []
        })

        return bay_rooms

    rooms += _fill_bay(0,       left_w,  left_beds,  left_baths,  True)
    rooms += _fill_bay(right_x, right_w, right_beds, right_baths, False)

    return {"level": level, "rooms": rooms}


# ΓöÇΓöÇ Legacy build_layout shim (keeps old callers working) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

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


# ΓöÇΓöÇ Furniture injection (Phase 6 ΓÇö unchanged from original but validated) ΓöÇΓöÇΓöÇΓöÇΓöÇ

FURNITURE_CATALOG: dict[str, list[tuple]] = {
    # ΓöÇΓöÇ Living / Lounge ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    "living": [
        ("3-Seat Sofa",    7, 3),
        ("Coffee Table",   3, 2),
        ("TV Unit",        5, 1),
        ("Armchair",       2.5, 2.5),
        ("Side Table",     1.5, 1.5),
        ("Floor Lamp",     1, 1),
    ],
    # ΓöÇΓöÇ Dining Room ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    "dining": [
        ("Dining Table",   5, 3),
        ("Dining Chair",   1.5, 1.5),
        ("Dining Chair",   1.5, 1.5),
        ("Dining Chair",   1.5, 1.5),
        ("Dining Chair",   1.5, 1.5),
        ("Sideboard",      4, 1.5),
    ],
    # ΓöÇΓöÇ Kitchen ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    "kitchen": [
        ("Counter Top",    8, 2),
        ("Kitchen Island", 4, 2.5),
        ("Refrigerator",   2.5, 2),
        ("Oven",           2, 2),
        ("Sink",           2, 1.5),
    ],
    # ΓöÇΓöÇ Master Bedroom ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    "master bedroom": [
        ("King Bed",        7, 6),
        ("Bedside Table",   1.5, 1.5),
        ("Bedside Table",   1.5, 1.5),
        ("Wardrobe",        6, 2),
        ("Dressing Table",  4, 1.5),
        ("Vanity Mirror",   2, 0.5),
        ("Bench",           4, 1.5),
    ],
    # ΓöÇΓöÇ Regular Bedrooms ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    "bedroom": [
        ("Double Bed",     6, 5),
        ("Bedside Table",  1.5, 1.5),
        ("Wardrobe",       5, 2),
        ("Study Desk",     4, 2),
        ("Study Chair",    2, 2),
        ("Bookshelf",      3, 1),
    ],
    # ΓöÇΓöÇ Bathrooms ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
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

    # ΓöÇΓöÇ Corridors / Foyer ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    "foyer": [
        ("Shoe Rack",      3, 1),
        ("Console Table",  3, 1),
        ("Coat Hanger",    1, 1),
    ],
    "corridor": [
        ("Wall Art",       2, 0.2),
    ],
    # ΓöÇΓöÇ Balcony / Terrace ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
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
    # ΓöÇΓöÇ Parking / Utility ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
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
            if rw >= rh:  # wider room ΓåÆ along bottom or top
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
