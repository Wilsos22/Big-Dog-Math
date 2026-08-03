"use client";

// Decimals, step by step - all four operations, one decision at a time.
//
// Every step is a multiple-choice "what do we do next?", and the board only
// moves once the choice is right. The digits being worked on light up as the
// question is asked, so the words and the numbers point at the same thing.
//
// Two modes, both one step at a time (Steele's ask). TEACHER LED is for the
// front of the room: bigger type, and a Show button so the question can be
// posed, hands taken, and then revealed. STUDENT has no reveal - a wrong pick
// says why it is wrong and the step stays put.
//
// Division is the one that carries an extra demand: having answered how many
// places the decimal moves, the student has to actually MOVE it that many
// times, on the divisor and then on the dividend. Naming the number is not the
// same as doing it, and moving only the divisor is the error it catches. The
// divide / multiply / subtract / bring down steps still run down the side rail.
//
// The engine (lib/decimalSteps) owns the arithmetic and the questions; this
// file is the board, the rail, and the decimal-moving interaction.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_DECIMAL_SET,
  buildDecimalTrace,
  parseDecimalSet,
  serializeDecimalSet,
  trimTrailingZeros,
  type DecCell,
  type DecStep,
  type DecimalRow,
  type DecimalTrace,
} from "@/lib/decimalSteps";
import { LiveToolBanner, useLiveToolConfig } from "./useLiveToolConfig";

type Mode = "teacher" | "student";
const PROGRESS_KEY = "bdm-decimal-steps";
const MODE_KEY = "bdm-decimal-steps-mode";

interface Ledger {
  rail: string;
  say: string;
}

function opSign(op: string): string {
  if (op === "+") return "+";
  if (op === "-") return "−";
  if (op === "x") return "×";
  return "÷";
}

/** Where in a set to pick up, so a reload mid-set does not restart it. */
function resumeIndex(sig: string, count: number): number {
  try {
    const saved = JSON.parse(window.localStorage.getItem(PROGRESS_KEY) || "null");
    if (saved && saved.sig === sig) return Math.max(0, Math.min(count - 1, Math.round(Number(saved.idx) || 0)));
  } catch {
    /* storage unavailable - the set still runs, it just starts at problem one */
  }
  return 0;
}

export default function DecimalStepsBoard({ set }: { set?: string | null }) {
  const liveTool = useLiveToolConfig("/decimal-steps");
  const [published, setPublished] = useState<string | null>(null);
  const [linked, setLinked] = useState<string | null>(null);

  // A teacher-built series also arrives in the URL (?set=12.4+3.75, 9.6/0.4) so
  // it can be pasted into Notion or handed out for work at home.
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("set");
    if (raw && parseDecimalSet(raw).problems.length) setLinked(raw);
  }, []);

  const source = published ?? linked ?? set ?? "";
  const problems = useMemo(() => {
    const parsed = parseDecimalSet(source).problems;
    return parsed.length ? parsed : parseDecimalSet(DEFAULT_DECIMAL_SET).problems;
  }, [source]);
  const signature = useMemo(() => serializeDecimalSet(problems), [problems]);

  const [idx, setIdx] = useState(0);
  const [mode, setMode] = useState<Mode>("student");
  const [stepIdx, setStepIdx] = useState(0);
  const [wrong, setWrong] = useState<number[]>([]);
  const [solvedStep, setSolvedStep] = useState(false);
  const [revealed, setRevealed] = useState<string[]>([]);
  const [moved, setMoved] = useState(0);
  const [shown, setShown] = useState(false);

  const trace = useMemo(() => buildDecimalTrace(problems[Math.min(idx, problems.length - 1)]), [problems, idx]);

  const resetProblem = useCallback(() => {
    setStepIdx(0);
    setWrong([]);
    setSolvedStep(false);
    setRevealed([]);
    setMoved(0);
    setShown(false);
  }, []);

  // A teacher-published set wins over whatever this device was doing. Keyed on
  // the config id, never the object: useLiveToolConfig re-reads every second,
  // so an object-keyed effect would restart the problem under a student.
  const liveToolId = liveTool?.id;
  useEffect(() => {
    if (!liveTool || liveTool.route !== "/decimal-steps") return;
    if (!parseDecimalSet(liveTool.config.set).problems.length) return;
    setPublished(liveTool.config.set);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveToolId]);

  useEffect(() => {
    setIdx(resumeIndex(signature, problems.length));
    resetProblem();
  }, [signature, problems.length, resetProblem]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PROGRESS_KEY, JSON.stringify({ sig: signature, idx }));
    } catch {
      /* progress just will not survive a reload */
    }
  }, [signature, idx]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(MODE_KEY);
      if (saved === "teacher" || saved === "student") setMode(saved);
    } catch {
      /* the toggle still works, it just will not be remembered */
    }
  }, []);
  const pickMode = (m: Mode) => {
    setMode(m);
    try {
      window.localStorage.setItem(MODE_KEY, m);
    } catch {
      /* ignore */
    }
  };

  if (!trace) {
    return <p style={{ padding: 24, fontWeight: 700 }}>That problem cannot be walked step by step.</p>;
  }

  const step: DecStep | undefined = trace.steps[stepIdx];
  const done = stepIdx >= trace.steps.length;
  // "Move it" is an instruction, not a decision - a one-choice question is a
  // button pretending to be a question, so the interaction opens straight away.
  // Such a step reveals nothing on its own; the move is the whole move.
  const instruction = Boolean(step && step.choices.length === 1 && step.action);
  const solved = solvedStep || instruction;
  const needsMove = Boolean(step?.action) && solved;
  const moveTarget = step?.action?.target;
  const movesLeft = (step?.action?.places ?? 0) - moved;

  const ledger: Ledger[] = trace.steps.slice(0, stepIdx).map((s) => ({ rail: s.rail, say: s.say }));
  const revealedSet = new Set(revealed);
  const highlightSet = new Set(step && !done ? step.highlight : []);

  const pick = (i: number) => {
    if (!step || solvedStep) return;
    if (step.choices[i].correct) {
      setSolvedStep(true);
      setRevealed((r) => [...r, ...step.reveal]);
    } else if (!wrong.includes(i)) {
      setWrong((w) => [...w, i]);
    }
  };

  const advance = () => {
    if (!step) return;
    setStepIdx((s) => s + 1);
    setWrong([]);
    setSolvedStep(false);
    setMoved(0);
    setShown(false);
  };

  const hop = (delta: number) => {
    const places = step?.action?.places ?? 0;
    setMoved((m) => Math.max(0, Math.min(places, m + delta)));
  };

  const nextProblem = () => {
    setIdx((i) => (i + 1) % problems.length);
    resetProblem();
  };

  // Live decimal positions. Only the divisor and the dividend ever move - the
  // quotient's point is already placed in the SHIFTED dividend's columns, so
  // shifting it again would slide it away from the digits it belongs to.
  const markerShift = (row: DecimalRow): number => {
    if (trace.layout !== "house") return 0;
    if (row !== "divisor" && row !== "dividend") return 0;
    const settled = trace.steps.slice(0, stepIdx).some((s) => s.action?.target === row);
    if (settled) return trace.shift;
    if (moveTarget === row && solved) return moved;
    return 0;
  };

  const chosen = step && solvedStep ? step.choices.findIndex((c) => c.correct) : -1;
  const answerTrim = trimTrailingZeros(trace.answerText);

  return (
    <div className={`ds-root ${mode === "teacher" ? "big" : ""}`.trim()}>
      <style>{`
        .ds-root { --ds-cell:44px; --ds-font:1.9rem; width:100%; display:grid; gap:16px; }
        .ds-root.big { --ds-cell:60px; --ds-font:2.7rem; }
        .ds-top { display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; }
        .ds-headline { font-size:clamp(1.5rem,3.4vw,2.2rem); font-weight:800; margin:0; letter-spacing:0.01em; }
        .ds-count { font-size:0.76rem; font-weight:800; letter-spacing:0.14em; text-transform:uppercase; color:var(--bdb-ink-faint); margin:0 0 2px; }
        .ds-seg { display:inline-flex; border:1px solid var(--bdb-line); border-radius:999px; overflow:hidden; }
        .ds-seg button { font:inherit; font-weight:800; font-size:0.84rem; min-height:44px; padding:0 16px; border:none; background:var(--bdb-card); color:var(--bdb-ink-soft); cursor:pointer; }
        .ds-seg button.on { background:var(--bdb-teal-deep); color:#fff; }
        .ds-btn { font:inherit; font-weight:800; font-size:0.88rem; min-height:44px; padding:0 17px; border-radius:11px; border:1px solid var(--bdb-line); background:var(--bdb-card); color:var(--bdb-ink); cursor:pointer; }
        .ds-btn.go { background:var(--bdb-teal-deep); border-color:var(--bdb-teal-deep); color:#fff; }
        .ds-btn:disabled { color:var(--bdb-ink-faint); cursor:default; }

        .ds-grid { display:grid; grid-template-columns:minmax(170px,0.85fr) minmax(320px,1.9fr) minmax(290px,1.15fr); gap:20px; align-items:start; }
        @media (max-width:1040px) { .ds-grid { grid-template-columns:1fr; } .ds-rail { order:3; } .ds-stage { order:1; } .ds-ask { order:2; } }

        /* ── the running steps, on the side ── */
        .ds-rail { display:grid; gap:7px; align-content:start; }
        .ds-raillbl { font-size:0.72rem; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:var(--bdb-ink-faint); }
        .ds-rrow { display:grid; gap:1px; padding:7px 11px; border-left:3px solid var(--bdb-line); }
        .ds-rrow b { font-size:0.82rem; font-weight:800; color:var(--bdb-ink); }
        .ds-rrow span { font-size:0.8rem; font-weight:600; color:var(--bdb-ink-soft); }
        .ds-rrow.now { border-left-color:var(--bdb-amber); animation:ds-pulse 1.9s ease-in-out infinite; }
        .ds-rrow.done { border-left-color:var(--bdb-green-deep); }
        @keyframes ds-pulse { 0%,100% { background:transparent; } 50% { background:color-mix(in srgb, var(--bdb-amber) 14%, transparent); } }
        @media (prefers-reduced-motion: reduce) { .ds-rrow.now { animation:none; background:color-mix(in srgb, var(--bdb-amber) 14%, transparent); } }

        /* ── the board ── */
        .ds-stage { display:grid; gap:10px; justify-items:center; padding:10px 4px; }
        .ds-rows { display:grid; gap:2px; font-variant-numeric:tabular-nums; }
        .ds-row { position:relative; display:grid; grid-auto-flow:column; justify-content:start; }
        .ds-cellrow { display:grid; }
        .ds-cell { width:var(--ds-cell); height:calc(var(--ds-cell) * 1.06); display:grid; place-items:center; font-size:var(--ds-font); font-weight:800; color:var(--bdb-ink); border-radius:8px; transition:background 140ms ease, color 140ms ease; }
        .ds-cell.small { font-size:calc(var(--ds-font) * 0.5); color:var(--bdb-ink-soft); height:calc(var(--ds-cell) * 0.62); }
        .ds-cell.pad { color:var(--bdb-ink-faint); }
        .ds-cell.hidden { visibility:hidden; }
        .ds-cell.lit { background:color-mix(in srgb, var(--bdb-amber) 34%, transparent); }
        .ds-cell.dot { font-size:var(--ds-font); }
        .ds-gutter { width:calc(var(--ds-cell) * 0.9); display:grid; place-items:center; font-size:var(--ds-font); font-weight:800; color:var(--bdb-ink-soft); }
        .ds-rule { height:3px; background:var(--bdb-ink); margin:5px 0; border-radius:2px; }
        .ds-mark { position:absolute; font-size:var(--ds-font); font-weight:900; line-height:1; transform:translateX(-52%); transition:left 220ms ease; }
        .ds-mark.muted { color:var(--bdb-ink-faint); }
        .ds-mark.lit { color:var(--bdb-coral-deep); }
        .ds-hop { position:absolute; border-top:2.5px solid var(--bdb-coral-deep); border-radius:60% 60% 0 0 / 100% 100% 0 0; height:13px; pointer-events:none; }

        /* long division house */
        .ds-house { display:flex; align-items:flex-start; }
        .ds-divisor { display:flex; align-items:center; padding-top:calc(var(--ds-cell) * 1.06 + 5px); position:relative; }
        .ds-bracket { position:relative; padding-left:10px; border-left:3px solid var(--bdb-ink); border-top-left-radius:14px; margin-top:calc(var(--ds-cell) * 1.06 + 2px); }
        .ds-bar { height:3px; background:var(--bdb-ink); border-radius:2px; }

        /* ── the question ── */
        .ds-ask { display:grid; gap:10px; align-content:start; }
        .ds-q { font-size:clamp(1.02rem,2.1vw,1.24rem); font-weight:800; margin:0; line-height:1.32; }
        .ds-choice { font:inherit; text-align:left; font-weight:700; font-size:0.95rem; line-height:1.32; min-height:52px; padding:11px 15px; border-radius:12px;
          border:2px solid var(--bdb-line); background:var(--bdb-card); color:var(--bdb-ink); cursor:pointer; }
        .ds-choice:hover:not(:disabled) { border-color:var(--bdb-teal-deep); }
        .ds-choice.bad { border-color:var(--bdb-coral-deep); background:color-mix(in srgb, var(--bdb-coral) 11%, var(--bdb-card)); color:var(--bdb-ink-soft); }
        .ds-choice.good { border-color:var(--bdb-green-deep); background:color-mix(in srgb, var(--bdb-green) 13%, var(--bdb-card)); }
        .ds-choice.hint { border-color:var(--bdb-amber); }
        .ds-choice:disabled { cursor:default; }
        .ds-why { font-size:0.92rem; font-weight:600; line-height:1.42; margin:0; padding:9px 13px; border-left:3px solid var(--bdb-line); color:var(--bdb-ink-soft); }
        .ds-why.good { border-left-color:var(--bdb-green-deep); color:var(--bdb-ink); }
        .ds-why.bad { border-left-color:var(--bdb-coral-deep); }
        .ds-move { display:grid; gap:9px; padding:12px 14px; border:2px dashed var(--bdb-coral-deep); border-radius:12px; }
        .ds-move p { margin:0; font-weight:800; font-size:0.95rem; }
        .ds-move .row { display:flex; gap:8px; flex-wrap:wrap; }
        .ds-done { font-size:1.15rem; font-weight:800; color:var(--bdb-green-deep); margin:0; }
      `}</style>

      <LiveToolBanner tool={liveTool} />

      <div className="ds-top">
        <div>
          <p className="ds-count">Problem {Math.min(idx, problems.length - 1) + 1} of {problems.length}</p>
          <h2 className="ds-headline">{trace.headline}{done ? ` = ${trace.answerText}` : ""}</h2>
        </div>
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap", alignItems: "center" }}>
          <div className="ds-seg">
            <button className={mode === "teacher" ? "on" : ""} onClick={() => pickMode("teacher")} type="button">Teacher led</button>
            <button className={mode === "student" ? "on" : ""} onClick={() => pickMode("student")} type="button">Student</button>
          </div>
          <button className="ds-btn" onClick={resetProblem} type="button">Start over</button>
          {problems.length > 1 && <button className="ds-btn" onClick={nextProblem} type="button">Next problem</button>}
        </div>
      </div>

      <div className="ds-grid">
        <div className="ds-rail">
          <span className="ds-raillbl">{trace.layout === "house" ? "Division steps" : "Steps so far"}</span>
          {ledger.map((l, i) => (
            <div className="ds-rrow done" key={`${l.rail}-${i}`}>
              <b>{l.rail}</b>
              <span>{l.say}</span>
            </div>
          ))}
          {step && !done && (
            <div className="ds-rrow now">
              <b>{step.rail}</b>
              <span>{solved ? step.say : "Working on it"}</span>
            </div>
          )}
        </div>

        <div className="ds-stage">
          <Board
            trace={trace}
            revealed={revealedSet}
            highlight={highlightSet}
            markerShift={markerShift}
            moveTarget={needsMove ? moveTarget : undefined}
          />
          {done && (
            <p className="ds-done">
              {trace.headline} = {trace.answerText}
              {answerTrim !== trace.answerText ? `, which is ${answerTrim}` : ""}
            </p>
          )}
        </div>

        <div className="ds-ask">
          {done ? (
            <>
              <p className="ds-q">Every step is done.</p>
              <p className="ds-why good">
                {answerTrim !== trace.answerText
                  ? `The algorithm gives ${trace.answerText}. A zero on the end changes nothing, so the answer is ${answerTrim}.`
                  : "Walk it again, or take the next problem."}
              </p>
              <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
                <button className="ds-btn go" onClick={resetProblem} type="button">Walk it again</button>
                {problems.length > 1 && <button className="ds-btn" onClick={nextProblem} type="button">Next problem</button>}
              </div>
            </>
          ) : step ? (
            <>
              <p className="ds-q">{step.question}</p>
              {!instruction && step.choices.map((c, i) => {
                const isWrong = wrong.includes(i);
                const isRight = solvedStep && c.correct;
                const hinted = shown && c.correct && !solvedStep;
                return (
                  <button
                    key={c.text}
                    className={`ds-choice ${isRight ? "good" : ""} ${isWrong ? "bad" : ""} ${hinted ? "hint" : ""}`.replace(/\s+/g, " ").trim()}
                    onClick={() => pick(i)}
                    disabled={solvedStep || isWrong}
                    type="button"
                  >
                    {c.text}
                  </button>
                );
              })}
              {solvedStep && chosen >= 0 && <p className="ds-why good">{step.choices[chosen].why}</p>}
              {!solvedStep && wrong.length > 0 && <p className="ds-why bad">{step.choices[wrong[wrong.length - 1]].why}</p>}

              {needsMove && step.action && (
                <div className="ds-move">
                  <p>
                    Move the decimal in the {step.action.target}: {moved} of {step.action.places} moved
                    {movesLeft > 0 ? ` - ${movesLeft} to go` : " - that is it"}
                  </p>
                  <div className="row">
                    <button className="ds-btn go" onClick={() => hop(1)} disabled={movesLeft <= 0} type="button">Move one place right</button>
                    <button className="ds-btn" onClick={() => hop(-1)} disabled={moved <= 0} type="button">Back one</button>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginTop: 2 }}>
                <button
                  className="ds-btn go"
                  onClick={advance}
                  disabled={!solved || (needsMove && movesLeft !== 0)}
                  type="button"
                >
                  {needsMove && movesLeft !== 0 ? "Move it first" : "Next step"}
                </button>
                {mode === "teacher" && !solvedStep && (
                  <button className="ds-btn" onClick={() => setShown(true)} type="button">Show the answer</button>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── the board itself ────────────────────────────────────────────────────────

function Board({
  trace,
  revealed,
  highlight,
  markerShift,
  moveTarget,
}: {
  trace: DecimalTrace;
  revealed: Set<string>;
  highlight: Set<string>;
  markerShift: (row: DecimalRow) => number;
  moveTarget?: "divisor" | "dividend";
}) {
  const cellRef = useRef<HTMLDivElement | null>(null);
  const [cellW, setCellW] = useState(44);
  useEffect(() => {
    const measure = () => {
      const w = cellRef.current?.getBoundingClientRect().width ?? 0;
      if (w > 0) setCellW(w);
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (cellRef.current && ro) ro.observe(cellRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const byRow = (row: DecimalRow) => trace.cells.filter((c) => c.row === row);

  // `underline` draws the subtraction bar under a product row, the way it is
  // written by hand - without it the product and the difference below it read
  // as two unrelated numbers.
  const renderCells = (row: DecimalRow, small = false, underline = false) => {
    const cells = byRow(row);
    const map = new Map<number, DecCell>();
    cells.forEach((c) => map.set(c.col, c));
    return (
      <div className="ds-cellrow" style={{ gridTemplateColumns: `repeat(${trace.columns}, var(--ds-cell))` }}>
        {Array.from({ length: trace.columns }, (_, col) => {
          const cell = map.get(col);
          if (!cell) return <span className="ds-cell" key={col} />;
          const hidden = !revealed.has(cell.id);
          return (
            <span
              key={cell.id}
              ref={col === 0 && row === trace.rows[0] ? cellRef : undefined}
              className={`ds-cell ${small ? "small" : ""} ${cell.kind === "pad" ? "pad" : ""} ${cell.kind === "dot" ? "dot" : ""} ${hidden ? "hidden" : ""} ${highlight.has(cell.id) ? "lit" : ""}`.replace(/\s+/g, " ").trim()}
              style={underline && !hidden ? { borderBottom: "3px solid var(--bdb-ink)" } : undefined}
            >
              {cell.text}
            </span>
          );
        })}
      </div>
    );
  };

  const renderMarkers = (row: DecimalRow) => {
    const shift = markerShift(row);
    return trace.markers
      .filter((m) => m.row === row)
      .map((m) => {
        const at = m.boundary + shift;
        const hidden = !revealed.has(m.id);
        const active = moveTarget && row === (moveTarget === "divisor" ? "divisor" : "dividend");
        return (
          <span key={m.id}>
            <span
              className={`ds-mark ${m.muted ? "muted" : ""} ${highlight.has(m.id) || active ? "lit" : ""}`.replace(/\s+/g, " ").trim()}
              style={{ left: at * cellW, bottom: 2, visibility: hidden ? "hidden" : "visible" }}
            >
              .
            </span>
            {/* One hop arc per place the decimal has travelled - the caret you
                would draw on the board, so the move leaves a trace. */}
            {Array.from({ length: shift }, (_, i) => (
              <span
                key={`${m.id}-hop-${i}`}
                className="ds-hop"
                style={{ left: (m.boundary + i) * cellW, width: cellW, top: -6 }}
              />
            ))}
          </span>
        );
      });
  };

  if (trace.layout === "house") {
    return (
      <div className="ds-house">
        <div className="ds-divisor" style={{ position: "relative" }}>
          <div style={{ position: "relative" }}>
            {renderCells("divisor")}
            {renderMarkers("divisor")}
          </div>
        </div>
        <div className="ds-bracket">
          <div style={{ position: "relative" }}>
            {renderCells("quotient")}
            {renderMarkers("quotient")}
          </div>
          <div className="ds-bar" />
          <div style={{ position: "relative" }}>
            {renderCells("dividend")}
            {renderMarkers("dividend")}
          </div>
          {trace.rows.filter((r) => r.startsWith("work") || r.startsWith("rest")).map((r) => (
            <div key={r} style={{ position: "relative" }}>{renderCells(r, false, r.startsWith("work"))}</div>
          ))}
        </div>
      </div>
    );
  }

  // Before the line-up question is answered nothing is on the board, so the
  // operator and the rule would float over an empty frame and read as broken.
  const started = revealed.size > 0;

  return (
    <div className="ds-rows">
      {trace.rows.map((row, i) => {
        if (row === "rule") return started ? <div className="ds-rule" key={`rule-${i}`} /> : <div key={`rule-${i}`} style={{ height: 11 }} />;
        const gutter = row === "b" && started ? opSign(trace.problem.op) : "";
        return (
          <div className="ds-row" key={`${row}-${i}`}>
            <span className="ds-gutter">{gutter}</span>
            <div style={{ position: "relative" }}>
              {renderCells(row, row === "carry" || row === "regroup")}
              {renderMarkers(row)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
