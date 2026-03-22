import json
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db import get_db
from app.deps import require_api_key
from app.models import ExerciseAttempt
from app.services.ollama import ollama_generate_json, tutor_system_prompt

router = APIRouter(prefix="/api/exercises", tags=["exercises"])


class GenerateBody(BaseModel):
    exercise_type: str = Field(
        ...,
        pattern="^(cloze|dictation|short_answer|error_correction)$",
    )
    topic: str | None = None
    model_tier: str | None = None


class GradeBody(BaseModel):
    exercise_type: str
    prompt_json: dict[str, Any]
    user_answer: str = Field(..., max_length=8000)


def _strong_model(settings: Settings) -> str:
    return settings.llm_model_strong or settings.llm_model


@router.post("/generate")
async def generate_exercise(
    body: GenerateBody,
    settings: Annotated[Settings, Depends(get_settings)],
    _: Annotated[None, Depends(require_api_key)],
):
    sys_base = tutor_system_prompt(settings)
    topic = body.topic or f"everyday {settings.lang_target} aligned to {settings.cefr_level}"
    specs = {
        "cloze": (
            "Return JSON with keys: passage (string with exactly one blank marked as ____), "
            "answer (string), hints (array of up to 2 short strings in "
            f"{settings.lang_ui}). Passage should be in {settings.lang_target}."
        ),
        "dictation": (
            "Return JSON with keys: text (one or two sentences in "
            f"{settings.lang_target}, suitable for dictation at {settings.cefr_level}), "
            f"translation ({settings.lang_ui} gloss)."
        ),
        "short_answer": (
            "Return JSON with keys: question (in "
            f"{settings.lang_target}), expected_points (array of strings the answer should cover), "
            f"model_answer ({settings.lang_target})."
        ),
        "error_correction": (
            "Return JSON with keys: flawed (a short paragraph in "
            f"{settings.lang_target} with 2–3 realistic learner errors), "
            f"corrected (fully corrected version), notes (brief explanation in {settings.lang_ui})."
        ),
    }
    user = (
        f"Create one {body.exercise_type} exercise about: {topic}. "
        f"{specs[body.exercise_type]} "
        "Respond with JSON only, no markdown."
    )
    model = _strong_model(settings) if body.model_tier == "strong" else None
    data = await ollama_generate_json(
        settings,
        sys_base + " Always output valid JSON matching the user's schema description.",
        user,
        model=model,
    )
    return {"exercise_type": body.exercise_type, "content": data}


@router.post("/grade")
async def grade_answer(
    body: GradeBody,
    settings: Annotated[Settings, Depends(get_settings)],
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[None, Depends(require_api_key)],
):
    sys_base = tutor_system_prompt(settings)
    prompt_s = json.dumps(body.prompt_json, ensure_ascii=False)
    user = (
        f"Grade this {body.exercise_type} attempt.\n"
        f"Exercise data (JSON): {prompt_s}\n"
        f"Learner answer: {body.user_answer}\n"
        "Return JSON with keys: score (0-1 float), feedback (short, helpful, in "
        f"{settings.lang_ui}), corrected_answer (string or null), "
        "follow_up_drill (one short optional practice prompt in the target language or null)."
    )
    model = _strong_model(settings)
    result = await ollama_generate_json(
        settings,
        sys_base + " You are a fair grader. Output JSON only.",
        user,
        model=model,
    )
    att = ExerciseAttempt(
        exercise_type=body.exercise_type,
        prompt_json=prompt_s,
        user_answer=body.user_answer,
        score=float(result.get("score", 0)) if result.get("score") is not None else None,
        feedback_json=json.dumps(result, ensure_ascii=False),
    )
    db.add(att)
    db.commit()
    db.refresh(att)
    return {"attempt_id": att.id, **result}
