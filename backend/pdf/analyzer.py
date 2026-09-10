"""
PDF Layout and Text Analyzer Service.
Leverages PyMuPDF and pdfplumber to detect structure, text blocks, fonts, and bounding boxes.
"""
from typing import Optional
from backend.models.document import DocumentAnalysis
from backend.pdf.pymupdf_backend import PyMuPDFBackend

class PDFAnalyzer:
    def __init__(self, backend: Optional[PyMuPDFBackend] = None):
        self.backend = backend or PyMuPDFBackend()

    def analyze(self, pdf_path: str) -> DocumentAnalysis:
        return self.backend.analyze_document(pdf_path)
