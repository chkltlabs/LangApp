import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Layout } from "../components/Layout";
import { PUBLIC_SETTINGS } from "../test/fixtures";
import { VoicePage } from "./VoicePage";

const { voiceTurn, playWavBase64 } = vi.hoisted(() => ({
  voiceTurn: vi.fn(),
  playWavBase64: vi.fn(),
}));

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    voiceTurn,
    playWavBase64,
  };
});

vi.mock("../components/AudioRecorder", () => ({
  AudioRecorder: ({ onRecording }: { onRecording: (b: Blob) => void }) => (
    <button type="button" onClick={() => onRecording(new Blob(["a"]))}>
      talk
    </button>
  ),
}));

describe("VoicePage", () => {
  it("sends voice turn and shows transcript", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ...PUBLIC_SETTINGS }),
      }),
    );
    voiceTurn.mockResolvedValue({
      transcript: "user said",
      reply: "tutor said",
      audio_base64: "YQ==",
    });
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/voice"]}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="voice" element={<VoicePage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText(/voice conversation/i)).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /^talk$/i }));
    await waitFor(() => expect(screen.getByText(/user said/)).toBeInTheDocument());
    expect(playWavBase64).toHaveBeenCalled();
  });

  it("shows error when voice turn fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ...PUBLIC_SETTINGS }),
      }),
    );
    voiceTurn.mockRejectedValueOnce(new Error("mic failed"));
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/voice"]}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="voice" element={<VoicePage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: /^talk$/i })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /^talk$/i }));
    await waitFor(() => expect(screen.getByText(/mic failed/i)).toBeInTheDocument());
  });
});
