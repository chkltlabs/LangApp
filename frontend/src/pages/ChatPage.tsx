import { useCallback, useState } from "react";
import { apiJson, playWavBase64, streamChat } from "../api";
import { TargetLangText } from "../components/TargetLangText";
import { usePublicSettings } from "../context/SettingsContext";

type Msg = { role: "user" | "assistant"; content: string };

export function ChatPage() {
  const settings = usePublicSettings();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [tier, setTier] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const send = useCallback(async () => {
    const t = input.trim();
    if (!t || loading) return;
    setErr(null);
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content: t }];
    setMessages(next);
    setLoading(true);
    let acc = "";
    setMessages([...next, { role: "assistant", content: "" }]);
    try {
      await streamChat(
        next.map((m) => ({ role: m.role, content: m.content })),
        tier || null,
        (tok) => {
          acc += tok;
          setMessages([...next, { role: "assistant", content: acc }]);
        },
      );
    } catch (e) {
      setErr(String(e));
      setMessages(next);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, tier]);

  const speakLast = useCallback(async () => {
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    if (!last?.content) return;
    const voice = settings?.tts_voice_target || "es_ES-davefx-medium";
    const r = await apiJson<{ audio_base64: string }>("/api/speech/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: last.content, voice_key: voice }),
    });
    playWavBase64(r.audio_base64);
  }, [messages, settings]);

  return (
    <div>
      <h2>Chat</h2>
      {settings && (
        <p style={{ color: "#9aa3b5", fontSize: "0.9rem" }}>
          Target: {settings.lang_target} — UI: {settings.lang_ui} — TTS uses{" "}
          <code>{settings.tts_voice_target}</code>
        </p>
      )}
      <div style={{ marginBottom: "0.75rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <label>
          Model tier{" "}
          <select value={tier} onChange={(e) => setTier(e.target.value)}>
            <option value="">Default</option>
            <option value="fast">Fast (voice-friendly)</option>
            <option value="strong">Strong (if configured)</option>
          </select>
        </label>
        <button type="button" onClick={() => void speakLast()} disabled={loading}>
          Speak last reply
        </button>
      </div>
      {err && <p style={{ color: "#f88" }}>{err}</p>}
      <div
        style={{
          border: "1px solid #2a3142",
          borderRadius: 8,
          padding: "0.75rem",
          minHeight: 240,
          marginBottom: "0.75rem",
          background: "#1a1d26",
          overflowY: "auto",
          maxHeight: "50vh",
        }}
      >
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: "0.6rem", whiteSpace: "pre-wrap" }}>
            <strong>{m.role === "user" ? "You" : "Tutor"}:</strong>{" "}
            <TargetLangText text={m.content} sentenceContext={m.content} />
          </div>
        ))}
      </div>
      <textarea
        rows={3}
        style={{ width: "100%", marginBottom: "0.5rem" }}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Type in your target language or ask for help…"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void send();
          }
        }}
      />
      <button type="button" onClick={() => void send()} disabled={loading}>
        {loading ? "…" : "Send"}
      </button>
    </div>
  );
}
