import base64
import json
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.config import Settings, get_settings
from app.deps import require_api_key
from app.services.ollama import ollama_chat_complete, tutor_system_prompt
from app.services.speech import synthesize_speech, transcribe_audio

router = APIRouter(prefix="/api/speech", tags=["speech"])


class TtsRequest(BaseModel):
    text: str = Field(..., max_length=5000)
    voice_key: str | None = None


@router.post("/transcribe")
async def proxy_transcribe(
    file: UploadFile = File(...),
    language: str | None = Form(None),
    settings: Settings = Depends(get_settings),
    _: None = Depends(require_api_key),
):
    raw = await file.read()
    if len(raw) > 25 * 1024 * 1024:
        raise HTTPException(413, "Audio too large")
    name = file.filename or "audio.webm"
    return await transcribe_audio(settings.stt_url, raw, name, language)


@router.post("/tts")
async def proxy_tts(
    body: TtsRequest,
    settings: Settings = Depends(get_settings),
    _: None = Depends(require_api_key),
):
    voice = body.voice_key or settings.tts_voice_target
    audio = await synthesize_speech(settings.tts_url, body.text, voice)
    b64 = base64.standard_b64encode(audio).decode("ascii")
    return {"format": "wav", "audio_base64": b64}


class ChatMessage(BaseModel):
    role: str
    content: str


class VoiceChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(default_factory=list)
    model_tier: str | None = None


def _resolve_model(settings: Settings, tier: str | None) -> str:
    if tier == "fast" and settings.llm_model_fast:
        return settings.llm_model_fast
    if tier == "strong" and settings.llm_model_strong:
        return settings.llm_model_strong
    return settings.llm_model


@router.post("/voice-turn")
async def voice_turn(
    file: UploadFile = File(...),
    messages_json: str = Form("[]"),
    model_tier: str | None = Form(None),
    tts_voice: str | None = Form(None),
    stt_language: str | None = Form(None),
    settings: Settings = Depends(get_settings),
    _: None = Depends(require_api_key),
):
    """
    Push-to-talk: audio -> STT -> Ollama (full reply) -> TTS -> base64 wav.
    """
    raw = await file.read()
    name = file.filename or "audio.webm"
    stt = await transcribe_audio(settings.stt_url, raw, name, stt_language)
    user_text = (stt.get("text") or "").strip()
    if not user_text:
        raise HTTPException(400, "Could not transcribe audio")

    try:
        prior = json.loads(messages_json)
    except json.JSONDecodeError:
        prior = []

    sys_msg = tutor_system_prompt(settings)
    ollama_messages: list[dict[str, str]] = [{"role": "system", "content": sys_msg}]
    for m in prior:
        if isinstance(m, dict) and m.get("role") in ("user", "assistant") and m.get("content"):
            ollama_messages.append({"role": m["role"], "content": str(m["content"])})
    ollama_messages.append({"role": "user", "content": user_text})

    model = _resolve_model(settings, model_tier)
    reply = await ollama_chat_complete(settings, ollama_messages, model=model)
    reply = (reply or "").strip()

    voice = tts_voice or settings.tts_voice_target
    audio = await synthesize_speech(settings.tts_url, reply, voice)
    b64 = base64.standard_b64encode(audio).decode("ascii")

    return {
        "transcript": user_text,
        "reply": reply,
        "model": model,
        "stt": {"language": stt.get("language"), "duration": stt.get("duration")},
        "audio_base64": b64,
        "audio_format": "wav",
    }
