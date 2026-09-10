from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from backend.models.operations import PDFOperation
from backend.models.document import DocumentAnalysis, PageInfo

class PDFEditingBackend(ABC):
    """
    Abstract interface for PDF manipulation engine.
    Allows seamlessly swapping PyMuPDF with Infix Server or any other PDF engine.
    """

    @abstractmethod
    def analyze_document(self, pdf_path: str) -> DocumentAnalysis:
        """Extract layout, pages, text blocks, fonts, colors, and bounding boxes."""
        pass

    @abstractmethod
    def apply_operations(self, input_pdf_path: str, output_pdf_path: str, operations: List[PDFOperation]) -> List[int]:
        """Apply a batch of operations and return the list of modified page numbers."""
        pass

    @abstractmethod
    def replace_text(self, input_pdf_path: str, output_pdf_path: str, page: int, old_text: str, new_text: str,
                     bbox: Optional[List[float]] = None, font_size: Optional[float] = None,
                     color: Optional[str] = None) -> bool:
        """Replace text while preserving layout, position, approximate font and color."""
        pass

    @abstractmethod
    def add_text(self, input_pdf_path: str, output_pdf_path: str, page: int, text: str,
                 x: float, y: float, font_size: float = 12.0, font_name: str = "helv",
                 color: Optional[str] = "#000000", alignment: str = "left") -> bool:
        """Add text at specified position."""
        pass

    @abstractmethod
    def add_image(self, input_pdf_path: str, output_pdf_path: str, page: int, image_bytes: bytes,
                  bbox: List[float]) -> bool:
        """Stamp an image / logo into the specified page area."""
        pass

    @abstractmethod
    def redact(self, input_pdf_path: str, output_pdf_path: str, page: int, bbox: List[float],
               fill_color: Optional[str] = "#000000") -> bool:
        """Draw a redaction / blackout box over sensitive text or region."""
        pass

    @abstractmethod
    def render_page_image(self, pdf_path: str, page_number: int, dpi: int = 150) -> bytes:
        """Render a page as PNG for fast and crisp thumbnail or preview."""
        pass
