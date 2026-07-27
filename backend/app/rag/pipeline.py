"""RAG pipeline: ingest -> chunk -> embed -> store; retrieve -> cite.

Citation contract: every retrieval result carries document name, page, section,
chunk id, and the source snippet. If nothing relevant is found, the caller MUST
surface: 'No supporting source was found in the uploaded documents.'
"""
from __future__ import annotations

from dataclasses import dataclass

from .chunking import chunk_text
from .store import get_vector_store

NO_SOURCE = "No supporting source was found in the uploaded documents."


@dataclass
class Citation:
    document: str
    page: int | None
    section: str
    chunk_id: str
    snippet: str
    confidence: float

    def to_dict(self) -> dict:
        return {
            "document": self.document,
            "page": self.page,
            "section": self.section,
            "chunk_id": self.chunk_id,
            "snippet": self.snippet[:280],
            "confidence": round(self.confidence, 3),
        }


class RAGPipeline:
    def __init__(self, store=None):
        self.store = store or get_vector_store()

    def ingest(self, project_id: int, document_name: str, text: str) -> int:
        ns = str(project_id)
        chunks = chunk_text(text, doc_id=document_name)
        for c in chunks:
            self.store.add(
                ns,
                c.chunk_id,
                c.text,
                {
                    "document": document_name,
                    "page": c.page,
                    "section": c.section,
                    "ordinal": c.ordinal,
                },
            )
        return len(chunks)

    def retrieve(self, project_id: int, query: str, k: int = 5,
                 min_score: float = 0.05) -> list[Citation]:
        hits = self.store.search(str(project_id), query, k=k)
        cites = [
            Citation(
                document=h.metadata.get("document", "unknown"),
                page=h.metadata.get("page"),
                section=h.metadata.get("section", ""),
                chunk_id=h.chunk_id,
                snippet=h.text,
                confidence=max(0.0, min(1.0, h.score)),
            )
            for h in hits
            if h.score >= min_score
        ]
        return cites
