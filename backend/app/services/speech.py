from typing import Any

import httpx


async def transcribe_audio(stt_url: str, audio: bytes, filename: str, language: str | None) -> dict[str, Any]:
    url = f"{stt_url.rstrip('/')}/transcribe"
    files = {"file": (filename, audio, "application/octet-stream")}
    data = {}
    if language:
        data["language"] = language
    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.post(url, files=files, data=data)
        r.raise_for_status()
        return r.json()


async def synthesize_speech(tts_url: str, text: str, voice_key: str) -> bytes:
    url = f"{tts_url.rstrip('/')}/synthesize"
    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.post(
            url,
            json={"text": text, "voice_key": voice_key},
        )
        r.raise_for_status()
        return r.content
