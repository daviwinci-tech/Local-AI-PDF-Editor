from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class TextBlock(BaseModel):
    id: str
    text: str
    bbox: List[float] = Field(description="[x0, y0, x1, y1] coordinates")
    font_name: Optional[str] = "Helvetica"
    font_size: float = 11.0
    color: Optional[str] = "#000000"
    page: int = 1
    flags: int = 0
    line_count: int = 1

class ImageBlock(BaseModel):
    id: str
    bbox: List[float]
    page: int
    width: float
    height: float
    format: Optional[str] = "png"

class PageInfo(BaseModel):
    page_number: int
    width: float
    height: float
    rotation: int = 0
    text_blocks: List[TextBlock] = Field(default_factory=list)
    image_blocks: List[ImageBlock] = Field(default_factory=list)
    has_text_layer: bool = True
    is_scanned: bool = False

class RevisionInfo(BaseModel):
    id: str
    revision_number: int
    timestamp: str
    description: str
    operations_count: int
    modified_pages: List[int]

class DocumentMetadata(BaseModel):
    id: str
    filename: str
    original_filename: str
    total_pages: int
    file_size_bytes: int
    created_at: str
    current_revision: int
    total_revisions: int
    has_ocr_content: bool = False
    pages: List[PageInfo] = Field(default_factory=list)

class DocumentAnalysis(BaseModel):
    metadata: DocumentMetadata
    pages: List[PageInfo]
