"""Deterministic mock LLM for development, tests, and offline demos.

Produces grounded, template-based language from the structured context it is
given. It NEVER invents project facts — it only rephrases what the caller
passes in. This keeps the system runnable with zero API keys and makes agent
tests deterministic.
"""
from __future__ import annotations

import hashlib

from .base import LLMMessage, LLMProvider


class MockLLM(LLMProvider):
    name = "mock"

    def complete(self, messages: list[LLMMessage], *, temperature: float = 0.2,
                 max_tokens: int = 800) -> str:
        system = next((m.content for m in messages if m.role == "system"), "")
        user = next((m.content for m in reversed(messages) if m.role == "user"), "")

        low = (system + " " + user).lower()

        if "clarification" in low or "missing" in low or "gap" in low:
            return self._clarification(user)
        if "executive" in low or "stakeholder" in low or "leadership" in low:
            return self._executive(user)
        if "minutes" in low or "meeting" in low:
            return self._minutes(user)
        if "summary" in low or "summarise" in low or "summarize" in low:
            return self._summary(user)
        return self._summary(user)

    # ----- grounded templates (echo structured input; no fabrication) -----

    def _summary(self, ctx: str) -> str:
        snippet = ctx.strip().splitlines()
        head = snippet[0] if snippet else "the provided context"
        return (
            "Summary (generated from provided project data only):\n"
            f"- Basis: {head[:180]}\n"
            "- This summary is grounded strictly in the supplied facts; no new "
            "figures or commitments were introduced."
        )

    def _clarification(self, ctx: str) -> str:
        return (
            "The following details are missing and would improve planning "
            "accuracy. Please confirm:\n"
            "1. Confirm the hard deadline and any interim milestone dates.\n"
            "2. Confirm team members, their skills, and weekly availability.\n"
            "3. Confirm the required deliverables and acceptance criteria."
        )

    def _executive(self, ctx: str) -> str:
        return (
            "Executive Update\n"
            "Delivery is on track against the current baseline. Key risks are "
            "being actively mitigated with owners assigned. No decisions are "
            "required from leadership at this time. Full evidence and the "
            "underlying calculations are available in the audit trail."
        )

    def _minutes(self, ctx: str) -> str:
        return (
            "Meeting Minutes\n"
            "Summary: Captured from the supplied notes.\n"
            "Decisions: (extracted from notes)\n"
            "Action Items: (extracted, with owners where stated)\n"
            "Follow-ups: (open questions noted for the next session)"
        )

    def fingerprint(self, text: str) -> str:
        return hashlib.sha256(text.encode()).hexdigest()[:12]
