import json
from typing import Any, AsyncIterator

import httpx

from app.config import Settings


def resolve_model(settings: Settings, tier: str | None) -> str:
    if tier == "fast" and settings.llm_model_fast:
        return settings.llm_model_fast
    if tier == "strong" and settings.llm_model_strong:
        return settings.llm_model_strong
    return settings.llm_model


async def ollama_chat_complete(
    settings: Settings,
    messages: list[dict[str, str]],
    *,
    model: str | None = None,
) -> str:
    url = f"{settings.ollama_host.rstrip('/')}/api/chat"
    body: dict[str, Any] = {
        "model": model or settings.llm_model,
        "messages": messages,
        "stream": False,
    }
    async with httpx.AsyncClient(timeout=300.0) as client:
        r = await client.post(url, json=body)
        r.raise_for_status()
        data = r.json()
        return (data.get("message") or {}).get("content") or ""


async def ollama_chat_stream(
    settings: Settings,
    messages: list[dict[str, str]],
    *,
    model: str | None = None,
) -> AsyncIterator[str]:
    url = f"{settings.ollama_host.rstrip('/')}/api/chat"
    body: dict[str, Any] = {
        "model": model or settings.llm_model,
        "messages": messages,
        "stream": True,
    }
    async with httpx.AsyncClient(timeout=300.0) as client:
        async with client.stream("POST", url, json=body) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.strip():
                    continue
                try:
                    chunk = json.loads(line)
                except json.JSONDecodeError:
                    continue
                msg = chunk.get("message") or {}
                piece = msg.get("content")
                if piece:
                    yield piece
                if chunk.get("done"):
                    break


def tutor_system_prompt(settings: Settings) -> str:
    return (
        f"You are a supportive {settings.lang_target} language tutor. "
        f"The learner's comfort language for explanations is {settings.lang_ui}. "
        f"Target CEFR level: {settings.cefr_level}. "
        "Use short turns, mostly in the target language, with comprehensible input slightly above their level. "
        "When introducing new words, gloss them briefly in the comfort language. "
        "Stay in character for role-play tasks. "
        "Do not produce harmful content."
    )


def gloss_system_prompt(settings: Settings) -> str:
    return (
        f"You are a compact bilingual lexicon. Target language: {settings.lang_target}. "
        f"Glosses and notes must be in {settings.lang_ui}. "
        'Reply with JSON only: {"glosses": string[] (1-4 short translation senses), '
        '"pos": string|null (part of speech abbreviation), "note": string|null (usage hint)}. '
        "If the token is not in the target language or is a name, set glosses to []. "
        "Do not produce harmful content."
    )


def gloss_user_message(surface: str, sentence: str | None) -> str:
    payload = {"surface": surface.strip(), "sentence": (sentence or "").strip()[:400] or None}
    return json.dumps(payload, ensure_ascii=False)


def vocab_pack_system_prompt(settings: Settings) -> str:
    return (
        f"You generate vocabulary for learners of {settings.lang_target}. "
        f"Glosses and hints must be in {settings.lang_ui}. "
        f"CEFR level: {settings.cefr_level}. "
        "Return JSON only: an array of objects, each with keys "
        "lemma (string in target language), gloss_native (string), "
        "example_l2 (one short natural sentence in target language using the lemma), "
        "hint_native (optional short memory clue in comfort language). "
        "No duplicates. High-frequency, practical items. "
        "Do not produce harmful content."
    )


def vocab_pack_user_message(theme: str | None, count: int) -> str:
    t = theme.strip() if theme else ""
    scope = f'Theme: "{t}".' if t else "General high-frequency survival vocabulary."
    return json.dumps(
        {"instructions": scope, "count": count},
        ensure_ascii=False,
    )


async def ollama_generate_json(
    settings: Settings,
    system: str,
    user: str,
    *,
    model: str | None = None,
) -> dict[str, Any]:
    url = f"{settings.ollama_host.rstrip('/')}/api/chat"
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]
    body = {
        "model": model or settings.llm_model,
        "messages": messages,
        "stream": False,
        "format": "json",
    }
    async with httpx.AsyncClient(timeout=300.0) as client:
        r = await client.post(url, json=body)
        r.raise_for_status()
        data = r.json()
        raw = (data.get("message") or {}).get("content") or "{}"
        return json.loads(raw)
