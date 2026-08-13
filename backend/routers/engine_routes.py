from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import Response
from pydantic import BaseModel, Field
from typing import List, Any
import uuid
import base64
import traceback

from core.auth import get_current_user
from engines.inference import FloorPlanGenerator, fix_vastu_topology, fix_room_topology
from exporters.dxf_exporter import export_to_dxf
from exporters.floor_renderer import render_floor_plan
from engines.vastu_engine import score_vastu
from engines.nbc_engine import score_nbc
from engines.bom_engine import compute_bom
from exporters.pdf_report import generate_report_pdf

router = APIRouter(tags=["engine"])
ai_generator = FloorPlanGenerator()

class GenerateRequest(BaseModel):
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

@router.post("/generate")
def generate_plans(req: GenerateRequest, current_user: dict = Depends(get_current_user)):
    plan_id = f"plan_{uuid.uuid4().hex[:8]}"
    plot_size = req.length * req.width

    try:
        json_layout = ai_generator.generate_floorplan_json(
            plot_size = plot_size,
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
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=503,
            detail="AI inference engine is currently unavailable. Please try again later."
        )

    if "error" in json_layout:
        raise HTTPException(
            status_code=500,
            detail="AI Layout Generation Failed. Please try again."
        )

    floor_list = json_layout.get("floors", [])
    if not floor_list:
        raise HTTPException(status_code=500, detail="AI returned an empty floor list")
        
    try:
        unit_label = f"{int(plot_size)} sqft · {req.bedrooms}BHK · {req.entryDir} Entry"
        
        for floor in floor_list:
            floor_rooms = floor.get("rooms", [])
            floor_label = f"{floor.get('level', 'Floor')} | {unit_label}"
            png_bytes = render_floor_plan(floor_rooms, unit_label=floor_label)
            
            b64_str = base64.b64encode(png_bytes).decode("utf-8")
            floor["imageUrl"] = f"data:image/png;base64,{b64_str}"
        
        data_uri = floor_list[0]["imageUrl"]
        
    except Exception as e:
        print(f"Render Error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Floor Plan Rendering Failed due to an internal error."
        )

    ground_rooms = floor_list[0].get("rooms", [])
    vastu_result = score_vastu(
        rooms    = ground_rooms,
        plot_w   = req.length,
        plot_h   = req.width,
        entry_dir = req.entryDir,
    ) if req.vastuToggle else {"score": 0, "grade": "Disabled", "rules": []}

    nbc_result = score_nbc(
        rooms      = ground_rooms,
        plot_w     = req.length,
        plot_h     = req.width,
        num_floors = req.floors,
    )

    return {
        "status": "success",
        "candidates": [
            {
                "id":                   plan_id,
                "imageUrl":             data_uri,
                "layout":               json_layout,
                "vastuScore":           vastu_result["score"],
                "vastuResult":          vastu_result,
                "nbcResult":            nbc_result,
                "validationReport":     json_layout.get("validation_report", []),
                "circulationWarnings":  json_layout.get("circulation_warnings", []),
            }
        ],
    }


class DxfExportRequest(BaseModel):
    rooms: List[Any]
    plan_id: str

@router.post("/export/dxf")
def export_dxf(req: DxfExportRequest, current_user: dict = Depends(get_current_user)):
    try:
        dxf_bytes = export_to_dxf(req.rooms)
        return Response(
            content=dxf_bytes,
            media_type="application/dxf",
            headers={
                "Content-Disposition": f'attachment; filename="floorplan_{req.plan_id}.dxf"'
            }
        )
    except Exception as e:
        print(f"DXF Export Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate DXF")


class PdfExportRequest(BaseModel):
    layout: dict
    vastu_result: dict
    plan_id: str
    project_meta: dict

@router.post("/export/pdf")
def export_pdf(req: PdfExportRequest, current_user: dict = Depends(get_current_user)):
    try:
        length = float(req.project_meta.get("length", 40))
        width = float(req.project_meta.get("width", 30))
        sqft = round(length * width)
        
        rooms = req.layout.get("rooms", [])
        if not rooms:
            # Fallback if the layout structure is slightly different (e.g. floors)
            floors = req.layout.get("floors", [])
            if floors:
                rooms = floors[0].get("rooms", [])
                
        cost_bom = compute_bom(rooms, sqft)
        
        pdf_bytes = generate_report_pdf(
            layout=req.layout,
            vastu_result=req.vastu_result,
            bom=cost_bom,
            project_meta=req.project_meta,
        )
        
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="report_{req.plan_id}.pdf"'
            }
        )
    except Exception as e:
        print(f"PDF Export Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate PDF Report")


class VastuFixRequest(BaseModel):
    layout: dict
    plot_width: float = 40.0
    plot_height: float = 30.0
    entry_dir: str = "east"
    bedrooms: int = 2
    bathrooms: int = 2
    floors: int = 1
    # The current vastu_result so we can score before/after
    vastu_result: dict = Field(default_factory=dict)

@router.post("/vastu/fix")
def vastu_fix(req: VastuFixRequest, current_user: dict = Depends(get_current_user)):
    """
    Corrects Vastu violations by sending failing rules to the LLM as a topology
    revision request, then rerunning the deterministic Drafter to produce
    guaranteed-overlap-free coordinates. Scores before and after.
    """
    try:
        # Identify which rules are actually failing (status != 'pass')
        current_rules = req.vastu_result.get("rules", [])
        before_score = req.vastu_result.get("score", 0)
        violated = [r for r in current_rules if r.get("status") in ("fail", "warn")]

        if not violated:
            return {
                "status": "already_optimal",
                "message": "No Vastu violations found — layout is already optimal.",
                "before_score": before_score,
                "after_score": before_score,
                "fixed_layout": req.layout.get("rooms") or (
                    req.layout.get("floors", [{}])[0].get("rooms", [])
                ),
            }

        result = fix_vastu_topology(
            length=req.plot_width,
            width=req.plot_height,
            bedrooms=req.bedrooms,
            bathrooms=req.bathrooms,
            floors=req.floors,
            entry_dir=req.entry_dir,
            violated_rules=violated,
            max_retries=2,
        )

        if not result["converged"] or result["layout"] is None:
            raise HTTPException(
                status_code=500,
                detail="Vastu fix failed: LLM could not produce a valid revised topology after 2 attempts."
            )

        new_layout = result["layout"]
        ground_rooms = new_layout["floors"][0]["rooms"]

        # Re-score the corrected layout
        new_vastu = score_vastu(
            rooms=ground_rooms,
            plot_w=req.plot_width,
            plot_h=req.plot_height,
            entry_dir=req.entry_dir,
        )

        png_bytes = render_floor_plan(ground_rooms, unit_label="Vastu-Optimised Plan")
        b64_str = base64.b64encode(png_bytes).decode("utf-8")
        image_url = f"data:image/png;base64,{b64_str}"

        return {
            "status": "success",
            "before_score": before_score,
            "after_score": new_vastu["score"],
            "new_vastu_result": new_vastu,
            "design_rationale": result["design_rationale"],
            "converged": True,
            # fixed_layout is the full rooms list so the frontend can replace the floor
            "fixed_layout": ground_rooms,
            "imageUrl": image_url,
        }
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Auto-fix failed: {str(e)}")


class RegenerateRoomRequest(BaseModel):
    rooms: List[Any]
    room_name: str
    instruction: str
    # Real plot dimensions — no more hardcoded 40×30
    plot_width: float = 40.0
    plot_height: float = 30.0
    entry_dir: str = "east"
    bedrooms: int = 2
    bathrooms: int = 2
    floors: int = 1

@router.post("/regenerate-room")
def regenerate_room(req: RegenerateRoomRequest, current_user: dict = Depends(get_current_user)):
    """
    Uses the LLM to revise the layout topology based on a natural-language room
    instruction, then reruns the Drafter for guaranteed overlap-free geometry.
    Falls back gracefully if the LLM call fails.
    """
    try:
        result = fix_room_topology(
            room_name=req.room_name,
            instruction=req.instruction,
            length=req.plot_width,
            width=req.plot_height,
            bedrooms=req.bedrooms,
            bathrooms=req.bathrooms,
            floors=req.floors,
            entry_dir=req.entry_dir,
        )

        if result["converged"] and result["layout"] is not None:
            ground_rooms = result["layout"]["floors"][0]["rooms"]
            
            png_bytes = render_floor_plan(ground_rooms, unit_label="AI-Edited Room Plan")
            b64_str = base64.b64encode(png_bytes).decode("utf-8")
            image_url = f"data:image/png;base64,{b64_str}"

            return {
                "rooms": ground_rooms,
                "imageUrl": image_url,
                "llm_called": True,
                "design_rationale": result["design_rationale"],
            }

        raise HTTPException(
            status_code=400,
            detail=f"AI could not safely perform this edit without causing layout collisions. ({result['design_rationale']})"
        )
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Regeneration failed: {str(e)}")
