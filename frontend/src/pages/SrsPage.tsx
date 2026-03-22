import { useCallback, useEffect, useRef, useState } from "react";
import {
  apiJson,
  completeCardIntro,
  fetchVocabMcq,
  generateVocabPack,
  gradeVocabProduction,
  playWavBase64,
} from "../api";
import { TargetLangText } from "../components/TargetLangText";
import { usePublicSettings } from "../context/SettingsContext";

type Card = {
  id: number;
  deck_id: number;
  front: string;
  back: string;
  hint: string | null;
  intro_complete: boolean;
  due_at: string;
  interval_days: number;
  repetitions: number;
  ease_factor: number;
};

type LearnStep = "present" | "mcq" | "type" | "done";

export function SrsPage() {
  const pub = usePublicSettings();
  const [due, setDue] = useState<Card[]>([]);
  const [learn, setLearn] = useState<Card[]>([]);
  const [current, setCurrent] = useState<Card | null>(null);
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [theme, setTheme] = useState("");
  const [packCount, setPackCount] = useState(10);
  const [replacePack, setReplacePack] = useState(false);
  const [packBusy, setPackBusy] = useState(false);

  const [manualOpen, setManualOpen] = useState(false);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");

  const [learnStep, setLearnStep] = useState<LearnStep>("present");
  const [mcq, setMcq] = useState<{ options: string[]; correct_index: number } | null>(null);
  const [mcqFeedback, setMcqFeedback] = useState<string | null>(null);
  const [typeAttempt, setTypeAttempt] = useState("");
  const [typeFeedback, setTypeFeedback] = useState<string | null>(null);
  const [learnBusy, setLearnBusy] = useState(false);
  const learnCard = learn[0] ?? null;
  const prevLearnFirstId = useRef<number | null>(null);

  const loadDue = useCallback(async () => {
    const list = await apiJson<Card[]>("/api/srs/due?limit=30");
    setDue(list);
    setCurrent((c) => {
      if (c && list.some((x) => x.id === c.id)) return c;
      return list[0] ?? null;
    });
    setShow(false);
  }, []);

  const loadLearn = useCallback(async () => {
    const list = await apiJson<Card[]>("/api/srs/learn?limit=50");
    setLearn(list);
  }, []);

  const reloadAll = useCallback(async () => {
    await Promise.all([loadDue(), loadLearn()]);
  }, [loadDue, loadLearn]);

  useEffect(() => {
    void reloadAll().catch((e) => setErr(String(e)));
  }, [reloadAll]);

  useEffect(() => {
    const fid = learn[0]?.id ?? null;
    if (fid !== prevLearnFirstId.current) {
      prevLearnFirstId.current = fid;
      setLearnStep(fid ? "present" : "done");
      setMcq(null);
      setMcqFeedback(null);
      setTypeAttempt("");
      setTypeFeedback(null);
    }
  }, [learn]);

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
      body: JSON.stringify({ front: front.trim(), back: back.trim(), intro_complete: true }),
    });
    setFront("");
    setBack("");
    await reloadAll();
  };

  const runPack = async () => {
    setErr(null);
    setPackBusy(true);
    try {
      await generateVocabPack({
        theme: theme.trim() || null,
        count: packCount,
        model_tier: "strong",
        replace_existing: replacePack,
      });
      setTheme("");
      await reloadAll();
    } catch (e) {
      setErr(String(e));
    } finally {
      setPackBusy(false);
    }
  };

  const speak = async (text: string) => {
    const voice = pub?.tts_voice_target || "es_ES-davefx-medium";
    const r = await apiJson<{ audio_base64: string }>("/api/speech/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice_key: voice }),
    });
    playWavBase64(r.audio_base64);
  };

  const goMcq = async () => {
    if (!learnCard) return;
    setLearnBusy(true);
    setMcqFeedback(null);
    try {
      const r = await fetchVocabMcq(learnCard.id);
      setMcq({ options: r.options, correct_index: r.correct_index });
      setLearnStep("mcq");
    } catch (e) {
      setErr(String(e));
    } finally {
      setLearnBusy(false);
    }
  };

  const pickMcq = (idx: number) => {
    if (!mcq || !learnCard) return;
    if (idx === mcq.correct_index) {
      setMcqFeedback(null);
      setLearnStep("type");
      setTypeAttempt("");
      setTypeFeedback(null);
    } else {
      setMcqFeedback(`Not quite — the gloss for "${learnCard.front}" is: ${learnCard.back.split("\n")[0]}`);
    }
  };

  const submitType = async () => {
    if (!learnCard || !typeAttempt.trim()) return;
    setLearnBusy(true);
    setTypeFeedback(null);
    try {
      const r = await gradeVocabProduction(learnCard.id, typeAttempt.trim());
      if (r.ok) {
        await completeCardIntro(learnCard.id);
        await reloadAll();
      } else {
        setTypeFeedback(r.feedback || `Try again. Expected something like: ${learnCard.front}`);
      }
    } catch (e) {
      setErr(String(e));
    } finally {
      setLearnBusy(false);
    }
  };

  return (
    <div>
      <h2>Vocabulary (SRS)</h2>
      {pub && (
        <p style={{ color: "#9aa3b5", fontSize: "0.9rem" }}>
          Target: {pub.lang_target} — glosses in {pub.lang_ui} — CEFR {pub.cefr_level}
        </p>
      )}
      {err && <p style={{ color: "#f88" }}>{err}</p>}

      <section style={{ marginBottom: "1.5rem" }}>
        <h3>Learn new ({learn.length})</h3>
        <p style={{ color: "#9aa3b5", fontSize: "0.88rem", maxWidth: 640 }}>
          Interactive intro: hear the word, pick the meaning, then type the word. Cards then enter spaced review.
        </p>
        {learnCard && (
          <div
            style={{
              border: "1px solid #2a3142",
              borderRadius: 8,
              padding: "1rem",
              background: "#1a1d26",
              marginTop: "0.75rem",
            }}
          >
            {learnStep === "present" && (
              <>
                <div style={{ fontSize: "1.15rem", marginBottom: "0.5rem" }}>
                  <TargetLangText text={learnCard.front} sentenceContext={learnCard.front} />
                </div>
                {learnCard.hint && (
                  <p style={{ color: "#8ab", fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                    Example:{" "}
                    <TargetLangText text={learnCard.hint} sentenceContext={learnCard.hint} />
                  </p>
                )}
                <p style={{ color: "#9aa3b5", fontSize: "0.85rem", marginBottom: "0.75rem" }}>
                  Meaning ({pub?.lang_ui ?? "your language"}): {learnCard.back.split("\n")[0]}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  <button type="button" disabled={learnBusy} onClick={() => void speak(learnCard.front)}>
                    Play audio
                  </button>
                  <button type="button" disabled={learnBusy} onClick={() => void goMcq()}>
                    Continue to quiz
                  </button>
                </div>
              </>
            )}
            {learnStep === "mcq" && mcq && (
              <>
                <p style={{ marginBottom: "0.5rem" }}>
                  Pick the meaning of:{" "}
                  <strong>
                    <TargetLangText text={learnCard.front} sentenceContext={learnCard.front} />
                  </strong>
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  {mcq.options.map((opt, i) => (
                    <button key={i} type="button" disabled={learnBusy} onClick={() => pickMcq(i)}>
                      {opt}
                    </button>
                  ))}
                </div>
                {mcqFeedback && <p style={{ color: "#f88", marginTop: "0.75rem" }}>{mcqFeedback}</p>}
              </>
            )}
            {learnStep === "type" && learnCard && (
              <>
                <p style={{ marginBottom: "0.5rem" }}>
                  Type the {pub?.lang_target ?? "target"} word for:{" "}
                  <strong>{learnCard.back.split("\n")[0]}</strong>
                </p>
                <input
                  style={{ width: "100%", maxWidth: 400, marginBottom: "0.5rem" }}
                  value={typeAttempt}
                  onChange={(e) => setTypeAttempt(e.target.value)}
                  placeholder="Type here…"
                />
                <button type="button" disabled={learnBusy} onClick={() => void submitType()}>
                  Check
                </button>
                {typeFeedback && <p style={{ color: "#f88", marginTop: "0.75rem" }}>{typeFeedback}</p>}
              </>
            )}
          </div>
        )}
        {!learn.length && <p style={{ color: "#9aa3b5" }}>No new cards waiting for intro.</p>}
      </section>

      <h3>Due for review</h3>
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
          <div style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>
            <TargetLangText text={current.front} sentenceContext={current.front} />
          </div>
          {current.hint && (
            <div style={{ color: "#8ab", marginBottom: "0.5rem" }}>
              Example: <TargetLangText text={current.hint} sentenceContext={current.hint} />
            </div>
          )}
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
        <p>No cards due for review. Finish “Learn new” or generate a deck below.</p>
      )}

      <h3>Generate deck (LLM)</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxWidth: 480 }}>
        <input
          placeholder="Theme (optional, e.g. food, travel)"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
        />
        <label style={{ color: "#9aa3b5", fontSize: "0.9rem" }}>
          Number of words (1–30){" "}
          <input
            type="number"
            min={1}
            max={30}
            value={packCount}
            onChange={(e) => setPackCount(Number(e.target.value) || 8)}
            style={{ width: 80 }}
          />
        </label>
        <label style={{ color: "#9aa3b5", fontSize: "0.9rem" }}>
          <input type="checkbox" checked={replacePack} onChange={(e) => setReplacePack(e.target.checked)} /> Replace
          previous LLM pack in default deck
        </label>
        <button type="button" disabled={packBusy} onClick={() => void runPack()}>
          {packBusy ? "Generating…" : "Generate vocabulary"}
        </button>
      </div>

      <h3 style={{ marginTop: "1.5rem" }}>
        <button
          type="button"
          onClick={() => setManualOpen((o) => !o)}
          style={{ background: "none", border: "none", color: "#8ab", cursor: "pointer", padding: 0 }}
        >
          {manualOpen ? "▼" : "▶"} Advanced: add card manually
        </button>
      </h3>
      {manualOpen && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxWidth: 480 }}>
          <input placeholder="Front (target language)" value={front} onChange={(e) => setFront(e.target.value)} />
          <input placeholder="Back (translation)" value={back} onChange={(e) => setBack(e.target.value)} />
          <button type="button" onClick={() => void addCard()}>
            Add to default deck
          </button>
        </div>
      )}
    </div>
  );
}
