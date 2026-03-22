import { useState } from "react";
import { apiJson } from "../api";

const types = ["cloze", "dictation", "short_answer", "error_correction"] as const;

export function ExercisePage() {
  const [exerciseType, setExerciseType] = useState<(typeof types)[number]>("cloze");
  const [topic, setTopic] = useState("");
  const [content, setContent] = useState<Record<string, unknown> | null>(null);
  const [answer, setAnswer] = useState("");
  const [grade, setGrade] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const generate = async () => {
    setErr(null);
    setBusy(true);
    setGrade(null);
    try {
      const r = await apiJson<{ exercise_type: string; content: Record<string, unknown> }>(
        "/api/exercises/generate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            exercise_type: exerciseType,
            topic: topic.trim() || null,
            model_tier: "strong",
          }),
        },
      );
      setContent(r.content);
      setAnswer("");
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  const gradeIt = async () => {
    if (!content) return;
    setErr(null);
    setBusy(true);
    try {
      const r = await apiJson<Record<string, unknown>>("/api/exercises/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exercise_type: exerciseType,
          prompt_json: content,
          user_answer: answer,
        }),
      });
      setGrade(r);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h2>Written exercises</h2>
      {err && <p style={{ color: "#f88" }}>{err}</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "0.75rem" }}>
        <label>
          Type{" "}
          <select value={exerciseType} onChange={(e) => setExerciseType(e.target.value as (typeof types)[number])}>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <input
          style={{ flex: 1, minWidth: 200 }}
          placeholder="Topic (optional)"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />
        <button type="button" disabled={busy} onClick={() => void generate()}>
          Generate
        </button>
      </div>
      {content && (
        <>
          <pre
            style={{
              background: "#1a1d26",
              padding: "0.75rem",
              borderRadius: 8,
              overflow: "auto",
              border: "1px solid #2a3142",
            }}
          >
            {JSON.stringify(content, null, 2)}
          </pre>
          <h3>Your answer</h3>
          <textarea rows={5} style={{ width: "100%" }} value={answer} onChange={(e) => setAnswer(e.target.value)} />
          <button type="button" disabled={busy} onClick={() => void gradeIt()}>
            Grade with LLM
          </button>
        </>
      )}
      {grade && (
        <div style={{ marginTop: "1rem" }}>
          <h3>Result</h3>
          <pre
            style={{
              background: "#1a1d26",
              padding: "0.75rem",
              borderRadius: 8,
              overflow: "auto",
              border: "1px solid #2a3142",
            }}
          >
            {JSON.stringify(grade, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
