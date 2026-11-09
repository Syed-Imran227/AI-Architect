"""
export_routes.py
================
Endpoints for exporting multi-floor architectural designs to:
  1. AutoCAD R2010 DXF CAD format (application/dxf)
  2. Multi-page Architectural Blueprint Dossier PDF (application/pdf)

Also records asset generation metadata into public.generated_assets in Supabase mode.
"""

from __future__ import annotations

import os
import traceback
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

from core.auth import get_current_user, get_raw_bearer_token
from exporters.dxf_exporter import export_multi_floor_dxf, export_to_dxf
from exporters.pdf_dossier import generate_architectural_dossier_pdf
from engines.bom_engine import compute_bom
from db.supabase_client import get_database_provider, get_supabase_client
from db.database import db
from db.repositories import record_generated_asset, get_project_by_id

router = APIRouter(tags=["Export"])


class MultiFloorDxfRequest(BaseModel):
    rooms: Optional[List[Any]] = None
    layout: Optional[Dict[str, Any]] = None
    plan_id: Optional[str] = "unnamed"
    project_id: Optional[str] = None
    plot_width: float = Field(30.0, gt=0, le=500)
    plot_height: float = Field(40.0, gt=0, le=500)


class MultiPagePdfRequest(BaseModel):
    layout: Dict[str, Any]
    vastu_result: Optional[Dict[str, Any]] = None
    nbc_result: Optional[Dict[str, Any]] = None
    energy_result: Optional[Dict[str, Any]] = None
    sunlight_result: Optional[Dict[str, Any]] = None
    plan_id: Optional[str] = "unnamed"
    project_id: Optional[str] = None
    project_meta: Optional[Dict[str, Any]] = None


async def _record_asset_metadata(
    project_id: Optional[str],
    asset_type: str,
    file_name: str,
    file_size: int,
    user_id: Optional[str] = None,
    user_token: Optional[str] = None,
) -> None:
    """Records asset creation metadata via record_generated_asset in repository layer after verifying project ownership."""
    if not project_id or not user_id:
        return

    # Verify project belongs to requesting user
    proj = await get_project_by_id(project_id, user_id, user_token=user_token)
    if not proj:
        return

    await record_generated_asset(
        project_id=project_id,
        asset_type=asset_type,
        file_name=file_name,
        file_size=file_size,
        user_id=user_id,
        user_token=user_token,
        verify_ownership=True,
    )


# ── DXF Export Endpoints ──────────────────────────────────────────────────────

@router.post("/api/export/dxf")
@router.post("/export/dxf")
async def export_cad_dxf(
    req: MultiFloorDxfRequest,
    current_user: dict = Depends(get_current_user),
    user_token: str = Depends(get_raw_bearer_token),
):
    """
    Exports a single- or multi-floor floor plan to AutoCAD-compatible DXF format.
    Arranges multiple floor plates side-by-side with standard CAD layers.
    """
    try:
        # Determine layout payload
        payload: Any = req.layout if req.layout else req.rooms
        if not payload:
            payload = []

        dxf_bytes = export_multi_floor_dxf(
            layout_data=payload,
            plot_w=req.plot_width,
            plot_h=req.plot_height,
        )

        if isinstance(dxf_bytes, str):
            with open(dxf_bytes, "rb") as f:
                dxf_bytes = f.read()

        file_id = req.project_id or req.plan_id or "plan"
        filename = f"floorplan_{file_id}.dxf"

        # Record metadata
        await _record_asset_metadata(
            project_id=req.project_id or req.plan_id,
            asset_type="dxf_cad",
            file_name=filename,
            file_size=len(dxf_bytes),
            user_id=current_user.get("id"),
            user_token=user_token,
        )

        return Response(
            content=dxf_bytes,
            media_type="application/dxf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            },
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate DXF drawing: {str(e)}"
        )


# ── PDF Dossier Endpoints ─────────────────────────────────────────────────────

@router.post("/api/export/pdf")
@router.post("/export/pdf")
async def export_dossier_pdf(
    req: MultiPagePdfRequest,
    current_user: dict = Depends(get_current_user),
    user_token: str = Depends(get_raw_bearer_token),
):
    """
    Compiles a comprehensive multi-page Architectural Blueprint Dossier PDF.
    Includes Cover Page, Floor Plates, Room Schedules, and Itemized BOM.
    """
    try:
        meta = req.project_meta or {}
        length = float(meta.get("length", 40.0))
        width = float(meta.get("width", 30.0))
        sqft = round(length * width)

        cost_bom = compute_bom(req.layout, sqft)

        pdf_bytes = generate_architectural_dossier_pdf(
            layout=req.layout,
            project_meta=meta,
            vastu_result=req.vastu_result,
            nbc_result=req.nbc_result,
            energy_result=req.energy_result,
            sunlight_result=req.sunlight_result,
            bom=cost_bom,
        )

        file_id = req.project_id or req.plan_id or "plan"
        filename = f"dossier_{file_id}.pdf"

        # Record metadata
        await _record_asset_metadata(
            project_id=req.project_id or req.plan_id,
            asset_type="dossier_pdf",
            file_name=filename,
            file_size=len(pdf_bytes),
            user_id=current_user.get("id"),
            user_token=user_token,
        )

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            },
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate PDF Dossier: {str(e)}"
        )


ALLOWED_AUDIT_EXTENSIONS = {".dxf", ".pdf", ".svg", ".json", ".png"}
MAX_AUDIT_FILE_BYTES = 10 * 1024 * 1024  # 10 MB limit


class SaveAuditFileRequest(BaseModel):
    filename: str = Field(..., max_length=255)
    data_url: str = Field(..., max_length=15 * 1024 * 1024)  # 15MB max payload string


@router.post("/api/export/save-audit-file")
@router.post("/export/save-audit-file")
@router.post("/save-audit-file")
async def save_audit_file(
    req: SaveAuditFileRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Saves an exported file from authenticated browser E2E session directly into scratch/exports.
    Requires authentication, validates file extension to safe formats, and enforces size caps.
    """
    import base64
    import urllib.parse

    safe_name = os.path.basename(req.filename)
    _, ext = os.path.splitext(safe_name)
    if ext.lower() not in ALLOWED_AUDIT_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Disallowed file extension '{ext}'. Permitted: {sorted(ALLOWED_AUDIT_EXTENSIONS)}",
        )

    dest_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "scratch", "exports"))
    os.makedirs(dest_dir, exist_ok=True)
    dest_path = os.path.join(dest_dir, safe_name)

    if req.data_url.startswith("data:"):
        header, raw_payload = req.data_url.split(",", 1)
        if ";base64" in header:
            file_bytes = base64.b64decode(raw_payload)
        else:
            file_bytes = urllib.parse.unquote(raw_payload).encode("utf-8")
        if len(file_bytes) > MAX_AUDIT_FILE_BYTES:
            raise HTTPException(status_code=413, detail="File size exceeds maximum allowed 10MB limit.")
        with open(dest_path, "wb") as f:
            f.write(file_bytes)
    else:
        text_bytes = req.data_url.encode("utf-8")
        if len(text_bytes) > MAX_AUDIT_FILE_BYTES:
            raise HTTPException(status_code=413, detail="File size exceeds maximum allowed 10MB limit.")
        with open(dest_path, "w", encoding="utf-8") as f:
            f.write(req.data_url)

    file_size = os.path.getsize(dest_path)
    return {"saved": True, "path": dest_path, "size": file_size}
