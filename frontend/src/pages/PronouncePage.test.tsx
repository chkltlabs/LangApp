import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PronouncePage } from "./PronouncePage";

vi.mock("../components/AudioRecorder", () => ({
  AudioRecorder: ({ onRecording }: { onRecording: (b: Blob) => void }) => (
    <button type="button" onClick={() => onRecording(new Blob(["a"]))}>
      mock-record
    </button>
  ),
}));

vi.mock("../components/TargetLangText", () => ({
  TargetLangText: ({ text }: { text: string }) => <span data-testid="gloss">{text}</span>,
}));

describe("PronouncePage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("submits recording and shows feedback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          feedback: "Nice",
          transcript: "hola",
          alignment: { ratio: 0.95 },
        }),
      }),
    );
    const user = userEvent.setup();
    render(<PronouncePage />);
    await user.type(screen.getByRole("textbox"), "hola mundo");
    await user.click(screen.getByRole("button", { name: /mock-record/i }));
    await waitFor(() => expect(screen.getByText("Nice")).toBeInTheDocument());
    expect(screen.getByTestId("gloss")).toHaveTextContent("hola");
    await user.click(screen.getByRole("radio", { name: /shadowing/i }));
    expect(screen.getByRole("textbox").getAttribute("placeholder") ?? "").toMatch(/reference/i);
  });

  it("requires text before recording", async () => {
    const user = userEvent.setup();
    render(<PronouncePage />);
    await user.click(screen.getByRole("button", { name: /mock-record/i }));
    await waitFor(() => expect(screen.getByText(/enter reference/i)).toBeInTheDocument());
  });

  it("shows error when pronunciation request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        text: async () => "server error",
      }),
    );
    const user = userEvent.setup();
    render(<PronouncePage />);
    await user.type(screen.getByRole("textbox"), "hola");
    await user.click(screen.getByRole("button", { name: /mock-record/i }));
    await waitFor(() => expect(screen.getByText(/server error/i)).toBeInTheDocument());
  });
});
