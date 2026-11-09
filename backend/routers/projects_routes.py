from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime, timezone
from core.auth import get_current_user, get_raw_bearer_token
from db.models import ProjectCreate, ProjectResponse, ProjectVersionResponse
from db.repositories import (
    get_projects_for_user,
    get_project_by_id,
    create_project,
    delete_project,
    update_project,
    get_project_versions,
    _in_memory_projects,
)

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=List[ProjectResponse])
async def list_projects(
    current_user: dict = Depends(get_current_user),
    user_token: str = Depends(get_raw_bearer_token),
):
    """List all floor plan projects owned by the authenticated user."""
    return await get_projects_for_user(current_user["id"], user_token=user_token)


@router.post("", response_model=ProjectResponse)
async def save_project(
    project: ProjectCreate,
    current_user: dict = Depends(get_current_user),
    user_token: str = Depends(get_raw_bearer_token),
):
    """Create a new project and initialize version 1 in design history."""
    project_doc = {
        **project.model_dump(),
        "user_id": current_user["id"],
        "created_at": datetime.now(timezone.utc),
    }
    inserted_id = await create_project(project_doc, user_token=user_token)
    saved = await get_project_by_id(inserted_id, current_user["id"], user_token=user_token)
    if saved:
        return saved
    return {**project_doc, "id": inserted_id}


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_saved_project(
    project_id: str,
    project: ProjectCreate,
    current_user: dict = Depends(get_current_user),
    user_token: str = Depends(get_raw_bearer_token),
):
    """Update layout and metadata for a project, creating an incremental design snapshot."""
    project_doc = {
        **project.model_dump(),
        "user_id": current_user["id"],
        "updated_at": datetime.now(timezone.utc),
    }
    updated = await update_project(
        project_id,
        project_doc,
        current_user["id"],
        commit_message="Layout updated via editor",
        user_token=user_token,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Project not found or not authorized")

    saved = await get_project_by_id(project_id, current_user["id"], user_token=user_token)
    if saved:
        return saved
    return {**project_doc, "id": project_id}


@router.get("/{project_id}", response_model=ProjectResponse)
async def fetch_project(
    project_id: str,
    current_user: dict = Depends(get_current_user),
    user_token: str = Depends(get_raw_bearer_token),
):
    """Retrieve an existing project by ID."""
    project = await get_project_by_id(project_id, current_user["id"], user_token=user_token)
    if not project:
        if project_id in _in_memory_projects:
            cached = _in_memory_projects[project_id]
            return {
                **cached,
                "user_id": current_user["id"],
            }
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.delete("/{project_id}")
async def remove_project(
    project_id: str,
    current_user: dict = Depends(get_current_user),
    user_token: str = Depends(get_raw_bearer_token),
):
    """Delete a project owned by the user."""
    deleted = await delete_project(project_id, current_user["id"], user_token=user_token)
    if deleted == 0:
        raise HTTPException(status_code=404, detail="Project not found or not authorized")
    return {"status": "success", "message": "Project deleted"}


@router.get("/{project_id}/versions", response_model=List[ProjectVersionResponse])
async def list_versions(
    project_id: str,
    current_user: dict = Depends(get_current_user),
    user_token: str = Depends(get_raw_bearer_token),
):
    """Retrieve immutable version history snapshots for a project."""
    return await get_project_versions(project_id, current_user["id"], user_token=user_token)
