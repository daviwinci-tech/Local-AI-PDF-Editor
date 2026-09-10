"""
Undo / Redo and Revision History Manager.
Every modification generates a timestamped immutable revision snapshot.
Original uploaded file is NEVER overwritten.
"""
import os
import shutil
import datetime
from typing import List, Optional, Dict
from backend.models.document import RevisionInfo

class UndoManager:
    def __init__(self, session_dir: str):
        self.session_dir = session_dir
        self.revisions_dir = os.path.join(session_dir, "revisions")
        os.makedirs(self.revisions_dir, exist_ok=True)
        self.history: List[RevisionInfo] = []
        self.current_index: int = -1  # 0-indexed in history list

    def initialize_original(self, original_pdf_path: str) -> str:
        """Create baseline revision #1 from original file."""
        rev_id = "rev_1"
        target_path = os.path.join(self.revisions_dir, f"{rev_id}.pdf")
        shutil.copy2(original_pdf_path, target_path)

        rev_info = RevisionInfo(
            id=rev_id,
            revision_number=1,
            timestamp=datetime.datetime.now().strftime("%H:%M:%S"),
            description="Původní dokument",
            operations_count=0,
            modified_pages=[]
        )
        self.history = [rev_info]
        self.current_index = 0
        return target_path

    def add_revision(self, new_pdf_path: str, description: str, operations_count: int, modified_pages: List[int]) -> RevisionInfo:
        """Push a new revision, discarding any redo branch beyond current_index."""
        if self.current_index < len(self.history) - 1:
            self.history = self.history[:self.current_index + 1]

        next_num = len(self.history) + 1
        rev_id = f"rev_{next_num}"
        target_path = os.path.join(self.revisions_dir, f"{rev_id}.pdf")
        shutil.copy2(new_pdf_path, target_path)

        rev_info = RevisionInfo(
            id=rev_id,
            revision_number=next_num,
            timestamp=datetime.datetime.now().strftime("%H:%M:%S"),
            description=description,
            operations_count=operations_count,
            modified_pages=modified_pages
        )
        self.history.append(rev_info)
        self.current_index = len(self.history) - 1
        return rev_info

    def can_undo(self) -> bool:
        return self.current_index > 0

    def can_redo(self) -> bool:
        return self.current_index < len(self.history) - 1

    def undo(self) -> Optional[str]:
        if not self.can_undo():
            return None
        self.current_index -= 1
        rev = self.history[self.current_index]
        return os.path.join(self.revisions_dir, f"{rev.id}.pdf")

    def redo(self) -> Optional[str]:
        if not self.can_redo():
            return None
        self.current_index += 1
        rev = self.history[self.current_index]
        return os.path.join(self.revisions_dir, f"{rev.id}.pdf")

    def get_current_pdf_path(self) -> Optional[str]:
        if self.current_index >= 0 and self.current_index < len(self.history):
            rev = self.history[self.current_index]
            return os.path.join(self.revisions_dir, f"{rev.id}.pdf")
        return None

    def get_revision_path(self, revision_number: int) -> Optional[str]:
        for r in self.history:
            if r.revision_number == revision_number:
                return os.path.join(self.revisions_dir, f"{r.id}.pdf")
        return None

    def get_history_summary(self) -> List[RevisionInfo]:
        return list(self.history)
