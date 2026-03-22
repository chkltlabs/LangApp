from app.routers.pronunciation import _alignment_hint, _normalize
from tests.conftest import patch_ollama_complete, patch_stt_tts


def test_normalize():
    assert _normalize("Hello, World!") == "hello world"


def test_alignment_hint():
    h = _alignment_hint("hello world", "hello word")
    assert h["ratio"] <= 1.0
    assert "hello" in h["target_tokens"]


def test_target_phrase(client, monkeypatch):
    patch_stt_tts(monkeypatch)
    patch_ollama_complete(monkeypatch, "feedback line")
    r = client.post(
        "/api/pronunciation/target-phrase",
        data={"target_text": "hola"},
        files={"file": ("a.webm", b"x", "video/webm")},
    )
    assert r.status_code == 200
    j = r.json()
    assert j["transcript"] == "hola"
    assert j["feedback"] == "feedback line"


def test_shadowing(client, monkeypatch):
    patch_stt_tts(monkeypatch)
    patch_ollama_complete(monkeypatch, "fb")
    r = client.post(
        "/api/pronunciation/shadowing",
        data={"reference_text": "buenos días"},
        files={"file": ("a.wav", b"x", "application/octet-stream")},
    )
    assert r.status_code == 200


def test_target_phrase_empty_transcript(client, monkeypatch):
    async def empty(*_a, **_k):
        return {"text": ""}

    monkeypatch.setattr("app.routers.pronunciation.transcribe_audio", empty)
    r = client.post(
        "/api/pronunciation/target-phrase",
        data={"target_text": "x"},
        files={"file": ("a.webm", b"x", "video/webm")},
    )
    assert r.status_code == 400


def test_shadowing_empty_transcript(client, monkeypatch):
    async def empty(*_a, **_k):
        return {"text": ""}

    monkeypatch.setattr("app.routers.pronunciation.transcribe_audio", empty)
    r = client.post(
        "/api/pronunciation/shadowing",
        data={"reference_text": "x"},
        files={"file": ("a.webm", b"x", "video/webm")},
    )
    assert r.status_code == 400
