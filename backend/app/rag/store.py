"""Vector store abstraction with a ChromaDB backend and in-memory fallback.

Per-project namespace isolation prevents cross-project leakage. If ChromaDB is
not installed/reachable, an in-memory cosine store is used so the app still runs.
"""
from __future__ import annotations

from dataclasses import dataclass

from .embeddings import cosine, embed


@dataclass
class StoredChunk:
    chunk_id: str
    text: str
    metadata: dict
    embedding: list[float]


@dataclass
class SearchHit:
    chunk_id: str
    text: str
    metadata: dict
    score: float


class InMemoryVectorStore:
    """Simple, dependency-free cosine store used as the default/fallback."""

    def __init__(self):
        self._data: dict[str, list[StoredChunk]] = {}

    def add(self, namespace: str, chunk_id: str, text: str, metadata: dict) -> None:
        self._data.setdefault(namespace, []).append(
            StoredChunk(chunk_id, text, metadata, embed(text))
        )

    def search(self, namespace: str, query: str, k: int = 5) -> list[SearchHit]:
        q = embed(query)
        hits = [
            SearchHit(c.chunk_id, c.text, c.metadata, cosine(q, c.embedding))
            for c in self._data.get(namespace, [])
        ]
        hits.sort(key=lambda h: h.score, reverse=True)
        return hits[:k]

    def reset(self, namespace: str) -> None:
        self._data.pop(namespace, None)


def get_vector_store():
    """Return a Chroma-backed store if available, else the in-memory store."""
    from ..config import settings

    if settings.chroma_host:
        try:  # pragma: no cover - optional dependency
            import chromadb

            client = chromadb.HttpClient(host=settings.chroma_host, port=settings.chroma_port)
            return _ChromaStore(client)
        except Exception:
            return InMemoryVectorStore()
    return InMemoryVectorStore()


class _ChromaStore:  # pragma: no cover - exercised only when chroma present
    def __init__(self, client):
        self.client = client

    def _col(self, namespace: str):
        return self.client.get_or_create_collection(name=f"proj_{namespace}")

    def add(self, namespace, chunk_id, text, metadata):
        self._col(namespace).add(
            ids=[chunk_id], documents=[text], metadatas=[metadata], embeddings=[embed(text)]
        )

    def search(self, namespace, query, k=5):
        res = self._col(namespace).query(query_embeddings=[embed(query)], n_results=k)
        hits = []
        for i, cid in enumerate(res.get("ids", [[]])[0]):
            hits.append(
                SearchHit(
                    chunk_id=cid,
                    text=res["documents"][0][i],
                    metadata=res["metadatas"][0][i],
                    score=1.0 - res.get("distances", [[0]])[0][i],
                )
            )
        return hits

    def reset(self, namespace):
        try:
            self.client.delete_collection(name=f"proj_{namespace}")
        except Exception:
            pass
