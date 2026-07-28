"""Document ingestion + RAG routes with upload validation and citations."""
from __future__ import annotations

import os
import re

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from ...agents import DocumentAnalysisAgent
from ...config import settings
from ...core.exceptions import SentinelError
from ...core.rbac import Permission, require_permission
from ...core.response import success
from ...models.document import Document
from ...rag import NO_SOURCE, RAGPipeline
from ..deps import get_current_user, get_db

router = APIRouter(tags=["documents"])
_rag = RAGPipeline()

_SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]")


def _safe_filename(name: str) -> str:
    # Path-traversal protection: strip directories and unsafe chars.
    base = os.path.basename(name).replace("..", "")
    return _SAFE_NAME.sub("_", base) or "upload.bin"


def _validate(file: UploadFile, size: int) -> str:
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in settings.allowed_upload_extensions:
        raise SentinelError(
            "unsupported_file_type",
            f"File type '.{ext}' is not allowed.",
            details={"allowed": settings.allowed_upload_extensions},
            suggested_action="Upload a PDF, DOCX, TXT, CSV, JSON, or MD file.",
        )
    if size > settings.max_upload_mb * 1024 * 1024:
        raise SentinelError(
            "file_too_large",
            f"File exceeds the {settings.max_upload_mb}MB limit.",
            suggested_action="Compress or split the file.",
        )
    return ext


@router.post("/projects/{project_id}/documents")
async def upload_document(
    project_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(require_permission(Permission.DOCUMENT_UPLOAD)),
):
    raw = await file.read()
    _validate(file, len(raw))
    safe = _safe_filename(file.filename or "upload")

    os.makedirs(os.path.join(settings.storage_dir, str(project_id)), exist_ok=True)
    path = os.path.join(settings.storage_dir, str(project_id), safe)
    with open(path, "wb") as fh:
        fh.write(raw)

    # naive text extraction for text-like formats (real impl uses pdfminer/docx)
    text = raw.decode("utf-8", errors="ignore")

    doc = Document(project_id=project_id, filename=safe, content_type=file.content_type or "",
                   size_bytes=len(raw), storage_path=path, status="ingested")
    db.add(doc)
    db.flush()

    n_chunks = _rag.ingest(project_id, safe, text)
    analysis = DocumentAnalysisAgent().run({"text": text, "document": safe})
    doc.extracted_facts = analysis.data["facts"]
    db.commit()

    return success(
        {"document_id": doc.id, "filename": safe, "chunks": n_chunks,
         "facts": analysis.data["facts"]},
        analysis.explanation.to_dict(),
        next_actions=analysis.next_actions,
    )


@router.get("/projects/{project_id}/rag/search")
def rag_search(project_id: int, q: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    cites = _rag.retrieve(project_id, q)
    if not cites:
        return success({"query": q, "citations": [], "message": NO_SOURCE})
    return success({"query": q, "citations": [c.to_dict() for c in cites]})
