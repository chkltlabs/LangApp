from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_api_key
from app.models import Card, Deck
from app.srs.sm2 import schedule_review

router = APIRouter(prefix="/api/srs", tags=["srs"])


def _default_deck(db: Session) -> Deck:
    d = db.query(Deck).filter(Deck.is_default.is_(True)).first()
    if not d:
        d = Deck(name="Default", is_default=True)
        db.add(d)
        db.commit()
        db.refresh(d)
    return d


class DeckOut(BaseModel):
    id: int
    name: str
    is_default: bool

    model_config = {"from_attributes": True}


class CardOut(BaseModel):
    id: int
    deck_id: int
    front: str
    back: str
    hint: str | None
    due_at: datetime
    interval_days: float
    repetitions: int
    ease_factor: float

    model_config = {"from_attributes": True}


class CardCreate(BaseModel):
    front: str = Field(..., min_length=1, max_length=4000)
    back: str = Field(..., min_length=1, max_length=4000)
    hint: str | None = None
    deck_id: int | None = None
    source: str | None = None


class ReviewBody(BaseModel):
    quality: int = Field(..., ge=0, le=5)


@router.get("/decks", response_model=list[DeckOut])
def list_decks(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[None, Depends(require_api_key)],
):
    return db.query(Deck).order_by(Deck.id).all()


class DeckCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)


@router.post("/decks", response_model=DeckOut)
def create_deck(
    body: DeckCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[None, Depends(require_api_key)],
):
    d = Deck(name=body.name.strip()[:200], is_default=False)
    db.add(d)
    db.commit()
    db.refresh(d)
    return d


@router.get("/decks/{deck_id}/cards", response_model=list[CardOut])
def list_cards(
    deck_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[None, Depends(require_api_key)],
):
    return db.query(Card).filter(Card.deck_id == deck_id).order_by(Card.id).all()


@router.post("/cards", response_model=CardOut)
def create_card(
    body: CardCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[None, Depends(require_api_key)],
):
    if body.deck_id:
        deck = db.query(Deck).filter(Deck.id == body.deck_id).first()
        if not deck:
            raise HTTPException(404, "Deck not found")
        deck_id = deck.id
    else:
        deck_id = _default_deck(db).id
    c = Card(
        deck_id=deck_id,
        front=body.front,
        back=body.back,
        hint=body.hint,
        source=body.source,
        due_at=datetime.utcnow(),
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.get("/due", response_model=list[CardOut])
def due_cards(
    limit: int = 20,
    db: Session = Depends(get_db),
    _: None = Depends(require_api_key),
):
    now = datetime.utcnow()
    q = (
        db.query(Card)
        .filter(Card.due_at <= now)
        .order_by(Card.due_at)
        .limit(min(limit, 100))
    )
    return q.all()


@router.post("/cards/{card_id}/review", response_model=CardOut)
def review_card(
    card_id: int,
    body: ReviewBody,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[None, Depends(require_api_key)],
):
    c = db.query(Card).filter(Card.id == card_id).first()
    if not c:
        raise HTTPException(404, "Card not found")
    reps, ef, interval, due = schedule_review(
        body.quality,
        repetitions=c.repetitions,
        ease_factor=c.ease_factor,
        interval_days=c.interval_days,
    )
    c.repetitions = reps
    c.ease_factor = ef
    c.interval_days = interval
    c.due_at = due
    db.commit()
    db.refresh(c)
    return c


@router.delete("/cards/{card_id}")
def delete_card(
    card_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[None, Depends(require_api_key)],
):
    c = db.query(Card).filter(Card.id == card_id).first()
    if not c:
        raise HTTPException(404, "Card not found")
    db.delete(c)
    db.commit()
    return {"ok": True}
