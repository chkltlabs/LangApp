from tests.conftest import patch_ollama_complete


def test_chat_complete(client, monkeypatch):
    patch_ollama_complete(monkeypatch, "done")
    r = client.post(
        "/api/chat/complete",
        json={"messages": [{"role": "user", "content": "hi"}]},
    )
    assert r.status_code == 200
    j = r.json()
    assert j["reply"] == "done"
    assert "model" in j


async def _fake_stream(*_a, **_k):
    yield "a"
    yield "b"


def test_chat_stream(client, monkeypatch):
    monkeypatch.setattr("app.routers.chat.ollama_chat_stream", _fake_stream)
    r = client.post(
        "/api/chat/stream",
        json={"messages": [{"role": "user", "content": "x"}]},
    )
    assert r.status_code == 200
    body = r.text
    assert "token" in body
    assert "[DONE]" in body


def test_chat_invalid_role(client):
    r = client.post(
        "/api/chat/complete",
        json={"messages": [{"role": "narrator", "content": "x"}]},
    )
    assert r.status_code == 422
