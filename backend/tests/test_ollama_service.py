import json

import httpx
import pytest
import respx

from app.config import Settings
from app.services import ollama as ollama_mod


def _minimal_settings(host: str) -> Settings:
    return Settings(
        ollama_host=host,
        database_url="sqlite:///./unused.db",
    )


@pytest.mark.asyncio
async def test_ollama_chat_complete_http():
    with respx.mock:
        respx.post("http://fake-ollama/api/chat").mock(
            return_value=httpx.Response(200, json={"message": {"content": "hello"}}),
        )
        s = _minimal_settings("http://fake-ollama")
        out = await ollama_mod.ollama_chat_complete(
            s,
            [{"role": "user", "content": "hi"}],
        )
        assert out == "hello"


@pytest.mark.asyncio
async def test_ollama_generate_json_http():
    payload = {"a": 1}
    with respx.mock:
        respx.post("http://fake-ollama/api/chat").mock(
            return_value=httpx.Response(
                200,
                json={"message": {"content": json.dumps(payload)}},
            ),
        )
        s = _minimal_settings("http://fake-ollama")
        out = await ollama_mod.ollama_generate_json(s, "sys", "user")
        assert out == payload


@pytest.mark.asyncio
async def test_ollama_chat_stream_yields_tokens(monkeypatch):
    class FakeResp:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            pass

        def raise_for_status(self):
            return None

        async def aiter_lines(self):
            yield json.dumps({"message": {"content": "x"}, "done": False})
            yield json.dumps({"message": {"content": "y"}, "done": False})
            yield json.dumps({"message": {}, "done": True})
            yield ""
            yield "{not-json"

    class FakeInnerClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            pass

        def stream(self, method, url, json=None):
            return FakeResp()

    class FakeAsyncClient:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return FakeInnerClient()

        async def __aexit__(self, *a):
            pass

    monkeypatch.setattr(httpx, "AsyncClient", FakeAsyncClient)
    s = _minimal_settings("http://fake-ollama")
    parts = []
    async for t in ollama_mod.ollama_chat_stream(s, [{"role": "user", "content": "h"}]):
        parts.append(t)
    assert "".join(parts) == "xy"
