import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatPage } from "./ChatPage";

const { streamChat, apiJson, playWavBase64 } = vi.hoisted(() => ({
  streamChat: vi.fn(),
  apiJson: vi.fn(),
  playWavBase64: vi.fn(),
}));

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    streamChat,
    apiJson,
    playWavBase64,
  };
});

vi.mock("../components/TargetLangText", () => ({
  TargetLangText: ({ text }: { text: string }) => <span>{text}</span>,
}));

vi.mock("../context/SettingsContext", () => ({
  usePublicSettings: () => ({
    lang_target: "Spanish",
    lang_ui: "English",
    tts_voice_target: "es_ES-test",
  }),
}));

describe("ChatPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    streamChat.mockImplementation(async (_m, _tier, onTok) => {
      onTok("ok");
    });
    apiJson.mockResolvedValue({ audio_base64: "YQ==" });
  });

  it("streams assistant reply and can speak last", async () => {
    const user = userEvent.setup();
    render(<ChatPage />);
    await user.type(screen.getByRole("textbox"), "hola");
    await user.click(screen.getByRole("button", { name: /^send$/i }));
    await waitFor(() => expect(screen.getByText("ok")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /speak last reply/i }));
    await waitFor(() => expect(apiJson).toHaveBeenCalled());
    expect(playWavBase64).toHaveBeenCalled();
  });

  it("passes selected model tier to streamChat", async () => {
    const user = userEvent.setup();
    render(<ChatPage />);
    await user.selectOptions(screen.getByRole("combobox"), "fast");
    await user.type(screen.getByRole("textbox"), "x");
    await user.click(screen.getByRole("button", { name: /^send$/i }));
    await waitFor(() => expect(streamChat).toHaveBeenCalled());
    expect(streamChat.mock.calls[0][1]).toBe("fast");
  });

  it("shows error when stream fails", async () => {
    streamChat.mockRejectedValueOnce(new Error("stream down"));
    const user = userEvent.setup();
    render(<ChatPage />);
    await user.type(screen.getByRole("textbox"), "x");
    await user.click(screen.getByRole("button", { name: /^send$/i }));
    await waitFor(() => expect(screen.getByText(/stream down/i)).toBeInTheDocument());
  });
});
