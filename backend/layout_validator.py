"""
layout_validator.py
===================
Deterministic geometry fixer for AI Architect floor plan layouts.

Replaces the previous clamp-only Step 4 with a full validation pipeline:
  1. Per-type minimum dimension enforcement
  2. AABB overlap detection & resolution (min-translation-vector push-apart)
  3. Wall-thickness gap enforcement between adjacent rooms
  4. Boundary clamping (runs LAST so resolution can't push rooms back out)
  5. Circulation reachability check + corridor strip insertion

Must be called:
  - After every LLM round-trip (initial generation AND each Vastu auto-fix pass)
  - Before any output reaches Pillow, Stable Diffusion, or ezdxf

Usage:
    from layout_validator import validate_and_fix_layout
    result = validate_and_fix_layout(rooms, plot_w, plot_h, entrance_point)
    if result["status"] == "unresolved":
        raise ValueError(result["validation_report"][-1])
    rooms = result["rooms"]
"""

from __future__ import annotations
from typing import Any

# ─────────────────────────────────────────────────────────────────────────────
# Configuration  (tune here, never hardcode below)
# ─────────────────────────────────────────────────────────────────────────────

WALL_THICKNESS_FT: float = 0.5
MIN_CORRIDOR_WIDTH_FT: float = 3.0
MAX_RESOLUTION_ITERATIONS: int = 50

# (min_width_ft, min_height_ft) per room type keyword
ROOM_MIN_DIMENSIONS: dict[str, tuple[float, float]] = {
    "master bedroom":  (10, 10),
    "bedroom":         (10, 10),
    "bathroom":        (5,  8),
    "toilet":          (4,  6),
    "kitchen":         (8, 10),
    "living":          (12, 12),
    "dining":          (10, 10),
    "hall":            (8,  6),
    "foyer":           (6,  6),
    "lobby":           (6,  6),
    "balcony":         (6,  4),
    "terrace":         (8,  6),
    "stair":           (6,  6),
    "lift":            (4,  4),
    "parking":         (12, 8),
    "pooja":           (6,  6),
    "prayer":          (6,  6),
    "study":           (8,  8),
}

# ─────────────────────────────────────────────────────────────────────────────
# Public entry point
# ─────────────────────────────────────────────────────────────────────────────

def validate_and_fix_layout(
    rooms: list[dict[str, Any]],
    plot_width: float,
    plot_height: float,
    entrance_point: tuple[float, float] = (0.0, 0.0),
    max_iterations: int = MAX_RESOLUTION_ITERATIONS,
) -> dict[str, Any]:
    """
    Full deterministic geometry fixer.

    Parameters
    ----------
    rooms          : list of room dicts {name, x, y, width, height, furniture?, ...}
    plot_width     : plot dimension along x-axis in feet
    plot_height    : plot dimension along y-axis in feet
    entrance_point : (x, y) coordinate of the main entrance (default top-left)
    max_iterations : max overlap-resolution passes before giving up

    Returns
    -------
    {
        "rooms"            : list[dict],   # corrected, same schema as input
        "validation_report": list[str],    # human-readable log of all fixes
        "status"           : "ok" | "unresolved"
    }
    """
    report: list[str] = []

    if not rooms:
        return {"rooms": [], "validation_report": ["No rooms provided."], "status": "ok"}

    # Deep-copy to avoid mutating caller's data
    rooms = _deep_copy_rooms(rooms)

    # Step 1 — Per-type minimum dimension enforcement
    rooms, report = _enforce_minimum_dimensions(rooms, report, plot_width, plot_height)

    # Step 2 — Overlap detection and push-apart resolution
    rooms, report, resolved = _resolve_overlaps(rooms, report, max_iterations)

    # Step 3 — Wall-thickness gap enforcement
    rooms, report = _enforce_min_gap(rooms, report, WALL_THICKNESS_FT)

    # Step 4 — Boundary clamping  (LAST — resolution can push rooms out of bounds)
    rooms, report = _clamp_to_boundary(rooms, plot_width, plot_height, report)

    # Step 5 — Circulation reachability + corridor insertion
    rooms, report = _ensure_circulation(
        rooms, entrance_point, report, MIN_CORRIDOR_WIDTH_FT, plot_width, plot_height
    )

    # Final sanity: re-clamp after corridor insertion (corridor itself may push)
    rooms, report = _clamp_to_boundary(rooms, plot_width, plot_height, report)

    # Check overall fit feasibility
    min_total_area = sum(
        _get_min_dims(r["name"])[0] * _get_min_dims(r["name"])[1]
        for r in rooms
    )
    plot_area = plot_width * plot_height
    if min_total_area > plot_area:
        report.append(
            f"UNRESOLVED: Plot area ({plot_area:.0f} sq ft) is too small for "
            f"{len(rooms)} rooms at minimum dimensions ({min_total_area:.0f} sq ft required)."
        )
        resolved = False

    status = "ok" if resolved else "unresolved"
    return {"rooms": rooms, "validation_report": report, "status": status}


# ─────────────────────────────────────────────────────────────────────────────
# Step 1 — Per-type minimum dimension enforcement
# ─────────────────────────────────────────────────────────────────────────────

def _get_min_dims(name: str) -> tuple[float, float]:
    """Return (min_w, min_h) for a room by matching name keywords."""
    n = name.lower()
    for keyword, dims in ROOM_MIN_DIMENSIONS.items():
        if keyword in n:
            return dims
    return (6.0, 6.0)  # generic minimum


def _enforce_minimum_dimensions(
    rooms: list[dict],
    report: list[str],
    plot_w: float,
    plot_h: float,
) -> tuple[list[dict], list[str]]:
    for room in rooms:
        min_w, min_h = _get_min_dims(room["name"])
        changed = False

        if room["width"] < min_w:
            old = room["width"]
            room["width"] = min_w
            # Try to stay inside plot; shift x back if needed
            if room["x"] + room["width"] > plot_w:
                room["x"] = max(0.0, plot_w - room["width"])
            report.append(
                f"Min-dim: '{room['name']}' width {old:.1f}→{min_w:.1f} ft"
            )
            changed = True

        if room["height"] < min_h:
            old = room["height"]
            room["height"] = min_h
            if room["y"] + room["height"] > plot_h:
                room["y"] = max(0.0, plot_h - room["height"])
            report.append(
                f"Min-dim: '{room['name']}' height {old:.1f}→{min_h:.1f} ft"
            )
            changed = True

        if changed:
            room = _reclamp_furniture(room)

    return rooms, report


# ─────────────────────────────────────────────────────────────────────────────
# Step 2 — AABB overlap detection and minimum-translation-vector resolution
# ─────────────────────────────────────────────────────────────────────────────

def _aabb_overlap(a: dict, b: dict) -> tuple[float, float] | None:
    """
    Returns (dx, dy) minimum-translation vector to separate a from b,
    or None if they do not overlap.
    """
    ax1, ay1 = a["x"], a["y"]
    ax2, ay2 = ax1 + a["width"], ay1 + a["height"]
    bx1, by1 = b["x"], b["y"]
    bx2, by2 = bx1 + b["width"], by1 + b["height"]

    ox = min(ax2, bx2) - max(ax1, bx1)
    oy = min(ay2, by2) - max(ay1, by1)

    if ox <= 0 or oy <= 0:
        return None  # No overlap

    # Push apart along axis of least penetration
    if ox < oy:
        # Push horizontally
        if (ax1 + ax2) / 2 < (bx1 + bx2) / 2:
            return (-ox / 2, 0.0)   # push a left, b right
        return (ox / 2, 0.0)
    else:
        # Push vertically
        if (ay1 + ay2) / 2 < (by1 + by2) / 2:
            return (0.0, -oy / 2)   # push a up, b down
        return (0.0, oy / 2)


def _resolve_overlaps(
    rooms: list[dict],
    report: list[str],
    max_iterations: int,
) -> tuple[list[dict], list[str], bool]:
    resolved = True
    n = len(rooms)

    for iteration in range(max_iterations):
        found_overlap = False
        for i in range(n):
            for j in range(i + 1, n):
                mtv = _aabb_overlap(rooms[i], rooms[j])
                if mtv is None:
                    continue
                found_overlap = True
                dx, dy = mtv
                # Move each room by half the MTV in opposite directions
                rooms[i]["x"] -= dx
                rooms[i]["y"] -= dy
                rooms[j]["x"] += dx
                rooms[j]["y"] += dy
                # Re-clamp furniture for both moved rooms
                rooms[i] = _reclamp_furniture(rooms[i])
                rooms[j] = _reclamp_furniture(rooms[j])

        if not found_overlap:
            if iteration > 0:
                report.append(
                    f"Overlap-fix: All overlaps resolved after {iteration + 1} iteration(s)."
                )
            break
    else:
        # Exhausted max_iterations
        remaining = sum(
            1
            for i in range(n)
            for j in range(i + 1, n)
            if _aabb_overlap(rooms[i], rooms[j]) is not None
        )
        if remaining:
            report.append(
                f"UNRESOLVED: {remaining} room pair(s) still overlap after "
                f"{max_iterations} iterations. Plot may be overconstrained."
            )
            resolved = False

    return rooms, report, resolved


# ─────────────────────────────────────────────────────────────────────────────
# Step 3 — Wall-thickness gap enforcement
# ─────────────────────────────────────────────────────────────────────────────

def _enforce_min_gap(
    rooms: list[dict],
    report: list[str],
    gap: float,
) -> tuple[list[dict], list[str]]:
    """
    After overlaps are resolved, push rooms apart so no two room boundaries
    are closer than `gap` ft unless they are truly separate floors.
    """
    n = len(rooms)
    adjusted_count = 0
    for i in range(n):
        for j in range(i + 1, n):
            a, b = rooms[i], rooms[j]
            ax2 = a["x"] + a["width"]
            bx2 = b["x"] + b["width"]
            ay2 = a["y"] + a["height"]
            by2 = b["y"] + b["height"]

            h_gap = min(ax2, bx2) - max(a["x"], b["x"])
            v_gap = min(ay2, by2) - max(a["y"], b["y"])

            # Only act on rooms that are adjacent (non-overlapping but touching)
            if 0 < h_gap and 0 < v_gap:
                continue  # they overlap — handled in Step 2

            # Check proximity on each axis
            x_sep = max(a["x"], b["x"]) - min(ax2, bx2)   # separation along x
            y_sep = max(a["y"], b["y"]) - min(ay2, by2)   # separation along y

            if 0 <= x_sep < gap and v_gap <= 0:
                # Rooms are too close horizontally
                push = (gap - x_sep) / 2
                if a["x"] < b["x"]:
                    rooms[i]["x"] -= push
                    rooms[j]["x"] += push
                else:
                    rooms[i]["x"] += push
                    rooms[j]["x"] -= push
                adjusted_count += 1

            elif 0 <= y_sep < gap and h_gap <= 0:
                # Rooms are too close vertically
                push = (gap - y_sep) / 2
                if a["y"] < b["y"]:
                    rooms[i]["y"] -= push
                    rooms[j]["y"] += push
                else:
                    rooms[i]["y"] += push
                    rooms[j]["y"] -= push
                adjusted_count += 1

    if adjusted_count:
        report.append(
            f"Wall-gap: Applied {gap} ft wall buffer to {adjusted_count} room pair(s)."
        )
        # Re-clamp furniture after positional shifts
        rooms = [_reclamp_furniture(r) for r in rooms]

    return rooms, report


# ─────────────────────────────────────────────────────────────────────────────
# Step 4 — Boundary clamping (runs after resolution)
# ─────────────────────────────────────────────────────────────────────────────

def _clamp_to_boundary(
    rooms: list[dict],
    plot_w: float,
    plot_h: float,
    report: list[str],
) -> tuple[list[dict], list[str]]:
    clamped = 0
    for room in rooms:
        changed = False
        # Clamp position
        if room["x"] < 0:
            room["x"] = 0.0
            changed = True
        if room["y"] < 0:
            room["y"] = 0.0
            changed = True
        # Clamp size so room stays inside plot
        if room["x"] + room["width"] > plot_w:
            room["width"] = plot_w - room["x"]
            changed = True
        if room["y"] + room["height"] > plot_h:
            room["height"] = plot_h - room["y"]
            changed = True

        if changed:
            clamped += 1
            room = _reclamp_furniture(room)

    if clamped:
        report.append(f"Boundary-clamp: {clamped} room(s) clamped to plot boundary.")

    return rooms, report


# ─────────────────────────────────────────────────────────────────────────────
# Step 5 — Circulation reachability + corridor insertion
# ─────────────────────────────────────────────────────────────────────────────

def _rooms_block_path(
    origin: dict,
    target: dict,
    all_rooms: list[dict],
    corridor_width: float,
) -> bool:
    """
    Simple check: is there a room whose bounding box fully blocks the
    direct rectilinear path between two room centroids?
    """
    cx_o = origin["x"] + origin["width"] / 2
    cy_o = origin["y"] + origin["height"] / 2
    cx_t = target["x"] + target["width"] / 2
    cy_t = target["y"] + target["height"] / 2

    for room in all_rooms:
        if room is origin or room is target:
            continue
        # Does the room's box fully contain the midpoint of the path?
        mid_x = (cx_o + cx_t) / 2
        mid_y = (cy_o + cy_t) / 2
        if (
            room["x"] < mid_x < room["x"] + room["width"]
            and room["y"] < mid_y < room["y"] + room["height"]
        ):
            return True
    return False


def _ensure_circulation(
    rooms: list[dict],
    entrance_point: tuple[float, float],
    report: list[str],
    corridor_width: float,
    plot_w: float,
    plot_h: float,
) -> tuple[list[dict], list[str]]:
    """
    Find rooms blocked from the entrance and insert a corridor strip between
    the entrance room and the blocked room.
    """
    if not rooms:
        return rooms, report

    ex, ey = entrance_point

    # Find the room closest to the entrance (this is our "anchor")
    def dist_to_entrance(r: dict) -> float:
        cx = r["x"] + r["width"] / 2
        cy = r["y"] + r["height"] / 2
        return (cx - ex) ** 2 + (cy - ey) ** 2

    entrance_room = min(rooms, key=dist_to_entrance)
    inserted = 0

    for room in rooms:
        if room is entrance_room:
            continue
        if _rooms_block_path(entrance_room, room, rooms, corridor_width):
            # Insert a narrow corridor strip between them
            cx_e = entrance_room["x"] + entrance_room["width"] / 2
            cy_e = entrance_room["y"] + entrance_room["height"] / 2
            cx_r = room["x"] + room["width"] / 2
            cy_r = room["y"] + room["height"] / 2

            # Determine corridor orientation based on dominant axis
            if abs(cx_r - cx_e) > abs(cy_r - cy_e):
                # Horizontal corridor
                corr_x = min(cx_e, cx_r)
                corr_y = (cy_e + cy_r) / 2 - corridor_width / 2
                corr_w = abs(cx_r - cx_e)
                corr_h = corridor_width
            else:
                # Vertical corridor
                corr_x = (cx_e + cx_r) / 2 - corridor_width / 2
                corr_y = min(cy_e, cy_r)
                corr_w = corridor_width
                corr_h = abs(cy_r - cy_e)

            # Clamp corridor to plot
            corr_x = max(0.0, min(corr_x, plot_w - corr_w))
            corr_y = max(0.0, min(corr_y, plot_h - corr_h))

            corridor = {
                "name":      "Corridor",
                "x":         corr_x,
                "y":         corr_y,
                "width":     corr_w,
                "height":    corr_h,
                "furniture": [],
            }
            rooms.append(corridor)
            inserted += 1
            report.append(
                f"Corridor: Inserted {corridor_width:.1f} ft corridor between "
                f"'{entrance_room['name']}' and '{room['name']}'."
            )

    if inserted == 0:
        report.append("Circulation: All rooms reachable — no corridors inserted.")

    return rooms, report


# ─────────────────────────────────────────────────────────────────────────────
# Furniture helper — re-clamp furniture after a room is moved/resized
# ─────────────────────────────────────────────────────────────────────────────

def _reclamp_furniture(room: dict) -> dict:
    """Ensure all furniture stays inside the (possibly resized/moved) room."""
    updated = []
    for f in room.get("furniture", []):
        fw = min(f.get("width", 1), room["width"] - f.get("x", 0))
        fh = min(f.get("height", 1), room["height"] - f.get("y", 0))
        fx = max(0.0, min(f.get("x", 0), room["width"] - max(fw, 1)))
        fy = max(0.0, min(f.get("y", 0), room["height"] - max(fh, 1)))
        if fw > 0 and fh > 0:
            updated.append({**f, "x": fx, "y": fy, "width": fw, "height": fh})
    room["furniture"] = updated
    return room


# ─────────────────────────────────────────────────────────────────────────────
# Deep copy utility (avoids modifying the caller's dict)
# ─────────────────────────────────────────────────────────────────────────────

def _deep_copy_rooms(rooms: list[dict]) -> list[dict]:
    import copy
    return copy.deepcopy(rooms)
