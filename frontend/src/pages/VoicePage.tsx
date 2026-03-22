import { useCallback, useState } from "react";
import { playWavBase64, voiceTurn } from "../api";
import { AudioRecorder } from "../components/AudioRecorder";
import { TargetLangText } from "../components/TargetLangText";
import { usePublicSettings } from "../context/SettingsContext";

type Msg = { role: "user" | "assistant"; content: string };

export function VoicePage() {
  const settings = usePublicSettings();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [tier, setTier] = useState<string>("fast");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lastLog, setLastLog] = useState<string | null>(null);

  const onBlob = useCallback(
    async (blob: Blob) => {
      setErr(null);
      setBusy(true);
      setLastLog(null);
      try {
        const hist = messages.map((m) => ({ role: m.role, content: m.content }));
        const r = await voiceTurn(blob, hist, tier || null, settings?.tts_voice_target ?? null);
        setLastLog(`STT: ${r.transcript}`);
        const next: Msg[] = [
          ...messages,
          { role: "user", content: r.transcript },
          { role: "assistant", content: r.reply },
        ];
        setMessages(next);
        playWavBase64(r.audio_base64);
      } catch (e) {
        setErr(String(e));
      } finally {
        setBusy(false);
      }
    },
    [messages, settings, tier],
  );

  return (
    <div>
      <h2>Voice conversation</h2>
      <p style={{ color: "#9aa3b5", maxWidth: 640 }}>
        Record a turn: audio is transcribed, the tutor replies via Ollama, and the reply is spoken with Piper TTS.
        Default tier is <strong>fast</strong> for lower latency.
      </p>
      <div style={{ marginBottom: "0.75rem" }}>
        <label>
          Model tier{" "}
          <select value={tier} onChange={(e) => setTier(e.target.value)}>
            <option value="">Default</option>
            <option value="fast">Fast</option>
            <option value="strong">Strong</option>
          </select>
        </label>
      </div>
      {err && <p style={{ color: "#f88" }}>{err}</p>}
      {lastLog && <p style={{ color: "#8ab" }}>{lastLog}</p>}
      <AudioRecorder onRecording={(b) => void onBlob(b)} disabled={busy} />
      <div
        style={{
          marginTop: "1rem",
          border: "1px solid #2a3142",
          borderRadius: 8,
          padding: "0.75rem",
          background: "#1a1d26",
          maxHeight: "40vh",
          overflowY: "auto",
        }}
      >
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: "0.5rem", whiteSpace: "pre-wrap" }}>
            <strong>{m.role === "user" ? "You" : "Tutor"}:</strong>{" "}
            <TargetLangText text={m.content} sentenceContext={m.content} />
          </div>
        ))}
      </div>
      <button type="button" style={{ marginTop: "0.75rem" }} onClick={() => setMessages([])}>
        Clear history
      </button>
    </div>
  );
}
