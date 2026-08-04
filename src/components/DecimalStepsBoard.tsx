"use client";

// Decimals, step by step - all four operations, one move at a time.
//
// v2, rebuilt from Steele's toolbar comments on /decimal-steps. What changed:
//   - students TYPE the arithmetic; multiple choice is kept for the decisions
//   - a carry is a decision AND a physical act: type it into a box over the
//     next column, where it solidifies
//   - the decimal is DRAGGED by the student, click by click, and each hop
//     leaves a big dashed arc UNDER the number from the old spot to the new
//   - the operation is chosen before anything, and can also be picked from the
//     top bar so a teacher can jump straight to the one they are teaching
//   - an estimate comes first, so there is something to check the answer against
//   - the long-division house is a proper L, with the quotient over the bar
//   - correct answers do not sit in the first slot (the engine seats them)
//   - a big "Yes!" lands on every correct move, and the current step flashes
//
// The engine (lib/decimalSteps) owns the arithmetic, the questions and the
// choice order; this file is the board, the rail, and the interactions.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DECIMAL_OPS,
  DEFAULT_DECIMAL_SET,
  buildDecimalTrace,
  parseDec,
  parseDecimalSet,
  serializeDecimalSet,
  trimTrailingZeros,
  type DecCell,
  type DecStep,
  type DecimalOp,
  type DecimalProblem,
  type DecimalRow,
  type DecimalTrace,
} from "@/lib/decimalSteps";
import { useTeacherDevice } from "@/lib/teacherDevice";
import { LiveToolBanner, useLiveToolConfig } from "./useLiveToolConfig";

type Mode = "teacher" | "student";
const PROGRESS_KEY = "bdm-decimal-steps";
const MODE_KEY = "bdm-decimal-steps-mode";

/** Used when the picker asks for an operation the current set does not carry. */
const FALLBACK: Record<DecimalOp, [string, string]> = {
  "+": ["12.4", "3.75"],
  "-": ["8.3", "4.68"],
  "x": ["6.2", "0.4"],
  "/": ["9.6", "0.4"],
};

function opSign(op: string): string {
  if (op === "+") return "+";
  if (op === "-") return "−";
  if (op === "x") return "×";
  return "÷";
}

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
  // Teacher mode holds an answer reveal, so it is derived from the httpOnly
  // teacher cookie, never from a toggle a student can reach. This is a public
  // route: the toggle used to sit in the top bar of every Chromebook's screen,
  // two taps from the answer.
  const teacherDevice = useTeacherDevice();
  const [published, setPublished] = useState<string | null>(null);
  const [linked, setLinked] = useState<string | null>(null);

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
  // A problem chosen by the operation picker rather than by walking the set.
  const [picked, setPicked] = useState<DecimalProblem | null>(null);
  const [mode, setMode] = useState<Mode>("student");
  const [stepIdx, setStepIdx] = useState(0);
  // Only the MOST RECENT wrong choice is marked, and no choice is ever removed
  // from play - Steele, 2026-08-03. Disabling each wrong one turned a 3-choice
  // step into brute force in two taps, and left the elimination on screen.
  const [lastWrong, setLastWrong] = useState<number | null>(null);
  const [solvedStep, setSolvedStep] = useState(false);
  const [revealed, setRevealed] = useState<string[]>([]);
  const [moved, setMoved] = useState(0);
  const [shown, setShown] = useState(false);
  const [typed, setTyped] = useState("");
  /** Why the last submission was not accepted - blank is not the same as wrong. */
  const [typedIssue, setTypedIssue] = useState<"none" | "empty" | "negative" | "wrong">("none");
  const [cheer, setCheer] = useState(0);
  const [snap, setSnap] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const problem = picked ?? problems[Math.min(idx, problems.length - 1)];
  const trace = useMemo(() => buildDecimalTrace(problem), [problem]);

  const resetProblem = useCallback(() => {
    setStepIdx(0);
    setLastWrong(null);
    setSolvedStep(false);
    setRevealed([]);
    setMoved(0);
    setShown(false);
    setTyped("");
    setTypedIssue("none");
  }, []);

  const liveToolId = liveTool?.id;
  useEffect(() => {
    // An UNPUBLISH has to release the set, or students keep working the old one
    // until they happen to reload.
    if (!liveTool || liveTool.route !== "/decimal-steps") {
      setPublished(null);
      return;
    }
    if (!parseDecimalSet(liveTool.config.set).problems.length) return;
    setPublished(liveTool.config.set);
    setPicked(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveToolId]);

  useEffect(() => {
    setIdx(resumeIndex(signature, problems.length));
    setPicked(null);
    resetProblem();
  }, [signature, problems.length, resetProblem]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PROGRESS_KEY, JSON.stringify({ sig: signature, idx }));
    } catch {
      /* progress just will not survive a reload */
    }
  }, [signature, idx]);

  // The box takes focus on every typed step. Most steps in this tool ARE typed
  // - 11 of 11 on an addition, 15 on a division - and without this each one is
  // tap-the-box-then-type on a trackpad, with Enter unreachable until the tap
  // lands. preventScroll so the question the student is reading stays put.
  useEffect(() => {
    if (!trace || solvedStep) return;
    if (trace.steps[stepIdx]?.kind !== "input") return;
    inputRef.current?.focus({ preventScroll: true });
  }, [trace, stepIdx, solvedStep]);

  useEffect(() => {
    if (!teacherDevice) {
      // A device that was the teacher's and is not any more must not keep the
      // remembered mode.
      setMode("student");
      return;
    }
    try {
      const saved = window.localStorage.getItem(MODE_KEY);
      if (saved === "teacher" || saved === "student") setMode(saved);
    } catch {
      /* the toggle still works, it just will not be remembered */
    }
  }, [teacherDevice]);
  const pickMode = (m: Mode) => {
    setMode(m);
    try {
      window.localStorage.setItem(MODE_KEY, m);
    } catch { /* ignore */ }
  };

  // Jump to an operation. Prefers a problem the teacher actually published, so
  // a set of four divisions stays a set of four divisions.
  const pickOp = (op: DecimalOp) => {
    const found = problems.findIndex((p) => p.op === op);
    if (found >= 0) {
      setPicked(null);
      setIdx(found);
    } else {
      const [x, y] = FALLBACK[op];
      const a = parseDec(x);
      const b = parseDec(y);
      if (a && b) setPicked({ a, b, op });
    }
    resetProblem();
  };

  if (!trace) {
    return <p style={{ padding: 24, fontWeight: 700 }}>That problem cannot be walked step by step.</p>;
  }

  const step: DecStep | undefined = trace.steps[stepIdx];
  const done = stepIdx >= trace.steps.length;
  const needsMove = step?.kind === "move";
  const movesLeft = (step?.action?.places ?? 0) - moved;
  const moveReady = needsMove && movesLeft === 0;
  const solved = solvedStep || moveReady;

  const ledger = trace.steps.slice(0, stepIdx).map((s) => ({ rail: s.rail, say: s.say }));
  const revealedSet = new Set(revealed);
  const highlightSet = new Set(step && !done ? step.highlight : []);

  const celebrate = () => setCheer((c) => c + 1);

  const pick = (i: number) => {
    if (!step || solvedStep) return;
    if (step.choices[i].correct) {
      setSolvedStep(true);
      setRevealed((r) => [...r, ...step.reveal]);
      celebrate();
      if (step.id === "lineup") setSnap((s) => s + 1);
    } else {
      setLastWrong(i);
    }
  };

  const submitTyped = () => {
    if (!step?.input || solvedStep) return;
    const raw = typed.trim();
    const value = Number(raw);
    if (!raw || !Number.isFinite(value)) {
      // Blank is not a wrong answer, and answering it with the arithmetic hint
      // reads as "your number is wrong" when there is no number.
      setTypedIssue("empty");
      return;
    }
    const near = step.input.about;
    if (near !== undefined && value < 0 && near >= 0) {
      setTypedIssue("negative");
      return;
    }
    const ok = near !== undefined && step.input.tolerance !== undefined
      ? Math.abs(value - near) <= step.input.tolerance
      : raw === step.input.expect;
    if (!ok) {
      setTypedIssue("wrong");
      return;
    }
    setTypedIssue("none");
    setSolvedStep(true);
    setRevealed((r) => [...r, ...step.reveal]);
    celebrate();
  };

  const advance = () => {
    setStepIdx((s) => s + 1);
    setLastWrong(null);
    setSolvedStep(false);
    setMoved(0);
    setShown(false);
    setTyped("");
    setTypedIssue("none");
  };

  const hop = (delta: number) => {
    const places = step?.action?.places ?? 0;
    setMoved((m) => {
      const next = Math.max(0, Math.min(places, m + delta));
      if (next === places && m !== places) celebrate();
      return next;
    });
  };

  const nextProblem = () => {
    setPicked(null);
    setIdx((i) => (i + 1) % problems.length);
    resetProblem();
  };

  // Live decimal positions. Divisor and dividend travel right; a product's
  // point travels LEFT from the end of the number.
  const markerShift = (row: DecimalRow): number => {
    const target = row === "divisor" ? "divisor" : row === "dividend" ? "dividend" : row === "sum" ? "product" : null;
    if (!target) return 0;
    const settledStep = trace.steps.slice(0, stepIdx).find((s) => s.action?.target === target);
    if (settledStep) return settledStep.action!.places * (settledStep.action!.direction === "left" ? -1 : 1);
    if (step?.action?.target === target) return moved * (step.action.direction === "left" ? -1 : 1);
    return 0;
  };

  const chosen = step && solvedStep ? step.choices.findIndex((c) => c.correct) : -1;
  const answerTrim = trimTrailingZeros(trace.answerText);
  const canAdvance = solved;

  return (
    <div className={`ds-root ${mode === "teacher" ? "big" : ""}`.trim()}>
      <style>{`
        .ds-root { --ds-cell:56px; --ds-font:2.5rem; width:100%; display:grid; gap:16px; position:relative; }
        .ds-root.big { --ds-cell:76px; --ds-font:3.4rem; }
        @media (max-width:900px) { .ds-root { --ds-cell:40px; --ds-font:1.8rem; } .ds-root.big { --ds-cell:46px; --ds-font:2.1rem; } }
        .ds-top { display:flex; align-items:flex-end; justify-content:space-between; gap:14px; flex-wrap:wrap; }
        .ds-headline { font-size:clamp(2.1rem,5vw,3.4rem); font-weight:900; margin:0; letter-spacing:-0.01em; line-height:1.05; }
        .ds-count { font-size:0.78rem; font-weight:800; letter-spacing:0.14em; text-transform:uppercase; color:var(--bdb-ink-faint); margin:0 0 4px; }
        .ds-seg { display:inline-flex; border:1px solid var(--bdb-line); border-radius:999px; overflow:hidden; }
        .ds-seg button { font:inherit; font-weight:800; font-size:0.84rem; min-height:44px; padding:0 15px; border:none; background:var(--bdb-card); color:var(--bdb-ink-soft); cursor:pointer; }
        .ds-seg button.on { background:var(--bdb-teal-deep); color:#fff; }
        .ds-ops { display:inline-flex; gap:6px; }
        .ds-op { font:inherit; font-weight:900; font-size:1.05rem; min-width:52px; min-height:44px; border-radius:11px;
          border:2px solid var(--bdb-line); background:var(--bdb-card); color:var(--bdb-ink-soft); cursor:pointer; }
        .ds-op.on { border-color:var(--bdb-brown); background:var(--bdb-brown); color:#fff; }
        .ds-btn { font:inherit; font-weight:800; font-size:0.88rem; min-height:44px; padding:0 17px; border-radius:11px; border:1px solid var(--bdb-line); background:var(--bdb-card); color:var(--bdb-ink); cursor:pointer; }
        .ds-btn.go { background:var(--bdb-teal-deep); border-color:var(--bdb-teal-deep); color:#fff; }
        .ds-btn:disabled { color:var(--bdb-ink-faint); background:var(--bdb-card); border-color:var(--bdb-line); cursor:default; }

        .ds-grid { display:grid; grid-template-columns:minmax(190px,0.8fr) minmax(340px,2fr) minmax(300px,1.1fr); gap:22px; align-items:start; }
        @media (max-width:1100px) { .ds-grid { grid-template-columns:1fr; } .ds-rail { order:3; } .ds-stage { order:1; } .ds-ask { order:2; } }

        /* ── the steps, on the side ── */
        .ds-rail { display:grid; gap:8px; align-content:start; }
        .ds-raillbl { font-size:0.74rem; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:var(--bdb-ink-faint); }
        .ds-rrow { display:grid; gap:2px; padding:9px 13px; border-left:4px solid var(--bdb-line); }
        .ds-rrow b { font-size:0.95rem; font-weight:800; color:var(--bdb-ink); }
        .ds-rrow span { font-size:0.86rem; font-weight:600; color:var(--bdb-ink-soft); }
        .ds-rrow.done { border-left-color:var(--bdb-green-deep); }
        .ds-rrow.now { border-left-color:var(--bdb-amber); animation:ds-flash 1.4s ease-in-out infinite; }
        .ds-rrow.now b { font-size:1.22rem; }
        @keyframes ds-flash { 0%,100% { background:transparent; } 50% { background:color-mix(in srgb, var(--bdb-amber) 26%, transparent); } }
        @media (prefers-reduced-motion: reduce) { .ds-rrow.now { animation:none; background:color-mix(in srgb, var(--bdb-amber) 26%, transparent); } }

        /* ── the board ── */
        .ds-stage { display:grid; gap:14px; justify-items:center; padding:8px 4px 28px; }
        .ds-rows { display:grid; gap:3px; font-variant-numeric:tabular-nums; }
        .ds-row { position:relative; display:flex; align-items:stretch; }
        .ds-cellrow { display:grid; position:relative; }
        .ds-cell { width:var(--ds-cell); height:calc(var(--ds-cell) * 1.06); display:grid; place-items:center;
          font-size:var(--ds-font); font-weight:800; color:var(--bdb-ink); border-radius:9px; transition:background 140ms ease; }
        .ds-cell.small { font-size:calc(var(--ds-font) * 0.46); color:var(--bdb-ink-soft); height:calc(var(--ds-cell) * 0.6); }
        .ds-cell.pad { color:var(--bdb-ink-faint); }
        .ds-cell.hidden { visibility:hidden; }
        .ds-cell.lit { background:color-mix(in srgb, var(--bdb-amber) 40%, transparent); }
        .ds-cell.carrybox { font-size:calc(var(--ds-font) * 0.46); height:calc(var(--ds-cell) * 0.6);
          border:2px dashed var(--bdb-coral-deep); color:var(--bdb-coral-deep); border-radius:7px;
          width:calc(var(--ds-cell) * 0.62); margin:0 auto; }
        .ds-cell.carrybox.waiting { animation:ds-await 1.2s ease-in-out infinite; }
        @keyframes ds-await { 0%,100% { background:transparent; } 50% { background:color-mix(in srgb, var(--bdb-coral) 22%, transparent); } }
        @media (prefers-reduced-motion: reduce) { .ds-cell.carrybox.waiting { animation:none; background:color-mix(in srgb, var(--bdb-coral) 22%, transparent); } }
        .ds-gutter { width:calc(var(--ds-cell) * 0.85); display:grid; place-items:center; font-size:var(--ds-font); font-weight:800; color:var(--bdb-ink-soft); }
        .ds-rule { height:4px; background:var(--bdb-ink); margin:6px 0; border-radius:2px; }
        /* The numbers snap together when the line-up question is answered -
           Steele: "act like they are magnets drawn to eachother". */
        .ds-snap { animation:ds-magnet 380ms cubic-bezier(.2,1.5,.4,1); }
        @keyframes ds-magnet { 0% { transform:translateX(var(--ds-from)); opacity:0.35; } 100% { transform:translateX(0); opacity:1; } }
        @media (prefers-reduced-motion: reduce) { .ds-snap { animation:none; } }

        /* decimal points that float between columns, and can be dragged */
        /* A decimal point is a button so the student can move it, but a DISABLED
           button is greyed by the browser - which washed the point out on every
           row that was not currently movable. Forced back to ink. */
        .ds-mark { position:absolute; bottom:calc(var(--ds-cell) * 0.14); transform:translateX(-50%);
          font-size:var(--ds-font); font-weight:900; line-height:0.5; color:var(--bdb-ink);
          background:none; border:none; padding:0; opacity:1; -webkit-text-fill-color:currentColor;
          transition:left 240ms cubic-bezier(.3,1.4,.5,1); }
        .ds-mark:disabled { color:var(--bdb-ink); opacity:1; }
        .ds-mark.muted, .ds-mark.muted:disabled { color:var(--bdb-ink-faint); }
        .ds-mark.grab, .ds-mark.grab:disabled { cursor:grab; color:var(--bdb-coral-deep); animation:ds-bob 1.1s ease-in-out infinite; }
        .ds-mark.grab::after { content:""; position:absolute; inset:-16px -20px; border-radius:50%;
          border:2.5px dashed var(--bdb-coral-deep); }
        @keyframes ds-bob { 0%,100% { transform:translateX(-50%) scale(1); } 50% { transform:translateX(-50%) scale(1.22); } }
        /* One dashed arc per place travelled, UNDER the number, from the old
           spot to the new one. This is the caret you draw on the board. */
        .ds-hop { position:absolute; border-bottom:3px dashed var(--bdb-coral-deep);
          border-radius:0 0 58% 58% / 0 0 100% 100%; height:26px; pointer-events:none; }
        .ds-uparrow { position:absolute; width:0; height:0; border-left:10px solid transparent; border-right:10px solid transparent;
          border-bottom:16px solid var(--bdb-coral-deep); transform:translateX(-50%); animation:ds-rise 1.1s ease-in-out infinite; }
        @keyframes ds-rise { 0%,100% { opacity:0.35; } 50% { opacity:1; } }
        @media (prefers-reduced-motion: reduce) { .ds-mark.grab, .ds-uparrow { animation:none; } }

        /* long division: a proper L - vertical stroke down the left of the
           dividend, horizontal bar across its top, quotient sitting above. */
        .ds-house { display:flex; align-items:flex-start; }
        .ds-divisor { position:relative; }
        .ds-hstack { display:grid; }
        .ds-quot { padding-left:14px; position:relative; }
        .ds-lbody { border-left:4px solid var(--bdb-ink); border-top:4px solid var(--bdb-ink);
          border-top-left-radius:12px; padding-left:14px; padding-top:5px; }

        /* ── the question ── */
        .ds-ask { display:grid; gap:11px; align-content:start; }
        .ds-q { font-size:clamp(1.1rem,2.3vw,1.38rem); font-weight:800; margin:0; line-height:1.3; }
        .ds-choice { font:inherit; text-align:left; font-weight:700; font-size:1rem; line-height:1.3; min-height:54px; padding:12px 16px; border-radius:12px;
          border:2px solid var(--bdb-line); background:var(--bdb-card); color:var(--bdb-ink); cursor:pointer; }
        .ds-choice:hover:not(:disabled) { border-color:var(--bdb-teal-deep); }
        .ds-choice.bad { border-color:var(--bdb-coral-deep); background:color-mix(in srgb, var(--bdb-coral) 11%, var(--bdb-card)); color:var(--bdb-ink-soft); }
        .ds-choice.good { border-color:var(--bdb-green-deep); background:color-mix(in srgb, var(--bdb-green) 14%, var(--bdb-card)); }
        .ds-choice.hint { border-color:var(--bdb-amber); }
        .ds-choice:disabled { cursor:default; }
        .ds-entry { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
        .ds-entrylbl { font-size:1.15rem; font-weight:800; color:var(--bdb-ink); }
        .ds-input { font:inherit; font-weight:900; font-size:1.5rem; width:7ch; min-height:56px; text-align:center;
          border:3px solid var(--bdb-teal-deep); border-radius:12px; background:var(--bdb-card); color:var(--bdb-ink); padding:0 8px; }
        .ds-input.bad { border-color:var(--bdb-coral-deep); }
        .ds-input.good { border-color:var(--bdb-green-deep); background:color-mix(in srgb, var(--bdb-green) 13%, var(--bdb-card)); }
        .ds-why { font-size:0.95rem; font-weight:600; line-height:1.42; margin:0; padding:10px 14px; border-left:4px solid var(--bdb-line); color:var(--bdb-ink-soft); }
        .ds-why.good { border-left-color:var(--bdb-green-deep); color:var(--bdb-ink); }
        .ds-why.bad { border-left-color:var(--bdb-coral-deep); }
        .ds-move { display:grid; gap:10px; padding:13px 15px; border:3px dashed var(--bdb-coral-deep); border-radius:13px; }
        .ds-move p { margin:0; font-weight:800; font-size:1rem; }
        .ds-move .row { display:flex; gap:8px; flex-wrap:wrap; }
        .ds-done { font-size:1.3rem; font-weight:900; color:var(--bdb-green-deep); margin:0; }

        /* the "Yes!" that lands on a correct move */
        .ds-yes { position:fixed; left:50%; top:22%; transform:translateX(-50%); z-index:90; pointer-events:none;
          font-size:clamp(3rem,9vw,6rem); font-weight:900; color:var(--bdb-green-deep);
          text-shadow:0 6px 24px rgba(0,0,0,0.18); animation:ds-yes 1100ms ease-out forwards; }
        @keyframes ds-yes {
          0% { opacity:0; transform:translateX(-50%) scale(0.5); }
          22% { opacity:1; transform:translateX(-50%) scale(1.12); }
          40% { transform:translateX(-50%) scale(1); }
          100% { opacity:0; transform:translateX(-50%) scale(1) translateY(-40px); }
        }
        /* Not animation:none - that left a permanent "Yes!" pinned over the
           board from the first correct answer onward. Same class of bug as the
           division board's, which vanished the confirmation instead. */
        @keyframes ds-yes-quiet { 0%,70% { opacity:1; } 100% { opacity:0; } }
        @media (prefers-reduced-motion: reduce) {
          .ds-yes { animation:ds-yes-quiet 1200ms ease-out forwards; transform:translateX(-50%); }
        }
      `}</style>

      <LiveToolBanner tool={liveTool} />

      <div className="ds-top">
        <div>
          <p className="ds-count">
            {picked ? "Picked" : `Problem ${Math.min(idx, problems.length - 1) + 1} of ${problems.length}`}
          </p>
          <h2 className="ds-headline">{trace.headline}{done ? ` = ${trace.answerText}` : ""}</h2>
        </div>
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap", alignItems: "center" }}>
          {/* Steele: "allow me or thr student to pick the operation wre are doing" */}
          <div className="ds-ops">
            {DECIMAL_OPS.map((o) => (
              <button
                key={o.op}
                className={`ds-op ${trace.problem.op === o.op ? "on" : ""}`.trim()}
                onClick={() => pickOp(o.op)}
                title={o.label}
                aria-label={o.label}
                type="button"
              >
                {o.sign}
              </button>
            ))}
          </div>
          {/* Teacher led carries the answer reveal, so the toggle only exists
              on a device the teacher cookie vouches for. */}
          {teacherDevice && (
            <div className="ds-seg">
              <button className={mode === "teacher" ? "on" : ""} onClick={() => pickMode("teacher")} type="button">Teacher led</button>
              <button className={mode === "student" ? "on" : ""} onClick={() => pickMode("student")} type="button">Student</button>
            </div>
          )}
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
            moveStep={needsMove && movesLeft > 0 ? step : undefined}
            onHop={() => hop(1)}
            snapKey={snap}
            showUpArrow={step?.id === "qpoint"}
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

              {step.kind === "choice" && step.choices.map((c, i) => {
                const isWrong = lastWrong === i;
                const isRight = solvedStep && c.correct;
                const hinted = shown && c.correct && !solvedStep;
                return (
                  <button
                    key={c.text}
                    className={`ds-choice ${isRight ? "good" : ""} ${isWrong ? "bad" : ""} ${hinted ? "hint" : ""}`.replace(/\s+/g, " ").trim()}
                    onClick={() => pick(i)}
                    disabled={solvedStep}
                    type="button"
                  >
                    {c.text}
                  </button>
                );
              })}

              {step.kind === "input" && step.input && (
                <div className="ds-entry">
                  <span className="ds-entrylbl">{step.input.label}</span>
                  <input
                    ref={inputRef}
                    className={`ds-input ${typedIssue !== "none" ? "bad" : ""} ${solvedStep ? "good" : ""}`.replace(/\s+/g, " ").trim()}
                    // The student's own number stays in the box. Rewriting an
                    // accepted estimate of 17 to 16 with no explanation reads
                    // as "you were wrong" on the step that just said Yes.
                    value={typed}
                    onChange={(e) => { setTyped(e.target.value); setTypedIssue("none"); }}
                    onKeyDown={(e) => { if (e.key === "Enter") submitTyped(); }}
                    disabled={solvedStep}
                    inputMode="decimal"
                    aria-label={step.input.label}
                  />
                  {!solvedStep && <button className="ds-btn go" onClick={submitTyped} type="button">Check</button>}
                </div>
              )}

              {step.kind === "move" && step.action && (
                <div className="ds-move">
                  <p>
                    {moved} of {step.action.places} moved
                    {movesLeft > 0 ? ` - drag the decimal point ${movesLeft} more` : " - that is it"}
                  </p>
                  <div className="row">
                    <button className="ds-btn go" onClick={() => hop(1)} disabled={movesLeft <= 0} type="button">
                      Move one place {step.action.direction}
                    </button>
                    <button className="ds-btn" onClick={() => hop(-1)} disabled={moved <= 0} type="button">Back one</button>
                  </div>
                </div>
              )}

              {solvedStep && chosen >= 0 && <p className="ds-why good">{step.choices[chosen].why}</p>}
              {!solvedStep && lastWrong !== null && <p className="ds-why bad">{step.choices[lastWrong].why}</p>}
              {typedIssue === "empty" && <p className="ds-why bad">Type a number in the box first.</p>}
              {typedIssue === "negative" && <p className="ds-why bad">An estimate of this answer cannot be less than zero. Check the minus sign.</p>}
              {typedIssue === "wrong" && step.input && <p className="ds-why bad">{step.input.hint}</p>}
              {solvedStep && step.kind === "input" && <p className="ds-why good">{step.say}</p>}

              <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginTop: 2 }}>
                <button className="ds-btn go" onClick={advance} disabled={!canAdvance} type="button">
                  {needsMove && movesLeft !== 0 ? "Move it first" : "Next step"}
                </button>
                {teacherDevice && mode === "teacher" && !solved && (
                  <button className="ds-btn" onClick={() => setShown(true)} type="button">Show the answer</button>
                )}
                {teacherDevice && mode === "teacher" && shown && step.kind === "input" && step.input && (
                  <span className="ds-entrylbl" style={{ alignSelf: "center" }}>{step.input.expect}</span>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {cheer > 0 && <span className="ds-yes" key={cheer}>Yes!</span>}
    </div>
  );
}

// ── the board itself ────────────────────────────────────────────────────────

function Board({
  trace,
  revealed,
  highlight,
  markerShift,
  moveStep,
  onHop,
  snapKey,
  showUpArrow,
}: {
  trace: DecimalTrace;
  revealed: Set<string>;
  highlight: Set<string>;
  markerShift: (row: DecimalRow) => number;
  moveStep?: DecStep;
  onHop: () => void;
  snapKey: number;
  showUpArrow?: boolean;
}) {
  const byRow = (row: DecimalRow) => trace.cells.filter((c) => c.row === row);

  const renderCells = (row: DecimalRow, small = false, underline = false) => {
    const cells = byRow(row);
    const map = new Map<number, DecCell>();
    cells.forEach((c) => map.set(c.col, c));
    return (
      <div className="ds-cellrow" style={{ gridTemplateColumns: `repeat(${trace.columns}, var(--ds-cell))` }}>
        {Array.from({ length: trace.columns }, (_, col) => {
          const cell = map.get(col);
          if (!cell) return <span className="ds-cell" key={col} />;
          const filled = revealed.has(cell.id);
          // An empty carry box stands open while the student is being asked to
          // write in it, then SOLIDIFIES when they do - Steele's word. Every
          // other cell simply holds its space until it is written.
          const waiting = cell.kind === "carrybox" && !filled && highlight.has(cell.id);
          const hidden = !filled && !waiting;
          return (
            <span
              key={cell.id}
              className={`ds-cell ${small ? "small" : ""} ${cell.kind === "pad" ? "pad" : ""} ${cell.kind === "carrybox" ? "carrybox" : ""} ${waiting ? "waiting" : ""} ${hidden ? "hidden" : ""} ${highlight.has(cell.id) && !waiting ? "lit" : ""}`.replace(/\s+/g, " ").trim()}
              style={underline && filled ? { borderBottom: "4px solid var(--bdb-ink)" } : undefined}
            >
              {waiting ? "" : cell.text}
            </span>
          );
        })}
      </div>
    );
  };

  // Markers sit at exact column boundaries via calc on the cell width, never a
  // measured pixel value - measuring is what put the multiplication points out
  // of line with their digits.
  const renderMarkers = (row: DecimalRow) => {
    const shift = markerShift(row);
    const grabbable = moveStep?.action && (
      (moveStep.action.target === "divisor" && row === "divisor") ||
      (moveStep.action.target === "dividend" && row === "dividend") ||
      (moveStep.action.target === "product" && row === "sum")
    );
    return trace.markers
      .filter((m) => m.row === row)
      .map((m) => {
        const at = m.boundary + shift;
        const hidden = !revealed.has(m.id);
        const hops = Math.abs(shift);
        const from = Math.min(m.boundary, at);
        return (
          <span key={m.id}>
            <button
              className={`ds-mark ${m.muted ? "muted" : ""} ${grabbable ? "grab" : ""} ${highlight.has(m.id) ? "lit" : ""}`.replace(/\s+/g, " ").trim()}
              style={{ left: `calc(${at} * var(--ds-cell))`, visibility: hidden ? "hidden" : "visible" }}
              onClick={grabbable ? onHop : undefined}
              disabled={!grabbable}
              aria-label={grabbable ? "Move the decimal point one place" : "decimal point"}
              type="button"
            >
              .
            </button>
            {Array.from({ length: hops }, (_, i) => (
              <span
                key={`${m.id}-hop-${i}`}
                className="ds-hop"
                style={{ left: `calc(${from + i} * var(--ds-cell))`, width: "var(--ds-cell)", bottom: -22 }}
              />
            ))}
          </span>
        );
      });
  };

  if (trace.layout === "house") {
    const workRows = trace.rows.filter((r) => r.startsWith("work") || r.startsWith("rest"));
    return (
      <div className="ds-house">
        {/* the divisor sits level with the dividend, outside the L */}
        <div className="ds-divisor" style={{ paddingTop: "calc(var(--ds-cell) * 1.06 + 9px)" }}>
          <div style={{ position: "relative" }}>
            {renderCells("divisor")}
            {renderMarkers("divisor")}
          </div>
        </div>
        <div className="ds-hstack">
          <div className="ds-quot">
            <div style={{ position: "relative" }}>
              {renderCells("quotient")}
              {renderMarkers("quotient")}
              {showUpArrow && (
                <span className="ds-uparrow" style={{ left: `calc(${trace.markers.find((m) => m.row === "quotient")?.boundary ?? 0} * var(--ds-cell))`, bottom: -20 }} />
              )}
            </div>
          </div>
          <div className="ds-lbody">
            <div style={{ position: "relative" }}>
              {renderCells("dividend")}
              {renderMarkers("dividend")}
            </div>
            {workRows.map((r) => (
              <div key={r} style={{ position: "relative" }}>{renderCells(r, false, r.startsWith("work"))}</div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const started = revealed.size > 0;
  return (
    <div className="ds-rows">
      {trace.rows.map((row, i) => {
        if (row === "rule") return started ? <div className="ds-rule" key={`rule-${i}`} /> : <div key={`rule-${i}`} style={{ height: 14 }} />;
        const gutter = row === "b" && started ? opSign(trace.problem.op) : "";
        const magnet = (row === "a" || row === "b") && snapKey > 0;
        return (
          <div className="ds-row" key={`${row}-${i}`}>
            <span className="ds-gutter">{gutter}</span>
            <div
              key={magnet ? `${row}-snap-${snapKey}` : row}
              className={magnet ? "ds-snap" : undefined}
              style={{ position: "relative", ["--ds-from" as string]: row === "a" ? "-46px" : "46px" }}
            >
              {renderCells(row, row === "carry" || row === "sumcarry" || row === "regroup")}
              {renderMarkers(row)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
