import { useCallback, useRef, useState } from "react";

type Props = {
  onRecording: (blob: Blob) => void;
  disabled?: boolean;
};

export function AudioRecorder({ onRecording, disabled }: Props) {
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const chunks = useRef<BlobPart[]>([]);
  const [busy, setBusy] = useState(false);

  const stop = useCallback(
    (mr: MediaRecorder) => {
      mr.onstop = () => {
        const blob = new Blob(chunks.current, { type: mr.mimeType || "audio/webm" });
        chunks.current = [];
        setRec(null);
        setBusy(false);
        onRecording(blob);
      };
      mr.stop();
      mr.stream.getTracks().forEach((t) => t.stop());
    },
    [onRecording],
  );

  const start = useCallback(async () => {
    if (disabled || busy) return;
    setBusy(true);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime =
      MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
    const mr = new MediaRecorder(stream, { mimeType: mime });
    chunks.current = [];
    mr.ondataavailable = (e) => {
      if (e.data.size) chunks.current.push(e.data);
    };
    mr.start();
    setRec(mr);
    setBusy(false);
  }, [disabled, busy]);

  return (
    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
      {!rec ? (
        <button type="button" onClick={() => void start()} disabled={disabled || busy}>
          Hold to record — start
        </button>
      ) : (
        <button type="button" onClick={() => stop(rec)} style={{ background: "#8b3a3a" }}>
          Stop & send
        </button>
      )}
    </div>
  );
}
