"""Deterministic bag-of-words hashing embedder (offline default).

A real deployment swaps this for a sentence-transformer or an OpenAI embedding
model. This deterministic embedder needs no network and makes retrieval tests
reproducible. It is a hashed term-frequency vector, L2-normalised.
"""
from __future__ import annotations

import math
import re

_DIM = 256
_TOKEN = re.compile(r"[a-z0-9]+")


def embed(text: str, dim: int = _DIM) -> list[float]:
    vec = [0.0] * dim
    for tok in _TOKEN.findall(text.lower()):
        idx = hash(tok) % dim
        vec[idx] += 1.0
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def cosine(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b, strict=True))
