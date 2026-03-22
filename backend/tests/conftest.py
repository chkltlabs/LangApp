import pytest
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def _test_env(tmp_path, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'test.db'}")
    monkeypatch.setenv("API_KEY", "")
    monkeypatch.setenv("OLLAMA_HOST", "http://ollama.test")
    monkeypatch.delenv("LLM_MODEL_FAST", raising=False)
    monkeypatch.delenv("LLM_MODEL_STRONG", raising=False)
    monkeypatch.delenv("LANG_TARGET_LOCALE", raising=False)

    from app.config import get_settings
    from app.db import init_db, reset_engine

    get_settings.cache_clear()
    reset_engine()
    init_db()
    yield
    reset_engine()
    get_settings.cache_clear()


@pytest.fixture
def client() -> TestClient:
    from app.main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture
def client_with_api_key(monkeypatch) -> TestClient:
    monkeypatch.setenv("API_KEY", "secret-test-key")
    from app.config import get_settings

    get_settings.cache_clear()
    from app.main import app

    with TestClient(app) as c:
        yield c


def patch_ollama_complete(monkeypatch, reply: str = "mock reply") -> None:
    async def fake(*_a, **_k):
        return reply

    for mod in (
        "app.routers.speech",
        "app.routers.chat",
        "app.routers.pronunciation",
    ):
        monkeypatch.setattr(f"{mod}.ollama_chat_complete", fake)


def patch_ollama_generate_json(monkeypatch, data: dict) -> None:
    async def fake(*_a, **_k):
        return data

    for mod in (
        "app.routers.lexicon",
        "app.routers.vocab",
        "app.routers.exercises",
    ):
        monkeypatch.setattr(f"{mod}.ollama_generate_json", fake)


def patch_stt_tts(monkeypatch) -> None:
    async def fake_t(*_a, **_k):
        return {"text": "hola", "language": "es", "duration": 1.2}

    async def fake_s(*_a, **_k):
        return b"RIFFfake"

    monkeypatch.setattr("app.routers.speech.transcribe_audio", fake_t)
    monkeypatch.setattr("app.routers.speech.synthesize_speech", fake_s)
    monkeypatch.setattr("app.routers.pronunciation.transcribe_audio", fake_t)
