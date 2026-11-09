"""
layout_modifier.py
==================
Deterministic Python geometry modification engine for the AI Architectural Agent.
Interprets structured ArchitecturalOperation objects, executes boundary and collision
checks, and updates floor and room coordinates without hallucinating invalid geometry.
"""

from typing import Dict, Any, List, Optional, Tuple
import copy
import logging

logger = logging.getLogger(__name__)

def check_overlap(r1: Dict[str, Any], r2: Dict[str, Any], epsilon: float = 0.05) -> bool:
    """Returns True if two rooms overlap in 2D space with positive area."""
    x1_min, x1_max = float(r1.get("x", 0)), float(r1.get("x", 0)) + float(r1.get("width", 0))
    y1_min, y1_max = float(r1.get("y", 0)), float(r1.get("y", 0)) + float(r1.get("height", 0))

    x2_min, x2_max = float(r2.get("x", 0)), float(r2.get("x", 0)) + float(r2.get("width", 0))
    y2_min, y2_max = float(r2.get("y", 0)), float(r2.get("y", 0)) + float(r2.get("height", 0))

    overlap_x = min(x1_max, x2_max) - max(x1_min, x2_min)
    overlap_y = min(y1_max, y2_max) - max(y1_min, y2_min)

    return (overlap_x > epsilon) and (overlap_y > epsilon)


def check_in_bounds(room: Dict[str, Any], plot_w: float, plot_h: float, epsilon: float = 0.1) -> bool:
    """Returns True if the room is within the plot boundary."""
    rx = float(room.get("x", 0))
    ry = float(room.get("y", 0))
    rw = float(room.get("width", 0))
    rh = float(room.get("height", 0))

    if rx < -epsilon or ry < -epsilon:
        return False
    if (rx + rw) > (plot_w + epsilon) or (ry + rh) > (plot_h + epsilon):
        return False
    return True


def find_room_index(rooms: List[Dict[str, Any]], target_name: Optional[str]) -> int:
    """Finds room by exact name or case-insensitive substring."""
    if not target_name:
        return -1
    t = target_name.strip().lower()

    # 1. Exact match
    for idx, r in enumerate(rooms):
        if r.get("name", "").strip().lower() == t:
            return idx

    # 2. Substring match
    for idx, r in enumerate(rooms):
        r_name = r.get("name", "").strip().lower()
        if t in r_name or r_name in t:
            return idx

    return -1


def apply_architectural_operation(
    layout_data: Dict[str, Any],
    action: Any = None,
    target_floor_level: int = 0,
    target_room_name: Optional[str] = None,
    parameters: Optional[Dict[str, Any]] = None,
    plot_width: float = 30.0,
    plot_height: float = 40.0,
) -> Tuple[bool, Dict[str, Any], str, List[str], Dict[str, Any]]:
    """
    Deterministically applies an ArchitecturalOperation to layout_data.
    Supports either positional args or passing an ArchitecturalOperation instance directly.
    Returns:
        (success: bool, updated_layout: dict, message: str, warnings: list[str], change_summary: dict)
    """
    if hasattr(action, "action"):
        op = action
        action = op.action
        target_floor_level = getattr(op, "target_floor_level", target_floor_level)
        target_room_name = getattr(op, "target_room_name", target_room_name)
        parameters = getattr(op, "parameters", parameters)

    params = parameters or {}
    new_layout = copy.deepcopy(layout_data)
    warnings: List[str] = []

    # Extract plot dimensions from layout_data if available
    if isinstance(layout_data, dict):
        plot_info = layout_data.get("plot") or layout_data.get("form") or {}
        if isinstance(plot_info, dict):
            plot_width = float(plot_info.get("width", plot_info.get("plot_width", plot_width)))
            plot_height = float(plot_info.get("height", plot_info.get("plot_height", plot_height)))

    # Normalize multi-floor vs single-floor structure
    floors = new_layout.get("floors")
    if not floors or not isinstance(floors, list):
        rooms = new_layout.get("rooms", [])
        floors = [{"level": 0, "name": "Ground Floor", "rooms": rooms}]
        new_layout["floors"] = floors

    # Target floor resolution
    target_floor = None
    target_f_idx = 0
    for idx, f in enumerate(floors):
        f_lvl = f.get("level", idx)
        try:
            if int(f_lvl) == int(target_floor_level):
                target_floor = f
                target_f_idx = idx
                break
        except (ValueError, TypeError):
            if idx == target_floor_level:
                target_floor = f
                target_f_idx = idx
                break

    if target_floor is None:
        target_floor = floors[0]
        target_f_idx = 0

    target_rooms: List[Dict[str, Any]] = target_floor.get("rooms", [])
    if not target_rooms:
        return False, layout_data, f"Floor {target_floor_level} has no rooms to modify.", ["No rooms found on target floor."], {}

    # ─────────────────────────────────────────────────────────────────────────────
    # Action 1: GENERAL ADVICE (No geometric changes needed)
    # ─────────────────────────────────────────────────────────────────────────────
    if action == "general_advice":
        return True, layout_data, "Architectural advice provided without geometric modifications.", [], {"action": "general_advice", "is_destructive": False}

    # ─────────────────────────────────────────────────────────────────────────────
    # Action 2: RESIZE ROOM
    # ─────────────────────────────────────────────────────────────────────────────
    elif action == "resize_room":
        r_idx = find_room_index(target_rooms, target_room_name)
        if r_idx < 0 and len(floors) > 1:
            for alt_idx, alt_floor in enumerate(floors):
                alt_rooms = alt_floor.get("rooms", [])
                alt_r_idx = find_room_index(alt_rooms, target_room_name)
                if alt_r_idx >= 0:
                    target_floor = alt_floor
                    target_f_idx = alt_idx
                    target_rooms = alt_rooms
                    r_idx = alt_r_idx
                    break

        if r_idx < 0:
            return False, layout_data, f"Could not find room '{target_room_name}' to resize.", [f"Room '{target_room_name}' not found."], {}

        room = copy.deepcopy(target_rooms[r_idx])
        curr_w = float(room.get("width", 10))
        curr_h = float(room.get("height", 10))

        delta_w = float(params.get("delta_width", 0))
        delta_h = float(params.get("delta_height", 0))

        if "delta_ft" in params:
            dim = str(params.get("dimension", "width")).lower()
            if dim in ("height", "length", "y", "vertical"):
                delta_h = float(params["delta_ft"])
            else:
                delta_w = float(params["delta_ft"])

        # Direct dimension overrides if specified
        if "new_width" in params:
            delta_w = float(params["new_width"]) - curr_w
        if "new_height" in params:
            delta_h = float(params["new_height"]) - curr_h

        # Handle amount + direction (e.g. expand east by 2ft)
        amount = float(params.get("amount", 0))
        direction = str(params.get("direction", "")).lower()
        if amount > 0:
            if direction in ("east", "west", "width", "horizontal", "wider"):
                delta_w = amount if direction != "west" else -amount
            elif direction in ("north", "south", "height", "vertical", "longer"):
                delta_h = amount if direction != "north" else -amount
            else:
                delta_w = amount  # default width expansion

        new_w = max(4.0, curr_w + delta_w)
        new_h = max(4.0, curr_h + delta_h)

        candidates = [
            # 1. Expand right/downward (standard)
            {"x": room["x"], "y": room["y"], "width": new_w, "height": new_h},
            # 2. Expand leftward towards exterior setback
            {"x": max(0.0, room["x"] - delta_w), "y": room["y"], "width": new_w, "height": new_h} if delta_w > 0 else None,
            # 3. Expand upward towards exterior setback
            {"x": room["x"], "y": max(0.0, room["y"] - delta_h), "width": new_w, "height": new_h} if delta_h > 0 else None,
            # 4. Expand both left and up if both > 0
            {"x": max(0.0, room["x"] - delta_w), "y": max(0.0, room["y"] - delta_h), "width": new_w, "height": new_h} if (delta_w > 0 and delta_h > 0) else None,
            # 5. Expand height along unblocked axis if width is blocked
            {"x": room["x"], "y": room["y"], "width": curr_w, "height": max(4.0, curr_h + delta_w)} if (delta_w > 0 and delta_h == 0) else None,
            {"x": room["x"], "y": max(0.0, room["y"] - delta_w), "width": curr_w, "height": max(4.0, curr_h + delta_w)} if (delta_w > 0 and delta_h == 0) else None,
        ]

        chosen_candidate = None
        for cand in candidates:
            if not cand:
                continue
            test_c = dict(room, **cand)
            if not check_in_bounds(test_c, plot_width, plot_height):
                continue
            has_coll = False
            for other_idx, other in enumerate(target_rooms):
                if other_idx == r_idx:
                    continue
                if check_overlap(test_c, other):
                    has_coll = True
                    break
            if not has_coll:
                chosen_candidate = test_c
                break

        if not chosen_candidate:
            return False, layout_data, (
                f"Cannot resize '{room.get('name')}': expanding by {amount if amount > 0 else delta_w:.1f} ft "
                f"collides with neighboring rooms or exceeds plot boundaries."
            ), ["Collision or boundary constraint prevented expansion."], {}

        # Clamp openings and furniture within new room dimensions
        doors = target_rooms[r_idx].get("doors", [])
        for d in doors:
            w_wall = chosen_candidate["width"] if d.get("wall") in ("top", "bottom") else chosen_candidate["height"]
            d_w = float(d.get("width", 3.0))
            if float(d.get("position", 0)) + d_w > w_wall:
                d["position"] = max(0.0, round(w_wall - d_w - 0.5, 2))
        windows = target_rooms[r_idx].get("windows", [])
        for w_item in windows:
            w_wall = chosen_candidate["width"] if w_item.get("wall") in ("top", "bottom") else chosen_candidate["height"]
            win_w = float(w_item.get("width", 4.0))
            if float(w_item.get("position", 0)) + win_w > w_wall:
                w_item["position"] = max(0.0, round(w_wall - win_w - 0.5, 2))
        furns = target_rooms[r_idx].get("furniture", [])
        for f in furns:
            fw = float(f.get("width", 3.0))
            fh = float(f.get("height", 3.0))
            f["x"] = max(0.5, min(chosen_candidate["width"] - fw - 0.5, float(f.get("x", 0))))
            f["y"] = max(0.5, min(chosen_candidate["height"] - fh - 0.5, float(f.get("y", 0))))

        # Apply update
        target_rooms[r_idx]["width"] = round(chosen_candidate["width"], 2)
        target_rooms[r_idx]["height"] = round(chosen_candidate["height"], 2)
        target_rooms[r_idx]["x"] = round(chosen_candidate["x"], 2)
        target_rooms[r_idx]["y"] = round(chosen_candidate["y"], 2)
        target_floor["rooms"] = target_rooms

        resize_summary = {
            "action": "resize_room",
            "room": room.get("name"),
            "target_room": room.get("name"),
            "before": {
                "width": curr_w,
                "height": curr_h,
                "area_sqft": round(curr_w * curr_h, 1),
            },
            "after": {
                "width": round(chosen_candidate["width"], 2),
                "height": round(chosen_candidate["height"], 2),
                "area_sqft": round(chosen_candidate["width"] * chosen_candidate["height"], 1),
            },
            "delta": f"ΔW: {chosen_candidate['width'] - curr_w:+.1f}ft, ΔH: {chosen_candidate['height'] - curr_h:+.1f}ft",
            "details": f"Resized {room.get('name')} from {curr_w:.1f}×{curr_h:.1f} ft to {chosen_candidate['width']:.1f}×{chosen_candidate['height']:.1f} ft",
            "is_destructive": False,
        }
        return True, new_layout, f"Resized '{room.get('name')}' to {chosen_candidate['width']:.1f}×{chosen_candidate['height']:.1f} ft successfully.", [], resize_summary

    # ─────────────────────────────────────────────────────────────────────────────
    # Action 3: MOVE ROOM
    # ─────────────────────────────────────────────────────────────────────────────
    elif action == "move_room":
        r_idx = find_room_index(target_rooms, target_room_name)
        if r_idx < 0:
            return False, layout_data, f"Could not find room '{target_room_name}' to move.", [f"Room '{target_room_name}' not found."], {}

        room = copy.deepcopy(target_rooms[r_idx])
        dx = float(params.get("dx", 0))
        dy = float(params.get("dy", 0))

        direction = str(params.get("direction", "")).lower()
        dist = float(params.get("distance", params.get("amount", 2.0)))
        if direction == "north": dy -= dist
        elif direction == "south": dy += dist
        elif direction == "east": dx += dist
        elif direction == "west": dx -= dist

        test_room = dict(room, x=round(room["x"] + dx, 2), y=round(room["y"] + dy, 2))

        if not check_in_bounds(test_room, plot_width, plot_height):
            return False, layout_data, f"Cannot move '{room.get('name')}': falls outside plot bounds.", ["Plot boundary violation."], {}

        for other_idx, other in enumerate(target_rooms):
            if other_idx == r_idx: continue
            if check_overlap(test_room, other):
                return False, layout_data, f"Cannot move '{room.get('name')}': collides with '{other.get('name')}'.", [f"Collision with {other.get('name')}."], {}

        target_rooms[r_idx]["x"] = test_room["x"]
        target_rooms[r_idx]["y"] = test_room["y"]
        target_floor["rooms"] = target_rooms

        move_summary = {
            "action": "move_room",
            "room": room.get("name"),
            "target_room": room.get("name"),
            "before": {"x": room["x"], "y": room["y"]},
            "after": {"x": test_room["x"], "y": test_room["y"]},
            "delta": f"dx: {dx:+.1f}ft, dy: {dy:+.1f}ft",
            "details": f"Shifted {room.get('name')} by dx: {dx:+.1f}ft, dy: {dy:+.1f}ft",
            "is_destructive": False,
        }
        return True, new_layout, f"Moved '{room.get('name')}' to ({test_room['x']}, {test_room['y']}).", [], move_summary

    # ─────────────────────────────────────────────────────────────────────────────
    # Action 4: SWAP ROOMS
    # ─────────────────────────────────────────────────────────────────────────────
    elif action == "swap_rooms":
        r1_idx = find_room_index(target_rooms, target_room_name)
        second_name = params.get("second_room_name") or params.get("with_room") or params.get("target_room_b") or params.get("room_b")
        r2_idx = find_room_index(target_rooms, second_name)

        if r1_idx < 0 or r2_idx < 0:
            return False, layout_data, f"Could not find both rooms to swap ('{target_room_name}' and '{second_name}').", ["Rooms not found."], {}

        r1 = target_rooms[r1_idx]
        r2 = target_rooms[r2_idx]

        # Swap positions and dimensions
        r1["x"], r2["x"] = r2["x"], r1["x"]
        r1["y"], r2["y"] = r2["y"], r1["y"]
        r1["width"], r2["width"] = r2["width"], r1["width"]
        r1["height"], r2["height"] = r2["height"], r1["height"]

        target_floor["rooms"] = target_rooms
        swap_summary = {
            "action": "swap_rooms",
            "room": r1.get("name"),
            "second_room": r2.get("name"),
            "before": f"{r1.get('name')} at ({r2['x']},{r2['y']})",
            "after": f"{r1.get('name')} at ({r1['x']},{r1['y']})",
            "is_destructive": False,
        }
        return True, new_layout, f"Swapped positions of '{r1.get('name')}' and '{r2.get('name')}'.", [], swap_summary

    # ─────────────────────────────────────────────────────────────────────────────
    # Action 5: CHANGE ROOM TYPE / RENAME
    # ─────────────────────────────────────────────────────────────────────────────
    elif action == "change_room_type":
        r_idx = find_room_index(target_rooms, target_room_name)
        if r_idx < 0:
            return False, layout_data, f"Could not find room '{target_room_name}'.", ["Room not found."], {}

        new_name = params.get("new_name") or params.get("name") or "Reassigned Room"
        target_rooms[r_idx]["name"] = str(new_name)
        if "new_type" in params:
            target_rooms[r_idx]["room_type"] = params["new_type"]

        target_floor["rooms"] = target_rooms
        change_type_summary = {
            "action": "change_room_type",
            "room": target_room_name,
            "before": target_room_name,
            "after": new_name,
            "is_destructive": False,
        }
        return True, new_layout, f"Changed '{target_room_name}' to '{new_name}'.", [], change_type_summary

    # ─────────────────────────────────────────────────────────────────────────────
    # Action 6: ADD ROOM
    # ─────────────────────────────────────────────────────────────────────────────
    elif action == "add_room":
        new_name = target_room_name or params.get("name") or "New Room"
        w = float(params.get("width", 8.0))
        h = float(params.get("height", 8.0))

        # Try to find placement: partition from adjacent room or place in open plot area
        placed_x, placed_y = -1.0, -1.0
        parent_idx = find_room_index(target_rooms, params.get("adjacent_to") or params.get("from_room"))

        if parent_idx >= 0:
            parent = target_rooms[parent_idx]
            # If parent is large enough to partition
            if parent["width"] >= (w + 6.0) and parent["height"] >= h:
                placed_x = parent["x"] + parent["width"] - w
                placed_y = parent["y"]
                parent["width"] -= w
            elif parent["height"] >= (h + 6.0) and parent["width"] >= w:
                placed_x = parent["x"]
                placed_y = parent["y"] + parent["height"] - h
                parent["height"] -= h

        if placed_x < 0:
            # Grid search for non-overlapping open spot in plot
            found = False
            for test_y in [0.0, 10.0, 20.0, max(0.0, plot_height - h)]:
                for test_x in [0.0, 10.0, 20.0, max(0.0, plot_width - w)]:
                    cand = {"name": new_name, "x": test_x, "y": test_y, "width": w, "height": h}
                    if check_in_bounds(cand, plot_width, plot_height) and not any(check_overlap(cand, r) for r in target_rooms):
                        placed_x, placed_y = test_x, test_y
                        found = True
                        break
                if found:
                    break

        if placed_x < 0:
            return False, layout_data, (
                f"Cannot fit new '{new_name}' ({w:.1f}×{h:.1f}ft): "
                f"plot is densely packed. Please resize or remove an existing room first."
            ), ["No space available on floor."], {}

        new_room_obj = {
            "name": new_name,
            "x": round(placed_x, 2),
            "y": round(placed_y, 2),
            "width": round(w, 2),
            "height": round(h, 2),
            "doors": [{"wall": "bottom", "position": round(w / 2, 2), "width": 3.0}],
            "windows": [{"wall": "top", "position": round(w / 2, 2), "width": 4.0}],
            "furniture": [],
        }
        target_rooms.append(new_room_obj)
        target_floor["rooms"] = target_rooms

        add_summary = {
            "action": "add_room",
            "room": new_name,
            "dimensions": f"{w:.1f}×{h:.1f} ft",
            "location": f"({placed_x}, {placed_y})",
            "is_destructive": False,
        }
        return True, new_layout, f"Added '{new_name}' ({w:.1f}×{h:.1f}ft) at ({placed_x}, {placed_y}).", [], add_summary

    # ─────────────────────────────────────────────────────────────────────────────
    # Action 7: REMOVE ROOM
    # ─────────────────────────────────────────────────────────────────────────────
    elif action == "remove_room":
        r_idx = find_room_index(target_rooms, target_room_name)
        if r_idx < 0:
            return False, layout_data, f"Could not find room '{target_room_name}' to remove.", ["Room not found."], {}

        removed_room = target_rooms.pop(r_idx)
        target_floor["rooms"] = target_rooms
        del_summary = {
            "action": "remove_room",
            "room": removed_room.get("name"),
            "dimensions": f"{removed_room.get('width')}×{removed_room.get('height')} ft",
            "is_destructive": True,
        }
        return True, new_layout, f"Removed '{removed_room.get('name')}' from floor plan.", [], del_summary

    # ─────────────────────────────────────────────────────────────────────────────
    # Action 8: PLACE FURNITURE
    # ─────────────────────────────────────────────────────────────────────────────
    elif action == "place_furniture":
        r_idx = find_room_index(target_rooms, target_room_name)
        if r_idx < 0:
            r_idx = 0

        room = target_rooms[r_idx]
        item_name = str(params.get("item_name") or params.get("name") or "Furniture")
        c_id = str(params.get("catalog_id") or "item_placed")
        fw = float(params.get("width", 6.0))
        fd = float(params.get("height", params.get("depth", 3.0)))

        # Center inside room snapped to 0.5ft
        rw = float(room.get("width", 10.0))
        rh = float(room.get("height", 10.0))
        fx = round(max(0.5, min(rw - fw - 0.5, (rw - fw) / 2)) * 2) / 2
        fy = round(max(0.5, min(rh - fd - 0.5, (rh - fd) / 2)) * 2) / 2

        furn_item = {
            "id": f"furn_{c_id}_{len(room.get('furniture', [])) + 1}",
            "catalogId": c_id,
            "name": item_name,
            "x": fx,
            "y": fy,
            "width": fw,
            "height": fd,
            "rotation": float(params.get("rotation", 0.0)),
            "elevation": float(params.get("elevation", 0.0)),
            "color": str(params.get("color", "#475569")),
            "isLight": bool(params.get("is_light", False) or "light" in c_id or "lamp" in c_id),
            "lightProperties": params.get("light_properties"),
        }

        if "furniture" not in room or not isinstance(room["furniture"], list):
            room["furniture"] = []
        room["furniture"].append(furn_item)

        target_floor["rooms"] = target_rooms
        place_summary = {
            "action": "place_furniture",
            "room": room.get("name"),
            "item": item_name,
            "catalog_id": c_id,
            "is_destructive": False,
        }
        return True, new_layout, f"Placed '{item_name}' in '{room.get('name')}'.", [], place_summary

    # ─────────────────────────────────────────────────────────────────────────────
    # Action 9: REMOVE FURNITURE
    # ─────────────────────────────────────────────────────────────────────────────
    elif action == "remove_furniture":
        r_idx = find_room_index(target_rooms, target_room_name)
        if r_idx < 0:
            candidate_rooms = target_rooms
        else:
            candidate_rooms = [target_rooms[r_idx]]

        f_id = params.get("furniture_id")
        f_name = (params.get("item_name") or params.get("name") or "").lower()
        removed_count = 0

        for rm in candidate_rooms:
            furns = rm.get("furniture", [])
            new_furns = []
            for f in furns:
                if f_id and f.get("id") == f_id:
                    removed_count += 1
                elif f_name and (f_name in f.get("name", "").lower() or f_name in f.get("catalogId", "").lower()):
                    removed_count += 1
                else:
                    new_furns.append(f)
            rm["furniture"] = new_furns

        target_floor["rooms"] = target_rooms
        if removed_count > 0:
            rem_furn_summary = {
                "action": "remove_furniture",
                "count": removed_count,
                "item": f_name or f_id or "furniture",
                "is_destructive": True,
            }
            return True, new_layout, f"Removed {removed_count} furniture item(s).", [], rem_furn_summary
        return False, layout_data, f"No matching furniture found to remove.", ["No items matched."], {}

    return False, layout_data, f"Unknown action: '{action}'.", [f"Unsupported action: {action}"], {}
