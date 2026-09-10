"""
OCR module for scanned PDF detection and optical character recognition.
Only called when a document lacks a native selectable text layer.
"""
import os
from typing import List, Dict, Any, Optional

try:
    import pytesseract
    from PIL import Image
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False

class OCRProcessor:
    def __init__(self):
        self.is_available = TESSERACT_AVAILABLE

    def is_scanned_page(self, text_block_count: int, has_images: bool) -> bool:
        return text_block_count == 0 and has_images

    def extract_text_from_image(self, image_bytes: bytes, lang: str = "ces+eng") -> str:
        if not self.is_available:
            return ""
        try:
            import io
            image = Image.open(io.BytesIO(image_bytes))
            return pytesseract.image_to_string(image, lang=lang)
        except Exception as e:
            print(f"OCR Error: {e}")
            return ""
