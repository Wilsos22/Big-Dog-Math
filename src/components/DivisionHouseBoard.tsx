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

import { useCallback, useEffect, useMemo, useState } from "react";
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
/** Half the clear space kept around the sign so the arrow never runs through it. */
const SIGN_GAP = 30;

export default function DivisionHouseBoard({ set }: { set?: string | null }) {
  const liveTool = useLiveToolConfig("/division-house");
  const [published, setPublished] = useState<string | null>(null);
  const [linked, setLinked] = useState<string | null>(null);

  useEffect(() => {
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
  const [cheer, setCheer] = useState(0);
  const [visualKey, setVisualKey] = useState(0);

  const problem = problems[Math.min(idx, problems.length - 1)];
  const trace = useMemo(() => buildHouseTrace(problem.dividend, problem.divisor), [problem]);

  const reset = useCallback(() => {
    setStep(0);
    setFilled([]);
    setMissed(null);
    setVisualKey(0);
  }, []);

  const liveToolId = liveTool?.id;
  useEffect(() => {
    if (!liveTool || liveTool.route !== "/division-house") return;
    if (!parseHouseSet(liveTool.config.set).problems.length) return;
    setPublished(liveTool.config.set);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveToolId]);

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
    else setMissed(prompt.hint);
  };

  const clickOp = (op: HouseOp) => {
    if (!prompt || prompt.kind !== "operation") return;
    if (op === prompt.op) advance(prompt);
    else setMissed(prompt.hint);
  };

  const nextProblem = () => {
    setIdx((i) => (i + 1) % problems.length);
    reset();
  };

  const centre = (id: string) => {
    const s = trace.slots.find((x) => x.id === id);
    if (!s) return null;
    return { x: (s.col + 0.5) * CELL, y: (s.rowIndex + 0.5) * ROW };
  };

  const boardW = trace.columns * CELL;
  const boardH = trace.rows * ROW;

  // A line under the number being subtracted, with the difference below it.
  // Drawn as soon as that product is on the board, the way you would rule it
  // off by hand before writing the difference underneath.
  const subtractionRules = trace.slots
    .filter((s) => s.row.startsWith("work") && filledSet.has(s.id))
    .reduce<Record<string, { key: string; left: number; top: number; width: number }>>((acc, s) => {
      const existing = acc[s.row];
      const left = Math.min(existing?.left ?? Infinity, s.col * CELL + 6);
      const right = Math.max((existing ? existing.left + existing.width : 0), (s.col + 1) * CELL - 6);
      acc[s.row] = { key: s.row, left, top: (s.rowIndex + 1) * ROW - 5, width: right - left };
      return acc;
    }, {});
  const subtractionRuleList = Object.values(subtractionRules);
  const houseLeft = trace.houseCol * CELL;
  const houseTop = ROW; // the dividend row

  const done_ = done;
  const vis = activeVisual?.visual;
  const from = vis ? centre(vis.from) : null;
  const to = vis ? centre(vis.to) : null;

  return (
    <div className="dh-root">
      <style>{`
        .dh-root { width:100%; display:grid; gap:18px; }
        .dh-top { display:flex; align-items:flex-end; justify-content:space-between; gap:14px; flex-wrap:wrap; }
        .dh-headline { font-size:clamp(2rem,4.6vw,3rem); font-weight:900; margin:0; line-height:1.05; }
        .dh-count { font-size:0.78rem; font-weight:800; letter-spacing:0.14em; text-transform:uppercase; color:var(--bdb-ink-faint); margin:0 0 4px; }
        .dh-btn { font:inherit; font-weight:800; font-size:0.88rem; min-height:44px; padding:0 17px; border-radius:11px;
          border:1px solid var(--bdb-line); background:var(--bdb-card); color:var(--bdb-ink); cursor:pointer; }
        .dh-btn.go { background:var(--bdb-teal-deep); border-color:var(--bdb-teal-deep); color:#fff; }

        .dh-grid { display:grid; grid-template-columns:minmax(300px,1.5fr) minmax(280px,1fr); gap:26px; align-items:start; }
        @media (max-width:960px) { .dh-grid { grid-template-columns:1fr; } }

        .dh-stage { display:grid; justify-items:center; padding:10px 0 20px; }
        .dh-board { position:relative; }
        .dh-cells { display:grid; position:relative; z-index:1; }
        /* Every cell is a rectangle you can click, whether or not the answer
           uses it - otherwise "where does it go" is "click the only open box". */
        .dh-slot { font:inherit; font-variant-numeric:tabular-nums; display:grid; place-items:center;
          font-size:2.1rem; font-weight:800; color:var(--bdb-ink); background:transparent;
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
        .dh-slot.wrong { animation:dh-shake 320ms ease; border-color:var(--bdb-coral-deep); }
        @keyframes dh-shake { 0%,100% { transform:translateX(0); } 25% { transform:translateX(-5px); } 75% { transform:translateX(5px); } }
        @media (prefers-reduced-motion: reduce) { .dh-slot.land, .dh-slot.wrong { animation:none; } }

        /* the L: vertical down the dividend, bar across its top */
        .dh-l { position:absolute; border-left:5px solid var(--bdb-ink); border-top:5px solid var(--bdb-ink);
          border-top-left-radius:14px; pointer-events:none; z-index:0; }

        /* The sign lands twice: a big one that POPS and fades away, and a
           steady one underneath it that stays between the two numbers. */
        .dh-pop { position:absolute; z-index:4; pointer-events:none; transform:translate(-50%,-50%);
          font-size:5.4rem; font-weight:900; color:var(--bdb-coral-deep);
          animation:dh-burst 780ms cubic-bezier(.2,1.5,.4,1) forwards; }
        @keyframes dh-burst {
          0% { transform:translate(-50%,-50%) scale(0.25) rotate(-22deg); opacity:0; }
          30% { transform:translate(-50%,-50%) scale(1.35) rotate(5deg); opacity:1; }
          55% { transform:translate(-50%,-50%) scale(1.1) rotate(0); opacity:0.9; }
          100% { transform:translate(-50%,-50%) scale(1.9) rotate(0); opacity:0; }
        }
        .dh-vis { position:absolute; z-index:3; pointer-events:none; transform:translate(-50%,-50%);
          font-size:2.5rem; font-weight:900; color:var(--bdb-coral-deep);
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
        @media (prefers-reduced-motion: reduce) { .dh-vis, .dh-link { animation:none; } }

        .dh-ask { display:grid; gap:12px; align-content:start; }
        .dh-round { font-size:0.74rem; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:var(--bdb-ink-faint); }
        .dh-q { font-size:clamp(1.2rem,2.5vw,1.55rem); font-weight:800; margin:0; line-height:1.28; }
        .dh-cycle { display:flex; gap:6px; flex-wrap:wrap; }
        .dh-cyc { display:inline-grid; place-items:center; gap:1px; padding:7px 12px; border-radius:10px;
          border:2px solid var(--bdb-line); background:var(--bdb-card); color:var(--bdb-ink-faint);
          font-size:0.72rem; font-weight:800; letter-spacing:0.04em; text-transform:uppercase; }
        .dh-cyc b { font-size:1.15rem; font-weight:900; }
        .dh-cyc.on { border-color:var(--bdb-green-deep); background:color-mix(in srgb, var(--bdb-green) 15%, var(--bdb-card)); color:var(--bdb-ink); }
        .dh-ops { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; }
        .dh-op { font:inherit; font-weight:800; font-size:1.05rem; min-height:66px; border-radius:13px;
          border:2px solid var(--bdb-line); background:var(--bdb-card); color:var(--bdb-ink); cursor:pointer;
          display:grid; gap:2px; place-items:center; }
        .dh-op:hover { border-color:var(--bdb-teal-deep); }
        .dh-op b { font-size:1.5rem; font-weight:900; color:var(--bdb-brown); }
        .dh-hint { font-size:0.98rem; font-weight:600; line-height:1.4; margin:0; padding:10px 14px;
          border-left:4px solid var(--bdb-coral-deep); color:var(--bdb-ink-soft); }
        .dh-say { font-size:0.98rem; font-weight:700; line-height:1.4; margin:0; padding:10px 14px;
          border-left:4px solid var(--bdb-green-deep); color:var(--bdb-ink); }
        .dh-trail { display:grid; gap:5px; }
        .dh-trail span { font-size:0.85rem; font-weight:700; color:var(--bdb-ink-soft); padding:5px 11px; border-left:3px solid var(--bdb-green-deep); }
        .dh-done { font-size:1.35rem; font-weight:900; color:var(--bdb-green-deep); margin:0; }
        .dh-yes { position:fixed; left:50%; top:20%; transform:translateX(-50%); z-index:90; pointer-events:none;
          font-size:clamp(2.6rem,7vw,5rem); font-weight:900; color:var(--bdb-green-deep);
          animation:dh-yes 950ms ease-out forwards; }
        @keyframes dh-yes { 0% { opacity:0; transform:translateX(-50%) scale(0.5); }
          25% { opacity:1; transform:translateX(-50%) scale(1.1); }
          100% { opacity:0; transform:translateX(-50%) scale(1) translateY(-32px); } }
        @media (prefers-reduced-motion: reduce) { .dh-yes { animation:none; opacity:0; } }
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
        <div className="dh-stage">
          <div className="dh-board" style={{ width: boardW, height: boardH }}>
            <div
              className="dh-l"
              style={{ left: houseLeft, top: houseTop, width: boardW - houseLeft, height: boardH - houseTop }}
            />
            <div
              className="dh-cells"
              style={{
                gridTemplateColumns: `repeat(${trace.columns}, ${CELL}px)`,
                gridTemplateRows: `repeat(${trace.rows}, ${ROW}px)`,
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
                return (
                  <button
                    key={i}
                    className={`dh-slot ${slot?.given ? "given" : ""} ${shown && !slot?.given ? "filled land" : ""} ${isTarget ? "target" : ""}`.replace(/\s+/g, " ").trim()}
                    style={{ gridColumn: col + 1, gridRow: row + 1 }}
                    onClick={() => clickSlot(slot?.id ?? `empty-${row}-${col}`)}
                    disabled={done_}
                    aria-label={shown ? `${slot!.text}` : "empty spot"}
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
              const signAt = stacked
                ? { x: to.x - CELL * 0.62, y: to.y }
                : { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
              const dx = to.x - from.x;
              const dy = to.y - from.y;
              const len = Math.hypot(dx, dy) || 1;
              const ux = dx / len;
              const uy = dy / len;
              // Never let the two segments swallow each other on a short span.
              const lead = Math.min(30, len * 0.3);
              const gap = arrowOnly || stacked ? 0 : Math.min(SIGN_GAP, len * 0.22);
              const start = { x: from.x + ux * lead, y: from.y + uy * lead };
              const end = { x: to.x - ux * (lead + 4), y: to.y - uy * (lead + 4) };
              const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
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

        <div className="dh-ask">
          {done_ ? (
            <>
              <p className="dh-q">Every step is placed.</p>
              <p className="dh-done">
                {trace.headline} = {trace.quotient}{trace.remainder ? ` remainder ${trace.remainder}` : ""}
              </p>
              <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
                <button className="dh-btn go" onClick={reset} type="button">Run it again</button>
                {problems.length > 1 && <button className="dh-btn" onClick={nextProblem} type="button">Next problem</button>}
              </div>
            </>
          ) : prompt ? (
            <>
              <span className="dh-round">Round {prompt.round + 1}</span>
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
              <p className="dh-q">{prompt.ask}</p>
              {prompt.kind === "operation" && (
                <div className="dh-ops">
                  {HOUSE_OPS.map((o) => (
                    <button className="dh-op" key={o.op} onClick={() => clickOp(o.op)} type="button">
                      <b>{o.sign}</b>
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
              {missed && <p className="dh-hint">{missed}</p>}
              {step > 0 && !missed && <p className="dh-say">{trace.prompts[step - 1].say}</p>}
              <div className="dh-trail">
                {trace.prompts.slice(Math.max(0, step - 4), step).map((p) => (
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
