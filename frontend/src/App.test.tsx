import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "./App";
import { PUBLIC_SETTINGS } from "./test/fixtures";

describe("App", () => {
  it("mounts default chat route", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ...PUBLIC_SETTINGS }),
      }),
    );
    render(<App />);
    await waitFor(() => expect(screen.getByText("LangApp")).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: /^chat$/i })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
