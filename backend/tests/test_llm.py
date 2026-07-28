"""LLM provider resilience tests."""
from __future__ import annotations

from app.llm.base import FallbackLLMProvider, LLMMessage, LLMProvider
from app.llm.mock import MockLLM


class FailingLLM(LLMProvider):
    name = "failing"

    def complete(
        self,
        messages: list[LLMMessage],
        *,
        temperature: float = 0.2,
        max_tokens: int = 800,
    ) -> str:
        raise RuntimeError("provider unavailable")


def test_provider_failure_uses_deterministic_fallback():
    provider = FallbackLLMProvider(FailingLLM(), MockLLM())

    result = provider.complete([LLMMessage("user", "Summarize the supplied facts")])

    assert result.startswith("Summary (generated from provided project data only):")