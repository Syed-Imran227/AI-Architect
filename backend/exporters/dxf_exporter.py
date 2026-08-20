"""
dxf_exporter.py
===============
Exports a list of room dicts to AutoCAD R2010-compatible DXF.

Door arc logic is synced with InteractiveBlueprint.tsx:
  - Hinge at one end of the door opening on the wall
  - Door leaf swings INWARD (into the room), not outward
  - Arc center = hinge point, radius = door width
  - Wall gap drawn as a white/thin line over the wall to show the opening

1 JSON unit = 1 foot = 304.8 mm in AutoCAD
"""

import ezdxf
from ezdxf import units
import tempfile
import os

SCALE = 304.8   # 1 ft in mm


def _draw_door_inward(msp, room_x, room_y, room_w, room_h,
                      wall: str, pos: float, door_w: float, layer: str) -> None:
    """
    Draw a door arc that swings INWARD into the room.

    Coordinate system (DXF model space):
      Origin at (room_x, room_y) — bottom-left corner of the room.
      x increases right, y increases up (standard DXF).

    For each wall, the hinge is placed at the leading edge of the
    door opening, and the arc sweeps 90° inward.

    Wall mapping (to match SVG coordinate system where y increases DOWN):
      "bottom" wall = y=room_y   (top of SVG room  = bottom in DXF since y flipped)
      "top"    wall = y=room_y+h (bottom of SVG room)
      "left"   wall = x=room_x
      "right"  wall = x=room_x+w
    """
    # DXF attribs for doors
    attribs = {"layer": layer, "lineweight": 18}
    wall_attribs = {"layer": layer, "lineweight": 13}

    x, y, w, h = room_x, room_y, room_w, room_h

    if wall == "bottom":
        hx = x + pos
        hy = y + h        # top face of room in DXF
        # Leaf end goes inward (downward in DXF)
        leaf_x = hx
        leaf_y = hy - door_w
        # Arc sweeps from 270 (leaf) to 360/0 (wall opening)
        msp.add_arc(center=(hx, hy), radius=door_w,
                    start_angle=270, end_angle=0, dxfattribs=attribs)
        msp.add_line((hx, hy), (leaf_x, leaf_y), dxfattribs=wall_attribs)   # door leaf
        # Wall gap (thin white-ish line over the wall to indicate opening)
        msp.add_line((hx, hy), (hx + door_w, hy), dxfattribs={"layer": "WALLOPENING", "lineweight": 5})

    elif wall == "top":
        hx = x + pos
        hy = y            # bottom face of room
        # Leaf end goes inward (upward in DXF)
        leaf_x = hx
        leaf_y = hy + door_w
        # Arc sweeps from 0 (wall opening) to 90 (leaf)
        msp.add_arc(center=(hx, hy), radius=door_w,
                    start_angle=0, end_angle=90, dxfattribs=attribs)
        msp.add_line((hx, hy), (leaf_x, leaf_y), dxfattribs=wall_attribs)
        msp.add_line((hx, hy), (hx + door_w, hy), dxfattribs={"layer": "WALLOPENING", "lineweight": 5})

    elif wall == "left":
        hx = x            # left face
        hy = y + pos
        # Leaf end goes inward (rightward in DXF)
        leaf_x = hx + door_w
        leaf_y = hy
        # Arc sweeps from 0 (leaf) to 90 (wall opening)
        msp.add_arc(center=(hx, hy), radius=door_w,
                    start_angle=0, end_angle=90, dxfattribs=attribs)
        msp.add_line((hx, hy), (leaf_x, leaf_y), dxfattribs=wall_attribs)
        msp.add_line((hx, hy), (hx, hy + door_w), dxfattribs={"layer": "WALLOPENING", "lineweight": 5})

    elif wall == "right":
        hx = x + w        # right face
        hy = y + pos
        # Leaf end goes inward (leftward in DXF)
        leaf_x = hx - door_w
        leaf_y = hy
        # Arc sweeps from 90 (wall opening) to 180 (leaf)
        msp.add_arc(center=(hx, hy), radius=door_w,
                    start_angle=90, end_angle=180, dxfattribs=attribs)
        msp.add_line((hx, hy), (leaf_x, leaf_y), dxfattribs=wall_attribs)
        msp.add_line((hx, hy), (hx, hy + door_w), dxfattribs={"layer": "WALLOPENING", "lineweight": 5})


def export_to_dxf(rooms: list) -> bytes:
    """
    Converts a list of room dicts (x, y, width, height in feet, name, doors)
    into an AutoCAD R2010-compatible DXF file.
    Returns raw DXF bytes ready for download.
    """
    doc = ezdxf.new(dxfversion="R2010")
    doc.units = units.MM

    msp = doc.modelspace()

    # Layers
    doc.layers.add("WALLS",       color=7)    # white/black
    doc.layers.add("LABELS",      color=2)    # yellow
    doc.layers.add("DOORS",       color=3)    # green — inward arc + leaf
    doc.layers.add("WALLOPENING", color=7)    # white — wall gap at door
    doc.layers.add("WINDOW",      color=4)    # cyan — window double-line symbol
    doc.layers.add("FURNITURE",   color=8)    # dark gray
    doc.layers.add("DIMENSIONS",  color=4)    # cyan

    for room in rooms:
        rx = room["x"]      * SCALE
        ry = room["y"]      * SCALE
        rw = room["width"]  * SCALE
        rh = room["height"] * SCALE

        # ── Walls (closed polyline) ───────────────────────────────────────────
        pts = [(rx, ry), (rx + rw, ry), (rx + rw, ry + rh), (rx, ry + rh)]
        msp.add_lwpolyline(pts, close=True, dxfattribs={
            "layer":      "WALLS",
            "lineweight": 50,
        })

        # ── Room label (centred MTEXT) ────────────────────────────────────────
        cx, cy = rx + rw / 2, ry + rh / 2
        label  = f"{room['name']}\n{room['width']}' x {room['height']}'"
        mtext  = msp.add_mtext(label, dxfattribs={"layer": "LABELS"})
        mtext.set_location((cx, cy), attachment_point=5)   # 5 = MIDDLE_CENTER
        mtext.dxf.char_height = SCALE * 0.6
        mtext.dxf.width       = rw * 0.85

        # ── Doors — inward-swinging arcs matching the SVG frontend ────────────
        for door in room.get("doors", []):
            door_w_ft = door.get("width", 3)
            wall      = door.get("wall", "bottom")
            pos_ft    = door.get("position", 0)

            door_w_mm = door_w_ft * SCALE
            pos_mm    = pos_ft    * SCALE

            # Clamp door width so it fits inside the room on that axis
            if wall in ("bottom", "top"):
                max_dw = rw - pos_mm - SCALE * 0.3
            else:
                max_dw = rh - pos_mm - SCALE * 0.3
            door_w_mm = max(SCALE * 1.0, min(door_w_mm, max_dw))

            _draw_door_inward(
                msp,
                room_x=rx, room_y=ry,
                room_w=rw, room_h=rh,
                wall=wall,
                pos=pos_mm,
                door_w=door_w_mm,
                layer="DOORS",
            )

        # ── Windows — double-line symbol on exterior walls ────────────────────
        for window in room.get("windows", []):
            wall    = window.get("wall", "")
            w_pos   = window.get("position", 0) * SCALE
            w_width = window.get("width", 3)    * SCALE
            gap     = SCALE * 0.15   # 0.15 ft gap between the two parallel lines in mm
            w_attribs = {"layer": "WINDOW", "lineweight": 25}

            if wall == "top":
                # SVG top = DXF bottom face (y=ry)
                x1, x2, y = rx + w_pos, rx + w_pos + w_width, ry
                msp.add_line((x1, y),       (x2, y),       dxfattribs=w_attribs)
                msp.add_line((x1, y - gap), (x2, y - gap), dxfattribs=w_attribs)
                for tx in [x1, x2]:
                    msp.add_line((tx, y - gap * 2), (tx, y + gap), dxfattribs=w_attribs)
            elif wall == "bottom":
                # SVG bottom = DXF top face (y=ry+rh)
                x1, x2, y = rx + w_pos, rx + w_pos + w_width, ry + rh
                msp.add_line((x1, y),       (x2, y),       dxfattribs=w_attribs)
                msp.add_line((x1, y + gap), (x2, y + gap), dxfattribs=w_attribs)
                for tx in [x1, x2]:
                    msp.add_line((tx, y - gap), (tx, y + gap * 2), dxfattribs=w_attribs)
            elif wall == "left":
                y1, y2, x = ry + w_pos, ry + w_pos + w_width, rx
                msp.add_line((x,       y1), (x,       y2), dxfattribs=w_attribs)
                msp.add_line((x - gap, y1), (x - gap, y2), dxfattribs=w_attribs)
                for ty in [y1, y2]:
                    msp.add_line((x - gap * 2, ty), (x + gap, ty), dxfattribs=w_attribs)
            elif wall == "right":
                y1, y2, x = ry + w_pos, ry + w_pos + w_width, rx + rw
                msp.add_line((x,       y1), (x,       y2), dxfattribs=w_attribs)
                msp.add_line((x + gap, y1), (x + gap, y2), dxfattribs=w_attribs)
                for ty in [y1, y2]:
                    msp.add_line((x - gap, ty), (x + gap * 2, ty), dxfattribs=w_attribs)

        # ── Furniture ─────────────────────────────────────────────────────────────
        for furn in room.get("furniture", []):
            fx = rx + (furn["x"] * SCALE)
            fy = ry + (furn["y"] * SCALE)
            fw = furn["width"] * SCALE
            fh = furn["height"] * SCALE
            
            pts = [(fx, fy), (fx + fw, fy), (fx + fw, fy + fh), (fx, fy + fh)]
            msp.add_lwpolyline(pts, close=True, dxfattribs={"layer": "FURNITURE", "lineweight": 13})
            
            # Furniture Label
            fcx, fcy = fx + fw / 2, fy + fh / 2
            f_label = msp.add_mtext(furn["name"], dxfattribs={"layer": "FURNITURE"})
            f_label.set_location((fcx, fcy), attachment_point=5)
            f_label.dxf.char_height = SCALE * 0.3
            f_label.dxf.width = fw * 0.9
        # ── Width dimension line ──────────────────────────────────────────────
        try:
            dim = msp.add_linear_dim(
                base=(rx, ry - SCALE * 1.5),
                p1=(rx, ry),
                p2=(rx + rw, ry),
                dimstyle="EZ_INSIDE",
                dxfattribs={"layer": "DIMENSIONS"},
            )
            dim.render()
        except Exception:
            pass

    # ── Write to temp file then read bytes back ───────────────────────────────
    with tempfile.NamedTemporaryFile(suffix=".dxf", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        doc.saveas(tmp_path)
        with open(tmp_path, "rb") as f:
            return f.read()
    finally:
        os.unlink(tmp_path)
