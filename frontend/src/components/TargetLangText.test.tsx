import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TargetLangText } from "./TargetLangText";

const { fetchGloss } = vi.hoisted(() => ({
  fetchGloss: vi.fn(),
}));

vi.mock("../api", () => ({ fetchGloss }));
vi.mock("../context/SettingsContext", () => ({
  usePublicSettings: () => ({ lang_target_locale: "en" }),
}));

describe("TargetLangText", () => {
  beforeEach(() => {
    fetchGloss.mockResolvedValue({
      glosses: ["translation"],
      pos: "n",
      note: "hint",
      from_deck: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("shows tooltip after hover debounce", async () => {
    Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true });
    render(<TargetLangText text="hello" sentenceContext="hello world" />);
    const word = screen.getByText("hello");
    fireEvent.pointerEnter(word, { clientX: 120, clientY: 120, pointerType: "mouse" });
    await waitFor(() => expect(screen.getByText("translation")).toBeInTheDocument(), { timeout: 3000 });
    expect(screen.getByText("From your deck")).toBeInTheDocument();
  });

  it("shows fallback when gloss request fails", async () => {
    Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true });
    fetchGloss.mockRejectedValueOnce(new Error("nope"));
    render(<TargetLangText text="hola" />);
    const word = screen.getByText("hola");
    fireEvent.pointerEnter(word, { clientX: 120, clientY: 120, pointerType: "mouse" });
    await waitFor(() => expect(screen.getByText("(could not load)")).toBeInTheDocument());
  });

  it("shows No gloss when API returns empty glosses", async () => {
    Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true });
    fetchGloss.mockResolvedValueOnce({ glosses: [], pos: null, note: null, from_deck: false });
    render(<TargetLangText text="x" />);
    fireEvent.pointerEnter(screen.getByText("x"), { clientX: 120, clientY: 120, pointerType: "mouse" });
    await waitFor(() => expect(screen.getByText("No gloss")).toBeInTheDocument());
  });

  it("cancels touch long-press when pointer lifts early", () => {
    vi.useFakeTimers();
    Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true });
    render(<TargetLangText text="touch" />);
    const word = screen.getByText("touch");
    fireEvent.pointerDown(word, { pointerType: "touch", clientX: 80, clientY: 80 });
    vi.advanceTimersByTime(200);
    fireEvent.pointerUp(word);
    vi.advanceTimersByTime(400);
    expect(fetchGloss).not.toHaveBeenCalled();
    expect(screen.queryByText("translation")).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("reuses cache for the same word without refetching", async () => {
    Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true });
    render(<TargetLangText text="cache" sentenceContext="cache me" />);
    const word = screen.getByText("cache");
    fireEvent.pointerEnter(word, { clientX: 120, clientY: 120, pointerType: "mouse" });
    await waitFor(() => expect(screen.getByText("translation")).toBeInTheDocument());
    fireEvent.pointerLeave(word);
    await new Promise((r) => setTimeout(r, 250));
    fireEvent.pointerEnter(word, { clientX: 121, clientY: 121, pointerType: "mouse" });
    await new Promise((r) => setTimeout(r, 450));
    await waitFor(() => expect(screen.getByText("translation")).toBeInTheDocument());
    expect(fetchGloss).toHaveBeenCalledTimes(1);
  });

  it("segments with fallback when Intl.Segmenter throws", () => {
    const Original = Intl.Segmenter;
    try {
      (Intl as unknown as { Segmenter: typeof Intl.Segmenter }).Segmenter = class {
        constructor() {
          throw new Error("bad");
        }
      } as unknown as typeof Intl.Segmenter;
      render(<TargetLangText text="a b" localeOverride="xx" />);
      expect(screen.getByText("a")).toBeInTheDocument();
      expect(screen.getByText("b")).toBeInTheDocument();
    } finally {
      (Intl as unknown as { Segmenter: typeof Intl.Segmenter }).Segmenter = Original;
    }
  });
});
