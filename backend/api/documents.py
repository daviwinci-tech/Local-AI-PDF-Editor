"""
Documents REST API Router.
Handles uploads, page inspections, AI command planning, operation previewing,
execution, undo/redo, and exports.
"""
import os
import io
import re
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Response
from fastapi.responses import FileResponse, StreamingResponse
from typing import Optional, List, Dict, Any

from backend.services.document_session import SessionStore
from backend.models.operations import (
    AICommandRequest,
    AICommandResponse,
    ApplyOperationsRequest,
    ApplyOperationsResponse,
    PDFOperation,
    OperationType
)
from backend.models.document import DocumentAnalysis, DocumentMetadata, PageInfo
from backend.ai.ai_parser import AICommandParser
from backend.pdf.editor import PDFEditor

router = APIRouter(prefix="/api/documents", tags=["Documents"])
session_store = SessionStore()
ai_parser = AICommandParser()
pdf_editor = PDFEditor()

def sanitize_filename(name: str) -> str:
    cleaned = re.sub(r'[^a-zA-Z0-9_.-]', '_', name)
    return cleaned[:100] or "document.pdf"

@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    # Validate MIME type and filename
    clean_name = sanitize_filename(file.filename or "upload.pdf")
    if not clean_name.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    content = await file.read()
    if len(content) > 50 * 1024 * 1024:  # 50MB limit
        raise HTTPException(status_code=400, detail="File exceeds 50MB limit.")

    session = session_store.create_session(original_filename=clean_name)
    session.set_file_content(content)
    
    analysis = session.refresh_analysis()
    return analysis

@router.post("/sample")
async def create_sample_document():
    """Create a high-fidelity sample test document for immediate testing."""
    session = session_store.create_session(original_filename="Sample_Contract_2026.pdf")
    
    # Generate standard sample PDF using PyMuPDF if available, or create dummy PDF bytes
    try:
        import fitz
        doc = fitz.open()
        
        # Page 1
        page1 = doc.new_page(width=595.3, height=841.9) # A4
        # Header banner
        page1.draw_rect(fitz.Rect(50, 40, 545, 90), color=(0.1, 0.2, 0.4), fill=(0.93, 0.95, 0.98))
        page1.insert_text(fitz.Point(70, 72), "SMLOUVA O POSKYTOVÁNÍ SLUŽEB 2026", fontsize=15, fontname="helv", color=(0.1, 0.2, 0.4))
        
        # Key Metadata
        page1.insert_text(fitz.Point(70, 130), "Číslo smlouvy: SML-2026-098", fontsize=11, fontname="helv", color=(0.2, 0.2, 0.2))
        page1.insert_text(fitz.Point(70, 155), "Datum vystavení: 1. 9. 2026", fontsize=11, fontname="helv", color=(0.2, 0.2, 0.2))
        page1.insert_text(fitz.Point(70, 180), "Datum splatnosti: 15. 9. 2026", fontsize=11, fontname="helv", color=(0.2, 0.2, 0.2))

        # Parties
        page1.insert_text(fitz.Point(70, 230), "Objednatel: TechCorp Solutions s.r.o.", fontsize=11, fontname="helv", color=(0.1, 0.1, 0.1))
        page1.insert_text(fitz.Point(70, 250), "Kontaktní osoba: Jan Novák", fontsize=11, fontname="helv", color=(0.2, 0.2, 0.2))
        page1.insert_text(fitz.Point(70, 270), "Email: jan.novak@techcorp.cz", fontsize=11, fontname="helv", color=(0.2, 0.2, 0.2))
        page1.insert_text(fitz.Point(70, 290), "IČO: 12345678 (Důvěrný údaj)", fontsize=11, fontname="helv", color=(0.2, 0.2, 0.2))

        # Project details with Hello World test string
        page1.insert_text(fitz.Point(70, 340), "Předmět plnění: Vývoj webové aplikace", fontsize=12, fontname="helv", color=(0.1, 0.1, 0.1))
        page1.insert_text(fitz.Point(70, 365), "Úvodní zpráva systému: Hello World", fontsize=11, fontname="helv", color=(0.2, 0.2, 0.2))
        page1.insert_text(fitz.Point(70, 390), "Cena za dílo: 20 000 Kč bez DPH", fontsize=11, fontname="helv", color=(0.2, 0.2, 0.2))
        page1.insert_text(fitz.Point(70, 415), "Termín dokončení: 30. 9. 2026", fontsize=11, fontname="helv", color=(0.2, 0.2, 0.2))

        # Paragraph for deletion test
        page1.insert_text(fitz.Point(70, 470), "Tento odstavec obsahuje dočasné zkušební poznámky k revizi.", fontsize=10, fontname="helv", color=(0.5, 0.5, 0.5))
        page1.insert_text(fitz.Point(70, 490), "Prosím odstraňte tento testovací text před finální expedicí.", fontsize=10, fontname="helv", color=(0.5, 0.5, 0.5))

        # Footer
        page1.draw_line(fitz.Point(50, 780), fitz.Point(545, 780), color=(0.8, 0.8, 0.8))
        page1.insert_text(fitz.Point(70, 800), "Strana 1 z 2 | Vygenerováno aplikací Local AI PDF Editor", fontsize=9, fontname="helv", color=(0.5, 0.5, 0.5))

        # Page 2
        page2 = doc.new_page(width=595.3, height=841.9)
        page2.insert_text(fitz.Point(70, 70), "PŘÍLOHA Č. 1: SPECIFIKACE A SCHVÁLENÍ", fontsize=14, fontname="helv", color=(0.1, 0.2, 0.4))
        page2.insert_text(fitz.Point(70, 110), "Harmonogram prací pro rok 2026.", fontsize=11, fontname="helv", color=(0.2, 0.2, 0.2))
        page2.insert_text(fitz.Point(70, 135), "Zodpovědný vedoucí: Jan Novák", fontsize=11, fontname="helv", color=(0.2, 0.2, 0.2))
        page2.insert_text(fitz.Point(70, 160), "Datum podpisu protokolu: 1. 9. 2026", fontsize=11, fontname="helv", color=(0.2, 0.2, 0.2))

        page2.draw_line(fitz.Point(50, 780), fitz.Point(545, 780), color=(0.8, 0.8, 0.8))
        page2.insert_text(fitz.Point(70, 800), "Strana 2 z 2 | Vygenerováno aplikací Local AI PDF Editor", fontsize=9, fontname="helv", color=(0.5, 0.5, 0.5))

        pdf_bytes = doc.tobytes()
        doc.close()
    except Exception:
        # Minimal empty PDF if fitz not available
        pdf_bytes = b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF"

    session.set_file_content(pdf_bytes)
    analysis = session.refresh_analysis()
    return analysis

@router.get("/{doc_id}")
async def get_document(doc_id: str):
    session = session_store.get_session(doc_id)
    if not session:
        raise HTTPException(status_code=404, detail="Document session not found.")
    return session.refresh_analysis()

@router.get("/{doc_id}/pages")
async def get_document_pages(doc_id: str):
    session = session_store.get_session(doc_id)
    if not session:
        raise HTTPException(status_code=404, detail="Document not found.")
    analysis = session.refresh_analysis()
    return {"pages": analysis.pages}

@router.get("/{doc_id}/page/{page_num}")
async def get_page_info(doc_id: str, page_num: int):
    session = session_store.get_session(doc_id)
    if not session:
        raise HTTPException(status_code=404, detail="Document not found.")
    analysis = session.refresh_analysis()
    for p in analysis.pages:
        if p.page_number == page_num:
            return p
    raise HTTPException(status_code=404, detail=f"Page {page_num} not found.")

@router.get("/{doc_id}/page/{page_num}/image")
async def get_page_image(doc_id: str, page_num: int, dpi: int = 150):
    session = session_store.get_session(doc_id)
    if not session:
        raise HTTPException(status_code=404, detail="Document not found.")
    current_pdf = session.get_current_pdf_path()
    img_bytes = session.backend.render_page_image(current_pdf, page_num, dpi=dpi)
    if not img_bytes:
        raise HTTPException(status_code=500, detail="Failed to render page image.")
    return Response(content=img_bytes, media_type="image/png")

@router.get("/{doc_id}/pdf")
async def get_current_pdf(doc_id: str):
    session = session_store.get_session(doc_id)
    if not session:
        raise HTTPException(status_code=404, detail="Document not found.")
    pdf_path = session.get_current_pdf_path()
    return FileResponse(pdf_path, media_type="application/pdf", filename=session.original_filename)

@router.post("/{doc_id}/ai-command", response_model=AICommandResponse)
async def process_ai_command(doc_id: str, request: AICommandRequest):
    session = session_store.get_session(doc_id)
    if not session:
        raise HTTPException(status_code=404, detail="Document not found.")

    analysis = session.refresh_analysis()
    # Add prompt to session history
    session.chat_history.append({"role": "user", "content": request.prompt})
    
    # Pass history to parser
    request.history = session.chat_history
    ai_response = await ai_parser.parse_command(request, doc_analysis=analysis)

    # Record assistant answer in chat history
    session.chat_history.append({"role": "assistant", "content": ai_response.explanation})
    return ai_response

@router.post("/{doc_id}/preview-operation")
async def preview_operation(doc_id: str, request: ApplyOperationsRequest):
    """Generates a temporary preview PDF without committing it to the main revision history."""
    session = session_store.get_session(doc_id)
    if not session:
        raise HTTPException(status_code=404, detail="Document not found.")

    current_pdf = session.get_current_pdf_path()
    temp_preview_path = session.create_working_copy_path()
    
    modified_pages = pdf_editor.execute_plan(current_pdf, temp_preview_path, request.operations)
    return {
        "preview_ready": True,
        "modified_pages": modified_pages,
        "operations_count": len(request.operations)
    }

@router.post("/{doc_id}/apply", response_model=ApplyOperationsResponse)
async def apply_operations(doc_id: str, request: ApplyOperationsRequest):
    session = session_store.get_session(doc_id)
    if not session:
        raise HTTPException(status_code=404, detail="Document not found.")

    current_pdf = session.get_current_pdf_path()
    temp_target_path = session.create_working_copy_path()

    modified_pages = pdf_editor.execute_plan(current_pdf, temp_target_path, request.operations)
    
    # Save as new immutable revision
    rev = session.undo_manager.add_revision(
        new_pdf_path=temp_target_path,
        description=request.description or "Úprava dokumentu",
        operations_count=len(request.operations),
        modified_pages=modified_pages
    )
    
    # Refresh analysis with new revision
    session.refresh_analysis()

    return ApplyOperationsResponse(
        success=True,
        revision_id=rev.id,
        revision_number=rev.revision_number,
        modified_pages=modified_pages,
        message=f"Úspěšně aplikováno {len(request.operations)} změn."
    )

@router.post("/{doc_id}/undo")
async def undo_operation(doc_id: str):
    session = session_store.get_session(doc_id)
    if not session:
        raise HTTPException(status_code=404, detail="Document not found.")
    
    path = session.undo_manager.undo()
    if not path:
        raise HTTPException(status_code=400, detail="Nelze provést Undo (žádné starší revize).")
    
    analysis = session.refresh_analysis()
    return {
        "success": True,
        "current_revision": session.undo_manager.current_index + 1,
        "can_undo": session.undo_manager.can_undo(),
        "can_redo": session.undo_manager.can_redo(),
        "analysis": analysis
    }

@router.post("/{doc_id}/redo")
async def redo_operation(doc_id: str):
    session = session_store.get_session(doc_id)
    if not session:
        raise HTTPException(status_code=404, detail="Document not found.")
    
    path = session.undo_manager.redo()
    if not path:
        raise HTTPException(status_code=400, detail="Nelze provést Redo (žádné novější revize).")
    
    analysis = session.refresh_analysis()
    return {
        "success": True,
        "current_revision": session.undo_manager.current_index + 1,
        "can_undo": session.undo_manager.can_undo(),
        "can_redo": session.undo_manager.can_redo(),
        "analysis": analysis
    }

@router.get("/{doc_id}/history")
async def get_history(doc_id: str):
    session = session_store.get_session(doc_id)
    if not session:
        raise HTTPException(status_code=404, detail="Document not found.")
    return {
        "history": session.undo_manager.get_history_summary(),
        "current_index": session.undo_manager.current_index,
        "can_undo": session.undo_manager.can_undo(),
        "can_redo": session.undo_manager.can_redo()
    }

@router.get("/{doc_id}/export")
async def export_document(doc_id: str, format: str = "pdf"):
    session = session_store.get_session(doc_id)
    if not session:
        raise HTTPException(status_code=404, detail="Document not found.")
    
    pdf_path = session.get_current_pdf_path()
    export_filename = f"edited_{session.original_filename}"
    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=export_filename,
        headers={"Content-Disposition": f'attachment; filename="{export_filename}"'}
    )
