from tests.conftest import patch_ollama_generate_json


def _cloze():
    return {
        "passage": "Hola ____",
        "answer": "mundo",
        "hints": ["think sphere"],
    }


def test_generate_cloze(client, monkeypatch):
    patch_ollama_generate_json(monkeypatch, _cloze())
    r = client.post(
        "/api/exercises/generate",
        json={"exercise_type": "cloze", "topic": "greeting"},
    )
    assert r.status_code == 200
    j = r.json()
    assert j["exercise_type"] == "cloze"
    assert "mundo" in j["content"]["answer"]


def test_generate_dictation(client, monkeypatch):
    patch_ollama_generate_json(
        monkeypatch,
        {"text": "Buenos días.", "translation": "Good morning."},
    )
    r = client.post("/api/exercises/generate", json={"exercise_type": "dictation"})
    assert r.status_code == 200


def test_generate_short_answer(client, monkeypatch):
    patch_ollama_generate_json(
        monkeypatch,
        {
            "question": "¿Qué?",
            "expected_points": ["a"],
            "model_answer": "Nada.",
        },
    )
    r = client.post("/api/exercises/generate", json={"exercise_type": "short_answer"})
    assert r.status_code == 200


def test_generate_error_correction(client, monkeypatch):
    patch_ollama_generate_json(
        monkeypatch,
        {
            "flawed": "Yo gusta café.",
            "corrected": "Me gusta el café.",
            "notes": "verb",
        },
    )
    r = client.post("/api/exercises/generate", json={"exercise_type": "error_correction"})
    assert r.status_code == 200


def test_generate_strong_tier(client, monkeypatch):
    patch_ollama_generate_json(monkeypatch, _cloze())
    r = client.post(
        "/api/exercises/generate",
        json={"exercise_type": "cloze", "model_tier": "strong"},
    )
    assert r.status_code == 200


def test_grade_stores_attempt(client, monkeypatch):
    patch_ollama_generate_json(
        monkeypatch,
        {"score": 0.8, "feedback": "ok", "corrected_answer": None, "follow_up_drill": None},
    )
    r = client.post(
        "/api/exercises/grade",
        json={
            "exercise_type": "cloze",
            "prompt_json": _cloze(),
            "user_answer": "mundo",
        },
    )
    assert r.status_code == 200
    j = r.json()
    assert "attempt_id" in j
    assert j["score"] == 0.8


def test_grade_missing_score(client, monkeypatch):
    patch_ollama_generate_json(
        monkeypatch,
        {"feedback": "only"},
    )
    r = client.post(
        "/api/exercises/grade",
        json={
            "exercise_type": "cloze",
            "prompt_json": _cloze(),
            "user_answer": "x",
        },
    )
    assert r.status_code == 200
    assert r.json().get("score") is None
