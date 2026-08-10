"""
inference.py
============
Phase 1 — Architect-Drafter Hybrid Model

The LLM (Llama-3.3-70b-versatile) acts as the Lead Architect:
  - It ONLY produces a topology/zoning JSON — never raw x,y,w,h coordinates.
  - The output is validated against TopologyResponse (Pydantic) before use.
  - On schema mismatch the system retries once, then falls back to a default topology.

The Python Drafter (architectural_layout.py) turns that topology into exact coordinates.
"""

from __future__ import annotations
import os
import json
from typing import Optional
from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel, ValidationError
from architectural_layout import build_layout_from_topology, inject_furniture, default_topology
from layout_validator import boundary_check_only

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY is missing. Please add it to backend/.env")

llm_client = OpenAI(
    api_key=GROQ_API_KEY,
    base_url="https://api.groq.com/openai/v1",
)

MODEL = "llama-3.3-70b-versatile"


# ── Phase 1: Topology Pydantic Schema ────────────────────────────────────────

class LeftBayTopology(BaseModel):
    rooms: list[str]
    bathrooms_allocated: int = 0

class RightBayTopology(BaseModel):
    rooms: list[str]
    open_plan_living_dining: bool = False
    kitchen_position: str = "rear"   # "front" | "middle" | "rear"

class SpineTopology(BaseModel):
    rooms: list[str]

class TopologyBody(BaseModel):
    left_bay: LeftBayTopology
    right_bay: RightBayTopology
    spine: SpineTopology

class TopologyResponse(BaseModel):
    topology: TopologyBody
    design_rationale: str = ""


# ── LLM prompt ───────────────────────────────────────────────────────────────

_ARCHITECT_SYSTEM = (
    "You are the Lead AI Architect. Your job is to determine the optimal zoning "
    "and structural topology for a floor plan based on user constraints. "
    "You DO NOT output spatial coordinates (x, y, w, h). You ONLY output structural "
    "intent as a valid JSON object — no markdown, no backticks, no explanations."
)

def _build_architect_prompt(
    length: float, width: float,
    bedrooms: int, bathrooms: int,
    duplex: int, balcony: int, terrace: int, lift: int,
    vastu: int, entry_dir: str,
) -> str:
    extras = []
    if duplex:  extras.append("duplex stairs required")
    if balcony: extras.append(f"{balcony} balcony/balconies")
    if terrace: extras.append("rooftop terrace")
    if lift:    extras.append("lift/elevator")
    extras_str = (", ".join(extras)) if extras else "none"

    vastu_str = "Strict Vastu Shastra compliance required." if vastu else "Modern layout preferred."

    return f"""
You are the Lead AI Architect. Design the optimal zoning topology for a floor plan.

# Input Constraints
- Plot: {length} ft wide x {width} ft deep
- Bedrooms: {bedrooms}
- Bathrooms: {bathrooms} (each bedroom should ideally have an en-suite bathroom)
- Entry direction: {entry_dir}
- Vastu: {vastu_str}
- Extras: {extras_str}

# Rules
1. The building is divided into 3 vertical bays: Left Bay (left ~35%), Spine (central corridor/stair, ~20%), Right Bay (right ~45%).
2. Ground Floor: Left Bay holds Parking + Kitchen (private/service zone). Right Bay holds Living + Dining (public zone). Spine holds Foyer + Corridor + Staircase.
3. Upper Floors: Left Bay and Right Bay hold Bedrooms with their attached Bathrooms. Spine holds Corridor + Staircase.
4. If Vastu=True: place Kitchen in South-East (right bay rear is ideal), Master Bedroom in South-West (left bay).
5. kitchen_position options: "front" (near entry), "middle", "rear" (opposite entry). Default is "rear".
6. bathrooms_allocated = how many of the {bathrooms} bathrooms go to that bay's bedrooms. The total across both bays must equal {bathrooms}.
7. "rooms" in each bay should list high-level room types in top-to-bottom order (e.g. ["Master Bedroom", "Bedroom 2"]).

# Output Schema (respond with ONLY this JSON, no wrapping):
{{
  "topology": {{
    "left_bay": {{
      "rooms": ["Master Bedroom", "Bedroom 2"],
      "bathrooms_allocated": 2
    }},
    "right_bay": {{
      "rooms": ["Living Room", "Dining Room", "Kitchen"],
      "open_plan_living_dining": false,
      "kitchen_position": "rear"
    }},
    "spine": {{
      "rooms": ["Foyer", "Corridor", "Staircase"]
    }}
  }},
  "design_rationale": "One-sentence explanation of zoning choices."
}}
"""


# ── LLM call + validation ─────────────────────────────────────────────────────

def _call_architect_llm(prompt: str, retries: int = 1) -> Optional[TopologyResponse]:
    """Call the LLM, parse and validate the topology JSON. Returns None on failure."""
    for attempt in range(retries + 1):
        try:
            response = llm_client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": _ARCHITECT_SYSTEM},
                    {"role": "user",   "content": prompt},
                ],
                max_tokens=1200,
                temperature=0.4 + attempt * 0.1,  # slightly more random on retry
            )
            raw = response.choices[0].message.content.strip()

            # Strip markdown fences if present
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]

            start = raw.find("{")
            end   = raw.rfind("}")
            if start == -1 or end == -1:
                print(f"[architect] Attempt {attempt+1}: No JSON found in response.")
                continue

            obj = json.loads(raw[start:end+1])
            topology = TopologyResponse(**obj)
            print(f"[architect] Topology OK: {topology.design_rationale}")
            return topology

        except (json.JSONDecodeError, ValidationError, Exception) as e:
            print(f"[architect] Attempt {attempt+1} failed: {e}")

    return None


# ── Main generator class ──────────────────────────────────────────────────────

class FloorPlanGenerator:
    def __init__(self):
        self.llm_client = llm_client
        self.model = MODEL

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
        Phase 1+2: Architect (LLM) generates topology, Drafter (Python) builds geometry.
        The LLM never sees or produces x,y,w,h coordinates.
        Returns {floors: [...]} or {error: "..."}.
        """
        try:
            # Step 1 — Ask the Architect LLM for a zoning topology
            prompt = _build_architect_prompt(
                length, width, bedrooms, bathrooms,
                duplex, balcony, terrace, lift, vastu, entry_dir
            )
            topology = _call_architect_llm(prompt, retries=1)

            if topology is None:
                print("[architect] LLM failed — using default topology fallback.")
                topology = default_topology(bedrooms, bathrooms)

            # Step 2 — Pass topology to the deterministic Python Drafter
            layout = build_layout_from_topology(
                topology=topology,
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

            # Step 3 — Inject furniture deterministically
            layout = inject_furniture(layout)

            # Step 4 — Phase 3: boundary-only safety check (never mutates valid geometry)
            layout = _run_boundary_check(layout, length, width)

            return layout

        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"[generator] Generation failed: {e}")
            return {"error": str(e)}


# ── Phase 3: Boundary-only validator (safety net, not fixer) ─────────────────

def _run_boundary_check(layout: dict, plot_w: float, plot_h: float) -> dict:
    """
    Runs boundary-clamp ONLY (no overlap push-apart).
    The Drafter guarantees no overlaps by construction.
    If a room is found outside the boundary here, it is a Drafter bug — log loudly.
    """
    floors = layout.get("floors", [])
    for floor in floors:
        rooms = floor.get("rooms", [])
        checked_rooms, clamped = boundary_check_only(rooms, plot_w, plot_h)
        if clamped:
            print(f"[boundary-check] WARNING: {len(clamped)} room(s) out of bounds in "
                  f"'{floor.get('level')}' — this indicates a Drafter bug: {clamped}")
        floor["rooms"] = checked_rooms
    return layout


# ── Legacy alias (kept for vastu_engine.py / main.py imports) ────────────────

def _validate_rooms(layout: dict, max_x: float, max_y: float) -> dict:
    """Legacy alias — now does boundary-only check."""
    return _run_boundary_check(layout, max_x, max_y)
