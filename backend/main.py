from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import Response
from pydantic import BaseModel
from typing import List, Any

from inference import FloorPlanGenerator, llm_client
from dxf_exporter import export_to_dxf
from floor_renderer import render_floor_plan
from vastu_engine import score_vastu
from layout_validator import validate_and_fix_layout
import os
import uuid
import json
import base64
from datetime import datetime
from bson import ObjectId

# Auth and DB imports
from auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user,
)
from database import users_collection, projects_collection
from models import UserCreate, UserLogin, ProjectCreate, ProjectResponse

app = FastAPI(title="AI Architect API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

public_dir = os.path.join(os.path.dirname(__file__), "public")
os.makedirs(os.path.join(public_dir, "downloads"), exist_ok=True)
app.mount("/public", StaticFiles(directory=public_dir), name="public")

ai_generator = FloorPlanGenerator()


class GenerateRequest(BaseModel):
    plotSize: float
    length: float
    width: float
    floors: int
    duplex: bool
    bedrooms: int
    bathrooms: int
    kitchen: int
    balcony: int
    terrace: bool
    lift: bool
    parking: bool
    vastuToggle: bool
    entryDir: str


@app.get("/")
def read_root():
    return {"message": "AI Architect API — Programmatic Floor Plan Generator"}


# ── Authentication Routes ─────────────────────────────────────────────────────

@app.post("/auth/register")
async def register_user(user: UserCreate):
    existing_user = await users_collection.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = get_password_hash(user.password)
    user_dict = {
        "name": user.name,
        "email": user.email,
        "hashed_password": hashed_password,
        "created_at": datetime.utcnow()
    }
    
    result = await users_collection.insert_one(user_dict)
    
    # Create token for auto-login after register
    access_token = create_access_token(data={"sub": str(result.inserted_id)})
    return {"access_token": access_token, "token_type": "bearer", "user": {"id": str(result.inserted_id), "name": user.name, "email": user.email}}


@app.post("/auth/login")
async def login_user(user: UserLogin):
    db_user = await users_collection.find_one({"email": user.email})
    if not db_user or not verify_password(user.password, db_user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    access_token = create_access_token(data={"sub": str(db_user["_id"])})
    return {"access_token": access_token, "token_type": "bearer", "user": {"id": str(db_user["_id"]), "name": db_user["name"], "email": db_user["email"]}}


@app.get("/auth/me")
async def read_users_me(current_user: dict = Depends(get_current_user)):
    return {"id": current_user["id"], "name": current_user["name"], "email": current_user["email"]}


# ── Projects / Designs Routes ─────────────────────────────────────────────────

@app.get("/projects", response_model=List[ProjectResponse])
async def get_projects(current_user: dict = Depends(get_current_user)):
    cursor = projects_collection.find({"user_id": current_user["id"]}).sort("created_at", -1)
    projects = await cursor.to_list(length=100)
    for p in projects:
        p["id"] = str(p["_id"])
    return projects

@app.post("/projects", response_model=ProjectResponse)
async def create_project(project: ProjectCreate, current_user: dict = Depends(get_current_user)):
    project_dict = project.model_dump()
    project_dict["user_id"] = current_user["id"]
    project_dict["created_at"] = datetime.utcnow()
    
    result = await projects_collection.insert_one(project_dict)
    project_dict["id"] = str(result.inserted_id)
    return project_dict

@app.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, current_user: dict = Depends(get_current_user)):
    project = await projects_collection.find_one({"_id": ObjectId(project_id), "user_id": current_user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project["id"] = str(project["_id"])
    return project

@app.delete("/projects/{project_id}")
async def delete_project(project_id: str, current_user: dict = Depends(get_current_user)):
    result = await projects_collection.delete_one({"_id": ObjectId(project_id), "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found or not authorized")
    return {"status": "success", "message": "Project deleted"}



@app.post("/generate")
def generate_plans(req: GenerateRequest):
    plan_id = f"plan_{uuid.uuid4().hex[:8]}"

    # ── 1. LLM generates the mathematical room layout (JSON) ──────────────────
    json_layout = ai_generator.generate_floorplan_json(
        plot_size = req.plotSize,
        length    = req.length,
        width     = req.width,
        bedrooms  = req.bedrooms,
        bathrooms = req.bathrooms,
        floors    = req.floors,
        duplex    = int(req.duplex),
        balcony   = req.balcony,
        terrace   = int(req.terrace),
        lift      = int(req.lift),
        vastu     = int(req.vastuToggle),
        entry_dir = req.entryDir,
    )

    if "error" in json_layout:
        raise HTTPException(
            status_code=500,
            detail=f"AI Layout Generation Failed: {json_layout['error']}"
        )

    floors = json_layout.get("floors", [])
    if not floors:
        raise HTTPException(status_code=500, detail="AI returned an empty floor list")
        
    # ── 2. Render all floor plans to Base64 ────────
    try:
        unit_label = f"{int(req.plotSize)} sqft · {req.bedrooms}BHK · {req.entryDir} Entry"
        
        for floor in floors:
            floor_rooms = floor.get("rooms", [])
            floor_label = f"{floor.get('level', 'Floor')} | {unit_label}"
            png_bytes = render_floor_plan(floor_rooms, unit_label=floor_label)
            
            b64_str = base64.b64encode(png_bytes).decode("utf-8")
            floor["imageUrl"] = f"data:image/png;base64,{b64_str}"
        
        # Primary image for dashboard (Ground Floor)
        data_uri = floors[0]["imageUrl"]
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Floor Plan Rendering Failed: {str(e)}"
        )

    # ── 3. Score Vastu on the ground floor rooms ──────────────────────────────
    ground_rooms = floors[0].get("rooms", [])
    vastu_result = score_vastu(
        rooms    = ground_rooms,
        plot_w   = req.length,
        plot_h   = req.width,
        entry_dir = req.entryDir,
    ) if req.vastuToggle else {"score": 0, "grade": "Disabled", "rules": []}

    return {
        "status": "success",
        "candidates": [
            {
                "id":          plan_id,
                "imageUrl":    data_uri,
                "layout":      json_layout,
                "vastuScore":  vastu_result["score"],
                "vastuResult": vastu_result,
            }
        ],
    }


# ── DXF Export ────────────────────────────────────────────────────────────────

class DxfExportRequest(BaseModel):
    rooms: List[Any]
    plan_id: str


@app.post("/export/dxf")
def export_dxf(req: DxfExportRequest):
    """Converts the JSON layout to an AutoCAD-ready DXF file."""
    try:
        dxf_bytes = export_to_dxf(req.rooms)
        return Response(
            content=dxf_bytes,
            media_type="application/dxf",
            headers={
                "Content-Disposition":
                    f'attachment; filename="floorplan_{req.plan_id}.dxf"'
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── NL Room Edit ──────────────────────────────────────────────────────────────

class RegenerateRoomRequest(BaseModel):
    rooms: List[Any]
    room_name: str
    instruction: str


@app.post("/regenerate-room")
def regenerate_room(req: RegenerateRoomRequest):
    """Edits a specific room (or the whole plan) via natural language."""
    messages = [
        {
            "role": "system",
            "content": (
                "You are a precise architectural layout editor. "
                "You modify floor plan room coordinates based on user instructions. "
                "Respond ONLY with a raw JSON object — no markdown, no explanations."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Current floor plan:\n{json.dumps(req.rooms, indent=2)}\n\n"
                f"Instruction: '{req.instruction}' "
                f"(target room: '{req.room_name}' — if 'entire plan' update all rooms).\n\n"
                "Return the full updated room list as JSON:\n"
                '{"rooms": [{"name": "...", "x": 0, "y": 0, "width": 10, "height": 10}]}'
            ),
        },
    ]
    try:
        response = llm_client.chat_completion(
            messages=messages, max_tokens=1500, temperature=0.05
        )
        content = response.choices[0].message.content
        start, end = content.find("{"), content.rfind("}")
        if start != -1 and end != -1:
            updated = json.loads(content[start : end + 1])
            rooms = updated.get("rooms", req.rooms)

            # ── Re-validate after every LLM room edit (untrusted input) ──
            result = validate_and_fix_layout(
                rooms=rooms,
                plot_width=0,   # 0 = skip plot boundary (caller manages plot dims)
                plot_height=0,
                entrance_point=(0.0, 0.0),
            )
            return {"rooms": result["rooms"]}
        raise HTTPException(status_code=500, detail="Invalid JSON from AI")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Auto-Vastu Fixer ───────────────────────────────────────────────────────────

class VastuFixRequest(BaseModel):
    rooms:       List[Any]
    length:      float
    width:       float
    entry_dir:   str
    vastu_rules: List[Any]   # current vastu_result.rules


@app.post("/vastu-fix")
def vastu_fix(req: VastuFixRequest):
    """
    Re-positions specific rooms to achieve a near-perfect Vastu score.
    Only fixes rooms that are in the wrong zone; preserves everything else.
    """
    # ── 1. Build a targeted fix instruction per failing rule ──────────────────
    half_l = round(req.length / 2)
    half_w = round(req.width  / 2)

    ZONE_TARGETS = {
        "Kitchen Placement":           f"Kitchen     → Southeast  (x >= {half_l}, y >= {half_w})",
        "Master Bedroom Placement":    f"Master Bedroom → Southwest (x <= {half_l}, y >= {half_w})",
        "Pooja Room Placement":        f"Pooja Room  → Northeast  (x >= {half_l}, y <= {half_w})",
        "Staircase Placement":         f"Staircase   → Southwest  (x <= {half_l}, y >= {half_w})",
        "Bathroom/Toilet Placement":   f"Bathroom    → Northwest  (x <= {half_l}, y <= {half_w})",
        "Balcony Direction":           f"Balcony     → North/East (y <= {half_w} or x >= {half_l})",
    }

    failing = [r for r in req.vastu_rules if r.get("status") in ("fail", "warn") and r.get("max", 0) > 0]
    fix_lines = [ZONE_TARGETS[r["rule"]] for r in failing if r["rule"] in ZONE_TARGETS]

    if not fix_lines:
        # Nothing to fix — return unchanged
        vastu_result = score_vastu(req.rooms, req.length, req.width, req.entry_dir)
        png_bytes = render_floor_plan(req.rooms, unit_label="Auto-Fixed Plan")
        b64 = base64.b64encode(png_bytes).decode("utf-8")
        return {"rooms": req.rooms, "vastuScore": vastu_result["score"],
                "vastuResult": vastu_result, "imageUrl": f"data:image/png;base64,{b64}"}

    fix_text = "\n".join(f"  • {l}" for l in fix_lines)

    messages = [
        {
            "role": "system",
            "content": (
                "You are a precise architectural layout optimizer specializing in Vastu Shastra. "
                "You reposition rooms within a fixed plot to satisfy Vastu rules. "
                "Respond ONLY with valid JSON — no markdown, no explanations."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Current floor plan (plot: {req.length}ft × {req.width}ft):\n"
                f"{json.dumps(req.rooms, indent=2)}\n\n"
                f"VASTU CORRECTIONS NEEDED:\n{fix_text}\n\n"
                "RULES:\n"
                "1. Only change x and y coordinates — do NOT change width or height of any room.\n"
                "2. No two rooms may overlap after repositioning.\n"
                "3. All rooms must remain within the plot boundary.\n"
                "4. Swap rooms with each other to avoid gaps — if you move Kitchen to SE, "
                "   move whatever is there into Kitchen's old position.\n"
                "5. Preserve the 'furniture' array of every room unchanged.\n\n"
                "Return the complete updated room list as JSON:\n"
                '{"rooms": [{"name": "...", "x": 0, "y": 0, "width": 10, "height": 10, "furniture": [...]}]}'
            ),
        },
    ]

    try:
        response = llm_client.chat_completion(messages=messages, max_tokens=2000, temperature=0.02)
        content  = response.choices[0].message.content
        start, end = content.find("{"), content.rfind("}")
        if start == -1 or end == -1:
            raise HTTPException(status_code=500, detail="AI returned no valid JSON")

        fixed_data = json.loads(content[start : end + 1])
        fixed_rooms = fixed_data.get("rooms", req.rooms)

        # ── 2. Full deterministic re-validation after Vastu LLM correction ────
        # This re-runs on EVERY Vastu auto-fix round-trip, not just the first pass.
        val_result = validate_and_fix_layout(
            rooms=fixed_rooms,
            plot_width=req.length,
            plot_height=req.width,
            entrance_point=(0.0, 0.0),
        )
        fixed_rooms = val_result["rooms"]
        if val_result["status"] == "unresolved":
            print(f"[vastu-fix] Layout validator could not fully resolve geometry.")
            print(f"[vastu-fix] Report: {val_result['validation_report']}")

        # ── 3. Re-score & re-render ───────────────────────────────────────────
        vastu_result = score_vastu(fixed_rooms, req.length, req.width, req.entry_dir)
        png_bytes = render_floor_plan(fixed_rooms, unit_label="Vastu-Optimised Plan")
        b64 = base64.b64encode(png_bytes).decode("utf-8")

        return {
            "rooms":       fixed_rooms,
            "vastuScore":  vastu_result["score"],
            "vastuResult": vastu_result,
            "imageUrl":    f"data:image/png;base64,{b64}",
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Vastu fix failed: {e}")
