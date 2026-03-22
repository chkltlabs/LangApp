from app.db import get_session_local
from app.models import Card, Deck, GlossCache
from tests.conftest import patch_ollama_generate_json


def test_gloss_from_deck(client):
    client.post("/api/srs/cards", json={"front": "gato", "back": "cat\nextra", "intro_complete": True})
    r = client.post("/api/lexicon/gloss", json={"surface": "gato", "sentence": "el gato"})
    assert r.status_code == 200
    j = r.json()
    assert j["from_deck"] is True
    assert "cat" in j["glosses"][0]


def test_gloss_cache_then_llm(client, monkeypatch):
    patch_ollama_generate_json(
        monkeypatch,
        {"glosses": ["water"], "pos": "n", "note": "x"},
    )
    r = client.post("/api/lexicon/gloss", json={"surface": "xyzunknown", "sentence": None})
    assert r.status_code == 200
    j = r.json()
    assert j["glosses"] == ["water"]
    assert j["from_deck"] is False

    r2 = client.post("/api/lexicon/gloss", json={"surface": "xyzunknown", "sentence": None})
    assert r2.json()["glosses"] == ["water"]

    SessionLocal = get_session_local()
    db = SessionLocal()
    try:
        assert db.query(GlossCache).count() >= 1
    finally:
        db.close()


def test_gloss_empty_back_skips_deck(client, monkeypatch):
    db = get_session_local()()
    try:
        d = db.query(Deck).filter(Deck.is_default.is_(True)).first()
        c = Card(deck_id=d.id, front="emptyback", back="  \n  ", intro_complete=True)
        db.add(c)
        db.commit()
    finally:
        db.close()

    patch_ollama_generate_json(
        monkeypatch,
        {"glosses": ["z"], "pos": None, "note": None},
    )
    r = client.post("/api/lexicon/gloss", json={"surface": "emptyback"})
    assert r.status_code == 200
