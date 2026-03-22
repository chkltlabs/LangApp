import { useState } from "react";
import { authHeaders } from "../api";
import { AudioRecorder } from "../components/AudioRecorder";

export function PronouncePage() {
  const [mode, setMode] = useState<"target" | "shadow">("target");
  const [text, setText] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submitBlob = async (blob: Blob) => {
    if (!text.trim()) {
      setErr("Enter reference / target text first.");
      return;
    }
    setErr(null);
    setBusy(true);
    setResult(null);
    const fd = new FormData();
    fd.append("file", blob, "speech.webm");
    fd.append(mode === "target" ? "target_text" : "reference_text", text.trim());
    const path = mode === "target" ? "/api/pronunciation/target-phrase" : "/api/pronunciation/shadowing";
    try {
      const res = await fetch(path, {
        method: "POST",
        body: fd,
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(await res.text());
      setResult((await res.json()) as Record<string, unknown>);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h2>Pronunciation</h2>
      <p style={{ color: "#9aa3b5", maxWidth: 640 }}>
        Target phrase compares your speech to an expected line. Shadowing compares your repeat to a reference
        sentence. Feedback uses transcript alignment plus the local LLM.
      </p>
      <div style={{ marginBottom: "0.75rem", display: "flex", gap: "1rem" }}>
        <label>
          <input
            type="radio"
            checked={mode === "target"}
            onChange={() => setMode("target")}
          />{" "}
          Target phrase
        </label>
        <label>
          <input
            type="radio"
            checked={mode === "shadow"}
            onChange={() => setMode("shadow")}
          />{" "}
          Shadowing
        </label>
      </div>
      <textarea
        rows={3}
        style={{ width: "100%", marginBottom: "0.5rem" }}
        placeholder={mode === "target" ? "Sentence you should say…" : "Reference line you shadowed…"}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <AudioRecorder onRecording={(b) => void submitBlob(b)} disabled={busy} />
      {err && <p style={{ color: "#f88" }}>{err}</p>}
      {result && (
        <div style={{ marginTop: "1rem" }}>
          <h3>Feedback</h3>
          <p style={{ whiteSpace: "pre-wrap" }}>{String(result.feedback ?? "")}</p>
          <h4>Transcript</h4>
          <p>{String(result.transcript ?? "")}</p>
          <h4>Alignment ratio</h4>
          <p>{JSON.stringify((result.alignment as { ratio?: number })?.ratio)}</p>
        </div>
      )}
    </div>
  );
}
