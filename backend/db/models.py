from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class UserCreate(BaseModel):
    name: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class ProjectCreate(BaseModel):
    name: str
    layout_data: dict
    image_url: Optional[str] = None

class ProjectResponse(BaseModel):
    id: str
    user_id: str
    name: str
    layout_data: dict
    image_url: Optional[str] = None
    created_at: datetime
