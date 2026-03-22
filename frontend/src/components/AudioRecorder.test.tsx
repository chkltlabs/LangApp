import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioRecorder } from "./AudioRecorder";

describe("AudioRecorder", () => {
  const onRecording = vi.fn();
  let mockMr: {
    mimeType: string;
    stream: { getTracks: () => { stop: ReturnType<typeof vi.fn> }[] };
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    ondataavailable: ((e: { data: Blob }) => void) | null;
    onstop: (() => void) | null;
  };

  beforeEach(() => {
    onRecording.mockClear();
    const trackStop = vi.fn();
    mockMr = {
      mimeType: "audio/webm",
      stream: { getTracks: () => [{ stop: trackStop }] },
      start: vi.fn(),
      stop: vi.fn(() => {
        queueMicrotask(() => mockMr.onstop?.());
      }),
      ondataavailable: null,
      onstop: null,
    };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: trackStop }],
        }),
      },
    });
    const RecorderMock = vi.fn(() => mockMr) as unknown as typeof MediaRecorder;
    Object.assign(RecorderMock, { isTypeSupported: () => true });
    vi.stubGlobal("MediaRecorder", RecorderMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("records and delivers a blob on stop", async () => {
    const user = userEvent.setup();
    render(<AudioRecorder onRecording={onRecording} />);
    await user.click(screen.getByRole("button", { name: /start/i }));
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    expect(mockMr.start).toHaveBeenCalled();
    mockMr.ondataavailable?.({ data: new Blob(["x"]) });
    await user.click(screen.getByRole("button", { name: /stop/i }));
    await vi.waitFor(() => expect(onRecording).toHaveBeenCalled());
    expect(onRecording.mock.calls[0][0]).toBeInstanceOf(Blob);
  });

  it("does not start when disabled", async () => {
    const user = userEvent.setup();
    render(<AudioRecorder onRecording={onRecording} disabled />);
    const btn = screen.getByRole("button", { name: /start/i });
    expect(btn).toBeDisabled();
    await user.click(btn);
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });
});
