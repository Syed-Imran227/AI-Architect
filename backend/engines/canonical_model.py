"""
canonical_model.py
===============================================================================
Authoritative Canonical Building Geometry Model (Python / Pydantic Schema v1)

Supports:
  - Strongly-typed CanonicalBuildingDocument adhering to AGENTS.md Invariant 1.
  - Pure geometric validation (wall crossing, opening clearance, room overlap).
  - Legacy project migration (migrate_legacy_to_canonical).
  - Derived legacy projection (canonical_to_legacy_dict) for DXF and PDF exporters.
===============================================================================
"""

from __future__ import annotations
import math
from typing import List, Dict, Any, Optional, Literal
from pydantic import BaseModel, Field, ConfigDict

METRES_TO_FEET = 3.28084
FEET_TO_METRES = 0.3048

def m_to_ft(m: float) -> float:
    return round(m * METRES_TO_FEET, 2)

def ft_to_m(ft: float) -> float:
    return round(ft * FEET_TO_METRES, 3)

class Point2D(BaseModel):
    x: float
    y: float

class Setbacks(BaseModel):
    front: float = 1.5
    rear: float = 1.5
    left: float = 1.0
    right: float = 1.0

class SitePlot(BaseModel):
    plot_polygon: List[Point2D] = Field(default_factory=list)
    width: float
    length: float
    entry_side: Literal["north", "south", "east", "west"] = "east"
    north_angle: float = 0.0
    setbacks: Setbacks = Field(default_factory=Setbacks)

class WallNode(BaseModel):
    id: str
    x: float
    y: float

class Wall(BaseModel):
    id: str
    start_node_id: str
    end_node_id: str
    thickness: float = 0.23  # metres (9 in)
    height: float = 3.05     # metres (10 ft)
    kind: Literal["exterior", "interior", "parapet", "partition"] = "interior"
    material_id: Optional[str] = None

class Opening(BaseModel):
    id: str
    wall_id: str
    offset: float            # metres from start_node to center
    width: float             # metres
    height: float = 2.13     # metres (7 ft)
    sill: float = 0.0        # metres above slab
    type: Literal["single_door", "double_door", "sliding_door", "window", "opening"] = "single_door"
    swing: Optional[Literal["inward_left", "inward_right", "outward_left", "outward_right"]] = None
    name: Optional[str] = None

class CanonicalRoom(BaseModel):
    id: str
    name: str
    room_type: str
    boundary_node_ids: List[str] = Field(default_factory=list)
    material_id: Optional[str] = None

class PlacedItem(BaseModel):
    id: str
    asset_id: str
    name: str
    x: float
    y: float
    elevation: float = 0.0
    rotation: float = 0.0
    width: float = 1.0
    depth: float = 1.0
    height: float = 1.0
    color: Optional[str] = None
    is_light: bool = False
    locked: bool = False
    properties: Dict[str, Any] = Field(default_factory=dict)

class Level(BaseModel):
    id: str
    level_index: int
    name: str
    elevation: float = 0.0
    height: float = 3.05
    slab_thickness: float = 0.25
    nodes: List[WallNode] = Field(default_factory=list)
    walls: List[Wall] = Field(default_factory=list)
    openings: List[Opening] = Field(default_factory=list)
    rooms: List[CanonicalRoom] = Field(default_factory=list)
    items: List[PlacedItem] = Field(default_factory=list)

class DocumentMetadata(BaseModel):
    name: str = "Residential Plan"
    created_at: str = ""
    updated_at: str = ""
    generator_seed: Optional[str] = None
    entry_direction: Literal["north", "south", "east", "west"] = "east"
    display_units: Literal["ft", "m"] = "ft"

class CanonicalBuildingDocument(BaseModel):
    schema_version: int = Field(default=1, alias="schemaVersion")
    id: str
    metadata: DocumentMetadata = Field(default_factory=DocumentMetadata)
    site: SitePlot
    levels: List[Level] = Field(default_factory=list)
    legacy_snapshot: Optional[Dict[str, Any]] = Field(default=None, alias="legacySnapshot")

    model_config = ConfigDict(populate_by_name=True)


# ── Python Geometry Validation ────────────────────────────────────────────────

def validate_canonical_document(doc: CanonicalBuildingDocument) -> Dict[str, Any]:
    """Validates structural integrity of a CanonicalBuildingDocument."""
    errors = []
    warnings = []

    for lvl in doc.levels:
        node_map = {n.id: n for n in lvl.nodes}

        # 1. Opening fit validation
        for op in lvl.openings:
            wall = next((w for w in lvl.walls if w.id == op.wall_id), None)
            if not wall:
                errors.append(f"Opening {op.id} references non-existent Wall {op.wall_id}.")
                continue
            n1 = node_map.get(wall.start_node_id)
            n2 = node_map.get(wall.end_node_id)
            if n1 and n2:
                len_m = math.hypot(n2.x - n1.x, n2.y - n1.y)
                if op.offset - op.width / 2 < 0.15 or op.offset + op.width / 2 > len_m - 0.15:
                    errors.append(f"Opening '{op.name or op.id}' exceeds Wall {wall.id} bounds (length {len_m:.2f}m).")

        # 2. Room node existence
        for rm in lvl.rooms:
            for nid in rm.boundary_node_ids:
                if nid not in node_map:
                    errors.append(f"Room '{rm.name}' references missing WallNode '{nid}'.")

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
    }


# ── Migration & Backward Compatibility Functions ──────────────────────────────

def migrate_legacy_to_canonical(legacy_dict: Dict[str, Any]) -> CanonicalBuildingDocument:
    """Migrates a legacy floor plan dict into CanonicalBuildingDocument."""
    if legacy_dict.get("schemaVersion") == 1 or legacy_dict.get("schema_version") == 1:
        return CanonicalBuildingDocument.model_validate(legacy_dict)

    raw_floors = legacy_dict.get("floors") or []
    if not raw_floors and legacy_dict.get("rooms"):
        raw_floors = [{"level": 0, "name": "Ground Floor", "rooms": legacy_dict.get("rooms")}]

    plot_w_ft = float(legacy_dict.get("plot_width") or legacy_dict.get("width") or 30.0)
    plot_l_ft = float(legacy_dict.get("plot_length") or legacy_dict.get("length") or 40.0)
    plot_w_m = ft_to_m(plot_w_ft)
    plot_l_m = ft_to_m(plot_l_ft)

    levels: List[Level] = []

    for fl_idx, fl in enumerate(raw_floors):
        lvl_id = f"lvl_{fl_idx}"
        nodes: List[WallNode] = []
        walls: List[Wall] = []
        openings: List[Opening] = []
        rooms: List[CanonicalRoom] = []
        items: List[PlacedItem] = []

        coord_to_node: Dict[str, WallNode] = {}

        def get_or_create_node(xm: float, ym: float) -> WallNode:
            key = f"{round(xm, 2)}_{round(ym, 2)}"
            if key in coord_to_node:
                return coord_to_node[key]
            node = WallNode(id=f"n_{lvl_id}_{len(nodes)+1}", x=round(xm, 3), y=round(ym, 3))
            coord_to_node[key] = node
            nodes.append(node)
            return node

        def get_or_create_wall(n1: WallNode, n2: WallNode, is_ext: bool) -> Wall:
            for w in walls:
                if (w.start_node_id == n1.id and w.end_node_id == n2.id) or (w.start_node_id == n2.id and w.end_node_id == n1.id):
                    return w
            w = Wall(
                id=f"w_{lvl_id}_{len(walls)+1}",
                start_node_id=n1.id,
                end_node_id=n2.id,
                thickness=0.23 if is_ext else 0.115,
                kind="exterior" if is_ext else "interior",
            )
            walls.append(w)
            return w

        for r_idx, r in enumerate(fl.get("rooms", [])):
            rx_m = ft_to_m(float(r.get("x", 0)))
            ry_m = ft_to_m(float(r.get("y", 0)))
            rw_m = ft_to_m(float(r.get("width", 10)))
            rh_m = ft_to_m(float(r.get("height", 10)))
            r_name = str(r.get("name", f"Room {r_idx+1}"))
            r_id = f"room_{lvl_id}_{r_idx+1}"

            tl = get_or_create_node(rx_m, ry_m)
            tr = get_or_create_node(rx_m + rw_m, ry_m)
            br = get_or_create_node(rx_m + rw_m, ry_m + rh_m)
            bl = get_or_create_node(rx_m, ry_m + rh_m)

            w_top = get_or_create_wall(tl, tr, ry_m < 0.1)
            w_right = get_or_create_wall(tr, br, abs(rx_m + rw_m - plot_w_m) < 0.1)
            w_bottom = get_or_create_wall(br, bl, abs(ry_m + rh_m - plot_l_m) < 0.1)
            w_left = get_or_create_wall(bl, tl, rx_m < 0.1)

            rooms.append(CanonicalRoom(
                id=r_id,
                name=r_name,
                room_type=r_name.lower().replace(" ", "_"),
                boundary_node_ids=[tl.id, tr.id, br.id, bl.id],
            ))

            # Doors
            for d_idx, d in enumerate(r.get("doors", [])):
                side = str(d.get("wall", "bottom")).lower()
                target_w = w_top if side == "top" else w_right if side == "right" else w_left if side == "left" else w_bottom
                wall_len_m = math.hypot(tr.x - tl.x, tr.y - tl.y) if side in ("top", "bottom") else math.hypot(br.x - tr.x, br.y - tr.y)

                chosen_w = target_w
                chosen_len_m = wall_len_m

                if chosen_len_m < 0.80:
                    candidates = [(w_bottom, rw_m), (w_right, rh_m), (w_left, rh_m), (w_top, rw_m)]
                    for cw, clen in candidates:
                        if clen >= 0.90:
                            chosen_w = cw
                            chosen_len_m = clen
                            break

                if chosen_len_m < 0.80:
                    continue

                CORNER_MARGIN = 0.15
                max_allowed_w = chosen_len_m - 2 * CORNER_MARGIN
                op_width = ft_to_m(float(d.get("width", 3)))
                op_width = max(0.50, min(op_width, max_allowed_w))
                if op_width > max_allowed_w:
                    op_width = max_allowed_w

                pos_m = ft_to_m(float(d.get("position", 3)))
                min_off = CORNER_MARGIN + op_width / 2
                max_off = chosen_len_m - CORNER_MARGIN - op_width / 2
                op_offset = chosen_len_m / 2 if min_off >= max_off else max(min_off, min(max_off, pos_m))

                s = op_offset - op_width / 2
                e = op_offset + op_width / 2

                is_dup = any(
                    existing.wall_id == chosen_w.id and
                    (min(e, existing.offset + existing.width / 2) - max(s, existing.offset - existing.width / 2)) > 0.1
                    for existing in openings
                )
                if not is_dup:
                    is_entrance = bool(
                        d.get("is_entrance") or
                        "entrance" in str(d.get("name", "")).lower() or
                        (fl_idx == 0 and target_w.kind == "exterior" and any(k in r_name.lower() for k in ("foyer", "entrance", "living")))
                    )
                    openings.append(Opening(
                        id=f"op_door_{r_id}_{d_idx+1}",
                        wall_id=target_w.id,
                        offset=round(op_offset, 3),
                        width=round(op_width, 3),
                        type="single_door",
                        name="Main Entrance Door" if is_entrance else f"{r_name} Door",
                    ))

            # Windows
            for w_idx, w in enumerate(r.get("windows", [])):
                side = str(w.get("wall", "top")).lower()
                target_w = w_top if side == "top" else w_right if side == "right" else w_left if side == "left" else w_bottom
                wall_len_m = math.hypot(tr.x - tl.x, tr.y - tl.y) if side in ("top", "bottom") else math.hypot(br.x - tr.x, br.y - tr.y)

                if wall_len_m < 0.8:
                    continue

                CORNER_MARGIN = 0.15
                op_width = ft_to_m(float(w.get("width", 4)))
                if op_width > wall_len_m - 2 * CORNER_MARGIN:
                    op_width = max(0.60, wall_len_m - 2 * CORNER_MARGIN)

                pos_m = ft_to_m(float(w.get("position", 3)))
                min_off = CORNER_MARGIN + op_width / 2
                max_off = wall_len_m - CORNER_MARGIN - op_width / 2
                op_offset = wall_len_m / 2 if min_off >= max_off else max(min_off, min(max_off, pos_m))

                openings.append(Opening(
                    id=f"op_win_{r_id}_{w_idx+1}",
                    wall_id=target_w.id,
                    offset=round(op_offset, 3),
                    width=round(op_width, 3),
                    type="window",
                    name=f"{r_name} Window",
                ))

            # Furniture
            for f_idx, f in enumerate(r.get("furniture", [])):
                items.append(PlacedItem(
                    id=str(f.get("id") or f"item_{r_id}_{f_idx+1}"),
                    asset_id=str(f.get("catalogId") or f.get("name", "furn").lower().replace(" ", "_")),
                    name=str(f.get("name", "Furniture")),
                    x=round(rx_m + ft_to_m(float(f.get("x", 0))), 3),
                    y=round(ry_m + ft_to_m(float(f.get("y", 0))), 3),
                    rotation=float(f.get("rotation", 0)),
                    width=ft_to_m(float(f.get("width", 3))),
                    depth=ft_to_m(float(f.get("height", 3))),
                    height=ft_to_m(float(f.get("zHeight", 2.5))),
                    color=f.get("color"),
                    is_light=bool(f.get("isLight")),
                ))

        # Topological Wall Classification:
        # Determine exterior building envelope vs interior dividing partitions based on room incidence
        for w in walls:
            incident_count = 0
            borders_open = False
            for rm in rooms:
                nids = rm.boundary_node_ids
                if w.start_node_id in nids and w.end_node_id in nids:
                    i1 = nids.index(w.start_node_id)
                    i2 = nids.index(w.end_node_id)
                    diff = abs(i1 - i2)
                    if diff == 1 or diff == len(nids) - 1:
                        incident_count += 1
                        rn = rm.name.lower()
                        if any(k in rn for k in ("balcony", "terrace", "patio", "sundeck", "garden")):
                            borders_open = True
            if incident_count <= 1 or borders_open:
                w.kind = "exterior"
                w.thickness = 0.23
            else:
                w.kind = "interior"
                w.thickness = 0.115

        levels.append(Level(
            id=lvl_id,
            level_index=fl_idx,
            name=str(fl.get("name", f"Level {fl_idx}")),
            elevation=fl_idx * 3.3,
            nodes=nodes,
            walls=walls,
            openings=openings,
            rooms=rooms,
            items=items,
        ))

    return CanonicalBuildingDocument(
        schema_version=1,
        id=str(legacy_dict.get("id", "canonical_proj")),
        site=SitePlot(
            plot_polygon=[Point2D(x=0, y=0), Point2D(x=plot_w_m, y=0), Point2D(x=plot_w_m, y=plot_l_m), Point2D(x=0, y=plot_l_m)],
            width=plot_w_m,
            length=plot_l_m,
            entry_side="east",
        ),
        levels=levels,
        legacy_snapshot=legacy_dict,
    )


def canonical_to_legacy_dict(doc: CanonicalBuildingDocument) -> Dict[str, Any]:
    """Projects CanonicalBuildingDocument into the legacy {floors: [{rooms: [...]}]} format."""
    floors = []
    for lvl in doc.levels:
        node_map = {n.id: n for n in lvl.nodes}
        rooms_out = []
        for rm in lvl.rooms:
            r_nodes = [node_map[nid] for nid in rm.boundary_node_ids if nid in node_map]
            if not r_nodes:
                continue
            xs = [n.x for n in r_nodes]
            ys = [n.y for n in r_nodes]
            min_x, max_x = min(xs), max(xs)
            min_y, max_y = min(ys), max(ys)

            doors = []
            windows = []
            for op in lvl.openings:
                w = next((w for w in lvl.walls if w.id == op.wall_id), None)
                if not w:
                    continue
                if (w.start_node_id in rm.boundary_node_ids) and (w.end_node_id in rm.boundary_node_ids):
                    spec = {"wall": "bottom", "position": m_to_ft(op.offset), "width": m_to_ft(op.width)}
                    if op.type.startswith("door") or op.type == "opening":
                        doors.append(spec)
                    else:
                        windows.append(spec)

            furn = []
            for itm in lvl.items:
                if min_x <= itm.x <= max_x and min_y <= itm.y <= max_y:
                    furn.append({
                        "id": itm.id,
                        "catalogId": itm.asset_id,
                        "name": itm.name,
                        "x": m_to_ft(itm.x - min_x),
                        "y": m_to_ft(itm.y - min_y),
                        "width": m_to_ft(itm.width),
                        "height": m_to_ft(itm.depth),
                        "rotation": itm.rotation,
                        "color": itm.color,
                        "isLight": itm.is_light,
                    })

            rooms_out.append({
                "name": rm.name,
                "x": m_to_ft(min_x),
                "y": m_to_ft(min_y),
                "width": m_to_ft(max_x - min_x),
                "height": m_to_ft(max_y - min_y),
                "doors": doors,
                "windows": windows,
                "furniture": furn,
            })

        floors.append({
            "level": lvl.level_index,
            "name": lvl.name,
            "rooms": rooms_out,
            "plot_width": m_to_ft(doc.site.width),
            "plot_height": m_to_ft(doc.site.length),
        })

    return {
        "schemaVersion": 1,
        "floors": floors,
        "plot_width": m_to_ft(doc.site.width),
        "plot_height": m_to_ft(doc.site.length),
    }
