"""Central configuration via Pydantic settings (12-factor, env-driven)."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = PROJECT_ROOT / "backend"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(PROJECT_ROOT / ".env", BACKEND_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- app ---
    app_name: str = "Project Sentinel"
    api_v1_prefix: str = "/api/v1"
    environment: str = Field(default="development")
    debug: bool = True

    # --- database ---
    # Defaults to local SQLite so the app runs with zero infra; Docker Compose
    # overrides this with the PostgreSQL URL.
    database_url: str = Field(default="sqlite:///./sentinel.db")

    # --- security ---
    secret_key: str = Field(default="change-me-in-production-please-32bytes-min")
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 12
    bcrypt_rounds: int = 12

    # --- CORS ---
    cors_origins: list[str] = Field(default=["http://localhost:3000", "http://127.0.0.1:3000"])

    # --- infra (optional; graceful fallbacks if absent) ---
    redis_url: str = Field(default="redis://localhost:6379/0")
    chroma_host: str | None = None
    chroma_port: int = 8001
    chroma_persist_dir: str = "./.chroma"

    # --- llm ---
    llm_provider: str = Field(default="mock")  # mock | groq
    llm_model: str = "llama-3.3-70b-versatile"
    groq_api_key: str | None = None
    groq_base_url: str = "https://api.groq.com/openai/v1"

    # --- storage ---
    storage_backend: str = "local"  # local | s3
    storage_dir: str = "./storage"
    s3_bucket: str | None = None
    s3_endpoint_url: str | None = None

    # --- uploads ---
    max_upload_mb: int = 25
    allowed_upload_extensions: list[str] = Field(
        default=["pdf", "docx", "txt", "csv", "json", "md"]
    )

    # --- rate limiting ---
    rate_limit_per_minute: int = 120


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
