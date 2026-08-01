"use client";

// Order fractions on a number line (0 to 5, a tick every half, positive only).
//
// The student PULLS each card onto the line the way they would slide a card
// across a desk - a tap alone never places one, because the movement is the
// part that teaches where the number lives (same rule as the fraction bars).
// Cards may be mixed numbers, improper fractions, whole numbers, decimals, or
// percents; the set is authored as one string (see lib/fractionOrderSet).
//
// Judging is ORDER first: left to right must read smallest to largest, with
// equivalent cards a tie. Placement only has to land inside PLACEMENT_TOLERANCE
// so a card that is nowhere near right cannot ride a lucky sequence. Nothing
// reveals a true position while a board is wrong - a check that answers itself
// gets used instead of the thinking.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_FRACTION_SET,
  FRACTION_LINE_MAX,
  FRACTION_LINE_MIN,
  FRACTION_LINE_TICK,
  PLACEMENT_TOLERANCE,
  type FractionCard,
  type OrderCheck,
  checkOrder,
  parseFractionRounds,
  serializeFractionRounds,
} from "@/lib/fractionOrderSet";

const SPAN = FRACTION_LINE_MAX - FRACTION_LINE_MIN;
const PROGRESS_KEY = "bdm-fraction-order";
// Lane spacing in pixels between two card centres before the second stacks up a
// row. Cards are a fixed width for this arithmetic; a mixed number is a little
// wider, and the extra breathing room here covers it.
const CARD_GAP = 86;
const LANE_HEIGHT = 62;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function pct(value: number): number {
  return ((value - FRACTION_LINE_MIN) / SPAN) * 100;
}

function tickValues(): number[] {
  const out: number[] = [];
  for (let v = FRACTION_LINE_MIN; v <= FRACTION_LINE_MAX + 1e-9; v += FRACTION_LINE_TICK) {
    out.push(Math.round(v * 2) / 2);
  }
  return out;
}

/** The half marks say what they are - "2 1/2", not a repeated "1/2". */
function halfLabel(v: number): string {
  const whole = Math.floor(v);
  return whole === 0 ? "1/2" : `${whole} 1/2`;
}

/** Where in a set to pick up - a reload mid-set should not send them back to round one. */
function resumeRound(rounds: FractionCard[][]): number {
  try {
    const saved = JSON.parse(window.localStorage.getItem(PROGRESS_KEY) || "null");
    if (saved && saved.sig === serializeFractionRounds(rounds)) {
      return clamp(Math.round(Number(saved.idx) || 0), 0, rounds.length - 1);
    }
  } catch {
    /* storage unavailable - the set still runs, it just starts at round one */
  }
  return 0;
}

function CardFace({ card }: { card: FractionCard }) {
  if (card.kind === "fraction" || card.kind === "mixed") {
    return (
      <>
        {card.kind === "mixed" && <span className="fo-whole">{card.whole}</span>}
        <span className="fo-frac">
          <span className="fo-num">{card.num}</span>
          <span className="fo-den">{card.den}</span>
        </span>
      </>
    );
  }
  return <span className="fo-plain">{card.text}</span>;
}

export default function FractionOrderLine({ set }: { set?: string | null }) {
  const rounds = useMemo(() => {
    const parsed = parseFractionRounds(set);
    return parsed.length ? parsed : parseFractionRounds(DEFAULT_FRACTION_SET);
  }, [set]);
  const signature = useMemo(() => serializeFractionRounds(rounds), [rounds]);

  const [roundIdx, setRoundIdx] = useState(0);
  const [placed, setPlaced] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<OrderCheck | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const cards = rounds[Math.min(roundIdx, rounds.length - 1)] ?? [];

  // A new set (teacher published one, or the student reloaded) starts where this
  // device left off rather than at round one.
  useEffect(() => {
    setRoundIdx(resumeRound(rounds));
    setPlaced({});
    setSelected(null);
    setVerdict(null);
    setNote(null);
  }, [rounds]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PROGRESS_KEY, JSON.stringify({ sig: signature, idx: roundIdx }));
    } catch {
      /* progress just will not survive a reload */
    }
  }, [signature, roundIdx]);

  // ── the line's own geometry ────────────────────────────────────────────────
  // Measured, never assumed: window.innerWidth reports the frame inside an
  // embedded preview and lies under browser zoom, and a hidden tab measures
  // zero - so a zero rect keeps the last good width instead of collapsing every
  // card into one lane.
  const lineRef = useRef<HTMLDivElement | null>(null);
  const [lineW, setLineW] = useState(900);
  useEffect(() => {
    const measure = () => {
      const w = lineRef.current?.getBoundingClientRect().width ?? 0;
      if (w > 0) setLineW(w);
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (lineRef.current && ro) ro.observe(lineRef.current);
    window.addEventListener("resize", measure);
    const retry = window.setInterval(measure, 400);
    window.setTimeout(() => window.clearInterval(retry), 4000);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
      window.clearInterval(retry);
    };
  }, []);

  const positionFromClientX = useCallback((clientX: number): number | null => {
    const rect = lineRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return null;
    const frac = clamp((clientX - rect.left) / rect.width, 0, 1);
    return FRACTION_LINE_MIN + frac * SPAN;
  }, []);

  const place = useCallback((id: string, position: number) => {
    setPlaced((p) => ({ ...p, [id]: position }));
    setSelected(null);
    setVerdict(null);
    setNote(null);
  }, []);

  const takeOff = useCallback((id: string) => {
    setPlaced((p) => {
      const next = { ...p };
      delete next[id];
      return next;
    });
    setSelected(null);
    setVerdict(null);
    setNote(null);
  }, []);

  // ── drag ──────────────────────────────────────────────────────────────────
  // One pointer mechanism for the mouse and a Chromebook finger alike; the
  // window listeners read live state through refs. `zone` is the drop-target id
  // on the element under the pointer.
  const [drag, setDrag] = useState<FractionCard | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const dragRef = useRef<FractionCard | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  // The drop closure is attached once per drag, so it reads the live selection
  // through a ref rather than the value it captured.
  const selectedRef = useRef<string | null>(null);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  const startDrag = (card: FractionCard, e: React.PointerEvent) => {
    e.preventDefault();
    dragRef.current = card;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    setDrag(card);
    setDragPos({ x: e.clientX, y: e.clientY });
    setDragOver(null);
  };

  useEffect(() => {
    if (!drag) return;
    const zoneAt = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      return (el?.closest?.("[data-drop]") as HTMLElement | null)?.dataset.drop ?? null;
    };
    const move = (e: PointerEvent) => {
      setDragPos({ x: e.clientX, y: e.clientY });
      setDragOver(zoneAt(e.clientX, e.clientY));
    };
    const drop = (e: PointerEvent) => {
      const card = dragRef.current;
      const zone = zoneAt(e.clientX, e.clientY);
      const moved = Math.hypot(e.clientX - dragStartRef.current.x, e.clientY - dragStartRef.current.y) > 8;
      if (card) {
        if (!moved) {
          // A tap picks the card up: the next tap on the line sets it down.
          // Never a placement of its own - a card that lands without being
          // carried teaches nothing about where it belongs. This is tested
          // BEFORE the zones because a tray card is sitting inside the tray's
          // own drop zone, which would otherwise swallow every tap on one.
          const next = selectedRef.current === card.id ? null : card.id;
          setSelected(next);
          setNote(next ? "Now tap the line where it belongs." : null);
        } else if (zone === "line") {
          const position = positionFromClientX(e.clientX);
          if (position !== null) place(card.id, position);
        } else if (zone === "tray") {
          takeOff(card.id);
        }
      }
      dragRef.current = null;
      setDrag(null);
      setDragPos(null);
      setDragOver(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", drop);
    window.addEventListener("pointercancel", drop);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", drop);
      window.removeEventListener("pointercancel", drop);
    };
  }, [drag, place, positionFromClientX, takeOff]);

  const onLineClick = (e: React.MouseEvent) => {
    if (!selected) return;
    const position = positionFromClientX(e.clientX);
    if (position !== null) place(selected, position);
  };

  // ── board state ───────────────────────────────────────────────────────────
  const tray = cards.filter((c) => placed[c.id] === undefined);
  const onLine = cards.filter((c) => placed[c.id] !== undefined);
  const allPlaced = tray.length === 0;

  // Lanes: cards whose centres crowd each other stack upward, each keeping a
  // stem down to the exact point it was set on, so a tight set stays readable.
  const lanes = useMemo(() => {
    const sorted = [...onLine].sort((a, b) => (placed[a.id] ?? 0) - (placed[b.id] ?? 0));
    const lastX: number[] = [];
    const out: Record<string, number> = {};
    for (const card of sorted) {
      const x = ((placed[card.id] ?? 0) / SPAN) * lineW;
      let lane = 0;
      while (lane < lastX.length && x - lastX[lane] < CARD_GAP) lane += 1;
      lastX[lane] = x;
      out[card.id] = lane;
    }
    return out;
  }, [onLine, placed, lineW]);
  const laneCount = Math.max(1, ...Object.values(lanes).map((l) => l + 1));

  const runCheck = () => {
    const result = checkOrder(onLine.map((c) => ({ id: c.id, value: c.value, position: placed[c.id] ?? 0 })));
    setVerdict(result);
    setSelected(null);
    setNote(null);
  };

  const startOver = () => {
    setPlaced({});
    setSelected(null);
    setVerdict(null);
    setNote(null);
  };

  const nextRound = () => {
    setRoundIdx((i) => (i + 1) % rounds.length);
    setPlaced({});
    setSelected(null);
    setVerdict(null);
    setNote(null);
  };

  const cardState = (id: string): "" | "good" | "order" | "far" => {
    if (!verdict) return "";
    if (verdict.outOfPlace.includes(id)) return "order";
    if (verdict.farOff.includes(id)) return "far";
    return "good";
  };

  const verdictLine = (() => {
    if (note) return note;
    if (!verdict) {
      return allPlaced
        ? "Every card is on the line. Check the order when you are ready."
        : "Drag each card onto the line where you think it lands.";
    }
    if (verdict.correct) return "Correct - smallest to largest, left to right.";
    if (!verdict.ordered) {
      const n = verdict.outOfPlace.length;
      return `${n === 1 ? "One card is" : `${n} cards are`} out of order. Move ${n === 1 ? "it" : "them"} and check again.`;
    }
    const n = verdict.farOff.length;
    return `The order is right. ${n === 1 ? "One card is" : `${n} cards are`} further than half a unit from where ${n === 1 ? "it lands" : "they land"} - slide ${n === 1 ? "it" : "them"} closer.`;
  })();

  return (
    <div className="fo-root">
      <style>{`
        .fo-root { --fo-gutter:52px; width:100%; display:grid; gap:14px; }
        .fo-head { display:flex; align-items:baseline; justify-content:space-between; gap:14px; flex-wrap:wrap; }
        .fo-round { font-size:0.76rem; font-weight:800; letter-spacing:0.14em; text-transform:uppercase; color:var(--bdb-ink-faint); margin:0; }
        .fo-task { font-size:clamp(1.05rem,2.2vw,1.35rem); font-weight:700; color:var(--bdb-ink); margin:0; }
        .fo-plot { position:relative; padding-inline:var(--fo-gutter); padding-top:10px; }
        .fo-lanes { position:relative; }
        .fo-band { position:relative; height:104px; cursor:crosshair; touch-action:none; }
        .fo-band.over::after { content:""; position:absolute; inset:8px -10px; border-radius:14px; box-shadow:0 0 0 3px color-mix(in srgb, var(--bdb-amber) 78%, transparent); }
        .fo-axis { position:absolute; left:0; right:0; top:34px; height:3px; background:var(--bdb-ink-soft); }
        .fo-cap { position:absolute; top:28px; width:0; height:0; border-top:7px solid transparent; border-bottom:7px solid transparent; }
        .fo-tick { position:absolute; top:34px; transform:translateX(-50%); text-align:center; }
        .fo-tick i { display:block; width:2px; margin:0 auto; background:var(--bdb-line); height:12px; position:relative; top:-4px; }
        .fo-tick.major i { width:3px; height:22px; top:-10px; background:var(--bdb-ink-soft); }
        /* Every label on one baseline: the tick marks are different lengths on
           purpose, and letting that push the words around reads as a mistake. */
        .fo-tick b { position:absolute; top:20px; left:50%; transform:translateX(-50%); white-space:nowrap;
          font-size:1.02rem; font-weight:800; color:var(--bdb-ink); }
        .fo-tick.half b { font-size:0.78rem; font-weight:700; color:var(--bdb-ink-faint); }
        .fo-stem { position:absolute; width:2px; background:color-mix(in srgb, var(--bdb-teal) 60%, transparent); }
        .fo-dot { position:absolute; width:11px; height:11px; border-radius:50%; background:var(--bdb-teal); transform:translate(-50%,-50%); }
        .fo-dot.order { background:var(--bdb-coral-deep); }
        .fo-dot.far { background:var(--bdb-amber); }
        .fo-dot.good { background:var(--bdb-green-deep); }

        .fo-card { position:relative; font:inherit; display:inline-flex; align-items:center; justify-content:center; gap:6px;
          min-width:62px; min-height:50px; padding:6px 13px; border:2px solid var(--bdb-teal-deep); border-radius:11px;
          background:color-mix(in srgb, var(--bdb-teal) 9%, var(--bdb-ground)); color:var(--bdb-ink); cursor:grab; touch-action:none; }
        .fo-card.sel { border-color:var(--bdb-amber); background:color-mix(in srgb, var(--bdb-amber) 20%, var(--bdb-ground)); }
        .fo-card.dragging { opacity:0.4; transform:scale(0.94); }
        .fo-card.good { border-color:var(--bdb-green-deep); background:color-mix(in srgb, var(--bdb-green) 12%, var(--bdb-ground)); }
        .fo-card.order { border-color:var(--bdb-coral-deep); background:color-mix(in srgb, var(--bdb-coral) 12%, var(--bdb-ground)); }
        .fo-card.far { border-color:var(--bdb-amber); background:color-mix(in srgb, var(--bdb-amber) 16%, var(--bdb-ground)); }
        .fo-whole { font-size:1.3rem; font-weight:900; }
        .fo-frac { display:inline-grid; justify-items:center; line-height:1.02; }
        .fo-num { font-size:0.98rem; font-weight:900; padding:0 3px; border-bottom:2px solid currentColor; }
        .fo-den { font-size:0.98rem; font-weight:900; padding-top:1px; }
        .fo-plain { font-size:1.25rem; font-weight:900; }

        .fo-onLine { position:absolute; transform:translateX(-50%); }
        .fo-tray { display:flex; align-items:center; gap:12px; flex-wrap:wrap; min-height:82px; padding:12px var(--fo-gutter);
          border-top:1px dashed var(--bdb-line); }
        .fo-tray.over { border-top-color:var(--bdb-amber); box-shadow:inset 0 3px 0 -1px var(--bdb-amber); }
        .fo-traylbl { font-size:0.72rem; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; color:var(--bdb-ink-faint); }
        .fo-next { animation:fo-pulse 1.8s ease-in-out infinite; }
        @keyframes fo-pulse { 0%,100% { box-shadow:0 0 0 0 color-mix(in srgb, var(--bdb-teal) 55%, transparent); } 50% { box-shadow:0 0 0 7px color-mix(in srgb, var(--bdb-teal) 0%, transparent); } }
        @media (prefers-reduced-motion: reduce) { .fo-next { animation:none; border-color:var(--bdb-amber); } }

        .fo-actions { display:flex; gap:9px; flex-wrap:wrap; }
        .fo-btn { font:inherit; font-weight:800; font-size:0.88rem; min-height:44px; padding:0 17px; border-radius:11px;
          border:1px solid var(--bdb-line); background:var(--bdb-card); color:var(--bdb-ink); cursor:pointer; }
        .fo-btn.go { background:var(--bdb-teal-deep); border-color:var(--bdb-teal-deep); color:#fff; }
        .fo-btn.go:disabled { background:var(--bdb-card); border-color:var(--bdb-line); color:var(--bdb-ink-faint); cursor:default; }
        .fo-note { font-size:1rem; font-weight:700; color:var(--bdb-ink-soft); min-height:1.4em; margin:0; padding-inline:var(--fo-gutter); }
        .fo-note.win { color:var(--bdb-green-deep); }
        .fo-note.miss { color:var(--bdb-coral-deep); }

        .fo-ghost { position:fixed; z-index:80; transform:translate(-50%,-58%); pointer-events:none;
          box-shadow:0 10px 22px rgba(0,0,0,0.22); cursor:grabbing; }
        @media (max-width: 720px) { .fo-root { --fo-gutter:26px; } .fo-tick.half b { display:none; } }
      `}</style>

      <div className="fo-head">
        <div>
          <p className="fo-round">Round {Math.min(roundIdx, rounds.length - 1) + 1} of {rounds.length}</p>
          <p className="fo-task">Put these in order on the line, smallest to largest.</p>
        </div>
        <div className="fo-actions">
          <button className="fo-btn go" onClick={runCheck} disabled={!allPlaced} type="button">Check the order</button>
          <button className="fo-btn" onClick={startOver} type="button">Start over</button>
          {rounds.length > 1 && <button className="fo-btn" onClick={nextRound} type="button">Next set</button>}
        </div>
      </div>

      <div className="fo-plot">
        <div className="fo-lanes" style={{ height: laneCount * LANE_HEIGHT + 12 }}>
          {onLine.map((card) => {
            const position = placed[card.id] ?? 0;
            const lane = lanes[card.id] ?? 0;
            const bottom = lane * LANE_HEIGHT;
            const state = cardState(card.id);
            return (
              <div key={card.id} className="fo-onLine" style={{ left: `${pct(position)}%`, bottom }}>
                <button
                  className={`fo-card ${state} ${selected === card.id ? "sel" : ""} ${drag?.id === card.id ? "dragging" : ""}`.replace(/\s+/g, " ").trim()}
                  draggable={false}
                  aria-label={`${card.text}, placed on the line. Drag to move it.`}
                  onPointerDown={(e) => startDrag(card, e)}
                  type="button"
                >
                  <CardFace card={card} />
                </button>
                <span className="fo-stem" style={{ left: "50%", bottom: -(bottom + 36), height: bottom + 36 }} />
              </div>
            );
          })}
        </div>

        <div
          ref={lineRef}
          className={`fo-band ${dragOver === "line" ? "over" : ""}`.trim()}
          data-drop="line"
          onClick={onLineClick}
        >
          <div className="fo-axis" />
          <span className="fo-cap" style={{ left: -12, borderRight: "12px solid var(--bdb-ink-soft)" }} />
          <span className="fo-cap" style={{ right: -12, borderLeft: "12px solid var(--bdb-ink-soft)" }} />
          {tickValues().map((v) => {
            const major = Number.isInteger(v);
            return (
              <span key={v} className={`fo-tick ${major ? "major" : "half"}`} style={{ left: `${pct(v)}%` }}>
                <i />
                <b>{major ? v : halfLabel(v)}</b>
              </span>
            );
          })}
          {onLine.map((card) => (
            <span
              key={`dot-${card.id}`}
              className={`fo-dot ${cardState(card.id)}`.trim()}
              style={{ left: `${pct(placed[card.id] ?? 0)}%`, top: 35 }}
            />
          ))}
        </div>
      </div>

      <div className={`fo-tray ${dragOver === "tray" ? "over" : ""}`.trim()} data-drop="tray">
        <span className="fo-traylbl">{allPlaced ? "Drag a card back down here to take it off" : "Drag up onto the line"}</span>
        {tray.map((card, i) => (
          <button
            key={card.id}
            className={`fo-card ${selected === card.id ? "sel" : ""} ${drag?.id === card.id ? "dragging" : ""} ${i === 0 && !selected ? "fo-next" : ""}`.replace(/\s+/g, " ").trim()}
            draggable={false}
            aria-label={`${card.text}. Drag it onto the line.`}
            onPointerDown={(e) => startDrag(card, e)}
            type="button"
          >
            <CardFace card={card} />
          </button>
        ))}
      </div>

      <p className={`fo-note ${verdict?.correct ? "win" : verdict && !verdict.correct ? "miss" : ""}`.trim()}>{verdictLine}</p>

      {drag && dragPos && (
        <span className="fo-card fo-ghost" style={{ left: dragPos.x, top: dragPos.y }}>
          <CardFace card={drag} />
        </span>
      )}
    </div>
  );
}
