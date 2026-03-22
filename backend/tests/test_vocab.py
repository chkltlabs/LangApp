from app.routers.vocab import _parse_pack_items
from tests.conftest import patch_ollama_generate_json


def test_parse_pack_items_variants():
    assert len(_parse_pack_items([])) == 0
    raw = [{"lemma": "a", "gloss_native": "A", "example_l2": "a."}]
    assert len(_parse_pack_items(raw)) == 1
    assert len(_parse_pack_items({"items": raw})) == 1
    assert len(_parse_pack_items({"only_key": raw})) == 1
    assert len(_parse_pack_items({"bad": 1})) == 0


def test_generate_pack(client, monkeypatch):
    items = [
        {"lemma": "uno", "gloss_native": "one", "example_l2": "Es uno."},
        {"lemma": "dos", "gloss_native": "two", "example_l2": "Son dos."},
    ]
    patch_ollama_generate_json(monkeypatch, items)
    r = client.post("/api/vocab/generate-pack", json={"count": 5, "theme": "nums"})
    assert r.status_code == 200
    j = r.json()
    assert j["created"] == 2
    assert len(j["card_ids"]) == 2

    r = client.get("/api/srs/learn")
    assert len(r.json()) >= 2


def test_generate_pack_replace_and_502(client, monkeypatch):
    patch_ollama_generate_json(
        monkeypatch,
        [{"lemma": "a", "gloss_native": "A", "example_l2": "a"}],
    )
    client.post("/api/vocab/generate-pack", json={"count": 1})
    patch_ollama_generate_json(
        monkeypatch,
        [{"lemma": "b", "gloss_native": "B", "example_l2": "b"}],
    )
    r = client.post(
        "/api/vocab/generate-pack",
        json={"count": 1, "replace_existing": True},
    )
    assert r.status_code == 200

    patch_ollama_generate_json(monkeypatch, {})
    r = client.post("/api/vocab/generate-pack", json={"count": 3})
    assert r.status_code == 502


def test_mcq_and_grade(client, monkeypatch):
    patch_ollama_generate_json(
        monkeypatch,
        [{"lemma": "sol", "gloss_native": "sun", "example_l2": "El sol."}],
    )
    client.post("/api/vocab/generate-pack", json={"count": 1})
    client.post(
        "/api/srs/cards",
        json={"front": "luna", "back": "moon", "intro_complete": True},
    )
    client.post(
        "/api/srs/cards",
        json={"front": "mar", "back": "sea", "intro_complete": True},
    )
    client.post(
        "/api/srs/cards",
        json={"front": "cielo", "back": "sky", "intro_complete": True},
    )

    learn = client.get("/api/srs/learn").json()
    cid = learn[0]["id"]

    r = client.post("/api/vocab/quiz/multiple-choice", json={"card_id": cid})
    assert r.status_code == 200
    j = r.json()
    assert j["prompt_l2"]
    assert len(j["options"]) == 4

    r = client.post(
        "/api/vocab/grade-production",
        json={"card_id": cid, "attempt": "sol"},
    )
    assert r.status_code == 200
    assert r.json()["ok"] is True

    patch_ollama_generate_json(monkeypatch, {"acceptable": True, "feedback": "nice"})
    r = client.post(
        "/api/vocab/grade-production",
        json={"card_id": cid, "attempt": "completely wrong"},
    )
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_mcq_404(client):
    r = client.post("/api/vocab/quiz/multiple-choice", json={"card_id": 99999})
    assert r.status_code == 404


def test_grade_404(client, monkeypatch):
    patch_ollama_generate_json(monkeypatch, {})
    r = client.post(
        "/api/vocab/grade-production",
        json={"card_id": 99999, "attempt": "x"},
    )
    assert r.status_code == 404
