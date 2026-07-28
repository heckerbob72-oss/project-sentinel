"""LLM provider abstraction.

Sentinel uses LLMs ONLY for language tasks (summaries, clarification questions,
report drafting) — never for computation. Every provider implements the same
minimal interface so the app is provider-agnostic and testable with a mock.
"""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class LLMMessage:
    role: str  # system | user | assistant
    content: str


class LLMProvider(ABC):
    name: str = "base"

    @abstractmethod
    def complete(self, messages: list[LLMMessage], *, temperature: float = 0.2,
                 max_tokens: int = 800) -> str:
        """Return the model's text completion for a chat message list."""
        raise NotImplementedError


class FallbackLLMProvider(LLMProvider):
    """Use a deterministic fallback when the configured provider is unavailable."""

    def __init__(self, primary: LLMProvider, fallback: LLMProvider) -> None:
        self.primary = primary
        self.fallback = fallback
        self.name = primary.name

    def complete(
        self,
        messages: list[LLMMessage],
        *,
        temperature: float = 0.2,
        max_tokens: int = 800,
    ) -> str:
        try:
            return self.primary.complete(
                messages, temperature=temperature, max_tokens=max_tokens
            )
        except Exception as exc:
            logger.warning(
                "LLM provider %s failed (%s); using %s",
                self.primary.name,
                type(exc).__name__,
                self.fallback.name,
            )
            return self.fallback.complete(
                messages, temperature=temperature, max_tokens=max_tokens
            )
