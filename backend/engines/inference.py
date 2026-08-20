"""
inference.py
============
Phase 1 — Architect-Drafter Hybrid Model

LLM Fallback Chain (tried in order):
  1. deepseek-ai/DeepSeek-V3-0324  via HuggingFace Inference Router (primary)
  2. Qwen/Qwen3-Coder-30B-A3B-Instruct via HuggingFace (HF backup)
  3. openai/gpt-oss-120b            via Groq (final backup)

All three scored 20/20 on accuracy. DeepSeek-V3 is primary for best reasoning.
The LLM ONLY produces topology/zoning JSON — never raw x,y,w,h coordinates.
The Python Drafter (architectural_layout.py) turns topology into exact coordinates.
"""

from __future__ import annotations
import os
import re
from typing import Optional
from openai import OpenAI
from pydantic import BaseModel, ValidationError
import json_repair
from engines.architectural_layout import build_layout_from_topology, inject_furniture, default_topology
from engines.layout_validator import boundary_check_only

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
HF_API_KEY   = os.getenv("HF_API_KEY")

if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY is missing. Please add it to backend/.env")
if not HF_API_KEY:
    raise ValueError("HF_API_KEY is missing. Please add it to backend/.env")

_hf_client   = OpenAI(api_key=HF_API_KEY,   base_url="https://router.huggingface.co/v1")
_groq_client = OpenAI(api_key=GROQ_API_KEY, base_url="https://api.groq.com/openai/v1")

# Fallback chain: tried in order until one succeeds
# (model_id, client, label)
_MODEL_CHAIN: list[tuple[str, OpenAI, str]] = [
    ("deepseek-ai/DeepSeek-V3-0324",            _hf_client,   "DeepSeek-V3 (HF primary)"),
    ("Qwen/Qwen3-Coder-30B-A3B-Instruct",       _hf_client,   "Qwen3-Coder (HF backup)"),
    ("openai/gpt-oss-120b",                     _groq_client, "gpt-oss-120b (Groq backup)"),
]

# Legacy aliases kept for FloorPlanGenerator.model attribute
llm_client = _groq_client
MODEL = "openai/gpt-oss-120b"


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

def _clean_llm_raw(raw: str) -> str:
    """Strip DeepSeek <think> blocks and markdown fences from LLM output."""
    # Strip <think>...</think> reasoning blocks (DeepSeek-R1 style)
    if "<think>" in raw:
        if "</think>" in raw:
            raw = raw[raw.rfind("</think>") + 8:].strip()
        else:
            # If the output was truncated and missing </think>, we can't reliably extract JSON.
            # However, we can try to find the last occurrence of '```json' or '{' just in case.
            pass
    # Strip ```json ... ``` markdown fences
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
    if fence:
        raw = fence.group(1).strip()
    return raw


def _call_architect_llm(prompt: str, retries: int = 0) -> Optional[TopologyResponse]:
    """
    Try each model in _MODEL_CHAIN until one returns a valid TopologyResponse.
    Falls back to the next model on any error. Returns None if all fail.
    """
    for model_id, client, label in _MODEL_CHAIN:
        for attempt in range(retries + 1):
            try:
                response = client.chat.completions.create(
                    model=model_id,
                    messages=[
                        {"role": "system", "content": _ARCHITECT_SYSTEM},
                        {"role": "user",   "content": prompt},
                    ],
                    max_tokens=4000,
                    temperature=0.4 + attempt * 0.1,
                )
                raw = (response.choices[0].message.content or "").strip()
                raw = _clean_llm_raw(raw)

                start = raw.find("{")
                end   = raw.rfind("}")
                if start == -1 or end == -1:
                    print(f"[architect:{label}] Attempt {attempt+1}: No JSON found.")
                    print(f"RAW DUMP (len={len(raw)}):\n{raw[:500]}...\n...\n{raw[-500:]}")
                    continue

                obj = json_repair.loads(raw[start:end+1])
                if not isinstance(obj, dict):
                    raise ValueError("LLM returned valid JSON, but it was not a dictionary object.")
                topology = TopologyResponse(**obj)
                safe_rationale = topology.design_rationale.encode("ascii", "ignore").decode("ascii")
                print(f"[architect:{label}] Topology OK: {safe_rationale}")
                return topology

            except (ValueError, ValidationError) as e:
                safe_err = str(e).encode("ascii", "ignore").decode("ascii")
                print(f"[architect:{label}] Attempt {attempt+1}: Parse error — {safe_err}")
            except Exception as e:
                safe_err = str(e).encode("ascii", "ignore").decode("ascii")
                print(f"[architect:{label}] Attempt {attempt+1}: API error — {safe_err}")
                break  # don't retry on API errors, move to next model

        print(f"[architect:{label}] All attempts failed — trying next model.")

    print("[architect] All models in chain failed. Returning None.")
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


# ── Fix 1: LLM-driven Vastu topology correction ───────────────────────────────

def _build_vastu_fix_prompt(
    length: float, width: float,
    bedrooms: int, bathrooms: int,
    violated_rules: list[dict],
    current_rationale: str,
) -> str:
    """Build a prompt asking the LLM to fix specific Vastu violations via topology changes."""
    rule_lines = "\n".join(
        f"  - {r['rule']}: {r['detail']} (currently {r['points']}/{r['max']})"
        for r in violated_rules
    )
    return f"""
You are the Lead AI Architect performing a Vastu compliance correction.

# Current Layout
- Plot: {length} ft wide x {width} ft deep
- Bedrooms: {bedrooms}, Bathrooms: {bathrooms}
- Current design rationale: {current_rationale}

# Vastu Violations to Fix
{rule_lines}

# Your Task
Revise the topology to address these violations. You MUST:
1. Keep the 3-bay structure (left_bay, spine, right_bay) — do NOT output coordinates.
2. Address the specific failing rules above (e.g. move Kitchen to SE by placing it in right_bay rear, move Master Bedroom to SW by placing it in left_bay).
3. Kitchen in right_bay with kitchen_position "rear" puts it in the Southeast — ideal for Vastu.
4. Master Bedroom in left_bay positions it in the Southwest — ideal for Vastu.
5. Total bathrooms_allocated across both bays must sum to {bathrooms}.

# Output Schema (ONLY this JSON, no wrapping, no explanations):
{{
  "topology": {{
    "left_bay": {{
      "rooms": ["Master Bedroom"],
      "bathrooms_allocated": 1
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
  "design_rationale": "One sentence explaining the Vastu corrections made."
}}
"""


def fix_vastu_topology(
    length: float,
    width: float,
    bedrooms: int,
    bathrooms: int,
    floors: int,
    entry_dir: str,
    violated_rules: list[dict],
    max_retries: int = 2,
    balcony: int = 0,
    terrace: int = 0,
    lift: int = 0,
) -> dict:
    """
    Use the LLM to correct Vastu violations via topology changes, then rerun the Drafter.

    Returns:
        {
          "layout": dict,               # new full floor layout
          "converged": bool,            # True if score improved
          "attempts": int,              # how many LLM calls were made
          "design_rationale": str,
        }
    """

    best_layout: Optional[dict] = None
    best_rationale = ""

    current_violations = violated_rules
    for attempt in range(1, max_retries + 1):
        prompt = _build_vastu_fix_prompt(
            length, width, bedrooms, bathrooms,
            current_violations, best_rationale or "No prior rationale."
        )
        topology = _call_architect_llm(prompt, retries=1)

        if topology is None:
            print(f"[vastu-fix] Attempt {attempt}: LLM returned no topology — skipping.")
            continue

        try:
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
                vastu=True,
                entry_dir=entry_dir,
            )
            layout = inject_furniture(layout)
            layout = _run_boundary_check(layout, length, width)
            best_layout = layout
            best_rationale = topology.design_rationale
            print(f"[vastu-fix] Attempt {attempt}: topology applied. Rationale: {best_rationale}")
            break  # one successful Drafter run is enough per attempt
        except Exception as e:
            print(f"[vastu-fix] Attempt {attempt}: Drafter failed — {e}")
            continue

    return {
        "layout": best_layout,
        "converged": best_layout is not None,
        "attempts": attempt,
        "design_rationale": best_rationale,
    }


def _build_nbc_fix_prompt(
    length: float, width: float,
    bedrooms: int, bathrooms: int,
    violated_rules: list[dict],
    current_rationale: str,
) -> str:
    """Build a prompt asking the LLM to fix specific NBC violations via topology changes."""
    rule_lines = "\n".join(
        f"  - {r['rule']}: {r['detail']} (currently {r['points']}/{r['max']})"
        for r in violated_rules
    )
    return f"""
You are the Lead AI Architect performing an NBC compliance correction.

# Current Layout
- Plot: {length} ft wide x {width} ft deep
- Bedrooms: {bedrooms}, Bathrooms: {bathrooms}
- Current design rationale: {current_rationale}

# NBC Violations to Fix
{rule_lines}

# Your Task
Revise the topology to address these violations. You MUST:
1. Keep the 3-bay structure (left_bay, spine, right_bay) — do NOT output coordinates.
2. Address the specific failing rules above. For NBC compliance, setbacks and area ratios are critical. 
3. You can reduce room counts or move rooms to different bays to satisfy area requirements.
4. Total bathrooms_allocated across both bays must sum to {bathrooms}.

# Output Schema (ONLY this JSON, no wrapping, no explanations):
{{
  "topology": {{
    "left_bay": {{
      "rooms": ["Master Bedroom"],
      "bathrooms_allocated": 1
    }},
    "right_bay": {{
      "rooms": ["Living Room", "Dining Room", "Kitchen"],
      "open_plan_living_dining": true,
      "kitchen_position": "rear"
    }},
    "spine": {{
      "rooms": ["Foyer", "Corridor", "Staircase"]
    }}
  }},
  "design_rationale": "One sentence explaining the NBC corrections made."
}}
"""


def fix_nbc_topology(
    length: float,
    width: float,
    bedrooms: int,
    bathrooms: int,
    floors: int,
    entry_dir: str,
    violated_rules: list[dict],
    max_retries: int = 2,
    balcony: int = 0,
    terrace: int = 0,
    lift: int = 0,
) -> dict:
    """
    Use the LLM to correct NBC violations via topology changes, then rerun the Drafter.

    Returns:
        {
          "layout": dict,
          "converged": bool,
          "attempts": int,
          "design_rationale": str,
        }
    """

    best_layout: Optional[dict] = None
    best_rationale = ""

    current_violations = violated_rules
    for attempt in range(1, max_retries + 1):
        prompt = _build_nbc_fix_prompt(
            length, width, bedrooms, bathrooms,
            current_violations, best_rationale or "No prior rationale."
        )
        topology = _call_architect_llm(prompt, retries=1)

        if topology is None:
            print(f"[nbc-fix] Attempt {attempt}: LLM returned no topology — skipping.")
            continue

        try:
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
                vastu=False, # NBC fixes shouldn't enforce vastu
                entry_dir=entry_dir,
            )
            layout = inject_furniture(layout)
            layout = _run_boundary_check(layout, length, width)
            best_layout = layout
            best_rationale = topology.design_rationale
            print(f"[nbc-fix] Attempt {attempt}: topology applied. Rationale: {best_rationale}")
            break
        except Exception as e:
            print(f"[nbc-fix] Attempt {attempt}: Drafter failed — {e}")
            continue

    return {
        "layout": best_layout,
        "converged": best_layout is not None,
        "attempts": attempt,
        "design_rationale": best_rationale,
    }


# ── Fix 2: LLM-driven single-room topology regeneration ──────────────────────

_ROOM_SIZE_VOCAB = {
    "small":       0.7,
    "compact":     0.8,
    "medium":      1.0,
    "large":       1.2,
    "extra large": 1.4,
    "bigger":      1.2,
    "larger":      1.2,
    "smaller":     0.8,
    "wider":       1.2,
    "narrower":    0.8,
}

def _build_room_regen_prompt(
    room_name: str,
    instruction: str,
    length: float,
    width: float,
    bedrooms: int,
    bathrooms: int,
) -> str:
    return f"""
You are the Lead AI Architect handling a targeted room resize request.

# Current Layout
- Plot: {length} ft wide x {width} ft deep
- Bedrooms: {bedrooms}, Bathrooms: {bathrooms}

# User Request
Room: "{room_name}"
Instruction: "{instruction}"

# Your Task
Revise the topology to honour this request. The only thing you can change is:
- Which bay a room is allocated to
- The kitchen_position ("front" | "middle" | "rear")
- The bathrooms_allocated counts

You CANNOT change the 3-bay structure and MUST NOT output any coordinates.
If the request implies the room should be larger, prioritise it in its bay by listing it first.
If smaller, list it last.

# Output Schema (ONLY this JSON, no wrapping):
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
  "design_rationale": "One sentence explaining what changed for the room."
}}
"""


def fix_room_topology(
    room_name: str,
    instruction: str,
    length: float,
    width: float,
    bedrooms: int,
    bathrooms: int,
    floors: int,
    entry_dir: str,
    balcony: int = 0,
    terrace: int = 0,
    lift: int = 0,
) -> dict:
    """
    Use the LLM to update the topology to honour a natural-language room edit,
    then rerun the Drafter so the full layout is recomputed without overlaps.

    Returns:
        {
          "layout": dict | None,
          "converged": bool,
          "design_rationale": str,
          "llm_called": True,
        }
    """

    prompt = _build_room_regen_prompt(
        room_name, instruction, length, width, bedrooms, bathrooms
    )
    topology = _call_architect_llm(prompt, retries=1)

    if topology is None:
        return {
            "layout": None,
            "converged": False,
            "design_rationale": "LLM did not return a valid topology.",
            "llm_called": True,
        }

    try:
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
            vastu=False,
            entry_dir=entry_dir,
        )
        layout = inject_furniture(layout)
        layout = _run_boundary_check(layout, length, width)
        print(f"[room-regen] LLM topology applied: {topology.design_rationale}")
        return {
            "layout": layout,
            "converged": True,
            "design_rationale": topology.design_rationale,
            "llm_called": True,
        }
    except Exception as e:
        print(f"[room-regen] Drafter failed after LLM topology: {e}")
        return {
            "layout": None,
            "converged": False,
            "design_rationale": f"Drafter error: {e}",
            "llm_called": True,
        }

