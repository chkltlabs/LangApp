def test_decks_and_cards_flow(client):
    r = client.get("/api/srs/decks")
    assert r.status_code == 200
    decks = r.json()
    assert len(decks) >= 1
    default_id = next(d["id"] for d in decks if d["is_default"])

    r = client.post(
        "/api/srs/cards",
        json={"front": "hola", "back": "hello", "intro_complete": True},
    )
    assert r.status_code == 200
    card = r.json()
    cid = card["id"]
    assert card["intro_complete"] is True

    r = client.get(f"/api/srs/decks/{default_id}/cards")
    assert r.status_code == 200
    assert any(c["id"] == cid for c in r.json())

    r = client.get("/api/srs/due")
    assert r.status_code == 200

    r = client.post(f"/api/srs/cards/{cid}/review", json={"quality": 4})
    assert r.status_code == 200
    assert r.json()["repetitions"] == 1

    r = client.delete(f"/api/srs/cards/{cid}")
    assert r.status_code == 200


def test_create_card_unknown_deck(client):
    r = client.post(
        "/api/srs/cards",
        json={"front": "a", "back": "b", "deck_id": 99999},
    )
    assert r.status_code == 404


def test_review_unknown_card(client):
    r = client.post("/api/srs/cards/99999/review", json={"quality": 4})
    assert r.status_code == 404


def test_learn_queue_and_complete_intro(client):
    r = client.post(
        "/api/srs/cards",
        json={
            "front": "agua",
            "back": "water",
            "intro_complete": False,
            "source": "test",
        },
    )
    cid = r.json()["id"]
    r = client.get("/api/srs/learn")
    assert r.status_code == 200
    assert any(c["id"] == cid for c in r.json())

    r = client.post(f"/api/srs/cards/{cid}/complete-intro")
    assert r.status_code == 200
    assert r.json()["intro_complete"] is True

    r = client.post(f"/api/srs/cards/{cid}/complete-intro")
    assert r.status_code == 200


def test_create_deck(client):
    r = client.post("/api/srs/decks", json={"name": "Extra"})
    assert r.status_code == 200
    assert r.json()["name"] == "Extra"
