from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles

from app.db import init_db
from app.routers import chat, exercises, pronunciation, speech, srs

# In Docker, WORKDIR is /app with packages under /app/app/ and Vite output at /app/static (see Dockerfile.app).
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="LangApp",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/swagger",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)
app.include_router(speech.router)
app.include_router(srs.router)
app.include_router(exercises.router)
app.include_router(pronunciation.router)


@app.get("/api/health")
def api_health():
    return {"status": "ok"}


@app.get("/api/settings/public")
def public_settings():
    from app.config import get_settings

    s = get_settings()
    return {
        "lang_target": s.lang_target,
        "lang_ui": s.lang_ui,
        "cefr_level": s.cefr_level,
        "tts_voice_target": s.tts_voice_target,
        "tts_voice_ui": s.tts_voice_ui,
        "llm_model": s.llm_model,
        "has_fast_model": bool(s.llm_model_fast),
        "has_strong_model": bool(s.llm_model_strong),
    }


if STATIC_DIR.is_dir() and (STATIC_DIR / "index.html").is_file():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="spa")
