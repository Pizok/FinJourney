from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    supabase_url: str
    supabase_service_key: str
    supabase_jwt_secret: str
    environment: str = "development"
    qstash_current_signing_key: str = ""
    qstash_next_signing_key: str = ""

    # ── Email (Resend) ────────────────────────────────────────────────────────
    # Use "onboarding@resend.dev" for dev/testing (no domain needed).
    # Swap to your verified domain address (e.g. noreply@finjourney.app) in prod.
    resend_api_key: str = ""
    resend_from_email: str = "FinJourney <onboarding@resend.dev>"
    app_url: str = "http://localhost:3000"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()

