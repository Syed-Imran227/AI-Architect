import os
import json
from dotenv import load_dotenv
from openai import OpenAI
from layout_validator import validate_and_fix_layout
from architectural_layout import build_layout, inject_furniture

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY is missing. Please add it to backend/.env")

llm_client = OpenAI(
    api_key=GROQ_API_KEY,
    base_url="https://api.groq.com/openai/v1",
)

MODEL = "llama-3.3-70b-versatile"


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
        Generates floor plan using deterministic Python layout engine.
        Python handles ALL geometry (rooms, corridors, doors, adjacency).
        The LLM is no longer used for spatial layout - only geometry is Python.
        Returns {"floors": [...]} or {"error": "..."}.
        """
        try:
            # Step 1: Build the full layout in Python (no LLM for geometry)
            layout = build_layout(
                length=length,
                width=width,
                bedrooms=bedrooms,
                bathrooms=bathrooms,
                floors=floors,
                balcony=balcony,
                terrace=terrace,
                lift=lift,
                vastu=bool(vastu),
                entry_dir=entry_dir,
            )

            # Step 2: Inject furniture deterministically
            layout = inject_furniture(layout)

            # Step 3: Run geometry validator/fixer (boundary clamp, overlap check)
            layout = _run_validator(layout, length, width)

            return layout

        except Exception as e:
            print(f"Layout generation failed: {e}")
            import traceback; traceback.print_exc()
            return {"error": str(e)}


# ── Validation helpers ───────────────────────────────────────────────────────

def _run_validator(layout: dict, plot_w: float, plot_h: float) -> dict:
    """
    Runs the full deterministic layout validator over every floor.
    Returns layout with added top-level keys:
      - validation_report: list[str]  (human-readable fixes applied)
      - circulation_warnings: list[str] (landlocked / no-door rooms)
    """
    floors = layout.get("floors", [])
    if not floors and "rooms" in layout:
        floors = [{"level": "Ground Floor", "rooms": layout.get("rooms", [])}]

    validated_floors = []
    all_validation_report: list[str] = []
    all_circulation_warnings: list[str] = []

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

        if result["validation_report"]:
            print(f"[layout_validator] {floor.get('level', 'Floor')}:")
            for entry in result["validation_report"]:
                print(f"  • {entry}")

        if result["status"] == "unresolved":
            print(f"[layout_validator] WARNING: Layout unresolved for {floor.get('level')}")

        # Separate circulation warnings from regular fix-report entries
        floor_circ_warnings: list[str] = []
        floor_report: list[str] = []
        level = str(floor.get("level", "Floor"))
        for entry in result["validation_report"]:
            if entry.startswith("CIRCULATION_WARNINGS:"):
                raw = entry[len("CIRCULATION_WARNINGS:"):]
                floor_circ_warnings.extend(
                    f"[{level}] {w}" for w in raw.split("|") if w
                )
            else:
                floor_report.append(f"[{level}] {entry}")

        all_validation_report.extend(floor_report)
        all_circulation_warnings.extend(floor_circ_warnings)

        validated_floors.append({
            "level": level,
            "rooms": result["rooms"],
        })

    return {
        "floors": validated_floors,
        "validation_report": all_validation_report,
        "circulation_warnings": all_circulation_warnings,
    }


def _validate_rooms(layout: dict, max_x: float, max_y: float) -> dict:
    """Legacy alias kept for call-sites in main.py or vastu_engine.py."""
    return _run_validator(layout, max_x, max_y)
