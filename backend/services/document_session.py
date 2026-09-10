"""
Document Session Manager.
Handles session lifecycles, file storage isolation, temporary file management,
and test sample PDF generation.
"""
import os
import uuid
import shutil
from typing import Dict, Optional, List
from backend.services.undo_manager import UndoManager
from backend.models.document import DocumentAnalysis, DocumentMetadata
from backend.pdf.pymupdf_backend import PyMuPDFBackend

class DocumentSession:
    def __init__(self, doc_id: str, original_filename: str, base_dir: str = "./storage"):
        self.doc_id = doc_id
        self.original_filename = original_filename
        self.session_dir = os.path.join(base_dir, "sessions", doc_id)
        os.makedirs(self.session_dir, exist_ok=True)
        
        self.original_pdf_path = os.path.join(self.session_dir, "original.pdf")
        self.undo_manager = UndoManager(self.session_dir)
        self.backend = PyMuPDFBackend()
        self.analysis: Optional[DocumentAnalysis] = None
        self.chat_history: List[Dict[str, str]] = []

    def set_file_content(self, pdf_bytes: bytes) -> str:
        with open(self.original_pdf_path, "wb") as f:
            f.write(pdf_bytes)
        
        current_path = self.undo_manager.initialize_original(self.original_pdf_path)
        self.refresh_analysis()
        return current_path

    def refresh_analysis(self) -> DocumentAnalysis:
        current_path = self.undo_manager.get_current_pdf_path() or self.original_pdf_path
        self.analysis = self.backend.analyze_document(current_path)
        # Update metadata revision pointers
        self.analysis.metadata.id = self.doc_id
        self.analysis.metadata.original_filename = self.original_filename
        self.analysis.metadata.current_revision = self.undo_manager.current_index + 1
        self.analysis.metadata.total_revisions = len(self.undo_manager.history)
        return self.analysis

    def get_current_pdf_path(self) -> str:
        return self.undo_manager.get_current_pdf_path() or self.original_pdf_path

    def create_working_copy_path(self) -> str:
        temp_id = str(uuid.uuid4())[:8]
        return os.path.join(self.session_dir, f"temp_{temp_id}.pdf")

class SessionStore:
    def __init__(self, base_dir: str = "./storage"):
        self.base_dir = base_dir
        self.sessions: Dict[str, DocumentSession] = {}
        os.makedirs(os.path.join(base_dir, "sessions"), exist_ok=True)
        os.makedirs(os.path.join(base_dir, "temp"), exist_ok=True)
        os.makedirs(os.path.join(base_dir, "exports"), exist_ok=True)

    def create_session(self, original_filename: str) -> DocumentSession:
        doc_id = str(uuid.uuid4())
        session = DocumentSession(doc_id=doc_id, original_filename=original_filename, base_dir=self.base_dir)
        self.sessions[doc_id] = session
        return session

    def get_session(self, doc_id: str) -> Optional[DocumentSession]:
        return self.sessions.get(doc_id)

    def delete_session(self, doc_id: str) -> bool:
        session = self.sessions.pop(doc_id, None)
        if session and os.path.exists(session.session_dir):
            try:
                shutil.rmtree(session.session_dir)
                return True
            except Exception:
                pass
        return False
