"""Authentication primitives: password hashing and JWT tokens.

Uses the maintained `bcrypt` library directly (not passlib, which is unmaintained
and breaks against modern bcrypt during backend detection). bcrypt caps the
password at 72 bytes, so we truncate consistently for both hash and verify.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt

from ..config import settings

_MAX_BCRYPT_BYTES = 72


def _to_bytes(plain: str) -> bytes:
    # bcrypt only considers the first 72 bytes; truncate identically on both
    # hash and verify so behaviour is consistent.
    return plain.encode("utf-8")[:_MAX_BCRYPT_BYTES]


def hash_password(plain: str) -> str:
    hashed = bcrypt.hashpw(_to_bytes(plain), bcrypt.gensalt(rounds=settings.bcrypt_rounds))
    return hashed.decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(_to_bytes(plain), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(subject: str, extra: dict[str, Any] | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
