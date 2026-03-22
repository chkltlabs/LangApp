import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { PUBLIC_SETTINGS } from "../test/fixtures";
import { Layout } from "./Layout";

describe("Layout", () => {
  it("renders nav and outlet", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ...PUBLIC_SETTINGS }),
      }),
    );
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<span>child</span>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText("LangApp")).toBeInTheDocument());
    expect(screen.getByText("child")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /chat/i })).toHaveAttribute("href", "/");
  });
});
