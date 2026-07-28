"""Select the configured LLM provider with a deterministic mock fallback."""
from __future__ import annotations

import logging

from ..config import settings
from .base import FallbackLLMProvider, LLMProvider
from .groq import GroqProvider
from .mock import MockLLM

logger = logging.getLogger(__name__)


def get_llm() -> LLMProvider:
    provider = settings.llm_provider.lower()

    if provider == "groq":
        if settings.groq_api_key:
            return FallbackLLMProvider(
                GroqProvider(
                    api_key=settings.groq_api_key,
                    model=settings.llm_model,
                    base_url=settings.groq_base_url,
                ),
                MockLLM(),
            )
        logger.warning("LLM_PROVIDER=groq but GROQ_API_KEY is empty; using MockLLM")
    elif provider != "mock":
        logger.warning("Unsupported LLM provider %r; using MockLLM", provider)

    return MockLLM()
