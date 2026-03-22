import json
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.config import Settings, get_settings
from app.deps import require_api_key
from app.services.ollama import (
    ollama_chat_complete,
    ollama_chat_stream,
    resolve_model,
    tutor_system_prompt,
)

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(system|user|assistant)$")
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    model_tier: str | None = Field(
        default=None,
        description="fast | strong | default — maps to env LLM_MODEL_*",
    )


@router.post("/stream")
async def chat_stream(
    body: ChatRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    _: Annotated[None, Depends(require_api_key)],
):
    sys_msg = tutor_system_prompt(settings)
    msgs = [{"role": "system", "content": sys_msg}]
    msgs.extend(m.model_dump() for m in body.messages)
    model = resolve_model(settings, body.model_tier)

    async def gen():
        async for piece in ollama_chat_stream(settings, msgs, model=model):
            yield f"data: {json.dumps({'token': piece})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream")


@router.post("/complete")
async def chat_complete(
    body: ChatRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    _: Annotated[None, Depends(require_api_key)],
):
    sys_msg = tutor_system_prompt(settings)
    msgs = [{"role": "system", "content": sys_msg}]
    msgs.extend(m.model_dump() for m in body.messages)
    model = resolve_model(settings, body.model_tier)
    text = await ollama_chat_complete(settings, msgs, model=model)
    return {"reply": text, "model": model}
