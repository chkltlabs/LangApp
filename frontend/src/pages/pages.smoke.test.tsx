import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Layout } from "../components/Layout";
import { PUBLIC_SETTINGS } from "../test/fixtures";
import { ChatPage } from "./ChatPage";
import { ExercisePage } from "./ExercisePage";
import { PronouncePage } from "./PronouncePage";
import { SrsPage } from "./SrsPage";
import { VoicePage } from "./VoicePage";

function json(data: unknown) {
  return new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });
}

function sseResponse() {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    start(c) {
      c.enqueue(enc.encode('data: {"token":"ok"}\n\n'));
      c.enqueue(enc.encode("data: [DONE]\n\n"));
      c.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

function stubAppFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("/api/settings/public")) return json(PUBLIC_SETTINGS);
      if (url.includes("/api/srs/due")) return json([]);
      if (url.includes("/api/srs/learn")) return json([]);
      if (url.includes("/api/speech/tts")) return json({ format: "wav", audio_base64: "qqqq" });
      if (url.includes("/api/chat/stream")) return sseResponse();
      if (url.includes("/api/exercises/generate"))
        return json({
          exercise_type: "cloze",
          content: { passage: "Hola ____", answer: "mundo", hints: ["h"] },
        });
      if (url.includes("/api/exercises/grade")) return json({ score: 0.5, feedback: "ok" });
      if (url.includes("/api/vocab/generate-pack")) return json({ created: 0, card_ids: [] });
      if (url.includes("/api/lexicon/gloss")) return json({ glosses: ["x"], from_deck: false });
      return json({});
    }),
  );
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<ChatPage />} />
          <Route path="voice" element={<VoicePage />} />
          <Route path="srs" element={<SrsPage />} />
          <Route path="exercises" element={<ExercisePage />} />
          <Route path="pronounce" element={<PronouncePage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("page smoke", () => {
  beforeEach(() => {
    stubAppFetch();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ChatPage sends a message", async () => {
    const user = userEvent.setup();
    renderAt("/");
    await waitFor(() => expect(screen.getByText(/target:/i)).toBeInTheDocument());
    await user.type(screen.getByRole("textbox"), "hi");
    await user.click(screen.getByRole("button", { name: /^send$/i }));
    await waitFor(() => expect(screen.getByText(/ok/i)).toBeInTheDocument());
  });

  it("SrsPage shows vocabulary heading", async () => {
    renderAt("/srs");
    await waitFor(() => expect(screen.getByRole("heading", { name: /vocabulary/i })).toBeInTheDocument());
  });

  it("ExercisePage generates", async () => {
    const user = userEvent.setup();
    renderAt("/exercises");
    await user.click(screen.getByRole("button", { name: /generate/i }));
    await waitFor(() => expect(screen.getByText(/Hola ____/)).toBeInTheDocument());
  });

  it("PronouncePage renders", () => {
    renderAt("/pronounce");
    expect(screen.getByRole("heading", { name: /pronunciation/i })).toBeInTheDocument();
  });

  it("VoicePage renders", async () => {
    renderAt("/voice");
    await waitFor(() => expect(screen.getByRole("heading", { name: /voice/i })).toBeInTheDocument());
  });
});
