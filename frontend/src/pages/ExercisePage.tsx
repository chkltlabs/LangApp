import { useState } from "react";
import { apiJson } from "../api";
import { TargetLangText } from "../components/TargetLangText";

const types = ["cloze", "dictation", "short_answer", "error_correction"] as const;

function L2Block({ label, text }: { label: string; text: string }) {
  return (
    <div style={{ marginBottom: "0.75rem" }}>
      <div style={{ color: "#9aa3b5", fontSize: "0.85rem" }}>{label}</div>
      <div style={{ whiteSpace: "pre-wrap" }}>
        <TargetLangText text={text} sentenceContext={text} />
      </div>
    </div>
  );
}

function ExerciseContentView({
  exerciseType,
  content,
}: {
  exerciseType: (typeof types)[number];
  content: Record<string, unknown>;
}) {
  const str = (k: string) => (typeof content[k] === "string" ? (content[k] as string) : "");
  const hints = content.hints;
  return (
    <div
      style={{
        background: "#1a1d26",
        padding: "0.75rem",
        borderRadius: 8,
        border: "1px solid #2a3142",
        marginBottom: "0.75rem",
      }}
    >
      {exerciseType === "cloze" && (
        <>
          <L2Block label="Passage" text={str("passage")} />
          <details style={{ marginBottom: "0.5rem" }}>
            <summary style={{ color: "#9aa3b5", cursor: "pointer" }}>Show answer</summary>
            <TargetLangText text={str("answer")} sentenceContext={str("passage")} />
          </details>
          {Array.isArray(hints) &&
            hints.map((h, i) => (
              <div key={i} style={{ color: "#8ab", fontSize: "0.88rem" }}>
                {String(h)}
              </div>
            ))}
        </>
      )}
      {exerciseType === "dictation" && (
        <>
          <L2Block label="Text (listen / write)" text={str("text")} />
          <div style={{ color: "#9aa3b5", fontSize: "0.85rem" }}>Translation (UI language)</div>
          <p style={{ margin: 0 }}>{str("translation")}</p>
        </>
      )}
      {exerciseType === "short_answer" && (
        <>
          <L2Block label="Question" text={str("question")} />
          <L2Block label="Model answer" text={str("model_answer")} />
        </>
      )}
      {exerciseType === "error_correction" && (
        <>
          <L2Block label="Flawed" text={str("flawed")} />
          <L2Block label="Corrected" text={str("corrected")} />
          <p style={{ color: "#8ab", margin: 0 }}>{str("notes")}</p>
        </>
      )}
    </div>
  );
}

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
          <ExerciseContentView exerciseType={exerciseType} content={content} />
          <details style={{ marginBottom: "0.75rem" }}>
            <summary style={{ color: "#9aa3b5", cursor: "pointer" }}>Raw JSON</summary>
            <pre
              style={{
                background: "#1a1d26",
                padding: "0.75rem",
                borderRadius: 8,
                overflow: "auto",
                border: "1px solid #2a3142",
                marginTop: "0.5rem",
              }}
            >
              {JSON.stringify(content, null, 2)}
            </pre>
          </details>
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
          {typeof grade.follow_up_drill === "string" && (grade.follow_up_drill as string).trim() && (
            <div style={{ marginBottom: "0.75rem" }}>
              <div style={{ color: "#9aa3b5", fontSize: "0.85rem" }}>Follow-up drill</div>
              <TargetLangText
                text={grade.follow_up_drill as string}
                sentenceContext={grade.follow_up_drill as string}
              />
            </div>
          )}
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
