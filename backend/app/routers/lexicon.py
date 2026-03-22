import hashlib
import json
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db import get_db
from app.deps import require_api_key
from app.models import Card, GlossCache
from app.services.ollama import (
    gloss_system_prompt,
    gloss_user_message,
    ollama_generate_json,
    resolve_model,
)

router = APIRouter(prefix="/api/lexicon", tags=["lexicon"])


class GlossBody(BaseModel):
    surface: str = Field(..., min_length=1, max_length=200)
    sentence: str | None = Field(None, max_length=800)


class GlossOut(BaseModel):
    glosses: list[str]
    pos: str | None = None
    note: str | None = None
    from_deck: bool = False


def _cache_key(settings: Settings, surface: str, sentence: str | None) -> str:
    ctx = (sentence or "").strip()[:300]
    raw = f"{settings.lang_target}\0{settings.lang_ui}\0{surface.strip().lower()}\0{ctx}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _first_line(text: str) -> str:
    return (text or "").split("\n", 1)[0].strip()


@router.post("/gloss", response_model=GlossOut)
async def gloss_lookup(
    body: GlossBody,
    settings: Annotated[Settings, Depends(get_settings)],
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[None, Depends(require_api_key)],
):
    surface = body.surface.strip()
    key = _cache_key(settings, surface, body.sentence)

    deck_hit = (
        db.query(Card)
        .filter(func.lower(Card.front) == surface.lower())
        .first()
    )
    if deck_hit:
        g = _first_line(deck_hit.back)
        if g:
            return GlossOut(glosses=[g], pos=None, note=None, from_deck=True)

    cached = db.query(GlossCache).filter(GlossCache.cache_key == key).first()
    if cached:
        data = json.loads(cached.response_json)
        return GlossOut(
            glosses=list(data.get("glosses") or []),
            pos=data.get("pos"),
            note=data.get("note"),
            from_deck=False,
        )

    raw = await ollama_generate_json(
        settings,
        gloss_system_prompt(settings),
        gloss_user_message(surface, body.sentence),
        model=resolve_model(settings, "fast"),
    )
    glosses = [str(x).strip() for x in (raw.get("glosses") or []) if str(x).strip()]
    pos = raw.get("pos")
    note = raw.get("note")
    if pos is not None:
        pos = str(pos).strip() or None
    if note is not None:
        note = str(note).strip() or None

    out = {"glosses": glosses, "pos": pos, "note": note}
    db.add(GlossCache(cache_key=key, response_json=json.dumps(out, ensure_ascii=False)))
    db.commit()

    return GlossOut(glosses=glosses, pos=pos, note=note, from_deck=False)
