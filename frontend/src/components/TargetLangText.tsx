import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { fetchGloss } from "../api";
import { usePublicSettings } from "../context/SettingsContext";

type Seg = { text: string; word: boolean };

function segmentText(text: string, locale: string): Seg[] {
  try {
    const seg = new Intl.Segmenter(locale, { granularity: "word" });
    return Array.from(seg.segment(text)).map((s) => ({
      text: s.segment,
      word: Boolean(s.isWordLike),
    }));
  } catch {
    return text.split(/(\s+)/).map((t) => ({
      text: t,
      word: Boolean(t.trim()) && !/^\s+$/.test(t),
    }));
  }
}

export type TargetLangTextProps = {
  text: string;
  /** Full sentence or paragraph for disambiguated glosses */
  sentenceContext?: string;
  localeOverride?: string;
  style?: CSSProperties;
};

type TipState = {
  x: number;
  y: number;
  surface: string;
  glosses: string[];
  pos?: string | null;
  note?: string | null;
  fromDeck?: boolean;
  loading?: boolean;
};

const clientCache = new Map<string, { glosses: string[]; pos?: string | null; note?: string | null; fromDeck?: boolean }>();

function cacheKey(surface: string, sentence: string) {
  return `${surface.toLowerCase()}|${sentence.slice(0, 120)}`;
}

export function TargetLangText({ text, sentenceContext, localeOverride, style }: TargetLangTextProps) {
  const settings = usePublicSettings();
  const locale = localeOverride ?? settings?.lang_target_locale ?? "en";
  const segs = useMemo(() => segmentText(text, locale), [text, locale]);
  const [tip, setTip] = useState<TipState | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentence = sentenceContext ?? text;

  const clearDebounce = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  const hideTipSoon = useCallback(() => {
    clearDebounce();
    debounceRef.current = setTimeout(() => setTip(null), 200);
  }, [clearDebounce]);

  const showGloss = useCallback(
    (surface: string, clientX: number, clientY: number) => {
      if (!surface.trim()) return;
      const key = cacheKey(surface, sentence);
      const hit = clientCache.get(key);
      if (hit) {
        setTip({
          x: clientX,
          y: clientY,
          surface,
          glosses: hit.glosses,
          pos: hit.pos,
          note: hit.note,
          fromDeck: hit.fromDeck,
          loading: false,
        });
        return;
      }
      setTip({
        x: clientX,
        y: clientY,
        surface,
        glosses: [],
        loading: true,
      });
      void fetchGloss(surface, sentence)
        .then((r) => {
          clientCache.set(key, {
            glosses: r.glosses,
            pos: r.pos,
            note: r.note,
            fromDeck: r.from_deck,
          });
          setTip((prev) =>
            prev && prev.surface === surface
              ? {
                  ...prev,
                  glosses: r.glosses,
                  pos: r.pos,
                  note: r.note,
                  fromDeck: r.from_deck,
                  loading: false,
                }
              : prev,
          );
        })
        .catch(() => {
          setTip((prev) =>
            prev && prev.surface === surface
              ? { ...prev, glosses: ["(could not load)"], loading: false }
              : prev,
          );
        });
    },
    [sentence],
  );

  const onWordPointerEnter = useCallback(
    (surface: string, e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      clearDebounce();
      debounceRef.current = setTimeout(() => {
        showGloss(surface, e.clientX, e.clientY);
      }, 400);
    },
    [clearDebounce, showGloss],
  );

  const onWordPointerLeave = useCallback(() => {
    clearDebounce();
    hideTipSoon();
  }, [clearDebounce, hideTipSoon]);

  const onWordPointerDown = useCallback(
    (surface: string, e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      if (longPressRef.current) clearTimeout(longPressRef.current);
      const x = e.clientX;
      const y = e.clientY;
      longPressRef.current = setTimeout(() => {
        showGloss(surface, x, y);
      }, 450);
    },
    [showGloss],
  );

  const onWordPointerUp = useCallback(() => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }, []);

  useEffect(() => () => clearDebounce(), [clearDebounce]);

  return (
    <span style={style}>
      {segs.map((s, i) => {
        if (!s.word) {
          return <span key={i}>{s.text}</span>;
        }
        return (
          <span
            key={i}
            style={{
              cursor: "help",
              textDecoration: "underline dotted",
              textUnderlineOffset: "0.12em",
            }}
            onPointerEnter={(e) => onWordPointerEnter(s.text, e)}
            onPointerLeave={onWordPointerLeave}
            onPointerDown={(e) => onWordPointerDown(s.text, e)}
            onPointerUp={onWordPointerUp}
            onPointerCancel={onWordPointerUp}
          >
            {s.text}
          </span>
        );
      })}
      {tip && (
        <span
          style={{
            position: "fixed",
            left: Math.min(tip.x + 8, typeof window !== "undefined" ? window.innerWidth - 280 : tip.x),
            top: tip.y + 12,
            zIndex: 9999,
            maxWidth: 260,
            padding: "0.45rem 0.55rem",
            background: "#2a3142",
            border: "1px solid #3d4a62",
            borderRadius: 6,
            fontSize: "0.85rem",
            lineHeight: 1.35,
            boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
            pointerEvents: "none",
            color: "#e8eaef",
          }}
        >
          <strong style={{ color: "#9aa3b5" }}>{tip.surface}</strong>
          {tip.loading ? (
            <div style={{ marginTop: 4 }}>…</div>
          ) : (
            <>
              {tip.glosses.length > 0 ? (
                <div style={{ marginTop: 4 }}>{tip.glosses.join(" · ")}</div>
              ) : (
                <div style={{ marginTop: 4, color: "#9aa3b5" }}>No gloss</div>
              )}
              {tip.pos && (
                <div style={{ marginTop: 4, fontSize: "0.78rem", color: "#8ab" }}>{tip.pos}</div>
              )}
              {tip.note && (
                <div style={{ marginTop: 4, fontSize: "0.78rem", color: "#9aa3b5" }}>{tip.note}</div>
              )}
              {tip.fromDeck && (
                <div style={{ marginTop: 4, fontSize: "0.72rem", color: "#6a8" }}>From your deck</div>
              )}
            </>
          )}
        </span>
      )}
    </span>
  );
}
