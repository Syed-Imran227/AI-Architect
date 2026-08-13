"""
circulation.py
==============
Phase 2 — Circulation Path Visualization.

Builds a room adjacency graph from the layout geometry and runs BFS from the
entrance room to every other room, returning walking paths as (x, y) waypoint
arrays that the frontend can render as dashed SVG polylines.

A path from room A → room B visits each intermediate room by:
  1. Starting at the centre of room A
  2. Stepping through the shared wall midpoint between adjacent rooms
  3. Arriving at the centre of room B

Rooms with no BFS path to the entrance are flagged as "unreachable" and added
to the circulation_warnings list.
"""

from __future__ import annotations
from collections import deque
from typing import Any


# ── Geometry helpers ──────────────────────────────────────────────────────────

def _room_centre(room: dict) -> tuple[float, float]:
    return (room["x"] + room["width"] / 2, room["y"] + room["height"] / 2)


def _shared_wall_midpoint(
    a: dict, b: dict
) -> tuple[float, float] | None:
    """
    If rooms a and b share a wall segment of at least MIN_OVERLAP ft, return
    the midpoint of that shared segment. Otherwise return None.
    """
    MIN_OVERLAP = 1.5   # ft — minimum shared wall needed to be "adjacent"

    ax0, ax1 = a["x"], a["x"] + a["width"]
    ay0, ay1 = a["y"], a["y"] + a["height"]
    bx0, bx1 = b["x"], b["x"] + b["width"]
    by0, by1 = b["y"], b["y"] + b["height"]

    TOL = 0.6   # ft — tolerance for floating-point wall alignment

    # Check horizontal adjacency (shared vertical wall)
    if abs(ax1 - bx0) < TOL or abs(bx1 - ax0) < TOL:
        wall_x = ax1 if abs(ax1 - bx0) < TOL else bx1
        overlap_y0 = max(ay0, by0)
        overlap_y1 = min(ay1, by1)
        if overlap_y1 - overlap_y0 >= MIN_OVERLAP:
            return (wall_x, (overlap_y0 + overlap_y1) / 2)

    # Check vertical adjacency (shared horizontal wall)
    if abs(ay1 - by0) < TOL or abs(by1 - ay0) < TOL:
        wall_y = ay1 if abs(ay1 - by0) < TOL else by1
        overlap_x0 = max(ax0, bx0)
        overlap_x1 = min(ax1, bx1)
        if overlap_x1 - overlap_x0 >= MIN_OVERLAP:
            return ((overlap_x0 + overlap_x1) / 2, wall_y)

    return None


def _build_adjacency(rooms: list[dict]) -> dict[str, list[tuple[str, tuple[float, float]]]]:
    """
    Return an adjacency map: room_name → [(neighbour_name, shared_wall_midpoint), ...]
    """
    adj: dict[str, list[tuple[str, tuple[float, float]]]] = {r["name"]: [] for r in rooms}
    for i, a in enumerate(rooms):
        for j in range(i + 1, len(rooms)):
            b = rooms[j]
            midpt = _shared_wall_midpoint(a, b)
            if midpt is not None:
                adj[a["name"]].append((b["name"], midpt))
                adj[b["name"]].append((a["name"], midpt))
    return adj


def _find_entrance(rooms: list[dict]) -> str | None:
    """
    Find the entrance room by name priority:
      Foyer > Entrance > Hall > Lobby > Corridor > first room.
    """
    priority = ["foyer", "entrance", "hall", "lobby", "corridor"]
    for keyword in priority:
        for r in rooms:
            if keyword in r["name"].lower():
                return r["name"]
    return rooms[0]["name"] if rooms else None


# ── Public API ────────────────────────────────────────────────────────────────

def compute_paths(
    layout: dict,
) -> dict:
    """
    Add circulation data to the layout dict (mutates in-place).

    For each floor, adds:
      floor["circulation"] = {
          "paths": [
              {
                  "to": "<room_name>",
                  "waypoints": [[x, y], [x, y], ...]   # in feet, SVG coords
              },
              ...
          ],
          "unreachable": ["<room_name>", ...]
      }

    Returns the mutated layout dict.
    """
    for floor in layout.get("floors", []):
        rooms: list[dict] = floor.get("rooms", [])
        if not rooms:
            floor["circulation"] = {"paths": [], "unreachable": []}
            continue

        room_map: dict[str, dict] = {r["name"]: r for r in rooms}
        adj = _build_adjacency(rooms)
        entrance_name = _find_entrance(rooms)

        if entrance_name is None:
            floor["circulation"] = {"paths": [], "unreachable": []}
            continue

        # BFS from entrance
        visited: dict[str, str | None] = {entrance_name: None}
        # Store the waypoint used to reach each room: {name: (wall_midpoint)}
        via: dict[str, tuple[float, float] | None] = {entrance_name: None}
        queue: deque[str] = deque([entrance_name])

        while queue:
            current = queue.popleft()
            for neighbour, midpoint in adj[current]:
                if neighbour not in visited:
                    visited[neighbour] = current
                    via[neighbour] = midpoint
                    queue.append(neighbour)

        # Build path objects
        paths: list[dict[str, Any]] = []
        unreachable: list[str] = []

        for room in rooms:
            name = room["name"]
            if name == entrance_name:
                continue
            if name not in visited:
                unreachable.append(name)
                continue

            # Reconstruct path backwards from this room to entrance
            waypoints: list[list[float]] = []
            waypoints.append(list(_room_centre(room_map[name])))

            step = name
            while visited[step] is not None:
                parent = visited[step]
                # Add the shared wall midpoint
                if via[step] is not None:
                    waypoints.append(list(via[step]))
                waypoints.append(list(_room_centre(room_map[parent])))
                step = parent

            waypoints.reverse()
            paths.append({"to": name, "waypoints": waypoints})

        floor["circulation"] = {"paths": paths, "unreachable": unreachable}

    return layout
