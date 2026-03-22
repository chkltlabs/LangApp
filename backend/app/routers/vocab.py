import json
import random
import unicodedata
from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db import get_db
from app.deps import require_api_key
from app.models import Card
from app.routers.srs import _default_deck
from app.services.ollama import (
    ollama_generate_json,
    resolve_model,
    tutor_system_prompt,
    vocab_pack_system_prompt,
    vocab_pack_user_message,
)

router = APIRouter(prefix="/api/vocab", tags=["vocab"])


class VocabItem(BaseModel):
    lemma: str
    gloss_native: str
    example_l2: str
    hint_native: str | None = None

    @field_validator("lemma", "gloss_native", "example_l2")
    @classmethod
    def non_empty(cls, v: str) -> str:
        s = (v or "").strip()
        if not s:
            raise ValueError("empty field")
        return s


class GeneratePackBody(BaseModel):
    theme: str | None = Field(None, max_length=200)
    count: int = Field(8, ge=1, le=30)
    model_tier: str | None = None
    replace_existing: bool = False


class GeneratePackOut(BaseModel):
    created: int
    card_ids: list[int]


class McqBody(BaseModel):
    card_id: int = Field(..., ge=1)


class McqOut(BaseModel):
    prompt_l2: str
    options: list[str]
    correct_index: int


class GradeProdBody(BaseModel):
    card_id: int = Field(..., ge=1)
    attempt: str = Field(..., min_length=1, max_length=500)


class GradeProdOut(BaseModel):
    ok: bool
    feedback: str


def _first_line_back(back: str) -> str:
    return (back or "").split("\n", 1)[0].strip()


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFD", (s or "").lower())
    return "".join(c for c in s if unicodedata.category(c) != "Mn").strip()


def _parse_pack_items(raw: Any) -> list[VocabItem]:
    if isinstance(raw, list):
        items_raw = raw
    elif isinstance(raw, dict):
        items_raw = raw.get("items") or raw.get("vocabulary") or raw.get("words") or []
        if not items_raw and len(raw) == 1:
            v = next(iter(raw.values()))
            if isinstance(v, list):
                items_raw = v
    else:
        items_raw = []
    out: list[VocabItem] = []
    for it in items_raw:
        if not isinstance(it, dict):
            continue
        try:
            out.append(VocabItem.model_validate(it))
        except Exception:
            continue
    return out


@router.post("/generate-pack", response_model=GeneratePackOut)
async def generate_pack(
    body: GeneratePackBody,
    settings: Annotated[Settings, Depends(get_settings)],
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[None, Depends(require_api_key)],
):
    deck = _default_deck(db)
    if body.replace_existing:
        db.query(Card).filter(Card.deck_id == deck.id, Card.source == "llm_pack").delete()
        db.commit()

    raw = await ollama_generate_json(
        settings,
        vocab_pack_system_prompt(settings),
        vocab_pack_user_message(body.theme, body.count),
        model=resolve_model(settings, body.model_tier or "strong"),
    )
    items = _parse_pack_items(raw)
    if len(items) > body.count:
        items = items[: body.count]
    if not items:
        raise HTTPException(502, "Model returned no valid vocabulary items")

    ids: list[int] = []
    for it in items:
        c = Card(
            deck_id=deck.id,
            front=it.lemma,
            back=it.gloss_native,
            hint=it.example_l2,
            source="llm_pack",
            intro_complete=False,
            due_at=datetime.utcnow(),
        )
        db.add(c)
        db.flush()
        ids.append(c.id)
    db.commit()
    return GeneratePackOut(created=len(ids), card_ids=ids)


@router.post("/quiz/multiple-choice", response_model=McqOut)
def multiple_choice_quiz(
    body: McqBody,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[None, Depends(require_api_key)],
):
    card = db.query(Card).filter(Card.id == body.card_id).first()
    if not card:
        raise HTTPException(404, "Card not found")

    correct = _first_line_back(card.back)
    pool = (
        db.query(Card)
        .filter(Card.deck_id == card.deck_id, Card.id != card.id)
        .limit(80)
        .all()
    )
    wrong_src = [_first_line_back(c.back) for c in pool if _first_line_back(c.back) and _first_line_back(c.back) != correct]
    wrong_src = list(dict.fromkeys(wrong_src))
    random.shuffle(wrong_src)
    wrong = wrong_src[:3]
    generic = ["(other sense)", "(different word)", "(unrelated)"]
    gi = 0
    while len(wrong) < 3:
        w = generic[gi % len(generic)]
        gi += 1
        if w not in wrong and w != correct:
            wrong.append(w)

    options = wrong[:3] + [correct]
    random.shuffle(options)
    try:
        idx = options.index(correct)
    except ValueError:
        options[-1] = correct
        idx = len(options) - 1

    return McqOut(prompt_l2=card.front, options=options, correct_index=idx)


@router.post("/grade-production", response_model=GradeProdOut)
async def grade_production(
    body: GradeProdBody,
    settings: Annotated[Settings, Depends(get_settings)],
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[None, Depends(require_api_key)],
):
    card = db.query(Card).filter(Card.id == body.card_id).first()
    if not card:
        raise HTTPException(404, "Card not found")

    exp = _norm(card.front)
    att = _norm(body.attempt)
    if att and exp and (att == exp or exp in att or att in exp):
        return GradeProdOut(ok=True, feedback="")

    sys_msg = (
        tutor_system_prompt(settings)
        + " Judge if the learner's answer is an acceptable spelling/variant of the expected lemma. "
        + 'Reply with JSON only: {"acceptable": boolean, "feedback": string in '
        + settings.lang_ui
        + " (brief, encouraging)}."
    )
    user_msg = json.dumps(
        {
            "expected_lemma": card.front,
            "learner_attempt": body.attempt.strip(),
            "meaning_gloss": _first_line_back(card.back),
        },
        ensure_ascii=False,
    )
    raw = await ollama_generate_json(
        settings,
        sys_msg,
        user_msg,
        model=resolve_model(settings, "fast"),
    )
    ok = bool(raw.get("acceptable"))
    fb = str(raw.get("feedback") or "").strip()
    return GradeProdOut(ok=ok, feedback=fb)
