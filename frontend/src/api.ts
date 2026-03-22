const apiKey = import.meta.env.VITE_API_KEY || "";

export function authHeaders(): Record<string, string> {
  return apiKey ? { "X-API-Key": apiKey } : {};
}

function headers(base?: HeadersInit): Headers {
  const h = new Headers(base);
  if (apiKey) h.set("X-API-Key", apiKey);
  return h;
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: headers(init?.headers as HeadersInit),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || res.statusText);
  }
  return res.json() as Promise<T>;
}

export async function streamChat(
  messages: { role: string; content: string }[],
  modelTier: string | null,
  onToken: (t: string) => void,
): Promise<void> {
  const res = await fetch("/api/chat/stream", {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ messages, model_tier: modelTier }),
  });
  if (!res.ok) throw new Error(await res.text());
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() || "";
    for (const block of parts) {
      for (const line of block.split("\n")) {
        if (line.startsWith("data: ")) {
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") continue;
          try {
            const j = JSON.parse(payload) as { token?: string };
            if (j.token) onToken(j.token);
          } catch {
            /* ignore */
          }
        }
      }
    }
  }
}

export async function voiceTurn(
  blob: Blob,
  messages: { role: string; content: string }[],
  modelTier: string | null,
  ttsVoice: string | null,
): Promise<{
  transcript: string;
  reply: string;
  audio_base64: string;
}> {
  const fd = new FormData();
  fd.append("file", blob, "speech.webm");
  fd.append("messages_json", JSON.stringify(messages));
  if (modelTier) fd.append("model_tier", modelTier);
  if (ttsVoice) fd.append("tts_voice", ttsVoice);
  const res = await fetch("/api/speech/voice-turn", {
    method: "POST",
    headers: headers(),
    body: fd,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function playWavBase64(b64: string): void {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: "audio/wav" });
  const url = URL.createObjectURL(blob);
  const a = new Audio(url);
  a.play();
  a.onended = () => URL.revokeObjectURL(url);
}
