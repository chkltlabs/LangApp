import difflib
import re

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.config import Settings, get_settings
from app.deps import require_api_key
from app.services.ollama import ollama_chat_complete, tutor_system_prompt
from app.services.speech import transcribe_audio

router = APIRouter(prefix="/api/pronunciation", tags=["pronunciation"])


def _normalize(s: str) -> str:
    s = s.lower().strip()
    s = re.sub(r"[^\w\s]", "", s, flags=re.UNICODE)
    return re.sub(r"\s+", " ", s)


def _alignment_hint(target: str, spoken: str) -> dict:
    a = _normalize(target).split()
    b = _normalize(spoken).split()
    sm = difflib.SequenceMatcher(a=a, b=b)
    opcodes = sm.get_opcodes()
    return {
        "target_tokens": a,
        "spoken_tokens": b,
        "ratio": round(sm.ratio(), 3),
        "opcodes": opcodes,
    }


@router.post("/target-phrase")
async def target_phrase(
    target_text: str = Form(...),
    file: UploadFile = File(...),
    stt_language: str | None = Form(None),
    settings: Settings = Depends(get_settings),
    _: None = Depends(require_api_key),
):
    raw = await file.read()
    name = file.filename or "audio.webm"
    stt = await transcribe_audio(settings.stt_url, raw, name, stt_language)
    spoken = (stt.get("text") or "").strip()
    if not spoken:
        raise HTTPException(400, "Could not transcribe audio")
    hint = _alignment_hint(target_text, spoken)
    sys_msg = tutor_system_prompt(settings)
    user = (
        f"The learner was asked to say (in {settings.lang_target}):\n{target_text}\n\n"
        f"Speech-to-text heard:\n{spoken}\n\n"
        f"Simple token alignment ratio: {hint['ratio']}\n"
        "Give concise feedback: what matched, what to fix, and one minimal-pair or "
        "slow-practice suggestion. Keep explanations mostly in "
        f"{settings.lang_ui} unless demonstrating target language."
    )
    msgs = [
        {"role": "system", "content": sys_msg},
        {"role": "user", "content": user},
    ]
    model = settings.llm_model_fast or settings.llm_model
    feedback = await ollama_chat_complete(settings, msgs, model=model)
    return {
        "target_text": target_text,
        "transcript": spoken,
        "alignment": hint,
        "feedback": feedback,
        "model": model,
    }


@router.post("/shadowing")
async def shadowing_feedback(
    reference_text: str = Form(...),
    file: UploadFile = File(...),
    stt_language: str | None = Form(None),
    settings: Settings = Depends(get_settings),
    _: None = Depends(require_api_key),
):
    raw = await file.read()
    name = file.filename or "audio.webm"
    stt = await transcribe_audio(settings.stt_url, raw, name, stt_language)
    spoken = (stt.get("text") or "").strip()
    if not spoken:
        raise HTTPException(400, "Could not transcribe audio")
    hint = _alignment_hint(reference_text, spoken)
    sys_msg = tutor_system_prompt(settings)
    user = (
        "Shadowing exercise: the learner repeated after hearing a reference line.\n"
        f"Reference ({settings.lang_target}):\n{reference_text}\n\n"
        f"Their production (STT):\n{spoken}\n\n"
        f"Token overlap ratio: {hint['ratio']}\n"
        "Comment on content words, likely omissions, and give 2 short tips for rhythm/chunking. "
        f"Use {settings.lang_ui} for meta-commentary."
    )
    msgs = [
        {"role": "system", "content": sys_msg},
        {"role": "user", "content": user},
    ]
    model = settings.llm_model_fast or settings.llm_model
    feedback = await ollama_chat_complete(settings, msgs, model=model)
    return {
        "reference_text": reference_text,
        "transcript": spoken,
        "alignment": hint,
        "feedback": feedback,
        "model": model,
    }
