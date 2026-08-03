"use client";

// LCM Bouncer - the CONCRETE/REPRESENTATIONAL partner to /ladder-method.
//
// Two balls run left to right across the SAME numbered track at the SAME
// horizontal speed, but they hop different distances. Ball A touches down every
// stepA squares, Ball B every stepB squares. Because the speed is shared and
// only the stride differs, the two balls physically arrive in the same column
// at the same instant - which is the whole point: a common multiple is a
// MEETING, not a calculation.
//
// Why same speed and not same tempo. If both balls hopped once per beat, Ball A
// (stride 4) would reach 12 on beat 3 and Ball B (stride 6) on beat 2 - the same
// square at different moments, and the "they landed together" event never
// happens on screen. Sharing the speed puts the meeting in one frame and leaves
// the BOUNCE COUNTS different, which is exactly the quantity the lesson is
// about. Do not "fix" this to one hop per beat.
//
// Colors carry the mathematics and are not decoration:
//   teal   Ball A's own landings, the multiples of stepA
//   coral  Ball B's own landings, the multiples of stepB
//   amber  a square both balls landed on - a common multiple
// The first amber column is the LCM. The board deliberately KEEPS GOING past it
// so the room sees the amber columns repeat at a fixed interval, which is the
// fact that every common multiple is a multiple of the least one.
//
// The track length is derived from the pair, never hand-set, so the LCM is
// always reachable: a coprime pair simply gets a long track, and "these two take
// forever to meet" is a true and useful thing to watch.

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LiveToolBanner, useLiveToolConfig } from "./useLiveToolConfig";

const C_TEAL = "#50a3a4";
const C_CORAL = "#f95335";
const C_AMBER = "#fcaf38";
const C_BROWN = "#674a40";
const C_INK = "#201e1a";
// SVG presentation attributes take literals, not var() - the design tokens are
// mirrored here so the stage cannot drift from globals.css silently.
const C_LINE = "#ece4d4";      // --bdb-line
const C_INK_SOFT = "#6f675c";  // --bdb-ink-soft

const MIN_STEP = 2;
const MAX_STEP = 12;

// Stage geometry, in viewBox units. One column is CELL wide, so every pixel
// number below is resolution independent - the SVG scales to whatever width the
// center column gets, from a laptop to a 1920 projector.
const CELL = 100;
const PAD_L = 90;
const PAD_R = 40;
const INSET = 5;
const ROW_A_Y = 240;
const ROW_H = 84;
const ROW_GAP = 10;
const ROW_B_Y = ROW_A_Y + ROW_H + ROW_GAP;
const BALL_R = 26;
const REST_A = ROW_A_Y - BALL_R;
const REST_B = ROW_B_Y + ROW_H + BALL_R;
const VB_H = 660;

const SPEEDS = { slow: 2.2, normal: 4.2, fast: 7.5 } as const;
type SpeedKey = keyof typeof SPEEDS;
const STEP_SPEED = 5.5;   // manual Bounce travels a little faster than normal auto
const MEET_HOLD_MS = 900; // auto-run pauses on a meeting so the room can read it

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const lcmOf = (a: number, b: number) => (a * b) / gcd(a, b);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Arc apex for a given stride. A longer hop throws the ball higher, which is
// the visual cue that stride and distance are the same fact.
const arcHeight = (step: number) => Math.min(175, 72 + step * 11);
const colX = (p: number) => PAD_L + (p - 0.5) * CELL;

// The LCM must always be ON the track, so the length follows the pair. Short
// pairs get room to show the meeting repeat; long ones get one extra stride.
function trackLengthFor(a: number, b: number) {
  const l = lcmOf(a, b);
  return l <= 36 ? Math.max(12, l * 2) : l + Math.max(a, b);
}

function nextMultipleAfter(p: number, step: number) {
  return (Math.floor(p / step + 1e-6) + 1) * step;
}

interface CellsProps {
  trackLen: number;
  hitA: Set<number>;
  hitB: Set<number>;
  both: Set<number>;
}

// Memoized so the 60fps ball frames never re-render the track. Only a landing
// changes these sets, and a landing is the only thing that should repaint here.
const TrackCells = memo(function TrackCells({ trackLen, hitA, hitB, both }: CellsProps) {
  const cells = [];
  for (let n = 1; n <= trackLen; n += 1) {
    const x = PAD_L + (n - 1) * CELL + INSET;
    const w = CELL - INSET * 2;
    const meets = both.has(n);
    const litA = hitA.has(n);
    const litB = hitB.has(n);
    // A number is always readable on a square that has been landed on. On an
    // untouched square it appears only when the track is short enough to have
    // room for it, so a 100-column coprime track stays legible instead of
    // turning into grey mush.
    const showNumber =
      litA || litB || trackLen <= 30 || (trackLen <= 60 && n % 5 === 0) || n % 10 === 0;
    const size = n >= 100 ? 30 : 36;

    cells.push(
      <g key={n}>
        {meets && (
          <rect className="lcb-band" x={x - INSET} y={0} width={CELL} height={VB_H} />
        )}
        <rect
          className={`lcb-cell${litA ? " on" : ""}${meets ? " meet" : ""}`}
          x={x}
          y={ROW_A_Y}
          width={w}
          height={ROW_H}
          rx={12}
          fill={meets ? C_AMBER : litA ? C_TEAL : "#ffffff"}
          stroke={meets ? C_BROWN : litA ? C_TEAL : C_LINE}
        />
        <rect
          className={`lcb-cell${litB ? " on" : ""}${meets ? " meet" : ""}`}
          x={x}
          y={ROW_B_Y}
          width={w}
          height={ROW_H}
          rx={12}
          fill={meets ? C_AMBER : litB ? C_CORAL : "#ffffff"}
          stroke={meets ? C_BROWN : litB ? C_CORAL : C_LINE}
        />
        {/* The bridge closes the gap between the rows so a meeting reads as one
            tall block rather than two squares that happen to be near each other. */}
        {meets && (
          <rect x={x} y={ROW_A_Y + ROW_H} width={w} height={ROW_GAP} fill={C_AMBER} />
        )}
        {showNumber && (
          <>
            <text
              x={x + w / 2}
              y={ROW_A_Y + ROW_H / 2}
              className="lcb-num"
              fontSize={size}
              fill={meets ? C_INK : litA ? "#ffffff" : C_INK_SOFT}
            >
              {n}
            </text>
            <text
              x={x + w / 2}
              y={ROW_B_Y + ROW_H / 2}
              className="lcb-num"
              fontSize={size}
              fill={meets ? C_INK : litB ? "#ffffff" : C_INK_SOFT}
            >
              {n}
            </text>
          </>
        )}
      </g>,
    );
  }
  return <>{cells}</>;
});

export default function LcmBouncerBoard() {
  // Live-session directions. Without this a teacher publishing this tool from
  // /control or a Lesson Step has their prompt silently dropped - the
  // LiveToolRoute wiring contract.
  const liveTool = useLiveToolConfig("/lcm-bouncer");

  const [stepA, setStepA] = useState(4);
  const [stepB, setStepB] = useState(6);
  const [speed, setSpeed] = useState<SpeedKey>("normal");
  const [motion, setMotion] = useState<"idle" | "auto" | "step">("idle");
  const [p, setP] = useState(0);
  const [landedA, setLandedA] = useState<number[]>([]);
  const [landedB, setLandedB] = useState<number[]>([]);
  const [guess, setGuess] = useState("");
  const [guessLocked, setGuessLocked] = useState<number | null>(null);

  const trackLen = useMemo(() => trackLengthFor(stepA, stepB), [stepA, stepB]);
  const lcm = useMemo(() => lcmOf(stepA, stepB), [stepA, stepB]);
  const coprime = gcd(stepA, stepB) === 1 && stepA !== stepB;

  const engine = useRef({ p: 0, lastA: 0, lastB: 0, hold: 0, target: null as number | null });

  const reset = useCallback(() => {
    setMotion("idle");
    engine.current = { p: 0, lastA: 0, lastB: 0, hold: 0, target: null };
    setP(0);
    setLandedA([]);
    setLandedB([]);
    setGuessLocked(null);
  }, []);

  // Changing either stride is a different question, so the board starts over.
  useEffect(() => { reset(); }, [stepA, stepB, reset]);

  useEffect(() => {
    if (motion === "idle") return undefined;
    let frame = 0;
    let prev = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      const e = engine.current;

      if (now >= e.hold) {
        const v = motion === "step" ? STEP_SPEED : SPEEDS[speed];
        let next = e.p + v * dt;
        if (e.target != null && next >= e.target) next = e.target;
        if (next > trackLen) next = trackLen;
        e.p = next;

        const freshA: number[] = [];
        const freshB: number[] = [];
        while (e.lastA + stepA <= e.p + 1e-6) { e.lastA += stepA; freshA.push(e.lastA); }
        while (e.lastB + stepB <= e.p + 1e-6) { e.lastB += stepB; freshB.push(e.lastB); }
        if (freshA.length) setLandedA((prevList) => [...prevList, ...freshA]);
        if (freshB.length) setLandedB((prevList) => [...prevList, ...freshB]);

        // A meeting stops the clock briefly and snaps both balls flat on the
        // ground, so the room reads the amber column instead of watching it
        // slide past. Manual stepping already pauses, so this is auto only.
        const met = freshA.filter((n) => n % stepB === 0);
        if (met.length && motion === "auto") {
          e.p = met[met.length - 1];
          e.hold = now + MEET_HOLD_MS;
        }
      }

      setP(e.p);

      const done =
        e.p >= trackLen - 1e-6 || (motion === "step" && e.target != null && e.p >= e.target - 1e-6);
      if (done) {
        e.target = null;
        setMotion("idle");
        return;
      }
      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [motion, speed, stepA, stepB, trackLen]);

  const bounceOnce = useCallback(() => {
    const e = engine.current;
    if (e.p >= trackLen - 1e-6) return;
    // One press advances to whichever ball touches down next - so the room can
    // be asked "who lands next, and do they land together?" before every press.
    const target = Math.min(
      nextMultipleAfter(e.p, stepA),
      nextMultipleAfter(e.p, stepB),
      trackLen,
    );
    e.target = target;
    e.hold = 0;
    setMotion("step");
  }, [stepA, stepB, trackLen]);

  const togglePlay = useCallback(() => {
    const e = engine.current;
    if (motion === "auto") { setMotion("idle"); return; }
    if (e.p >= trackLen - 1e-6) return;
    e.target = null;
    e.hold = 0;
    setMotion("auto");
  }, [motion, trackLen]);

  const hitA = useMemo(() => new Set(landedA), [landedA]);
  const hitB = useMemo(() => new Set(landedB), [landedB]);
  const both = useMemo(() => new Set(landedA.filter((n) => hitB.has(n))), [landedA, hitB]);
  const meetings = useMemo(() => [...both].sort((x, y) => x - y), [both]);

  const finished = p >= trackLen - 1e-6;
  const guessNum = guessLocked;
  const firstMeet = meetings[0] ?? null;

  const phaseA = (p % stepA) / stepA;
  const phaseB = (p % stepB) / stepB;
  const yA = REST_A - arcHeight(stepA) * 4 * phaseA * (1 - phaseA);
  const yB = REST_B + arcHeight(stepB) * 4 * phaseB * (1 - phaseB);
  // Squash on contact. Only within the first sliver of a hop, so the ball reads
  // as landing rather than as permanently deformed.
  const squash = (ph: number) => (ph < 0.07 ? 1 - 0.3 * (1 - ph / 0.07) : 1);
  const sqA = squash(phaseA);
  const sqB = squash(phaseB);
  const x = colX(p);

  const vbW = PAD_L + trackLen * CELL + PAD_R;

  return (
    <div className="lcb-root">
      <style>{`
        .lcb-root {
          font-family: var(--bdb-font);
          color: var(--bdb-ink);
          background: var(--bdb-ground);
          min-height: 100vh;
          padding: 16px clamp(12px, 2.5vw, 28px) 40px;
        }
        .lcb-head { max-width: 1600px; margin: 0 auto 12px; }
        .lcb-title { font-size: clamp(1.15rem, 2.2vw, 1.6rem); font-weight: 800; letter-spacing: -0.02em; margin: 0; }
        .lcb-sub { margin: 4px 0 0; color: var(--bdb-ink-soft); font-weight: 600; font-size: 0.9rem; }
        .lcb-grid {
          max-width: 1600px; margin: 0 auto;
          display: grid; gap: 16px;
          grid-template-columns: minmax(230px, 260px) minmax(0, 1fr) minmax(230px, 260px);
          align-items: start;
        }
        @media (max-width: 1080px) { .lcb-grid { grid-template-columns: 1fr; } }
        .lcb-card {
          background: var(--bdb-card); border: 1px solid var(--bdb-line);
          border-radius: var(--bdb-r-sm); box-shadow: var(--bdb-shadow-sm);
          padding: 14px;
        }
        .lcb-card + .lcb-card { margin-top: 12px; }
        .lcb-eyebrow {
          font-size: 0.7rem; letter-spacing: 0.09em; text-transform: uppercase;
          font-weight: 700; color: var(--bdb-ink-soft); margin: 0 0 8px;
        }
        .lcb-ball-head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
        .lcb-dot { width: 20px; height: 20px; border-radius: 999px; flex: none; }
        .lcb-ball-name { font-weight: 800; font-size: 1rem; }
        .lcb-stepper { display: flex; align-items: center; gap: 10px; }
        .lcb-btn {
          font-family: inherit; font-weight: 700; cursor: pointer;
          border-radius: 999px; border: 1px solid var(--bdb-line);
          background: var(--bdb-card); color: var(--bdb-ink);
          min-height: 44px; padding: 0 16px; font-size: 0.9rem;
          transition: background 120ms, border-color 120ms, transform 80ms;
        }
        .lcb-btn:hover:not(:disabled) { background: color-mix(in srgb, var(--bdb-amber) 18%, transparent); }
        .lcb-btn:active:not(:disabled) { transform: translateY(1px); }
        .lcb-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .lcb-btn.solid { background: var(--bdb-ink); color: #fff; border-color: var(--bdb-ink); }
        .lcb-btn.solid:hover:not(:disabled) { background: #000; }
        .lcb-round { width: 44px; padding: 0; font-size: 1.3rem; line-height: 1; }
        .lcb-stepval { font-size: 2rem; font-weight: 800; min-width: 2ch; text-align: center; letter-spacing: -0.02em; }
        .lcb-hint { font-size: 0.78rem; color: var(--bdb-ink-soft); font-weight: 600; margin: 8px 0 0; }
        .lcb-mults { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 10px; min-height: 26px; }
        .lcb-chip {
          font-size: 0.82rem; font-weight: 800; padding: 3px 9px; border-radius: 999px;
          background: #fff; border: 1px solid currentColor;
        }
        .lcb-count { font-size: 0.82rem; font-weight: 700; color: var(--bdb-ink-soft); margin-top: 8px; }
        .lcb-count b { color: var(--bdb-ink); font-size: 1.05rem; }
        .lcb-stage { background: var(--bdb-card); border: 1px solid var(--bdb-line); border-radius: var(--bdb-r-sm); box-shadow: var(--bdb-shadow-sm); padding: 10px; }
        .lcb-svg { width: 100%; height: auto; display: block; }
        .lcb-num { text-anchor: middle; dominant-baseline: central; font-weight: 800; font-family: var(--bdb-font); }
        .lcb-cell { stroke-width: 3; }
        .lcb-cell.on { animation: lcb-pop 420ms ease-out; }
        .lcb-cell.meet { animation: lcb-meet 620ms ease-out; }
        @keyframes lcb-pop { from { stroke-width: 16; } to { stroke-width: 3; } }
        @keyframes lcb-meet { from { stroke-width: 24; } to { stroke-width: 3; } }
        .lcb-band { fill: ${C_AMBER}; opacity: 0.15; }
        .lcb-transport { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 12px; }
        .lcb-spacer { flex: 1 1 auto; }
        .lcb-speed { display: flex; gap: 4px; }
        .lcb-speed .lcb-btn { padding: 0 12px; font-size: 0.82rem; }
        .lcb-speed .lcb-btn.on { background: var(--bdb-ink); color: #fff; border-color: var(--bdb-ink); }
        .lcb-meet-card {
          border: 1px solid var(--bdb-line); border-left: 5px solid ${C_AMBER};
          border-radius: var(--bdb-r-sm); padding: 10px 12px; background: #fff; margin-bottom: 8px;
        }
        .lcb-meet-tag { font-size: 0.66rem; letter-spacing: 0.09em; text-transform: uppercase; font-weight: 800; color: ${C_BROWN}; }
        .lcb-meet-n { font-size: 2rem; font-weight: 800; letter-spacing: -0.03em; line-height: 1.05; }
        .lcb-meet-row { font-size: 0.8rem; font-weight: 700; margin-top: 4px; }
        .lcb-empty { font-size: 0.85rem; color: var(--bdb-ink-soft); font-weight: 600; line-height: 1.5; }
        .lcb-guess { display: flex; gap: 6px; margin-top: 8px; }
        .lcb-input {
          font-family: inherit; font-weight: 800; font-size: 1rem; width: 100%;
          min-height: 44px; padding: 0 12px; border-radius: var(--bdb-r-sm);
          border: 1px solid var(--bdb-line); background: #fff; color: var(--bdb-ink);
        }
        .lcb-verdict { font-size: 0.84rem; font-weight: 700; margin-top: 8px; line-height: 1.45; }
        .lcb-note { font-size: 0.8rem; font-weight: 600; color: var(--bdb-ink-soft); line-height: 1.5; margin-top: 10px; }
      `}</style>

      <div className="lcb-head">
        <h1 className="lcb-title">LCM Bouncer</h1>
        <p className="lcb-sub">
          Two balls, one track, same speed, different strides. Watch for the square they both land on.
        </p>
      </div>

      <LiveToolBanner tool={liveTool} style={{ maxWidth: 1600, margin: "0 auto 14px" }} />

      <div className="lcb-grid">
        {/* LEFT RAIL - the reference. What each ball is doing and the list of
            landings it has made, which is that ball's multiples written out. */}
        <div>
          <div className="lcb-card">
            <div className="lcb-ball-head">
              <span className="lcb-dot" style={{ background: C_TEAL }} />
              <span className="lcb-ball-name">Ball A</span>
            </div>
            <div className="lcb-stepper">
              <button
                type="button"
                className="lcb-btn lcb-round"
                onClick={() => setStepA((s) => clamp(s - 1, MIN_STEP, MAX_STEP))}
                disabled={stepA <= MIN_STEP}
                aria-label="Ball A smaller stride"
              >
                -
              </button>
              <span className="lcb-stepval" style={{ color: C_TEAL }}>{stepA}</span>
              <button
                type="button"
                className="lcb-btn lcb-round"
                onClick={() => setStepA((s) => clamp(s + 1, MIN_STEP, MAX_STEP))}
                disabled={stepA >= MAX_STEP}
                aria-label="Ball A bigger stride"
              >
                +
              </button>
              <span className="lcb-hint" style={{ margin: 0 }}>squares per hop</span>
            </div>
            <div className="lcb-count">Bounces so far: <b>{landedA.length}</b></div>
            <div className="lcb-mults">
              {landedA.map((n) => (
                <span key={n} className="lcb-chip" style={{ color: both.has(n) ? C_BROWN : C_TEAL }}>{n}</span>
              ))}
            </div>
          </div>

          <div className="lcb-card">
            <div className="lcb-ball-head">
              <span className="lcb-dot" style={{ background: C_CORAL }} />
              <span className="lcb-ball-name">Ball B</span>
            </div>
            <div className="lcb-stepper">
              <button
                type="button"
                className="lcb-btn lcb-round"
                onClick={() => setStepB((s) => clamp(s - 1, MIN_STEP, MAX_STEP))}
                disabled={stepB <= MIN_STEP}
                aria-label="Ball B smaller stride"
              >
                -
              </button>
              <span className="lcb-stepval" style={{ color: C_CORAL }}>{stepB}</span>
              <button
                type="button"
                className="lcb-btn lcb-round"
                onClick={() => setStepB((s) => clamp(s + 1, MIN_STEP, MAX_STEP))}
                disabled={stepB >= MAX_STEP}
                aria-label="Ball B bigger stride"
              >
                +
              </button>
              <span className="lcb-hint" style={{ margin: 0 }}>squares per hop</span>
            </div>
            <div className="lcb-count">Bounces so far: <b>{landedB.length}</b></div>
            <div className="lcb-mults">
              {landedB.map((n) => (
                <span key={n} className="lcb-chip" style={{ color: both.has(n) ? C_BROWN : C_CORAL }}>{n}</span>
              ))}
            </div>
          </div>

          <div className="lcb-card">
            <p className="lcb-eyebrow">Before you press play</p>
            <div className="lcb-empty">Which square do you think they both land on?</div>
            <div className="lcb-guess">
              <input
                className="lcb-input"
                inputMode="numeric"
                value={guess}
                onChange={(ev) => setGuess(ev.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                placeholder="Your number"
                disabled={guessLocked != null}
              />
              <button
                type="button"
                className="lcb-btn"
                disabled={!guess || guessLocked != null}
                onClick={() => setGuessLocked(Number(guess))}
              >
                Lock it
              </button>
            </div>
            {guessNum != null && firstMeet == null && (
              <div className="lcb-verdict">Locked in: {guessNum}. Now find out.</div>
            )}
            {guessNum != null && firstMeet != null && (
              <div className="lcb-verdict" style={{ color: guessNum === firstMeet ? "#2f9e6f" : C_BROWN }}>
                {guessNum === firstMeet
                  ? `You said ${guessNum}. They met at ${firstMeet}.`
                  : `You said ${guessNum}. They first met at ${firstMeet}. What made you pick ${guessNum}?`}
              </div>
            )}
          </div>
        </div>

        {/* CENTER - the thing being acted on. */}
        <div>
          <div className="lcb-stage">
            <svg className="lcb-svg" viewBox={`0 0 ${vbW} ${VB_H}`} role="img" aria-label={`Track of ${trackLen} squares. Ball A hops ${stepA}, Ball B hops ${stepB}.`}>
              <TrackCells trackLen={trackLen} hitA={hitA} hitB={hitB} both={both} />
              {/* Start line - where both balls begin, so zero is visibly not a landing. */}
              <line x1={PAD_L - 14} y1={ROW_A_Y - 6} x2={PAD_L - 14} y2={ROW_B_Y + ROW_H + 6} stroke={C_LINE} strokeWidth={4} strokeDasharray="10 8" />
              <ellipse cx={x} cy={yA + BALL_R * (1 - sqA)} rx={BALL_R * (2 - sqA)} ry={BALL_R * sqA} fill={C_TEAL} />
              <ellipse cx={x} cy={yB - BALL_R * (1 - sqB)} rx={BALL_R * (2 - sqB)} ry={BALL_R * sqB} fill={C_CORAL} />
            </svg>
          </div>

          <div className="lcb-transport">
            <button type="button" className="lcb-btn solid" onClick={togglePlay} disabled={finished}>
              {motion === "auto" ? "Pause" : "Play"}
            </button>
            <button type="button" className="lcb-btn" onClick={bounceOnce} disabled={motion !== "idle" || finished}>
              Bounce once
            </button>
            <button type="button" className="lcb-btn" onClick={reset}>Reset</button>
            <span className="lcb-spacer" />
            <div className="lcb-speed">
              {(Object.keys(SPEEDS) as SpeedKey[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`lcb-btn${speed === k ? " on" : ""}`}
                  onClick={() => setSpeed(k)}
                >
                  {k === "slow" ? "Slow" : k === "normal" ? "Normal" : "Fast"}
                </button>
              ))}
            </div>
          </div>
          {finished && (
            <p className="lcb-hint">
              End of the track. Reset to run it again, or change a stride to ask a new question.
            </p>
          )}
        </div>

        {/* RIGHT RAIL - the product. The meetings, in the order they happened. */}
        <div>
          <div className="lcb-card">
            <p className="lcb-eyebrow">Landed together</p>
            {meetings.length === 0 && (
              <div className="lcb-empty">
                Nothing yet. Keep bouncing. Ball A is only on multiples of {stepA}, Ball B only on multiples of {stepB} - they can only meet on a square that belongs to both lists.
              </div>
            )}
            {meetings.map((n, i) => (
              <div key={n} className="lcb-meet-card">
                <div className="lcb-meet-tag">{i === 0 ? "Least common multiple" : `Common multiple ${i + 1}`}</div>
                <div className="lcb-meet-n">{n}</div>
                <div className="lcb-meet-row" style={{ color: C_TEAL }}>Ball A: {n / stepA} bounces</div>
                <div className="lcb-meet-row" style={{ color: C_CORAL }}>Ball B: {n / stepB} bounces</div>
              </div>
            ))}
            {meetings.length >= 2 && (
              <p className="lcb-note">
                Look at the gap between the amber columns. Every meeting is {meetings[0]} further along than the one before it - so every common multiple is a multiple of the least one.
              </p>
            )}
            {coprime && meetings.length === 0 && (
              <p className="lcb-note">
                {stepA} and {stepB} share no factors, so the earliest they can meet is {stepA} x {stepB} = {lcm}. That is a long walk.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
