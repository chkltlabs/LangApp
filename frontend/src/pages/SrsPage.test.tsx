import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Layout } from "../components/Layout";
import { PUBLIC_SETTINGS } from "../test/fixtures";
import { SrsPage } from "./SrsPage";

const learnCard = {
  id: 1,
  deck_id: 1,
  front: "hola",
  back: "hello",
  hint: "Hola amigo.",
  intro_complete: false,
  due_at: new Date().toISOString(),
  interval_days: 0,
  repetitions: 0,
  ease_factor: 2.5,
};

const dueCard = {
  ...learnCard,
  id: 2,
  intro_complete: true,
  repetitions: 1,
  interval_days: 1,
};

const {
  apiJson,
  generateVocabPack,
  completeCardIntro,
  fetchVocabMcq,
  gradeVocabProduction,
  playWavBase64,
} = vi.hoisted(() => ({
  apiJson: vi.fn(),
  generateVocabPack: vi.fn(),
  completeCardIntro: vi.fn(),
  fetchVocabMcq: vi.fn(),
  gradeVocabProduction: vi.fn(),
  playWavBase64: vi.fn(),
}));

vi.mock("../api", () => ({
  apiJson,
  generateVocabPack,
  completeCardIntro,
  fetchVocabMcq,
  gradeVocabProduction,
  playWavBase64,
}));

function renderSrs() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...PUBLIC_SETTINGS }),
    }),
  );
  return render(
    <MemoryRouter initialEntries={["/srs"]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="srs" element={<SrsPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("SrsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchVocabMcq.mockResolvedValue({
      prompt_l2: "hola",
      options: ["hello", "wrong", "bad", "nope"],
      correct_index: 0,
    });
    gradeVocabProduction.mockResolvedValue({ ok: true, feedback: "" });
    completeCardIntro.mockResolvedValue({});
    generateVocabPack.mockResolvedValue({ created: 1, card_ids: [99] });
    playWavBase64.mockImplementation(() => {});
  });

  it("runs learn flow: quiz and graduate", async () => {
    apiJson.mockImplementation(async (path: string) => {
      if (path.includes("/api/srs/due")) return [];
      if (path.includes("/api/srs/learn")) return [learnCard];
      if (path.includes("/api/speech/tts")) return { audio_base64: "YQ==" };
      return {};
    });
    const user = userEvent.setup();
    renderSrs();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /learn new/i })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /continue to quiz/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /^hello$/ })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /^hello$/ }));
    const input = screen.getByPlaceholderText(/type here/i);
    await user.type(input, "hola");
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    await waitFor(() => expect(completeCardIntro).toHaveBeenCalledWith(1));
  });

  it("generates vocabulary pack", async () => {
    apiJson.mockImplementation(async (path: string) => {
      if (path.includes("/api/srs/due")) return [];
      if (path.includes("/api/srs/learn")) return [];
      return {};
    });
    const user = userEvent.setup();
    renderSrs();
    await waitFor(() => screen.getByRole("button", { name: /generate vocabulary/i }));
    await user.click(screen.getByRole("button", { name: /generate vocabulary/i }));
    await waitFor(() => expect(generateVocabPack).toHaveBeenCalled());
  });

  it("reviews due card with SM-2", async () => {
    apiJson.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.includes("/api/srs/due")) return [dueCard];
      if (path.includes("/api/srs/learn")) return [];
      if (path.includes("/api/srs/cards/2/review") && init?.method === "POST") return { ...dueCard };
      if (path.includes("/api/speech/tts")) return { audio_base64: "YQ==" };
      return {};
    });
    const user = userEvent.setup();
    renderSrs();
    await waitFor(() => expect(screen.getByRole("button", { name: /show answer/i })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /show answer/i }));
    await user.click(screen.getByRole("button", { name: /^4$/ }));
    await waitFor(() => expect(apiJson).toHaveBeenCalled());
  });

  it("adds manual card from advanced section", async () => {
    apiJson.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.includes("/api/srs/due")) return [];
      if (path.includes("/api/srs/learn")) return [];
      if (path.includes("/api/srs/cards") && init?.method === "POST")
        return { id: 3, deck_id: 1, front: "x", back: "y", hint: null, intro_complete: true, due_at: "", interval_days: 0, repetitions: 0, ease_factor: 2.5 };
      return {};
    });
    const user = userEvent.setup();
    renderSrs();
    await user.click(screen.getByRole("button", { name: /advanced/i }));
    await user.type(screen.getByPlaceholderText(/front \(target/i), "uno");
    await user.type(screen.getByPlaceholderText(/back \(translation/i), "one");
    await user.click(screen.getByRole("button", { name: /add to default deck/i }));
    await waitFor(() => expect(apiJson).toHaveBeenCalled());
  });
});
