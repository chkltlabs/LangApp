import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Layout } from "../components/Layout";
import { PUBLIC_SETTINGS } from "../test/fixtures";
import { ExercisePage } from "./ExercisePage";

describe("ExercisePage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("generates and grades an exercise", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (url.includes("/api/settings/public")) {
          return new Response(JSON.stringify(PUBLIC_SETTINGS), { status: 200 });
        }
        if (url.includes("/api/exercises/generate")) {
          return new Response(
            JSON.stringify({
              exercise_type: "cloze",
              content: { passage: "Text ____", answer: "ok", hints: ["h"] },
            }),
            { status: 200 },
          );
        }
        if (url.includes("/api/exercises/grade")) {
          return new Response(JSON.stringify({ score: 1, feedback: "great" }), { status: 200 });
        }
        return new Response("{}", { status: 404 });
      }),
    );
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/exercises"]}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="exercises" element={<ExercisePage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: /generate/i })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /generate/i }));
    await waitFor(() => expect(screen.getByText(/Text ____/)).toBeInTheDocument());
    const boxes = screen.getAllByRole("textbox");
    await user.type(boxes[boxes.length - 1], "ok");
    await user.click(screen.getByRole("button", { name: /grade with llm/i }));
    await waitFor(() => expect(screen.getByText(/great/i)).toBeInTheDocument());
  });

  it("shows error when generate fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (url.includes("/api/settings/public")) {
          return new Response(JSON.stringify(PUBLIC_SETTINGS), { status: 200 });
        }
        if (url.includes("/api/exercises/generate")) {
          return new Response("bad", { status: 500 });
        }
        return new Response("{}", { status: 404 });
      }),
    );
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/exercises"]}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="exercises" element={<ExercisePage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: /generate/i })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /generate/i }));
    await waitFor(() => expect(screen.getByText(/bad/i)).toBeInTheDocument());
  });

  it("renders dictation exercise content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (url.includes("/api/settings/public")) {
          return new Response(JSON.stringify(PUBLIC_SETTINGS), { status: 200 });
        }
        if (url.includes("/api/exercises/generate")) {
          return new Response(
            JSON.stringify({
              exercise_type: "dictation",
              content: { text: "Escucha", translation: "Listen" },
            }),
            { status: 200 },
          );
        }
        if (url.includes("/api/exercises/grade")) {
          return new Response(
            JSON.stringify({
              score: 1,
              feedback: "ok",
              follow_up_drill: "Repite: hola",
            }),
            { status: 200 },
          );
        }
        if (url.includes("/api/lexicon/gloss")) {
          return new Response(JSON.stringify({ glosses: [], from_deck: false }), { status: 200 });
        }
        return new Response("{}", { status: 404 });
      }),
    );
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/exercises"]}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="exercises" element={<ExercisePage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByRole("combobox")).toBeInTheDocument());
    await user.selectOptions(screen.getByRole("combobox"), "dictation");
    await user.click(screen.getByRole("button", { name: /generate/i }));
    await waitFor(() => expect(screen.getByText("Escucha")).toBeInTheDocument());
    await user.type(screen.getAllByRole("textbox")[screen.getAllByRole("textbox").length - 1], "x");
    await user.click(screen.getByRole("button", { name: /grade with llm/i }));
    await waitFor(() => expect(document.body.textContent).toContain("Repite: hola"));
  });
});
