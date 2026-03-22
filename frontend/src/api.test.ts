import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  apiJson,
  completeCardIntro,
  fetchGloss,
  generateVocabPack,
  gradeVocabProduction,
  fetchVocabMcq,
  playWavBase64,
  streamChat,
  voiceTurn,
} from "./api";

describe("apiJson", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns parsed JSON on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ a: 1 }),
      }),
    );
    await expect(apiJson("/api/x")).resolves.toEqual({ a: 1 });
  });

  it("throws with body text on error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        statusText: "Bad",
        text: async () => "nope",
      }),
    );
    await expect(apiJson("/api/x")).rejects.toThrow("nope");
  });

  it("throws statusText when body empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        statusText: "Teapot",
        text: async () => "",
      }),
    );
    await expect(apiJson("/api/x")).rejects.toThrow("Teapot");
  });
});

describe("streamChat", () => {
  afterEach(() => vi.restoreAllMocks());

  it("aggregates tokens from SSE chunks", async () => {
    const encoder = new TextEncoder();
    const chunks = [
      encoder.encode('data: {"token":"he"}\n\n'),
      encoder.encode('data: {"token":"llo"}\n\n'),
      encoder.encode("data: [DONE]\n\n"),
    ];
    let i = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: () =>
              Promise.resolve(
                i < chunks.length ? { done: false, value: chunks[i++] } : { done: true, value: undefined },
              ),
          }),
        },
      }),
    );
    const tokens: string[] = [];
    await streamChat([{ role: "user", content: "x" }], null, (t) => tokens.push(t));
    expect(tokens.join("")).toBe("hello");
  });

  it("throws when response not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        text: async () => "err",
      }),
    );
    await expect(streamChat([], null, () => {})).rejects.toThrow("err");
  });

  it("ignores malformed data lines", async () => {
    const encoder = new TextEncoder();
    const chunks = [encoder.encode("data: not-json\n\n"), encoder.encode('data: {"token":"x"}\n\n')];
    let i = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: () =>
              Promise.resolve(
                i < chunks.length ? { done: false, value: chunks[i++] } : { done: true, value: undefined },
              ),
          }),
        },
      }),
    );
    const out: string[] = [];
    await streamChat([], null, (t) => out.push(t));
    expect(out).toEqual(["x"]);
  });
});

describe("voiceTurn", () => {
  afterEach(() => vi.restoreAllMocks());

  it("posts form data and returns JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ transcript: "a", reply: "b", audio_base64: "c" }),
      }),
    );
    const r = await voiceTurn(new Blob(), [], null, null);
    expect(r.transcript).toBe("a");
    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe("/api/speech/voice-turn");
    expect(call[1].body).toBeInstanceOf(FormData);
  });

  it("throws on error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, text: async () => "bad" }),
    );
    await expect(voiceTurn(new Blob(), [], null, null)).rejects.toThrow("bad");
  });
});

describe("lexicon and vocab API helpers", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      }),
    );
  });
  afterEach(() => vi.restoreAllMocks());

  it("fetchGloss posts surface and sentence", async () => {
    await fetchGloss("w", "ctx");
    const init = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(JSON.parse(init.body)).toMatchObject({ surface: "w", sentence: "ctx" });
  });

  it("fetchGloss sends null sentence when blank", async () => {
    await fetchGloss("w", "   ");
    const init = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(JSON.parse(init.body).sentence).toBeNull();
  });

  it("generateVocabPack serializes body", async () => {
    await generateVocabPack({ count: 3, theme: "x", replace_existing: true });
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.count).toBe(3);
    expect(body.replace_existing).toBe(true);
  });

  it("fetchVocabMcq and gradeVocabProduction", async () => {
    await fetchVocabMcq(1);
    await gradeVocabProduction(2, "try");
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2);
  });

  it("completeCardIntro POSTs", async () => {
    await completeCardIntro(9);
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain("complete-intro");
  });
});

describe("playWavBase64", () => {
  it("creates blob URL and calls play on Audio", () => {
    const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:z");
    const play = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal(
      "Audio",
      class {
        onended: (() => void) | null = null;
        constructor(_u: string) {}
        play = play;
      } as unknown as typeof Audio,
    );
    playWavBase64(btoa("hi"));
    expect(create).toHaveBeenCalled();
    expect(play).toHaveBeenCalled();
  });
});
