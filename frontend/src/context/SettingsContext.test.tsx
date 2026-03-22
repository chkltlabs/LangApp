import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PUBLIC_SETTINGS } from "../test/fixtures";
import { SettingsProvider, usePublicSettings } from "./SettingsContext";

function Consumer() {
  const s = usePublicSettings();
  return <div data-testid="out">{s?.lang_target ?? "none"}</div>;
}

describe("SettingsProvider", () => {
  it("fetches public settings and provides context", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ...PUBLIC_SETTINGS }),
      }),
    );
    render(
      <SettingsProvider>
        <Consumer />
      </SettingsProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("out")).toHaveTextContent("Spanish"));
  });
});
