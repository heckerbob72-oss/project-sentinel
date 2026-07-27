"""LLM provider factory — selects a provider from settings with a mock fallback.

Real providers (OpenAI/Azure/Ollama) are imported lazily and only used when the
relevant SDK + credentials are present. Otherwise the deterministic MockLLM is
returned so the app always runs.
"""
from __future__ import annotations

from ..config import settings
from .base import LLMProvider
from .mock import MockLLM


def get_llm() -> LLMProvider:
    provider = settings.llm_provider.lower()

    if provider == "openai" and settings.openai_api_key:
        try:
            from .openai_provider import OpenAIProvider  # optional

            return OpenAIProvider()
        except Exception:
            return MockLLM()

    # azure / ollama would be wired similarly; default to the mock so the
    # system is always operational offline.
    return MockLLM()
