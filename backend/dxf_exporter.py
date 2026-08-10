import ezdxf
from ezdxf import units
import tempfile
import os

# 1 JSON unit = 1 foot = 304.8 mm in AutoCAD
SCALE = 304.8

def export_to_dxf(rooms: list) -> bytes:
    """
    Converts a list of room dicts (x, y, width, height in feet, name)
    into an AutoCAD R2010-compatible DXF file.
    Returns raw DXF bytes ready for download.
    """
    doc = ezdxf.new(dxfversion="R2010")
    doc.units = units.MM

    msp = doc.modelspace()

    # Layers
    doc.layers.add("WALLS",      color=7)   # white/black
    doc.layers.add("LABELS",     color=2)   # yellow
    doc.layers.add("DOORS",      color=3)   # green
    doc.layers.add("DIMENSIONS", color=4)   # cyan

    for room in rooms:
        x = room["x"]      * SCALE
        y = room["y"]      * SCALE
        w = room["width"]  * SCALE
        h = room["height"] * SCALE

        # ── Walls (closed polyline) ───────────────────────────────────────────
        pts = [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
        msp.add_lwpolyline(pts, close=True, dxfattribs={
            "layer":      "WALLS",
            "lineweight": 50,
        })

        # ── Room label (centred MTEXT) ────────────────────────────────────────
        cx, cy = x + w / 2, y + h / 2
        label  = f"{room['name']}\n{room['width']}' x {room['height']}'"
        mtext  = msp.add_mtext(label, dxfattribs={"layer": "LABELS"})
        mtext.set_location((cx, cy), attachment_point=5)   # 5 = MIDDLE_CENTER
        mtext.dxf.char_height = SCALE * 0.6
        mtext.dxf.width       = w * 0.85

        # ── Doors (from layout engine coordinates) ─────────────────────────────
        for door in room.get("doors", []):
            door_w = door.get("width", 3) * SCALE
            wall = door.get("wall", "bottom")
            pos = door.get("position", 0) * SCALE
            
            door_x, door_y = x, y
            start_angle, end_angle = 0, 90

            if wall == "bottom":
                door_x = x + pos
                door_y = y
                # draw arc sweeping up/right
                msp.add_arc(center=(door_x, door_y), radius=door_w, start_angle=0, end_angle=90, dxfattribs={"layer": "DOORS", "lineweight": 13})
                msp.add_line((door_x, door_y), (door_x + door_w, door_y), dxfattribs={"layer": "DOORS", "lineweight": 13})
                msp.add_line((door_x, door_y), (door_x, door_y + door_w), dxfattribs={"layer": "DOORS", "lineweight": 13})
            elif wall == "top":
                door_x = x + pos
                door_y = y + h
                msp.add_arc(center=(door_x, door_y), radius=door_w, start_angle=270, end_angle=360, dxfattribs={"layer": "DOORS", "lineweight": 13})
                msp.add_line((door_x, door_y), (door_x + door_w, door_y), dxfattribs={"layer": "DOORS", "lineweight": 13})
                msp.add_line((door_x, door_y), (door_x, door_y - door_w), dxfattribs={"layer": "DOORS", "lineweight": 13})
            elif wall == "left":
                door_x = x
                door_y = y + pos
                msp.add_arc(center=(door_x, door_y), radius=door_w, start_angle=0, end_angle=90, dxfattribs={"layer": "DOORS", "lineweight": 13})
                msp.add_line((door_x, door_y), (door_x, door_y + door_w), dxfattribs={"layer": "DOORS", "lineweight": 13})
                msp.add_line((door_x, door_y), (door_x + door_w, door_y), dxfattribs={"layer": "DOORS", "lineweight": 13})
            elif wall == "right":
                door_x = x + w
                door_y = y + pos
                msp.add_arc(center=(door_x, door_y), radius=door_w, start_angle=90, end_angle=180, dxfattribs={"layer": "DOORS", "lineweight": 13})
                msp.add_line((door_x, door_y), (door_x, door_y + door_w), dxfattribs={"layer": "DOORS", "lineweight": 13})
                msp.add_line((door_x, door_y), (door_x - door_w, door_y), dxfattribs={"layer": "DOORS", "lineweight": 13})

        # ── Width dimension line ──────────────────────────────────────────────
        try:
            dim = msp.add_linear_dim(
                base=(x, y - SCALE * 1.5),
                p1=(x, y),
                p2=(x + w, y),
                dimstyle="EZ_INSIDE",
                dxfattribs={"layer": "DIMENSIONS"},
            )
            dim.render()
        except Exception:
            pass

    # ── Write to temp file then read bytes back ───────────────────────────────
    # ezdxf >= 1.x write() requires a text stream; saveas() handles encoding
    with tempfile.NamedTemporaryFile(suffix=".dxf", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        doc.saveas(tmp_path)
        with open(tmp_path, "rb") as f:
            return f.read()
    finally:
        os.unlink(tmp_path)
