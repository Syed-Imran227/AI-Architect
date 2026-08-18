"""
energy_engine.py
Evaluates thermal efficiency and sun path optimization for a floor plan.
"""

from typing import Dict, Tuple

# We map the 3x3 grid to zones.
# For Vastu we used absolute compass, but here we can just use the same ZONE_MAP
# and rotate based on entry direction to find the absolute compass zones.
ZONE_MAP: Dict[Tuple[int, int], str] = {
    (0, 0): "NW", (1, 0): "N",  (2, 0): "NE",
    (0, 1): "W",  (1, 1): "C",  (2, 1): "E",
    (0, 2): "SW", (1, 2): "S",  (2, 2): "SE",
}

# The above ZONE_MAP assumes Top=North.
# We will use Vastu's mapping logic.
def _zone(room: dict, plot_w: float, plot_h: float) -> str:
    cx = room["x"] + room["width"]  / 2
    cy = room["y"] + room["height"] / 2
    col = 0 if cx < plot_w / 3 else (1 if cx < 2 * plot_w / 3 else 2)
    row = 0 if cy < plot_h / 3 else (1 if cy < 2 * plot_h / 3 else 2)
    return ZONE_MAP[(col, row)]

def _classify(name: str) -> str:
    n = name.lower()
    if "kitchen" in n: return "kitchen"
    if "bed" in n: return "bedroom"
    if "living" in n or "lounge" in n: return "living"
    if "bath" in n or "toilet" in n or "wc" in n: return "bathroom"
    if "stair" in n: return "staircase"
    return "other"

def score_energy(rooms: list, plot_w: float, plot_h: float, entry_dir: str) -> dict:
    """
    Score a layout based on natural lighting and thermal efficiency.
    Returns {score, grade, rules: [{rule, status, points, max, detail}]}
    """
    # For a real implementation, the absolute direction of the plot depends on entry_dir.
    # In Vastu, entry_dir is the literal direction the door faces.
    # We will score based on 3 simple thermal rules.
    
    typed = [(r, _classify(r["name"]), _zone(r, plot_w, plot_h)) for r in rooms]
    results = []
    total = 0
    
    # Rule 1: West Wall Heat Gain (Minimize living/bedrooms on the West)
    w_points = 35
    west_rooms = [t for r, t, z in typed if "W" in z]
    if any(t in ["bedroom", "living"] for t in west_rooms):
        pts = 10
        status = "warn"
        detail = "Bedrooms/Living spaces on West wall will experience high afternoon heat gain."
    else:
        pts = w_points
        status = "pass"
        detail = "Excellent. West wall is shielded from direct living areas."
    results.append({"rule": "West Wall Heat Gain", "status": status, "points": pts, "max": w_points, "detail": detail})
    total += pts

    # Rule 2: Morning Sun (East Exposure for Kitchen/Bedrooms)
    w_points = 35
    east_rooms = [t for r, t, z in typed if "E" in z]
    if any(t in ["kitchen", "bedroom"] for t in east_rooms):
        pts = w_points
        status = "pass"
        detail = "Great use of morning sun for Kitchen or Bedrooms on the East side."
    else:
        pts = 15
        status = "warn"
        detail = "East wall under-utilized for morning spaces."
    results.append({"rule": "Morning Sun Utilization", "status": status, "points": pts, "max": w_points, "detail": detail})
    total += pts

    # Rule 3: South Wall Thermal Buffering (Bathrooms/Stairs on South)
    w_points = 30
    south_rooms = [t for r, t, z in typed if "S" in z]
    if any(t in ["bathroom", "staircase"] for t in south_rooms):
        pts = w_points
        status = "pass"
        detail = "Bathrooms or stairs on South wall act as good thermal buffers."
    else:
        pts = 10
        status = "warn"
        detail = "Lack of thermal buffer on South wall."
    results.append({"rule": "South Thermal Buffer", "status": status, "points": pts, "max": w_points, "detail": detail})
    total += pts

    return {
        "score": total,
        "grade": "A" if total >= 80 else "B" if total >= 60 else "C",
        "rules": results
    }
