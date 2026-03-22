import json

from tests.conftest import patch_ollama_complete, patch_stt_tts


def test_tts_proxy(client, monkeypatch):
    patch_stt_tts(monkeypatch)
    r = client.post(
        "/api/speech/tts",
        json={"text": "hola", "voice_key": "es_ES-davefx-medium"},
    )
    assert r.status_code == 200
    j = r.json()
    assert j["format"] == "wav"
    assert "audio_base64" in j


def test_transcribe_proxy(client, monkeypatch):
    patch_stt_tts(monkeypatch)
    r = client.post(
        "/api/speech/transcribe",
        files={"file": ("a.webm", b"fake", "application/octet-stream")},
    )
    assert r.status_code == 200
    assert r.json()["text"] == "hola"


def test_voice_turn(client, monkeypatch):
    patch_stt_tts(monkeypatch)
    patch_ollama_complete(monkeypatch, "  reply text  ")
    r = client.post(
        "/api/speech/voice-turn",
        data={"messages_json": json.dumps([])},
        files={"file": ("a.webm", b"x", "application/octet-stream")},
    )
    assert r.status_code == 200
    j = r.json()
    assert j["transcript"] == "hola"
    assert j["reply"] == "reply text"
    assert j["audio_format"] == "wav"


def test_voice_turn_bad_json_prior(client, monkeypatch):
    patch_stt_tts(monkeypatch)
    patch_ollama_complete(monkeypatch, "ok")
    r = client.post(
        "/api/speech/voice-turn",
        data={"messages_json": "not-json"},
        files={"file": ("a.webm", b"x", "application/octet-stream")},
    )
    assert r.status_code == 200


def test_voice_turn_empty_stt(client, monkeypatch):
    async def empty(*_a, **_k):
        return {"text": "  ", "language": None, "duration": None}

    monkeypatch.setattr("app.routers.speech.transcribe_audio", empty)
    r = client.post(
        "/api/speech/voice-turn",
        files={"file": ("a.webm", b"x", "application/octet-stream")},
    )
    assert r.status_code == 400


def test_voice_turn_skips_bad_messages(client, monkeypatch):
    patch_stt_tts(monkeypatch)
    patch_ollama_complete(monkeypatch, "r")
    prior = [
        {"role": "user", "content": "u"},
        {"role": "tool", "content": "x"},
        {"role": "assistant", "content": ""},
        {"role": "assistant", "content": "a"},
    ]
    r = client.post(
        "/api/speech/voice-turn",
        data={"messages_json": json.dumps(prior)},
        files={"file": ("a.webm", b"x", "application/octet-stream")},
    )
    assert r.status_code == 200
