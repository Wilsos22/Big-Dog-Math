"use client";

// The blank long-division house - click the spot, name the operation.
//
// Steele's ask: "students just have to click where the numbers are located and
// what operation they are doing there". The arithmetic is done for them; what
// they supply is the choreography, because knowing 4 goes into 9 twice is
// useless if you cannot say where the 2 belongs.
//
// The whole house is a grid of EMPTY rectangles, not just the cells the answer
// happens to use - otherwise "where does the answer go?" collapses into "click
// the only open box". Given digits (the dividend and divisor) are printed; every
// other rectangle fills in when the right one is clicked.
//
// Between the two things being operated on, a sign animates in: ÷ when
// dividing, x when multiplying, − when subtracting, and an arrow that travels
// down the column on a bring-down.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_HOUSE_SET,
  HOUSE_OPS,
  buildHouseTrace,
  parseHouseSet,
  serializeHouseSet,
  type HouseOp,
  type HousePrompt,
  type HouseTrace,
} from "@/lib/divisionHouse";
import { LiveToolBanner, useLiveToolConfig } from "./useLiveToolConfig";

const PROGRESS_KEY = "bdm-division-house";
// Spread out on purpose: the sign and its arrow live BETWEEN the place-value
// columns, so the columns have to leave room for them.
const CELL = 104;
const ROW = 96;
/**
 * The board SIZES ITSELF to the space it is given, between these two.
 *
 * At the fixed 104px it rendered as a 520px island inside a full-width iframe
 * on `/teacher/present` - roughly a quarter of a 1920px wall, with an 11.5px
 * step strip - because `.stage-tool` applies no transform or zoom of its own.
 * It also grew off the bottom of a 1366x768 Chromebook on a four-round problem.
 * Both are the same missing thing: nothing ever measured the container.
 */
const CELL_MIN = 54;
const CELL_MAX = 168;
/** Half the clear space kept around the sign so the arrow never runs through it. */
const SIGN_GAP = 30;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * A layout effect on the client, a plain one on the server.
 *
 * It runs BEFORE the browser paints, which is what keeps `?set=` from showing
 * the built-in problems for a frame and then swapping. Reading the query on the
 * server instead would work too, and would make this page server-rendered on
 * every request - the wrong trade for a tool thirty Chromebooks open at once.
 */
const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

export default function DivisionHouseBoard({ set }: { set?: string | null }) {
  const liveTool = useLiveToolConfig("/division-house");
  const [published, setPublished] = useState<string | null>(null);
  const [linked, setLinked] = useState<string | null>(null);

  useBeforePaint(() => {
    const raw = new URLSearchParams(window.location.search).get("set");
    if (raw && parseHouseSet(raw).problems.length) setLinked(raw);
  }, []);

  const source = published ?? linked ?? set ?? "";
  const problems = useMemo(() => {
    const parsed = parseHouseSet(source).problems;
    return parsed.length ? parsed : parseHouseSet(DEFAULT_HOUSE_SET).problems;
  }, [source]);
  const signature = useMemo(() => serializeHouseSet(problems), [problems]);

  const [idx, setIdx] = useState(0);
  const [step, setStep] = useState(0);
  const [filled, setFilled] = useState<string[]>([]);
  const [missed, setMissed] = useState<string | null>(null);
  /** The spot they just got wrong, with a nonce so the shake replays. */
  const [wrongSlot, setWrongSlot] = useState<{ id: string; n: number } | null>(null);
  const [cheer, setCheer] = useState(0);
  const [visualKey, setVisualKey] = useState(0);
  const [wrapped, setWrapped] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef<HTMLButtonElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  const problem = problems[Math.min(idx, problems.length - 1)];
  const trace = useMemo(() => buildHouseTrace(problem.dividend, problem.divisor), [problem]);

  const reset = useCallback(() => {
    setStep(0);
    setFilled([]);
    setMissed(null);
    setWrongSlot(null);
    setWrapped(false);
    setVisualKey(0);
  }, []);

  const liveToolId = liveTool?.id;
  useEffect(() => {
    // An UNPUBLISH has to release the set, or students keep working the old one
    // until they happen to reload.
    if (!liveTool || liveTool.route !== "/division-house") {
      setPublished(null);
      return;
    }
    if (!parseHouseSet(liveTool.config.set).problems.length) return;
    setPublished(liveTool.config.set);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveToolId]);

  // Measure the space the board has been given. NEVER window.innerWidth - it
  // reports the frame rather than the stage inside an iframe or a preview pane,
  // and a zero rect has to heal itself rather than freeze the board at 1x.
  useBeforePaint(() => {
    const el = stageRef.current;
    if (!el) return;
    let alive = true;
    const measure = () => {
      if (!alive || !stageRef.current) return;
      const rect = stageRef.current.getBoundingClientRect();
      const w = stageRef.current.clientWidth;
      const h = Math.max(360, window.innerHeight - rect.top - 28);
      if (w > 0) setBox((b) => (b.w === w && b.h === h ? b : { w, h }));
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener("resize", measure);
    // A first paint inside a hidden tab or an iframe still settling measures
    // zero; keep asking until it does not.
    const retry = window.setInterval(measure, 400);
    const stop = window.setTimeout(() => window.clearInterval(retry), 4000);
    return () => {
      alive = false;
      ro?.disconnect();
      window.removeEventListener("resize", measure);
      window.clearInterval(retry);
      window.clearTimeout(stop);
    };
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(PROGRESS_KEY) || "null");
      if (saved && saved.sig === signature) setIdx(Math.max(0, Math.min(problems.length - 1, Number(saved.idx) || 0)));
      else setIdx(0);
    } catch { setIdx(0); }
    reset();
  }, [signature, problems.length, reset]);

  useEffect(() => {
    try { window.localStorage.setItem(PROGRESS_KEY, JSON.stringify({ sig: signature, idx })); }
    catch { /* progress just will not survive a reload */ }
  }, [signature, idx]);

  // Keep the spot the student has to click on screen. Even sized to fit, a
  // short window plus a four-round problem can push the last round below the
  // fold, and the amber pulse is the only thing telling them where to tap.
  useEffect(() => {
    targetRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [step]);

  if (!trace) return <p style={{ padding: 24, fontWeight: 700 }}>That problem cannot be drawn in the house.</p>;

  const prompt: HousePrompt | undefined = trace.prompts[step];
  const done = step >= trace.prompts.length;
  const filledSet = new Set(filled);
  // The sign stays up while the round it belongs to is still running, and
  // clears at the end - a connector left hanging over a finished board reads
  // as a stray mark.
  const activeVisual = done
    ? undefined
    : trace.prompts
      .slice(0, step)
      .reverse()
      .find((p) => p.visual && p.round === (trace.prompts[Math.max(0, step - 1)]?.round ?? 0));

  const advance = (p: HousePrompt) => {
    setFilled((f) => [...f, ...p.fill]);
    setMissed(null);
    setCheer((c) => c + 1);
    if (p.visual) setVisualKey((v) => v + 1);
    setStep((s) => s + 1);
  };

  const clickSlot = (id: string) => {
    if (!prompt || prompt.kind !== "slot") return;
    // Any digit of the number counts - "16" is one number in two cells.
    if (prompt.slots?.includes(id)) advance(prompt);
    else {
      setMissed(prompt.hint);
      // The only answer to a miss used to be a paragraph in the right-hand
      // rail, which on the single-column breakpoint sits BELOW a board taller
      // than the screen. A 6th grader taps, sees nothing, and taps harder.
      setWrongSlot((w) => ({ id, n: (w?.n ?? 0) + 1 }));
    }
  };

  const clickOp = (op: HouseOp) => {
    if (!prompt || prompt.kind !== "operation") return;
    if (op === prompt.op) advance(prompt);
    else setMissed(prompt.hint);
  };

  const nextProblem = () => {
    const last = Math.min(idx, problems.length - 1) === problems.length - 1;
    setIdx((i) => (i + 1) % problems.length);
    reset();
    // After reset, which clears it - so Start over does not resurrect the note.
    setWrapped(last && problems.length > 1);
  };

  // How big one cell gets: as wide as the space allows, but never so tall that
  // the last round falls off the bottom.
  const cellPx = (() => {
    if (!box.w) return CELL;
    const byWidth = box.w / trace.columns;
    const byHeight = (box.h / trace.rows) * (CELL / ROW);
    return Math.round(clamp(Math.min(byWidth, byHeight), CELL_MIN, CELL_MAX));
  })();
  const rowPx = Math.round(cellPx * (ROW / CELL));
  // Text on the rail rides the same scale, floored so it never gets smaller
  // than it already was and capped so it does not run away on a projector.
  const k = clamp(cellPx / CELL, 1, 1.7);

  const centre = (id: string) => {
    const s = trace.slots.find((x) => x.id === id);
    if (!s) return null;
    return { x: (s.col + 0.5) * cellPx, y: (s.rowIndex + 0.5) * rowPx };
  };

  const boardW = trace.columns * cellPx;
  const boardH = trace.rows * rowPx;
  /** The cell the scroll keeper follows - the first spot the prompt names. */
  const firstTargetId = prompt?.kind === "slot" ? prompt.slots?.[0] : undefined;
  /** The clear column between the divisor and the bracket - where the signs live. */
  const gutterX = (trace.houseCol - 0.5) * cellPx;

  // A line under the number being subtracted, with the difference below it.
  // Drawn as soon as that product is on the board, the way you would rule it
  // off by hand before writing the difference underneath.
  // The rule has to span the NUMBER BEING TAKEN AWAY FROM as well as the
  // product. Built from the work slots alone, 618/3 round 1 underlined one
  // column while the number above it spanned two.
  const partialColsFor = (round: number): number[] => {
    const ids = trace.prompts.find((p) => p.id === `pick-partial-${round}`)?.slots ?? [];
    return ids
      .map((id) => trace.slots.find((s) => s.id === id)?.col)
      .filter((c): c is number => typeof c === "number");
  };
  const subtractionRules = trace.slots
    .filter((s) => s.row.startsWith("work") && filledSet.has(s.id))
    .reduce<Record<string, { key: string; left: number; top: number; width: number }>>((acc, s) => {
      const round = Number(s.row.slice("work".length));
      const cols = [s.col, ...partialColsFor(round)];
      const existing = acc[s.row];
      const left = Math.min(existing?.left ?? Infinity, ...cols.map((c) => c * cellPx + 6));
      const right = Math.max(
        existing ? existing.left + existing.width : 0,
        ...cols.map((c) => (c + 1) * cellPx - 6),
      );
      acc[s.row] = { key: s.row, left, top: (s.rowIndex + 1) * rowPx - 5, width: right - left };
      return acc;
    }, {});
  const subtractionRuleList = Object.values(subtractionRules);
  const houseLeft = trace.houseCol * cellPx;
  const houseTop = rowPx; // the dividend row

  const done_ = done;
  const vis = activeVisual?.visual;
  const from = vis ? centre(vis.from) : null;
  const to = vis ? centre(vis.to) : null;

  return (
    <div className="dh-root" style={{ ["--dh-k" as string]: k }}>
      <style>{`
        .dh-root { width:100%; display:grid; gap:18px; }
        .dh-top { display:flex; align-items:flex-end; justify-content:space-between; gap:14px; flex-wrap:wrap; }
        .dh-headline { font-size:clamp(2rem,4.6vw,3rem); font-weight:900; margin:0; line-height:1.05; }
        .dh-count { font-size:0.78rem; font-weight:800; letter-spacing:0.14em; text-transform:uppercase; color:var(--bdb-ink-faint); margin:0 0 4px; }
        .dh-btn { font:inherit; font-weight:800; font-size:0.88rem; min-height:44px; padding:0 17px; border-radius:11px;
          border:1px solid var(--bdb-line); background:var(--bdb-card); color:var(--bdb-ink); cursor:pointer; }
        .dh-btn.go { background:var(--bdb-teal-deep); border-color:var(--bdb-teal-deep); color:var(--bdb-card); }
        .dh-btn:focus-visible, .dh-slot:focus-visible, .dh-op:focus-visible {
          outline:3px solid var(--bdb-brown); outline-offset:2px; }

        .dh-grid { display:grid; grid-template-columns:minmax(300px,1.5fr) minmax(280px,1fr); gap:26px; align-items:start; }
        @media (max-width:960px) { .dh-grid { grid-template-columns:1fr; } }

        .dh-stage { display:grid; justify-items:center; padding:10px 0 20px; min-width:0; }
        .dh-board { position:relative; }
        .dh-cells { display:grid; position:relative; z-index:1; }
        /* Every cell is a rectangle you can click, whether or not the answer
           uses it - otherwise "where does it go" is "click the only open box". */
        .dh-slot { font:inherit; font-variant-numeric:tabular-nums; display:grid; place-items:center;
          font-size:calc(2.1rem * var(--dh-k)); font-weight:800; color:var(--bdb-ink); background:transparent;
          border:2px dashed color-mix(in srgb, var(--bdb-ink-faint) 42%, transparent); border-radius:10px;
          margin:4px; cursor:pointer; transition:background 130ms ease, border-color 130ms ease, transform 130ms ease; }
        .dh-slot:hover { border-color:var(--bdb-teal-deep); background:color-mix(in srgb, var(--bdb-teal) 10%, transparent); }
        .dh-slot.given { border-style:solid; border-color:transparent; cursor:pointer; }
        /* A spot the student placed STAYS green, so the board becomes a record
           of the reps they have just done rather than resetting to plain ink. */
        .dh-slot.filled { border-style:solid; border-color:var(--bdb-green-deep);
          background:color-mix(in srgb, var(--bdb-green) 17%, transparent); color:var(--bdb-green-deep); }
        .dh-slot.land { animation:dh-land 420ms cubic-bezier(.2,1.6,.4,1); }
        @keyframes dh-land { 0% { transform:scale(0.4); opacity:0; } 60% { transform:scale(1.15); } 100% { transform:scale(1); opacity:1; } }
        /* The spot the next number goes into pulses (Steele's ask). This is a
           choreography trainer, so showing WHERE while still asking WHICH
           OPERATION is the point - the naming stays a real decision. */
        .dh-slot.target { border-style:solid; border-color:var(--bdb-amber);
          animation:dh-target 1.15s ease-in-out infinite; }
        @keyframes dh-target {
          0%,100% { background:color-mix(in srgb, var(--bdb-amber) 12%, transparent); box-shadow:0 0 0 0 color-mix(in srgb, var(--bdb-amber) 60%, transparent); }
          50% { background:color-mix(in srgb, var(--bdb-amber) 32%, transparent); box-shadow:0 0 0 8px color-mix(in srgb, var(--bdb-amber) 0%, transparent); }
        }
        @media (prefers-reduced-motion: reduce) { .dh-slot.target { animation:none; background:color-mix(in srgb, var(--bdb-amber) 30%, transparent); } }
        .dh-slot.wrong { border-color:var(--bdb-coral-deep);
          background:color-mix(in srgb, var(--bdb-coral) 16%, transparent); }
        .dh-slot.wrong-a { animation:dh-shake 320ms ease; }
        .dh-slot.wrong-b { animation:dh-shake-b 320ms ease; }
        @keyframes dh-shake { 0%,100% { transform:translateX(0); } 25% { transform:translateX(-5px); } 75% { transform:translateX(5px); } }
        @keyframes dh-shake-b { 0%,100% { transform:translateX(0); } 25% { transform:translateX(-5px); } 75% { transform:translateX(5px); } }
        .dh-slot:active { transform:scale(0.94); }
        @media (prefers-reduced-motion: reduce) {
          .dh-slot.land, .dh-slot.wrong { animation:none; }
          .dh-slot:active { transform:none; }
        }

        /* the L: vertical down the dividend, bar across its top */
        .dh-l { position:absolute; border-left:5px solid var(--bdb-ink); border-top:5px solid var(--bdb-ink);
          border-top-left-radius:14px; pointer-events:none; z-index:0; }

        /* The sign lands twice: a big one that POPS and fades away, and a
           steady one underneath it that stays between the two numbers. */
        /* The burst is sized off the cell, and its top scale is held down so it
           never spills out of the one-column gutter it lives in. */
        .dh-pop { position:absolute; z-index:4; pointer-events:none; transform:translate(-50%,-50%);
          font-size:calc(3.6rem * var(--dh-k)); font-weight:900; color:var(--bdb-coral-deep);
          animation:dh-burst 780ms cubic-bezier(.2,1.5,.4,1) forwards; }
        @keyframes dh-burst {
          0% { transform:translate(-50%,-50%) scale(0.25) rotate(-22deg); opacity:0; }
          30% { transform:translate(-50%,-50%) scale(1.25) rotate(5deg); opacity:1; }
          55% { transform:translate(-50%,-50%) scale(1.05) rotate(0); opacity:0.9; }
          100% { transform:translate(-50%,-50%) scale(1.5) rotate(0); opacity:0; }
        }
        .dh-vis { position:absolute; z-index:3; pointer-events:none; transform:translate(-50%,-50%);
          font-size:calc(2.2rem * var(--dh-k)); font-weight:900; color:var(--bdb-coral-deep);
          animation:dh-settle 780ms ease-out; }
        @keyframes dh-settle { 0%,45% { opacity:0; } 100% { opacity:1; } }
        @media (prefers-reduced-motion: reduce) { .dh-pop { display:none; } .dh-vis { animation:none; } }
        /* The rule under the number being subtracted; the difference goes below it. */
        .dh-subrule { position:absolute; z-index:2; height:4px; border-radius:2px;
          background:var(--bdb-ink); animation:dh-rule 300ms ease-out; transform-origin:left center; }
        @keyframes dh-rule { from { transform:scaleX(0); } to { transform:scaleX(1); } }
        .dh-link { position:absolute; z-index:2; pointer-events:none; stroke:var(--bdb-coral-deep);
          stroke-width:3; stroke-dasharray:7 6; fill:none; animation:dh-draw 460ms ease-out; }
        @keyframes dh-draw { from { opacity:0; } to { opacity:1; } }
        @media (prefers-reduced-motion: reduce) {
          .dh-vis, .dh-link { animation:none; }
          /* The rule was still sweeping in under reduce - it had no override. */
          .dh-subrule { animation:none; transform:scaleX(1); }
        }

        .dh-ask { display:grid; gap:12px; align-content:start; }
        .dh-round { font-size:calc(0.86rem * var(--dh-k)); font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:var(--bdb-ink-soft); }
        .dh-q { font-size:calc(clamp(1.2rem,2.5vw,1.55rem) * var(--dh-k)); font-weight:800; margin:0; line-height:1.28; }
        .dh-cycle { display:flex; gap:6px; flex-wrap:wrap; }
        .dh-cyc { display:inline-grid; place-items:center; gap:1px; padding:7px 12px; border-radius:10px;
          border:2px solid var(--bdb-line); background:var(--bdb-card); color:var(--bdb-ink-soft);
          font-size:calc(0.8rem * var(--dh-k)); font-weight:800; letter-spacing:0.04em; text-transform:uppercase; }
        .dh-cyc b { font-size:calc(1.3rem * var(--dh-k)); font-weight:900; }
        .dh-cyc.on { border-color:var(--bdb-green-deep); background:color-mix(in srgb, var(--bdb-green) 15%, var(--bdb-card)); color:var(--bdb-ink); }
        .dh-ops { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; }
        .dh-op { font:inherit; font-weight:800; font-size:calc(1.05rem * var(--dh-k)); min-height:66px; border-radius:13px;
          border:2px solid var(--bdb-line); background:var(--bdb-card); color:var(--bdb-ink); cursor:pointer;
          display:grid; gap:2px; place-items:center; transition:transform 110ms ease, border-color 110ms ease; }
        .dh-op:hover { border-color:var(--bdb-teal-deep); }
        /* A tap on a Chromebook or an iPad never fires :hover, so without this
           pressing a button gave no feedback at all. */
        .dh-op:active { transform:scale(0.96); border-color:var(--bdb-teal-deep);
          background:color-mix(in srgb, var(--bdb-teal) 12%, var(--bdb-card)); }
        .dh-op b { font-size:calc(1.5rem * var(--dh-k)); font-weight:900; color:var(--bdb-brown); }
        .dh-hint { font-size:calc(1rem * var(--dh-k)); font-weight:600; line-height:1.4; margin:0; padding:10px 14px;
          border-left:4px solid var(--bdb-coral-deep); color:var(--bdb-ink-soft); }
        .dh-say { font-size:calc(1rem * var(--dh-k)); font-weight:700; line-height:1.4; margin:0; padding:10px 14px;
          border-left:4px solid var(--bdb-green-deep); color:var(--bdb-ink); }
        .dh-trail { display:grid; gap:5px; }
        .dh-trail span { font-size:calc(0.9rem * var(--dh-k)); font-weight:700; color:var(--bdb-ink-soft); padding:5px 11px; border-left:3px solid var(--bdb-green-deep); }
        .dh-done { font-size:calc(1.35rem * var(--dh-k)); font-weight:900; color:var(--bdb-green-deep); margin:0; }
        .dh-yes { position:fixed; left:50%; top:20%; transform:translateX(-50%); z-index:90; pointer-events:none;
          font-size:clamp(2.6rem,7vw,5rem); font-weight:900; color:var(--bdb-green-deep);
          animation:dh-yes 950ms ease-out forwards; }
        @keyframes dh-yes { 0% { opacity:0; transform:translateX(-50%) scale(0.5); }
          25% { opacity:1; transform:translateX(-50%) scale(1.1); }
          100% { opacity:0; transform:translateX(-50%) scale(1) translateY(-32px); } }
        /* Under reduce this was animation:none; opacity:0 - which took the "Yes!"
           away entirely rather than giving a still one. A pure opacity fade is
           not the motion the preference is about. */
        @keyframes dh-yes-quiet { 0%,70% { opacity:1; } 100% { opacity:0; } }
        @media (prefers-reduced-motion: reduce) {
          .dh-yes { animation:dh-yes-quiet 1100ms ease-out forwards; transform:translateX(-50%); }
        }
      `}</style>

      <LiveToolBanner tool={liveTool} />

      <div className="dh-top">
        <div>
          <p className="dh-count">Problem {Math.min(idx, problems.length - 1) + 1} of {problems.length}</p>
          <h2 className="dh-headline">
            {trace.headline}
            {done_ ? ` = ${trace.quotient}${trace.remainder ? ` r${trace.remainder}` : ""}` : ""}
          </h2>
        </div>
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          <button className="dh-btn" onClick={reset} type="button">Start over</button>
          {problems.length > 1 && <button className="dh-btn" onClick={nextProblem} type="button">Next problem</button>}
        </div>
      </div>

      <div className="dh-grid">
        <div className="dh-stage" ref={stageRef}>
          <div className="dh-board" style={{ width: boardW, height: boardH }}>
            <div
              className="dh-l"
              style={{ left: houseLeft, top: houseTop, width: boardW - houseLeft, height: boardH - houseTop }}
            />
            <div
              className="dh-cells"
              style={{
                gridTemplateColumns: `repeat(${trace.columns}, ${cellPx}px)`,
                gridTemplateRows: `repeat(${trace.rows}, ${rowPx}px)`,
              }}
            >
              {Array.from({ length: trace.rows * trace.columns }, (_, i) => {
                const row = Math.floor(i / trace.columns);
                const col = i % trace.columns;
                const slot = trace.slots.find((s) => s.rowIndex === row && s.col === col);
                // Only the inside of the house is a spot. The columns left of
                // the bracket hold nothing but the divisor - there is no such
                // thing as a number above or below it - so they are not drawn
                // as click targets at all.
                if (col < trace.houseCol && slot?.row !== "divisor") {
                  return <span key={i} style={{ gridColumn: col + 1, gridRow: row + 1 }} />;
                }
                const shown = slot && (slot.given || filledSet.has(slot.id));
                const isTarget = Boolean(prompt?.kind === "slot" && slot && prompt.slots?.includes(slot.id));
                const id = slot?.id ?? `empty-${row}-${col}`;
                // Two alternating animation names replay the shake on a repeat
                // miss. Remounting the button would do it too, and would throw
                // keyboard focus back to the body every time.
                const wrongCls = wrongSlot?.id === id ? (wrongSlot.n % 2 ? "wrong wrong-b" : "wrong wrong-a") : "";
                const place = `row ${row + 1}, column ${col + 1}`;
                return (
                  <button
                    key={i}
                    ref={slot && slot.id === firstTargetId ? targetRef : undefined}
                    className={`dh-slot ${slot?.given ? "given" : ""} ${shown && !slot?.given ? "filled land" : ""} ${isTarget ? "target" : ""} ${wrongCls}`.replace(/\s+/g, " ").trim()}
                    style={{ gridColumn: col + 1, gridRow: row + 1 }}
                    onClick={() => clickSlot(id)}
                    disabled={done_}
                    // Up to sixty buttons used to share "empty spot", which told
                    // a screen reader nothing about where any of them were.
                    aria-label={shown ? `${slot!.text} at ${place}` : `empty spot at ${place}`}
                    data-target={isTarget ? "1" : undefined}
                    type="button"
                  >
                    {shown ? slot!.text : ""}
                  </button>
                );
              })}
            </div>

            {/* The line under the number being subtracted, with the difference
                below it - drawn as soon as that product is on the board. */}
            {subtractionRuleList.map((r) => (
              <span
                key={r.key}
                className="dh-subrule"
                style={{ left: r.left, top: r.top, width: r.width }}
              />
            ))}

            {vis && from && to && (() => {
              // Where the sign sits depends on the sign, because that is how
              // each one is written by hand:
              //   ÷ and x  BETWEEN the two numbers, arrow split around it
              //   −        to the LEFT of the number being taken away
              //   ↓        no glyph at all - the arrow IS the notation
              const stacked = vis.sign === "−";
              const arrowOnly = vis.sign === "↓";
              const dx = to.x - from.x;
              const dy = to.y - from.y;
              const len = Math.hypot(dx, dy) || 1;
              const ux = dx / len;
              const uy = dy / len;
              // ÷ AND x LIVE IN THE GUTTER COLUMN, ALWAYS.
              //
              // The raw midpoint of the diagonal walks right one cell per round,
              // so by round three the multiply sign sat INSIDE the house on top
              // of the bracket and the first dividend digit. The gutter is one
              // column wide and it is where these signs belong, so the x is
              // pinned there and only the y follows the line.
              const t = Math.abs(dx) > 1 ? clamp((gutterX - from.x) / dx, 0.12, 0.88) : 0.5;
              const onLine = { x: from.x + dx * t, y: from.y + dy * t };
              const signAt = stacked
                ? { x: to.x - cellPx * 0.62, y: to.y }
                : { x: gutterX, y: onLine.y };
              // Never let the two segments swallow each other on a short span.
              const lead = Math.min(30, len * 0.3);
              const gap = arrowOnly || stacked ? 0 : Math.min(SIGN_GAP, len * 0.22);
              const start = { x: from.x + ux * lead, y: from.y + uy * lead };
              const end = { x: to.x - ux * (lead + 4), y: to.y - uy * (lead + 4) };
              // The break in the arrow follows the sign, not the geometry, or
              // the line runs straight through the glyph.
              const mid = onLine;
              return (
                <span key={`vis-${visualKey}`}>
                  {!stacked && (
                    <svg className="dh-link" width={boardW} height={boardH} style={{ left: 0, top: 0, position: "absolute" }} aria-hidden="true">
                      <defs>
                        <marker id="dh-head" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
                          <path d="M0,0 L6,3.5 L0,7 Z" fill="var(--bdb-coral-deep)" stroke="none" />
                        </marker>
                      </defs>
                      {gap > 0 ? (
                        <>
                          <path d={`M ${start.x} ${start.y} L ${mid.x - ux * gap} ${mid.y - uy * gap}`} />
                          <path d={`M ${mid.x + ux * gap} ${mid.y + uy * gap} L ${end.x} ${end.y}`} markerEnd="url(#dh-head)" />
                        </>
                      ) : (
                        <path d={`M ${start.x} ${start.y} L ${end.x} ${end.y}`} markerEnd="url(#dh-head)" />
                      )}
                    </svg>
                  )}
                  {!arrowOnly && (
                    <>
                      {/* Pops big and fades away ... */}
                      <span className="dh-pop" style={{ left: signAt.x, top: signAt.y }}>{vis.sign}</span>
                      {/* ... while this one stays. */}
                      <span className="dh-vis" style={{ left: signAt.x, top: signAt.y }}>{vis.sign}</span>
                    </>
                  )}
                </span>
              );
            })()}
          </div>
        </div>

        {/* The question and the two feedback lines announce themselves. The
            whole column would announce the step strip and the trail with them,
            which is a paragraph of speech on every tap. */}
        <div className="dh-ask">
          {done_ ? (
            <>
              <p className="dh-q">Every step is placed.</p>
              <p className="dh-done">
                {trace.headline} = {trace.quotient}{trace.remainder ? ` remainder ${trace.remainder}` : ""}
              </p>
              {/* Finishing the last problem used to loop silently back to the
                  first, so a student had no way to tell they were done. */}
              {Math.min(idx, problems.length - 1) === problems.length - 1 && problems.length > 1 && (
                <p className="dh-say">That was the last problem in the set. Next problem starts the set over.</p>
              )}
              <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
                <button className="dh-btn go" onClick={reset} type="button">Run it again</button>
                {problems.length > 1 && <button className="dh-btn" onClick={nextProblem} type="button">Next problem</button>}
              </div>
            </>
          ) : prompt ? (
            <>
              <span className="dh-round">
                Round {prompt.round + 1}
                {wrapped && step === 0 ? " - back at the start of the set" : ""}
              </span>
              {/* The cycle, building up as they go. Steele: "I just want them to
                  start to remember what the sequence is" - so the steps they
                  have already named stay lit, and the one coming next does NOT
                  light early, or the question answers itself. */}
              <div className="dh-cycle">
                {HOUSE_OPS.map((o) => {
                  const taken = trace.prompts
                    .slice(0, step)
                    .some((p) => p.kind === "operation" && p.op === o.op && p.round === prompt.round);
                  return (
                    <span key={o.op} className={`dh-cyc ${taken ? "on" : ""}`.trim()}>
                      <b>{o.sign}</b>
                      {o.label}
                    </span>
                  );
                })}
              </div>
              <p className="dh-q" aria-live="polite">{prompt.ask}</p>
              {prompt.kind === "operation" && (
                <div className="dh-ops">
                  {/* Seated by the engine. In fixed cycle order "tap the
                      leftmost unlit chip" answered every one of these without
                      reading it; the STRIP above stays in cycle order, because
                      that is the sequence being learned. */}
                  {(prompt.options ?? HOUSE_OPS.map((o) => o.op)).map((op) => {
                    const o = HOUSE_OPS.find((x) => x.op === op)!;
                    return (
                      <button className="dh-op" key={o.op} onClick={() => clickOp(o.op)} type="button">
                        <b>{o.sign}</b>
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              )}
              {missed && <p className="dh-hint" role="alert">{missed}</p>}
              {step > 0 && !missed && <p className="dh-say" aria-live="polite">{trace.prompts[step - 1].say}</p>}
              {/* The green line above IS prompt[step - 1], so the trail starts
                  before it - otherwise the same sentence is stacked twice. */}
              <div className="dh-trail">
                {trace.prompts.slice(Math.max(0, step - 5), Math.max(0, step - 1)).map((p) => (
                  <span key={p.id}>{p.say}</span>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {cheer > 0 && <span className="dh-yes" key={cheer}>Yes!</span>}
    </div>
  );
}
