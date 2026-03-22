FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# v1.2.0 assets are piper_arm64.tar.gz / piper_amd64.tar.gz (not piper_linux_*)
ARG TARGETARCH
RUN set -eux; \
    if [ "$TARGETARCH" = "arm64" ]; then ASSET=piper_arm64.tar.gz; \
    else ASSET=piper_amd64.tar.gz; fi; \
    curl -fsSL "https://github.com/rhasspy/piper/releases/download/v1.2.0/${ASSET}" | tar xz -C /opt; \
    test -x /opt/piper/piper

ENV LD_LIBRARY_PATH="/opt/piper:${LD_LIBRARY_PATH:-}"

RUN mkdir -p /voices \
    && curl -sSL -o /voices/en_US-lessac-medium.onnx \
      "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx" \
    && curl -sSL -o /voices/en_US-lessac-medium.onnx.json \
      "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json" \
    && curl -sSL -o /voices/es_ES-davefx-medium.onnx \
      "https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/davefx/medium/es_ES-davefx-medium.onnx" \
    && curl -sSL -o /voices/es_ES-davefx-medium.onnx.json \
      "https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/davefx/medium/es_ES-davefx-medium.onnx.json"

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .

EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
