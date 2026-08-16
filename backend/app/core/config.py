from functools import lru_cache

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="DURISENSE_", env_file=".env", extra="ignore")

    environment: str = "development"
    database_url: str = "postgresql+asyncpg://durisense:change-me@db:5432/durisense"
    allowed_origins: list[str] = [
        "http://127.0.0.1:3000",
        "http://localhost:3000",
        "http://127.0.0.1:4173",
        "http://localhost:4173",
    ]
    allowed_hosts: list[str] = ["127.0.0.1", "localhost", "api", "testserver"]
    cookie_secure: bool = True
    expose_dev_tokens: bool = False
    secret_key: str = Field(default="development-only-secret-change-before-production", min_length=32)
    session_minutes: int = 480
    verification_minutes: int = 1440
    reset_minutes: int = 30
    public_app_url: str = "http://127.0.0.1:4173"
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from_email: str | None = None
    smtp_starttls: bool = True
    email_poll_seconds: int = 10
    login_attempts: int = 5
    lockout_minutes: int = 15
    admin_email: str | None = None
    admin_password: str | None = None
    admin_mfa_secret: str | None = None

    @model_validator(mode="after")
    def validate_production_settings(self):
        if self.environment == "production" and self.expose_dev_tokens:
            raise ValueError("development tokens cannot be exposed in production")
        if self.environment == "production" and "development-only" in self.secret_key:
            raise ValueError("production requires a unique secret key")
        if self.environment == "production" and not (self.smtp_host and self.smtp_from_email):
            raise ValueError("production requires SMTP host and sender")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
