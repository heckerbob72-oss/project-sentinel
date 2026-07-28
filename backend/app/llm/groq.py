"""Groq chat-completion provider using its OpenAI-compatible HTTP API."""
from __future__ import annotations

import ssl
from typing import Any

import httpx
import truststore

from .base import LLMMessage, LLMProvider


class GroqProvider(LLMProvider):
    """Generate language responses through Groq without an SDK dependency."""

    name = "groq"

    def __init__(self, api_key: str, model: str, base_url: str) -> None:
        self._api_key = api_key
        self._model = model
        self._endpoint = f"{base_url.rstrip('/')}/chat/completions"
        self._ssl_context = truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)

    def complete(
        self,
        messages: list[LLMMessage],
        *,
        temperature: float = 0.2,
        max_tokens: int = 800,
    ) -> str:
        """Return a Groq chat completion for the supplied messages."""
        payload: dict[str, Any] = {
            "model": self._model,
            "messages": [
                {"role": message.role, "content": message.content} for message in messages
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        with httpx.Client(verify=self._ssl_context, timeout=30.0) as client:
            response = client.post(
                self._endpoint,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            response.raise_for_status()

        data = response.json()
        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise ValueError("Groq returned an invalid chat-completion response") from exc
        if not isinstance(content, str) or not content.strip():
            raise ValueError("Groq returned an empty chat completion")
        return content.strip()