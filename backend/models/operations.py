from enum import Enum
from typing import List, Optional, Union, Dict, Any
from pydantic import BaseModel, Field

class OperationType(str, Enum):
    REPLACE_TEXT = "replace_text"
    REPLACE_ALL_TEXT = "replace_all_text"
    ADD_TEXT = "add_text"
    DELETE_TEXT = "delete_text"
    REDACT = "redact"
    ADD_IMAGE = "add_image"
    DELETE_IMAGE = "delete_image"
    MOVE_TEXT = "move_text"
    CHANGE_FONT_SIZE = "change_font_size"
    CHANGE_FONT = "change_font"
    CHANGE_ALIGNMENT = "change_alignment"
    CHANGE_COLOR = "change_color"
    DUPLICATE_ELEMENT = "duplicate_element"

class BBox(BaseModel):
    x0: float
    y0: float
    x1: float
    y1: float

class PDFOperation(BaseModel):
    type: OperationType
    page: Optional[int] = Field(default=1, description="1-based page number")
    old_text: Optional[str] = Field(default=None, description="Text to find or replace")
    new_text: Optional[str] = Field(default=None, description="New text content to insert")
    bbox: Optional[Union[BBox, List[float]]] = Field(default=None, description="Coordinates [x0, y0, x1, y1]")
    font_size: Optional[float] = Field(default=None, description="Font size in points")
    font_name: Optional[str] = Field(default=None, description="Font family name (e.g. helv, times, cour)")
    color: Optional[Union[str, List[float]]] = Field(default=None, description="Hex color or RGB [r, g, b] 0..1")
    alignment: Optional[str] = Field(default="left", description="left, center, or right")
    image_data: Optional[str] = Field(default=None, description="Base64 encoded image or path")
    image_position: Optional[str] = Field(default=None, description="top-right, top-left, bottom-right, center, or custom")
    width: Optional[float] = Field(default=None, description="Element width")
    height: Optional[float] = Field(default=None, description="Element height")
    dx: Optional[float] = Field(default=0.0, description="Horizontal shift for move")
    dy: Optional[float] = Field(default=0.0, description="Vertical shift for move")
    element_id: Optional[str] = Field(default=None, description="ID of selected target element")

class SelectedElementContext(BaseModel):
    page: int
    text: Optional[str] = None
    bbox: Optional[List[float]] = None
    font_size: Optional[float] = None
    color: Optional[str] = None
    element_id: Optional[str] = None

class AICommandRequest(BaseModel):
    prompt: str
    current_page: int = 1
    selected_element: Optional[SelectedElementContext] = None
    history: Optional[List[Dict[str, str]]] = Field(default_factory=list)
    model: Optional[str] = None
    temperature: Optional[float] = 0.2

class AICommandResponse(BaseModel):
    explanation: str
    operations: List[PDFOperation]
    raw_response: Optional[str] = None
    model_used: Optional[str] = None

class ApplyOperationsRequest(BaseModel):
    operations: List[PDFOperation]
    description: Optional[str] = "Manual or AI Edit"

class ApplyOperationsResponse(BaseModel):
    success: bool
    revision_id: str
    revision_number: int
    modified_pages: List[int]
    message: str
