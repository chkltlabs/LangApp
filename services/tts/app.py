import os
import subprocess
import tempfile
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

app = FastAPI(title="LangApp TTS", version="1.0.0")

VOICES_DIR = Path(os.environ.get("VOICES_DIR", "/voices"))


class SynthesizeBody(BaseModel):
    text: str = Field(..., max_length=5000)
    voice_key: str = Field(
        default="en_US-lessac-medium",
        description="Base name of .onnx under VOICES_DIR (without extension)",
    )


@app.get("/health")
def health():
    return {"status": "ok", "voices_dir": str(VOICES_DIR)}


@app.get("/voices")
def list_voices():
    if not VOICES_DIR.is_dir():
        return {"voices": []}
    names = sorted(p.stem for p in VOICES_DIR.glob("*.onnx"))
    return {"voices": names}


@app.post("/synthesize")
def synthesize(body: SynthesizeBody):
    text = body.text.strip()
    if not text:
        raise HTTPException(400, "Empty text")
    onnx = VOICES_DIR / f"{body.voice_key}.onnx"
    if not onnx.is_file():
        raise HTTPException(404, f"Voice not found: {body.voice_key}")
    cfg = VOICES_DIR / f"{body.voice_key}.onnx.json"
    if not cfg.is_file():
        raise HTTPException(
            404,
            f"Voice config missing: {body.voice_key}.onnx.json — re-download voice bundle",
        )
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        outpath = tmp.name
    try:
        proc = subprocess.run(
            ["/opt/piper/piper", "--model", str(onnx), "--output_file", outpath],
            input=text.encode("utf-8"),
            capture_output=True,
            timeout=120,
        )
        if proc.returncode != 0:
            err = proc.stderr.decode("utf-8", errors="replace")[:500]
            raise HTTPException(500, f"piper failed: {err}")
        data = Path(outpath).read_bytes()
        return Response(content=data, media_type="audio/wav")
    finally:
        try:
            os.unlink(outpath)
        except OSError:
            pass
