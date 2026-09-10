import os
import io
import uuid
import datetime
from typing import List, Optional, Dict, Any, Tuple
from backend.pdf.base import PDFEditingBackend
from backend.models.operations import PDFOperation, OperationType
from backend.models.document import DocumentAnalysis, DocumentMetadata, PageInfo, TextBlock, ImageBlock

try:
    import fitz  # PyMuPDF
    PYMUPDF_AVAILABLE = True
except ImportError:
    PYMUPDF_AVAILABLE = False

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

class PyMuPDFBackend(PDFEditingBackend):
    """
    Default high-performance PDF engine powered by PyMuPDF (fitz) and Pillow.
    Handles precise text detection, bounding box measurement, clean text replacement with redaction,
    font matching, and image insertion.
    """

    def __init__(self):
        if not PYMUPDF_AVAILABLE:
            print("Warning: PyMuPDF (fitz) is not installed. Python backend will use fallback handlers.")

    def _hex_to_rgb(self, hex_str: Optional[str]) -> Tuple[float, float, float]:
        if not hex_str:
            return (0.0, 0.0, 0.0)
        hex_clean = hex_str.lstrip('#')
        if len(hex_clean) == 3:
            hex_clean = ''.join(c * 2 for c in hex_clean)
        if len(hex_clean) == 6:
            try:
                r = int(hex_clean[0:2], 16) / 255.0
                g = int(hex_clean[2:4], 16) / 255.0
                b = int(hex_clean[4:6], 16) / 255.0
                return (r, g, b)
            except ValueError:
                pass
        return (0.0, 0.0, 0.0)

    def analyze_document(self, pdf_path: str) -> DocumentAnalysis:
        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"PDF not found at {pdf_path}")

        file_size = os.path.getsize(pdf_path)
        doc_id = str(uuid.uuid4())
        filename = os.path.basename(pdf_path)
        
        pages_info: List[PageInfo] = []
        total_text_blocks = 0

        if PYMUPDF_AVAILABLE:
            doc = fitz.open(pdf_path)
            total_pages = len(doc)
            
            for page_idx in range(total_pages):
                page = doc[page_idx]
                page_num = page_idx + 1
                rect = page.rect
                width, height = rect.width, rect.height

                # Extract text blocks with PyMuPDF detailed dict
                page_dict = page.get_text("dict")
                blocks = page_dict.get("blocks", [])
                text_blocks: List[TextBlock] = []
                image_blocks: List[ImageBlock] = []

                for block_idx, b in enumerate(blocks):
                    if b.get("type") == 0:  # Text block
                        bbox = list(b.get("bbox", [0, 0, 0, 0]))
                        lines = b.get("lines", [])
                        block_text_parts = []
                        font_name = "Helvetica"
                        font_size = 11.0
                        color = "#000000"

                        for line in lines:
                            spans = line.get("spans", [])
                            for span in spans:
                                span_text = span.get("text", "")
                                block_text_parts.append(span_text)
                                if span.get("font"):
                                    font_name = span.get("font")
                                if span.get("size"):
                                    font_size = round(span.get("size"), 1)
                                if "color" in span:
                                    c_int = span.get("color")
                                    # Convert int color to hex
                                    r = (c_int >> 16) & 255
                                    g = (c_int >> 8) & 255
                                    b_val = c_int & 255
                                    color = f"#{r:02x}{g:02x}{b_val:02x}"

                        full_text = " ".join(block_text_parts).strip()
                        if full_text:
                            text_blocks.append(TextBlock(
                                id=f"p{page_num}_b{block_idx}",
                                text=full_text,
                                bbox=[round(v, 2) for v in bbox],
                                font_name=font_name,
                                font_size=font_size,
                                color=color,
                                page=page_num,
                                line_count=len(lines)
                            ))
                            total_text_blocks += 1

                    elif b.get("type") == 1:  # Image block
                        bbox = list(b.get("bbox", [0, 0, 0, 0]))
                        image_blocks.append(ImageBlock(
                            id=f"p{page_num}_img{block_idx}",
                            bbox=[round(v, 2) for v in bbox],
                            page=page_num,
                            width=round(bbox[2] - bbox[0], 2),
                            height=round(bbox[3] - bbox[1], 2),
                            format="png"
                        ))

                has_text = len(text_blocks) > 0
                is_scanned = (not has_text and len(image_blocks) > 0)

                pages_info.append(PageInfo(
                    page_number=page_num,
                    width=round(width, 2),
                    height=round(height, 2),
                    rotation=page.rotation,
                    text_blocks=text_blocks,
                    image_blocks=image_blocks,
                    has_text_layer=has_text,
                    is_scanned=is_scanned
                ))
            doc.close()
        else:
            # Basic fallback structure if fitz is not installed
            total_pages = 1
            pages_info.append(PageInfo(
                page_number=1,
                width=595.3,
                height=841.9,
                text_blocks=[],
                image_blocks=[],
                has_text_layer=False,
                is_scanned=False
            ))

        metadata = DocumentMetadata(
            id=doc_id,
            filename=filename,
            original_filename=filename,
            total_pages=total_pages,
            file_size_bytes=file_size,
            created_at=datetime.datetime.now().isoformat(),
            current_revision=1,
            total_revisions=1,
            has_ocr_content=any(p.is_scanned for p in pages_info),
            pages=pages_info
        )

        return DocumentAnalysis(metadata=metadata, pages=pages_info)

    def apply_operations(self, input_pdf_path: str, output_pdf_path: str, operations: List[PDFOperation]) -> List[int]:
        if not PYMUPDF_AVAILABLE:
            raise RuntimeError("PyMuPDF (fitz) is required for PDF manipulation.")

        doc = fitz.open(input_pdf_path)
        modified_pages = set()

        for op in operations:
            page_num = op.page if op.page is not None else 1
            if page_num < 1 or page_num > len(doc):
                continue
            
            page = doc[page_num - 1]

            if op.type == OperationType.REPLACE_TEXT or op.type == "replace_text":
                if op.old_text and op.new_text is not None:
                    # Search text instances on this page
                    text_instances = page.search_for(op.old_text)
                    if text_instances:
                        for rect in text_instances:
                            # Apply redaction annotation over old text to cleanly remove it
                            annot = page.add_redact_annot(rect, fill=(1, 1, 1)) # White fill
                            page.apply_redactions()

                            # Insert new text preserving position & font size
                            font_size = op.font_size or max(8, min(24, rect.height * 0.85))
                            rgb = self._hex_to_rgb(op.color or "#000000")
                            
                            # Calculate insertion point
                            point = fitz.Point(rect.x0, rect.y1 - (rect.height * 0.15))
                            page.insert_text(point, op.new_text, fontsize=font_size, color=rgb)
                        modified_pages.add(page_num)

            elif op.type == OperationType.REPLACE_ALL_TEXT or op.type == "replace_all_text":
                if op.old_text and op.new_text is not None:
                    for p_idx in range(len(doc)):
                        p = doc[p_idx]
                        instances = p.search_for(op.old_text)
                        if instances:
                            for rect in instances:
                                p.add_redact_annot(rect, fill=(1, 1, 1))
                                p.apply_redactions()
                                font_size = op.font_size or max(8, min(24, rect.height * 0.85))
                                rgb = self._hex_to_rgb(op.color or "#000000")
                                point = fitz.Point(rect.x0, rect.y1 - (rect.height * 0.15))
                                p.insert_text(point, op.new_text, fontsize=font_size, color=rgb)
                            modified_pages.add(p_idx + 1)

            elif op.type == OperationType.ADD_TEXT or op.type == "add_text":
                if op.new_text:
                    x = 50.0
                    y = 50.0
                    if op.bbox:
                        b = op.bbox if isinstance(op.bbox, list) else [op.bbox.x0, op.bbox.y0, op.bbox.x1, op.bbox.y1]
                        x, y = b[0], b[1]
                    font_size = op.font_size or 12.0
                    rgb = self._hex_to_rgb(op.color or "#000000")
                    point = fitz.Point(x, y)
                    page.insert_text(point, op.new_text, fontsize=font_size, color=rgb)
                    modified_pages.add(page_num)

            elif op.type == OperationType.DELETE_TEXT or op.type == "delete_text":
                if op.old_text:
                    instances = page.search_for(op.old_text)
                    for rect in instances:
                        page.add_redact_annot(rect, fill=(1, 1, 1))
                        page.apply_redactions()
                    modified_pages.add(page_num)
                elif op.bbox:
                    b = op.bbox if isinstance(op.bbox, list) else [op.bbox.x0, op.bbox.y0, op.bbox.x1, op.bbox.y1]
                    rect = fitz.Rect(b[0], b[1], b[2], b[3])
                    page.add_redact_annot(rect, fill=(1, 1, 1))
                    page.apply_redactions()
                    modified_pages.add(page_num)

            elif op.type == OperationType.REDACT or op.type == "redact":
                # Blackout box
                if op.bbox:
                    b = op.bbox if isinstance(op.bbox, list) else [op.bbox.x0, op.bbox.y0, op.bbox.x1, op.bbox.y1]
                    rect = fitz.Rect(b[0], b[1], b[2], b[3])
                    rgb = self._hex_to_rgb(op.color or "#000000")
                    page.add_redact_annot(rect, fill=rgb)
                    page.apply_redactions()
                    modified_pages.add(page_num)
                elif op.old_text:
                    instances = page.search_for(op.old_text)
                    rgb = self._hex_to_rgb(op.color or "#000000")
                    for rect in instances:
                        page.add_redact_annot(rect, fill=rgb)
                        page.apply_redactions()
                    modified_pages.add(page_num)

            elif op.type == OperationType.ADD_IMAGE or op.type == "add_image":
                # Add image / logo
                rect = fitz.Rect(page.rect.width - 120, 30, page.rect.width - 30, 80) # Default top-right
                if op.image_position == "top-right":
                    rect = fitz.Rect(page.rect.width - 140, 30, page.rect.width - 40, 90)
                elif op.image_position == "top-left":
                    rect = fitz.Rect(40, 30, 140, 90)
                elif op.image_position == "bottom-right":
                    rect = fitz.Rect(page.rect.width - 140, page.rect.height - 90, page.rect.width - 40, page.rect.height - 30)
                elif op.bbox:
                    b = op.bbox if isinstance(op.bbox, list) else [op.bbox.x0, op.bbox.y0, op.bbox.x1, op.bbox.y1]
                    rect = fitz.Rect(b[0], b[1], b[2], b[3])

                if op.image_data:
                    import base64
                    try:
                        clean_data = op.image_data
                        if "," in clean_data:
                            clean_data = clean_data.split(",", 1)[1]
                        img_bytes = base64.b64decode(clean_data)
                        page.insert_image(rect, stream=img_bytes)
                        modified_pages.add(page_num)
                    except Exception as e:
                        print(f"Error inserting image: {e}")

        # Ensure directory exists and save modified document
        os.makedirs(os.path.dirname(output_pdf_path), exist_ok=True)
        doc.save(output_pdf_path)
        doc.close()
        return sorted(list(modified_pages))

    def replace_text(self, input_pdf_path: str, output_pdf_path: str, page: int, old_text: str, new_text: str,
                     bbox: Optional[List[float]] = None, font_size: Optional[float] = None,
                     color: Optional[str] = None) -> bool:
        op = PDFOperation(
            type=OperationType.REPLACE_TEXT,
            page=page,
            old_text=old_text,
            new_text=new_text,
            bbox=bbox,
            font_size=font_size,
            color=color
        )
        res = self.apply_operations(input_pdf_path, output_pdf_path, [op])
        return len(res) > 0

    def add_text(self, input_pdf_path: str, output_pdf_path: str, page: int, text: str,
                 x: float, y: float, font_size: float = 12.0, font_name: str = "helv",
                 color: Optional[str] = "#000000", alignment: str = "left") -> bool:
        op = PDFOperation(
            type=OperationType.ADD_TEXT,
            page=page,
            new_text=text,
            bbox=[x, y, x + 200, y + font_size + 4],
            font_size=font_size,
            font_name=font_name,
            color=color,
            alignment=alignment
        )
        res = self.apply_operations(input_pdf_path, output_pdf_path, [op])
        return len(res) > 0

    def add_image(self, input_pdf_path: str, output_pdf_path: str, page: int, image_bytes: bytes,
                  bbox: List[float]) -> bool:
        import base64
        op = PDFOperation(
            type=OperationType.ADD_IMAGE,
            page=page,
            image_data=base64.b64encode(image_bytes).decode('utf-8'),
            bbox=bbox
        )
        res = self.apply_operations(input_pdf_path, output_pdf_path, [op])
        return len(res) > 0

    def redact(self, input_pdf_path: str, output_pdf_path: str, page: int, bbox: List[float],
               fill_color: Optional[str] = "#000000") -> bool:
        op = PDFOperation(
            type=OperationType.REDACT,
            page=page,
            bbox=bbox,
            color=fill_color
        )
        res = self.apply_operations(input_pdf_path, output_pdf_path, [op])
        return len(res) > 0

    def render_page_image(self, pdf_path: str, page_number: int, dpi: int = 150) -> bytes:
        if not PYMUPDF_AVAILABLE:
            return b""
        doc = fitz.open(pdf_path)
        if page_number < 1 or page_number > len(doc):
            doc.close()
            return b""
        page = doc[page_number - 1]
        zoom = dpi / 72.0
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        img_bytes = pix.tobytes("png")
        doc.close()
        return img_bytes
