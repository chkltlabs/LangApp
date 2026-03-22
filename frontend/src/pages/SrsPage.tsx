import { useCallback, useEffect, useState } from "react";
import { apiJson } from "../api";

type Card = {
  id: number;
  deck_id: number;
  front: string;
  back: string;
  hint: string | null;
  due_at: string;
  interval_days: number;
  repetitions: number;
  ease_factor: number;
};

export function SrsPage() {
  const [due, setDue] = useState<Card[]>([]);
  const [current, setCurrent] = useState<Card | null>(null);
  const [show, setShow] = useState(false);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const loadDue = useCallback(async () => {
    const list = await apiJson<Card[]>("/api/srs/due?limit=30");
    setDue(list);
    setCurrent((c) => {
      if (c && list.some((x) => x.id === c.id)) return c;
      return list[0] ?? null;
    });
    setShow(false);
  }, []);

  useEffect(() => {
    void loadDue().catch((e) => setErr(String(e)));
  }, [loadDue]);

  const review = async (quality: number) => {
    if (!current) return;
    setErr(null);
    await apiJson(`/api/srs/cards/${current.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quality }),
    });
    const rest = due.filter((c) => c.id !== current.id);
    setDue(rest);
    setCurrent(rest[0] ?? null);
    setShow(false);
  };

  const addCard = async () => {
    if (!front.trim() || !back.trim()) return;
    setErr(null);
    await apiJson("/api/srs/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ front: front.trim(), back: back.trim() }),
    });
    setFront("");
    setBack("");
    await loadDue();
  };

  return (
    <div>
      <h2>Vocabulary (SRS)</h2>
      {err && <p style={{ color: "#f88" }}>{err}</p>}
      <p style={{ color: "#9aa3b5" }}>Due now: {due.length} cards</p>
      {current ? (
        <div
          style={{
            border: "1px solid #2a3142",
            borderRadius: 8,
            padding: "1rem",
            background: "#1a1d26",
            marginBottom: "1rem",
          }}
        >
          <div style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>{current.front}</div>
          {current.hint && <div style={{ color: "#8ab", marginBottom: "0.5rem" }}>Hint: {current.hint}</div>}
          {!show ? (
            <button type="button" onClick={() => setShow(true)}>
              Show answer
            </button>
          ) : (
            <>
              <div style={{ margin: "0.75rem 0" }}>{current.back}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                <span style={{ width: "100%", color: "#9aa3b5", fontSize: "0.85rem" }}>Quality (SM-2):</span>
                {[0, 1, 2, 3, 4, 5].map((q) => (
                  <button key={q} type="button" onClick={() => void review(q)}>
                    {q}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <p>No cards due. Add vocabulary below or come back later.</p>
      )}
      <h3>Add card</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxWidth: 480 }}>
        <input placeholder="Front (e.g. target language)" value={front} onChange={(e) => setFront(e.target.value)} />
        <input placeholder="Back (e.g. translation)" value={back} onChange={(e) => setBack(e.target.value)} />
        <button type="button" onClick={() => void addCard()}>
          Add to default deck
        </button>
      </div>
    </div>
  );
}
