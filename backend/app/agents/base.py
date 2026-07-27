"""Base agent contract.

Every Sentinel agent:
  - has a name and purpose
  - takes a typed dict input, returns an AgentResult (data + Explanation)
  - delegates computation to deterministic engines where applicable
  - uses the LLM only for language
  - is individually testable
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from ..engines.explain import Explanation


@dataclass
class AgentResult:
    agent: str
    data: dict
    explanation: Explanation
    next_actions: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "agent": self.agent,
            "data": self.data,
            "explanation": self.explanation.to_dict(),
            "next_actions": self.next_actions,
        }


class BaseAgent(ABC):
    name: str = "base-agent"
    purpose: str = ""

    @abstractmethod
    def run(self, payload: dict) -> AgentResult:  # pragma: no cover - interface
        raise NotImplementedError

    def _na(self, action: str, reason: str, priority: str, module: str) -> dict:
        return {"action": action, "reason": reason, "priority": priority, "module": module}
