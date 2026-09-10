"""
PDF Editor Service.
Executes verified operations with font matching, redactions, and bounding box safety checks.
"""
from typing import List, Optional
from backend.models.operations import PDFOperation
from backend.pdf.pymupdf_backend import PyMuPDFBackend

class PDFEditor:
    def __init__(self, backend: Optional[PyMuPDFBackend] = None):
        self.backend = backend or PyMuPDFBackend()

    def execute_plan(self, input_pdf: str, output_pdf: str, operations: List[PDFOperation]) -> List[int]:
        return self.backend.apply_operations(input_pdf, output_pdf, operations)
