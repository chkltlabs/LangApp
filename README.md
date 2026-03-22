# LangApp

Local-first language lab: **FastAPI** backend, **React + Vite** UI, optional **Docker Compose** for the API plus **Whisper** (STT) and **Piper** (TTS). LLM features use **Ollama** on the host or another reachable URL.

For a structural map of the repository, see [REPO_MAP.md](REPO_MAP.md).

## Prerequisites

- **Node.js 20+** and npm (for the frontend).
- **Python 3.11+** (3.14 is fine for local dev; the app image uses 3.11).
- **Ollama** running with the models you configure in `.env`.
- **Docker** (optional), for Compose-based runs and speech containers.

## Configuration

Copy [`.env.example`](.env.example) to `.env` at the repo root and adjust values. Compose and local processes load this file when documented below.

Optional frontend API key (when the backend has `API_KEY` set): create `frontend/.env` with `VITE_API_KEY=...`.

## Running

### Option A: Docker Compose (API + STT + TTS)

From the repository root:

```bash
docker compose up --build
```

- API and SPA (built static assets): [http://localhost:8000](http://localhost:8000)
- Ensure `OLLAMA_HOST` in `.env` points at Ollama (on macOS with Docker Desktop, `http://host.docker.internal:11434` is typical).

Data persists in the `langapp_data` volume (`DATABASE_URL` is SQLite under `/data` in the container).

### Option B: Local development (hot reload UI)

1. **Backend** — use a virtual environment (recommended on macOS/Homebrew Python):

   ```bash
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate   # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```

   Set `DATABASE_URL` if you want a specific SQLite file, for example:

   ```bash
   export DATABASE_URL=sqlite:///./langapp.db
   ```

   Load env vars from the repo root `.env` (e.g. `set -a && source ../.env && set +a` in bash), then:

   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **Frontend** — in another terminal:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

   Open [http://localhost:5173](http://localhost:5173). Vite proxies `/api`, `/swagger`, `/redoc`, and `/openapi.json` to `http://127.0.0.1:8000` (see `frontend/vite.config.ts`).

## Building

### Production-style app image

The root [Dockerfile.app](Dockerfile.app) builds the Vite app and bakes `dist` into the Python image:

```bash
docker build -f Dockerfile.app -t langapp .
```

### Frontend bundle only

```bash
cd frontend
npm install
npm run build
```

Output is `frontend/dist/`.

## Testing

The project targets **≥80% line coverage** on the main packages (see [`.cursor/rules/test-coverage.mdc`](.cursor/rules/test-coverage.mdc)).

### Backend (pytest + coverage)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
PYTHONPATH=. pytest tests -v --cov=app --cov-report=term-missing --cov-fail-under=80
```

Tests use a temporary SQLite database and mocked external services where appropriate (`tests/conftest.py`).

### Frontend (Vitest + v8 coverage)

```bash
cd frontend
npm install
npm test              # single run, no coverage
npm run test:coverage # coverage + thresholds (see vite.config.ts)
npm run test:watch    # watch mode
```

HTML coverage report: `frontend/coverage/index.html` after `npm run test:coverage`.

## API documentation

With the backend running, OpenAPI is available at `/docs` or `/redoc` on the server port (e.g. [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) when using uvicorn directly).
