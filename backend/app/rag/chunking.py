"""Text chunking with page/section metadata preservation."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Chunk:
    chunk_id: str
    text: str
    ordinal: int
    page: int | None = None
    section: str = ""


def chunk_text(
    text: str,
    *,
    doc_id: str,
    max_chars: int = 900,
    overlap: int = 120,
) -> list[Chunk]:
    """Split text into overlapping chunks on paragraph boundaries.

    Preserves a rough page marker if the text contains form-feed characters or
    explicit '--- page N ---' markers.
    """
    text = text.replace("\r\n", "\n")
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks: list[Chunk] = []
    buf = ""
    page = 1
    ordinal = 0
    section = ""

    def flush():
        nonlocal buf, ordinal
        if buf.strip():
            chunks.append(
                Chunk(
                    chunk_id=f"{doc_id}::c{ordinal}",
                    text=buf.strip(),
                    ordinal=ordinal,
                    page=page,
                    section=section,
                )
            )
            ordinal += 1

    for para in paragraphs:
        lower = para.lower()
        if lower.startswith("--- page") or "\f" in para:
            page += 1
        if para.isupper() and len(para) < 80:
            section = para.title()
        if len(buf) + len(para) + 2 > max_chars:
            flush()
            buf = buf[-overlap:] + "\n\n" + para if overlap else para
        else:
            buf = (buf + "\n\n" + para) if buf else para
    flush()
    return chunks
