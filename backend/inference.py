import os
import json
from dotenv import load_dotenv
from openai import OpenAI
from layout_validator import validate_and_fix_layout

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY is missing. Please add it to backend/.env")

llm_client = OpenAI(
    api_key=GROQ_API_KEY,
    base_url="https://api.groq.com/openai/v1",
)

MODEL = "openai/gpt-oss-120b"


class FloorPlanGenerator:
    def __init__(self):
        self.llm_client = llm_client
        self.model = MODEL

    # ──────────────────────────────────────────────────────────────────────────
    def generate_floorplan_json(
        self,
        plot_size: float,
        length: float,
        width: float,
        bedrooms: int,
        bathrooms: int,
        floors: int,
        duplex: int,
        balcony: int,
        terrace: int,
        lift: int,
        vastu: int,
        entry_dir: str = "East",
    ) -> dict:
        """
        Prompts Llama-3 to produce a non-overlapping JSON room layout.
        Returns {"rooms": [...]} or {"error": "..."}.
        """
        # Build extras list
        extras = []
        if balcony:  extras.append(f"{balcony} balcon{'ies' if balcony > 1 else 'y'}")
        if terrace:  extras.append("1 terrace")
        if lift:     extras.append("1 lift lobby")
        extras_str = ", ".join(extras) if extras else "none"

        # Vastu-specific placement rules injected when requested
        half_l, half_w = round(length / 2), round(width / 2)
        vastu_rules = ""
        if vastu:
            vastu_rules = f"""
VASTU COMPLIANCE (mandatory):
- Kitchen:        Southeast quadrant → x >= {half_l}, y <= {half_w}
- Master Bedroom: Southwest quadrant → x <= {half_l}, y <= {half_w}
- Living Room:    North or East side → y >= {half_w}
- Hall/Entrance:  Entry from {entry_dir} side
- Prayer Room (if included): Northeast corner → x >= {half_l}, y >= {half_w}
"""

        system_msg = (
            "You are a precise architectural layout engine. "
            "You output ONLY valid JSON — no markdown, no explanations, no extra text. "
            "The JSON must have a top-level key 'floors' whose value is an array of floor objects, "
            "each with 'level' (string) and 'rooms' (array of room objects with furniture)."
        )

        # Pre-compute good column splits for the prompt
        col1 = round(length * 0.55)   # wider left column
        col2 = length - col1           # narrower right column
        row1 = round(width  * 0.55)
        row2 = width  - row1

        user_msg = f"""Generate a complete 2D architectural floor plan for the following house.

━━━ PLOT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Length : {length} ft  |  Width : {width} ft  |  Total : {plot_size} sqft
Entry  : {entry_dir}  |  Floors: {floors}

━━━ ROOMS REQUIRED ━━━━━━━━━━━━━━━━━━━━━━━━━━━
{bedrooms} Bedroom(s), {bathrooms} Bathroom(s), 1 Kitchen, 1 Living Room, 1 Dining Room
Extras: {extras_str}
{vastu_rules}
━━━ SPACE-FILL STRATEGY (CRITICAL) ━━━━━━━━━━━
Think of the {length}×{width} ft plot as a grid of rectangles that must tile perfectly.
Use this partitioning approach:
  Column A (x=0 to {col1}): Living Room + Bedrooms stacked top to bottom
  Column B (x={col1} to {length}): Kitchen + Dining + Bathrooms stacked top to bottom
  Any leftover strip: Hall, Balcony, or Parking

You MUST achieve ≥ 90% plot coverage.
Room widths in Column A must SUM to exactly {length} ft on shared rows.
Room heights in each column must SUM to exactly {width} ft.
Never leave an unassigned rectangle — if a room list runs short, widen adjacent rooms.

━━━ HARD RULES (violations = invalid output) ━━
1. All x, y, width, height are NON-NEGATIVE INTEGERS in feet.
2. Every room: x+width ≤ {length}  AND  y+height ≤ {width}.
3. Zero overlaps — no two rooms share interior area.
4. Adjacent rooms share a wall (edge-to-edge, no float gaps).
5. SELF-CHECK before outputting: sum of all room areas on Ground Floor must be
   ≥ {round(plot_size * 0.9)} sqft  (90% of {plot_size} sqft).

━━━ ROOM SIZE GUIDE ━━━━━━━━━━━━━━━━━━━━━━━━━━
Master Bedroom  14×12  |  Bedroom   12×10  |  Bathroom  8×6
Living Room     {col1}×{row1}  |  Kitchen   {col2}×{row2}  |  Dining    {col2}×{round(width*0.3)}
Hall/Foyer      10×6   |  Balcony   10×5   |  Parking   12×8

━━━ FURNITURE PER ROOM (1–4 items) ━━━━━━━━━━━
Coordinates (x, y) are RELATIVE to room's top-left corner.
Furniture must be ≥ 1 ft from walls and must fit inside room.
  Double Bed 7×5  |  Single Bed 6×4  |  Wardrobe 4×2
  Sofa 7×3        |  Coffee Table 4×2  |  TV Unit 5×1
  Dining Table 5×3  |  Kitchen Counter 8×2  |  Kitchen Island 4×2
  Toilet 3×2      |  Bathtub 4×3     |  Study Desk 4×2

━━━ RETURN FORMAT (JSON only, no markdown) ━━━
{{"floors": [
  {{"level": "Ground Floor", "rooms": [
    {{"name": "Living Room",   "x": 0,     "y": 0,     "width": {col1}, "height": {row1},
     "furniture": [{{"name": "Sofa",         "x": 2, "y": 1, "width": 7, "height": 3}},
                   {{"name": "Coffee Table", "x": 3, "y": 5, "width": 4, "height": 2}},
                   {{"name": "TV Unit",      "x": 5, "y": {row1-2}, "width": 5, "height": 1}}]}},
    {{"name": "Kitchen",       "x": {col1}, "y": 0,     "width": {col2}, "height": {row2},
     "furniture": [{{"name": "Kitchen Counter", "x": 1, "y": 1, "width": {max(col2-2,4)}, "height": 2}}]}},
    {{"name": "Master Bedroom","x": 0,     "y": {row1}, "width": {col1}, "height": {row2},
     "furniture": [{{"name": "Double Bed", "x": 2, "y": 2, "width": 7, "height": 5}},
                   {{"name": "Wardrobe",   "x": {col1-5}, "y": 1, "width": 4, "height": 2}}]}}
  ]}}
]}}

Now generate the FULL floor plan with ALL required rooms and furniture for ALL {floors} floor(s).
Every floor must partition the {length}×{width} plot with ≥ 90% coverage."""

        try:
            response = self.llm_client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_msg},
                    {"role": "user",   "content": user_msg},
                ],
                max_tokens=2500,
                temperature=0.05,
            )
            content = response.choices[0].message.content.strip()

            # Extract JSON even if the model adds surrounding text
            start = content.find("{")
            end   = content.rfind("}")
            if start != -1 and end != -1:
                layout = json.loads(content[start : end + 1])
                # ── Step 4: Full deterministic geometry validation & fix ──
                layout = _run_validator(layout, length, width)
                return layout
            return {"error": "Model returned no valid JSON"}

        except Exception as e:
            print(f"JSON generation failed: {e}")
            return {"error": str(e)}


# ── Validation helpers ───────────────────────────────────────────────────────

def _run_validator(layout: dict, plot_w: float, plot_h: float) -> dict:
    """
    Runs the full deterministic layout validator over every floor.
    Re-validated after EVERY LLM round-trip (initial generation + Vastu fixes).
    """
    floors = layout.get("floors", [])
    # Fallback: if model forgot the 'floors' wrapper
    if not floors and "rooms" in layout:
        floors = [{"level": "Ground Floor", "rooms": layout.get("rooms", [])}]

    validated_floors = []
    for floor in floors:
        rooms = floor.get("rooms", [])
        if not rooms:
            continue

        result = validate_and_fix_layout(
            rooms=rooms,
            plot_width=plot_w,
            plot_height=plot_h,
            entrance_point=(0.0, 0.0),
        )

        # Log any fixes applied for debugging
        if result["validation_report"]:
            print(f"[layout_validator] {floor.get('level', 'Floor')}:")
            for entry in result["validation_report"]:
                print(f"  • {entry}")

        if result["status"] == "unresolved":
            print(f"[layout_validator] WARNING: Layout unresolved for {floor.get('level')}")

        validated_floors.append({
            "level": str(floor.get("level", "Floor")),
            "rooms": result["rooms"],
        })

    return {"floors": validated_floors}


def _validate_rooms(layout: dict, max_x: float, max_y: float) -> dict:
    """
    Legacy alias — now delegates to the full validator.
    Kept for any existing call-sites in main.py or vastu_engine.py.
    """
    return _run_validator(layout, max_x, max_y)
