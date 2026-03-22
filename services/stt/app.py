import os
import tempfile

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from faster_whisper import WhisperModel

app = FastAPI(title="LangApp STT", version="1.0.0")

_model_name = os.environ.get("WHISPER_MODEL", "base")
_model: WhisperModel | None = None


def get_model() -> WhisperModel:
    global _model
    if _model is None:
        _model = WhisperModel(_model_name, device="cpu", compute_type="int8")
    return _model


@app.get("/health")
def health():
    return {"status": "ok", "model": _model_name}


@app.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    language: str | None = Form(None),
):
    ct = file.content_type or ""
    if ct and not (
        ct.startswith("audio/")
        or ct in ("application/octet-stream", "video/webm")
    ):
        raise HTTPException(400, "Expected audio upload")

    raw = await file.read()
    if len(raw) > 25 * 1024 * 1024:
        raise HTTPException(413, "Audio too large")

    model = get_model()
    suffix = ".webm"
    if file.filename and file.filename.lower().endswith(".wav"):
        suffix = ".wav"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(raw)
        path = tmp.name
    try:
        segments_iter, info = model.transcribe(
            path,
            language=language if language else None,
            word_timestamps=True,
        )
        parts = []
        seg_list = []
        words_out = []
        for seg in segments_iter:
            t = seg.text.strip()
            if t:
                parts.append(t)
            seg_list.append({"start": seg.start, "end": seg.end, "text": seg.text.strip()})
            words_attr = getattr(seg, "words", None) or []
            for w in words_attr:
                words_out.append(
                    {
                        "word": w.word,
                        "start": w.start,
                        "end": w.end,
                        "probability": w.probability,
                    }
                )
        text = " ".join(parts).strip()
        return {
            "text": text,
            "language": info.language,
            "duration": info.duration,
            "segments": seg_list,
            "words": words_out,
        }
    finally:
        os.unlink(path)
