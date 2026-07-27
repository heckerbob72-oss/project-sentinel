"""LLM provider abstraction.

Sentinel uses LLMs ONLY for language tasks (summaries, clarification questions,
report drafting) — never for computation. Every provider implements the same
minimal interface so the app is provider-agnostic and testable with a mock.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


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
