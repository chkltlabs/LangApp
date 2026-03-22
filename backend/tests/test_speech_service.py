import httpx
import pytest
import respx

from app.services.speech import synthesize_speech, transcribe_audio


@pytest.mark.asyncio
async def test_transcribe_audio():
    with respx.mock:
        respx.post("http://stt-svc/transcribe").mock(
            return_value=httpx.Response(200, json={"text": "hello", "language": "en", "duration": 2.0}),
        )
        out = await transcribe_audio("http://stt-svc", b"bin", "a.webm", None)
        assert out["text"] == "hello"

    with respx.mock:
        respx.post("http://stt-svc/transcribe").mock(
            return_value=httpx.Response(200, json={"text": "hola"}),
        )
        out = await transcribe_audio("http://stt-svc", b"x", "a.webm", "es")
        assert out["text"] == "hola"


@pytest.mark.asyncio
async def test_synthesize_speech():
    with respx.mock:
        respx.post("http://tts-svc/synthesize").mock(
            return_value=httpx.Response(200, content=b"WAVDATA"),
        )
        raw = await synthesize_speech("http://tts-svc", " hi ", "voice1")
        assert raw == b"WAVDATA"
