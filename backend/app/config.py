from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ollama_host: str = "http://host.docker.internal:11434"
    stt_url: str = "http://localhost:8001"
    tts_url: str = "http://localhost:8002"
    database_url: str = "sqlite:///./langapp.db"

    lang_target: str = "Spanish"
    lang_ui: str = "English"
    cefr_level: str = "A2"

    llm_model: str = "qwen2.5:14b"
    llm_model_fast: str | None = None
    llm_model_strong: str | None = None

    api_key: str | None = None

    # Piper voice keys (must exist in TTS container /voices)
    tts_voice_target: str = "es_ES-davefx-medium"
    tts_voice_ui: str = "en_US-lessac-medium"


@lru_cache
def get_settings() -> Settings:
    return Settings()
