"use client";

/**
 * "Stuck? Walk it through." - the M1.T1.L1 distributive-property walkthrough.
 *
 * Six click-to-advance steps that build one worked example on a single stage:
 * rewrite the problem, draw the box template, pick the friendly factor, split
 * the other one, then multiply and add. Earlier steps stay on the stage and dim
 * to 0.34 so the current step pops but the whole chain of reasoning is still
 * there - the point is that the student sees where the number came from.
 *
 * Built from the Claude Design handoff "Distributive Walkthrough" (project
 * c5b70077, design_handoff_distributive_walkthrough/README.md). The stage is a
 * fixed 980 x 560 coordinate space, so every mark below is a literal from that
 * document; do not "tidy" the coordinates or the animation delays, they are
 * hand-tuned against each other. Three things deliberately differ from the
 * prototype, and each one is a site rule the handoff defers to:
 *
 *   1. CONTRAST. The prototype puts white on #F2820C (2.6:1) and uses #8A8378
 *      and #A99F91 as text. This repo's accessibility pass forbids that, so the
 *      step badge carries an INK number (the GEMS-tile precedent), and the
 *      accent, teal and green get their AA companions wherever they are READ
 *      rather than drawn. The bright originals stay for fills and strokes.
 *   2. TYPE. Numerals are Albert Sans (--bdb-font), the site's real body font,
 *      not the design system's Geist. Caveat is loaded for the handwritten
 *      annotations only, which are semantic here.
 *   3. NARROW SCREENS. Below 900px the "answer to match" panel leaves the stage
 *      and becomes a real card above it, and the stage narrows to its left
 *      column, so the page never scrolls sideways on a phone. Step 1's sentence
 *      follows the layout - see AnswerLocation in lib/distributiveWalkthrough.
 *
 * Reduced motion renders every step's finished state immediately.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  WALKTHROUGH_STEP_COUNT,
  walkthroughEquation,
  walkthroughSteps,
  walkthroughValues,
  type WalkthroughProblem,
} from "@/lib/distributiveWalkthrough";

export interface DistributiveWalkthroughProps {
  /** Which example to walk through. Never the student's own problem - see walkthroughExampleFor. */
  problem: WalkthroughProblem;
  /** Badge, circle, spot-1 numeral, card strip. Defaults to the design's orange. */
  accent?: string;
  /** Completed steps fade to 0.34. Off keeps every step at full strength. */
  dimPast?: boolean;
  /** "page" fills the viewport; "overlay" floats over whatever opened it. */
  variant?: "page" | "overlay";
  /** Rendered as the way out. Omit and no exit control appears. */
  onClose?: () => void;
  closeLabel?: string;
  /** Fires the first time the student reaches the last step. */
  onComplete?: () => void;
}

const STAGE_W = 980;
const STAGE_W_NARROW = 620;
const STAGE_H = 560;
/** Below this the answer panel leaves the stage. From the handoff's "Responsive". */
const NARROW_AT = 900;

const ACCENT = "#f2820c";
const REVEAL = "cubic-bezier(0.2,0.7,0.2,1)";
const CIRCLE_EASE = "cubic-bezier(0.4,0,0.5,1)";

function anim(name: string, duration: number, delay: number, ease: string = REVEAL): string {
  return `${name} ${duration}ms ${ease} ${delay}ms both`;
}

/** An absolutely-positioned mark on the stage. Coordinates are stage-space px. */
function Mark({
  left,
  top,
  width,
  em,
  color,
  weight,
  hand,
  rotate,
  align = "center",
  animation,
  children,
}: {
  left: number;
  top: number;
  width?: number;
  em?: number;
  color?: string;
  weight?: number;
  hand?: boolean;
  rotate?: number;
  align?: "center" | "left";
  animation: string;
  children: React.ReactNode;
}) {
  const ink: React.CSSProperties = {
    fontSize: em == null ? undefined : `${em}em`,
    color,
    fontWeight: weight,
    fontFamily: hand ? "var(--dw-hand)" : undefined,
    animation,
  };

  // The doodles rotate. Keep the rotation on a wrapper: the reveal animates
  // transform, so sharing one element would drop the tilt on the first frame.
  if (rotate != null) {
    return (
      <div style={{ position: "absolute", left, top, transform: `rotate(${rotate}deg)` }}>
        <div className="dw-anim" style={ink}>{children}</div>
      </div>
    );
  }

  return (
    <div
      className="dw-anim"
      style={{ position: "absolute", left, top, width, textAlign: width ? align : undefined, ...ink }}
    >
      {children}
    </div>
  );
}

/** One drawn line. `len` is the path length the dash animation runs over. */
function Stroke({
  d,
  len,
  duration,
  delay,
  color,
  width = 4.5,
  ease = "ease-in-out",
}: {
  d: string;
  len: number;
  duration: number;
  delay: number;
  color: string;
  width?: number;
  ease?: string;
}) {
  return (
    <path
      className="dw-anim"
      d={d}
      style={{
        stroke: color,
        strokeWidth: width,
        strokeDasharray: len,
        strokeDashoffset: len,
        animation: anim("dw-draw", duration, delay, ease),
      }}
    />
  );
}

function StageOverlay({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
      width={STAGE_W}
      height={STAGE_H}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        overflow: "visible",
        pointerEvents: "none",
        fill: "none",
        strokeLinecap: "round",
        strokeLinejoin: "round",
      }}
    >
      {children}
    </svg>
  );
}

/** The three dashed spots the template is drawn into. */
function TemplateBox({ left, delay }: { left: number; delay: number }) {
  return (
    <div
      className="dw-anim dw-box"
      style={{ left, top: 178, animation: anim("dw-box", 360, delay) }}
    />
  );
}

export default function DistributiveWalkthrough({
  problem,
  accent = ACCENT,
  dimPast = true,
  variant = "page",
  onClose,
  closeLabel = "Close",
  onComplete,
}: DistributiveWalkthroughProps) {
  const [step, setStep] = useState(1);
  // True for one frame to unmount every layer, which is what restarts the CSS
  // animations for Replay step.
  const [blank, setBlank] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [scale, setScale] = useState(1);

  const stageWrapRef = useRef<HTMLDivElement | null>(null);
  const blankTimer = useRef<number | null>(null);
  const completed = useRef(false);

  const { a, b, p, q, firstProduct, secondProduct, total } = walkthroughValues(problem);
  const steps = useMemo(
    () => walkthroughSteps(problem, { answerLocation: narrow ? "above" : "right" }),
    [problem, narrow],
  );
  const current = steps[step - 1];
  const stageWidth = narrow ? STAGE_W_NARROW : STAGE_W;

  const advance = useCallback(() => {
    // Updater form, not step + 1: rapid clicks must each register.
    setStep((s) => (s >= WALKTHROUGH_STEP_COUNT ? 1 : s + 1));
  }, []);
  const retreat = useCallback(() => setStep((s) => Math.max(1, s - 1)), []);
  const replay = useCallback(() => {
    setBlank(true);
    if (blankTimer.current != null) window.clearTimeout(blankTimer.current);
    blankTimer.current = window.setTimeout(() => setBlank(false), 50);
  }, []);

  useEffect(() => () => {
    if (blankTimer.current != null) window.clearTimeout(blankTimer.current);
  }, []);

  useEffect(() => {
    if (step < WALKTHROUGH_STEP_COUNT || completed.current) return;
    completed.current = true;
    onComplete?.();
  }, [step, onComplete]);

  // Scale the stage to whatever room it actually has. Measured off the wrapper,
  // never window.innerWidth - that reports the pane frame inside an embedded
  // preview and lies under browser zoom.
  useEffect(() => {
    const el = stageWrapRef.current;
    const measure = () => {
      const room = el?.clientWidth || 0;
      // A zero rect means the tab is not fronted yet; keep the last good value
      // and let the observer fire again rather than collapsing the stage.
      if (room <= 0) return;
      const isNarrow = room < NARROW_AT;
      setNarrow(isNarrow);
      setScale(Math.min(1, room / (isNarrow ? STAGE_W_NARROW : STAGE_W)));
    };
    measure();
    const observer = el && typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (el && observer) observer.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (onClose) {
          event.preventDefault();
          onClose();
        }
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        retreat();
        return;
      }
      if (event.key !== "ArrowRight" && event.key !== " " && event.key !== "Enter") return;
      // Space and Enter belong to whatever control has focus - swallowing them
      // here would fire Back or a rail button and advance in the same keystroke.
      const focused = document.activeElement?.tagName;
      if (event.key !== "ArrowRight" && (focused === "BUTTON" || focused === "A" || focused === "INPUT")) return;
      event.preventDefault();
      advance();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, retreat, onClose]);

  // An overlay owns the viewport while it is up.
  useEffect(() => {
    if (variant !== "overlay") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [variant]);

  const live = (n: number) => !blank && step >= n;
  const layer = (n: number): React.CSSProperties => ({
    position: "absolute",
    inset: 0,
    transition: "opacity 300ms",
    opacity: n === step ? 1 : dimPast ? 0.34 : 1,
  });

  return (
    <div className={`dw-root${variant === "overlay" ? " dw-overlay" : ""}`}>
      <style>{`
        .dw-root { --dw-accent:${accent}; --dw-accent-text:#c4660a; --dw-violet:#845bc9;
          --dw-teal:#50a3a4; --dw-teal-text:var(--bdb-teal-deep); --dw-green:#2e9e5a;
          --dw-green-text:var(--bdb-green-deep); --dw-brown:var(--bdb-brown);
          --dw-ink:#201e1a; --dw-body:#4a453e; --dw-muted:var(--bdb-ink-soft);
          --dw-faint:var(--bdb-ink-faint); --dw-line:#dbd5c9; --dw-paper:#f6f3ec;
          --dw-sunk:#ece7dd; --dw-panel:#faf8f3; --dw-hand:var(--bdb-font-hand);
          box-sizing:border-box; min-height:100dvh; background:#ece8e0; color:var(--dw-ink);
          font-family:var(--bdb-font); padding:26px 24px 40px; }
        .dw-root.dw-overlay { position:fixed; inset:0; z-index:90; overflow:auto; }
        .dw-root *, .dw-root *::before, .dw-root *::after { box-sizing:border-box; }

        .dw-shell { width:min(1032px,100%); margin:0 auto; display:flex; flex-direction:column; gap:14px; }
        .dw-head { display:flex; align-items:flex-start; gap:14px; }
        .dw-headtext { flex:1; min-width:0; display:flex; align-items:baseline; gap:14px; flex-wrap:wrap; }
        .dw-title { font-weight:800; font-size:clamp(20px,4.6vw,24px); letter-spacing:-0.02em; }
        .dw-sub { font-size:14px; color:var(--dw-muted); }
        .dw-head p, .dw-head h1 { margin:0; }
        .dw-exit { flex:none; font:inherit; font-size:13px; font-weight:700;
          color:var(--dw-body); background:var(--bdb-card); border:1px solid var(--dw-line);
          border-radius:12px; padding:9px 16px; min-height:44px; cursor:pointer; }
        .dw-exit:hover { background:var(--dw-paper); }

        .dw-card { position:relative; background:var(--bdb-card); border-radius:16px;
          padding:clamp(14px,2.6vw,26px); overflow:hidden; display:flex; flex-direction:column; gap:16px;
          box-shadow:0 1px 2px rgba(32,30,26,0.04), 0 12px 32px -12px rgba(32,30,26,0.18); }
        .dw-strip { position:absolute; left:0; right:0; top:0; height:4px; background:var(--dw-accent);
          border-radius:4px; }

        .dw-band { display:flex; align-items:center; gap:20px; background:var(--dw-sunk);
          border-radius:18px; padding:18px 22px; flex-wrap:wrap; }
        .dw-badge { flex:none; width:60px; height:60px; border-radius:20px; display:flex;
          align-items:center; justify-content:center; font-weight:800; font-size:28px;
          /* Ink, not white: white on this orange is 2.6:1. Same call as the GEMS tiles. */
          color:var(--dw-ink); background:var(--dw-accent);
          box-shadow:0 6px 14px -8px rgba(32,30,26,0.55); }
        .dw-say { flex:1; min-width:0; }
        .dw-say p { margin:0; }
        .dw-step-title { font-weight:800; font-size:clamp(21px,4.4vw,29px); line-height:1.12;
          letter-spacing:-0.02em; text-wrap:pretty; }
        .dw-step-text { font-size:clamp(16px,3.2vw,19px); font-weight:500; line-height:1.4;
          margin-top:5px; max-width:66ch; text-wrap:pretty; }
        .dw-count { flex:none; display:flex; flex-direction:column; align-items:flex-end; gap:8px; }
        .dw-count-label { font-size:11px; font-weight:700; letter-spacing:0.1em;
          text-transform:uppercase; color:var(--dw-muted); }
        .dw-rail { display:flex; gap:7px; }
        .dw-rail button { width:40px; height:40px; border-radius:12px; font:inherit; font-weight:700;
          font-size:14px; font-variant-numeric:tabular-nums; cursor:pointer;
          background:var(--bdb-card); border:1.5px solid var(--dw-line); color:var(--dw-faint); }
        .dw-rail button.done { background:var(--dw-paper); border-color:transparent; color:var(--dw-body); }
        .dw-rail button.here { background:var(--dw-ink); border-color:var(--dw-ink); color:#fff; }

        .dw-answer { border:1px solid var(--dw-line); border-radius:16px; background:var(--dw-panel);
          padding:14px 18px; text-align:center; }
        .dw-answer p { margin:0; }
        .dw-answer-label { font-size:11px; font-weight:700; letter-spacing:0.1em;
          text-transform:uppercase; color:var(--dw-muted); }
        .dw-answer-row { margin-top:6px; font-size:clamp(24px,6vw,32px); font-weight:700; }
        .dw-answer-row .v { color:var(--dw-faint); }
        .dw-answer-row .v.done { color:var(--dw-green-text); font-weight:800; }
        .dw-answer-check { margin-top:4px; font-family:var(--dw-hand); font-weight:600;
          font-size:20px; color:var(--dw-green-text); }

        .dw-stagewrap { overflow:hidden; }
        .dw-stage { position:relative; cursor:pointer; user-select:none; line-height:1;
          font-weight:700; letter-spacing:-0.01em; font-size:40px;
          transform-origin:top left; }
        .dw-panel { position:absolute; left:632px; top:0; width:348px; height:${STAGE_H}px;
          border-radius:16px; background:var(--dw-panel); }
        .dw-box { position:absolute; width:88px; height:88px; border:3px dashed var(--dw-line);
          border-radius:16px; background:var(--dw-panel); }

        .dw-foot { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
        .dw-btn { font:inherit; font-weight:700; font-size:14px; border-radius:12px;
          padding:11px 18px; min-height:44px; cursor:pointer; border:1px solid var(--dw-line);
          background:var(--bdb-card); color:var(--dw-ink); }
        .dw-btn:hover:not(:disabled) { background:var(--dw-paper); }
        .dw-btn:active:not(:disabled) { transform:translateY(1px); }
        .dw-btn:disabled { opacity:0.42; cursor:not-allowed; }
        .dw-btn.ghost { background:transparent; border-color:transparent; color:var(--dw-muted); }
        .dw-btn.ghost:hover { color:var(--dw-ink); }
        /* Ink, not the design system's teal "action": teal is the products colour
           on the stage, and a control that borrows it muddies the mapping. */
        .dw-btn.go { background:var(--dw-ink); border-color:var(--dw-ink); color:#fff;
          font-size:16px; padding:14px 26px; min-height:52px; }
        .dw-btn.go:hover { background:#000; }
        .dw-hint { flex:1; min-width:150px; font-size:11px; color:var(--dw-muted); }
        .dw-root :focus-visible { outline:3px solid color-mix(in srgb, var(--dw-teal) 45%, transparent);
          outline-offset:2px; }

        .dw-sr { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden;
          clip-path:inset(50%); white-space:nowrap; border:0; }

        /* Phone. A stuck student should not have to scroll past a title and a
           step rail to reach the mathematics, so the chrome gets out of the way.
           Same threshold the stage uses to move the answer panel. */
        @media (max-width: 900px) {
          .dw-root { padding:16px 14px 28px; }
          .dw-shell { gap:12px; }
          .dw-card { gap:12px; }
          .dw-band { gap:14px; padding:14px 16px; }
          .dw-badge { width:44px; height:44px; border-radius:14px; font-size:22px; }
          /* The rail gets its own full-width row under the step. The "STEP n OF 6"
             label goes: the badge already says the number and the rail already
             says the position, and it is still in the spoken announcement. */
          .dw-count { flex:1 0 100%; align-items:stretch; }
          .dw-count-label { display:none; }
          .dw-rail { justify-content:space-between; }
          .dw-rail button { width:38px; height:38px; }
          .dw-foot .dw-hint { order:3; flex-basis:100%; }
          .dw-foot .dw-btn.go { order:2; margin-left:auto; }
        }

        @keyframes dw-fade { from { opacity:0; transform:translateY(9px); } to { opacity:1; transform:none; } }
        @keyframes dw-box { from { opacity:0; transform:scale(0.9); } to { opacity:1; transform:scale(1); } }
        @keyframes dw-draw { to { stroke-dashoffset:0; } }
        @keyframes dw-pop { 0% { opacity:0; transform:scale(0.7); } 60% { opacity:1; transform:scale(1.08); }
          100% { opacity:1; transform:scale(1); } }

        /* Reduced motion: every step lands in its finished state at once. The
           layout is already correct with the reveals off; the drawn lines just
           need their dash offset closed. */
        @media (prefers-reduced-motion: reduce) {
          .dw-anim { animation:none !important; opacity:1 !important; transform:none !important;
            clip-path:none !important; stroke-dashoffset:0 !important; }
          .dw-layer { transition:none !important; }
          .dw-btn:active:not(:disabled) { transform:none; }
        }
      `}</style>

      <div className="dw-shell">
        <div className="dw-head">
          <div className="dw-headtext">
            <h1 className="dw-title">Stuck? Walk it through.</h1>
            <p className="dw-sub">Breaking a multiplication into friendly pieces.</p>
          </div>
          {onClose ? (
            <button className="dw-exit" type="button" onClick={onClose}>{closeLabel}</button>
          ) : null}
        </div>

        <div className="dw-card">
          <span className="dw-strip" aria-hidden="true" />

          <div className="dw-band">
            <div className="dw-badge" aria-hidden="true">{step}</div>
            <div className="dw-say">
              <p className="dw-step-title">{current.title}</p>
              <p className="dw-step-text">{current.sentence}</p>
            </div>
            <div className="dw-count">
              <span className="dw-count-label">Step {step} of {WALKTHROUGH_STEP_COUNT}</span>
              <div className="dw-rail">
                {steps.map((s, i) => {
                  const n = i + 1;
                  return (
                    <button
                      key={s.label}
                      type="button"
                      className={n === step ? "here" : n < step ? "done" : ""}
                      aria-label={`Step ${n}: ${s.label}`}
                      aria-current={n === step ? "step" : undefined}
                      onClick={() => setStep(n)}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* The only version of the step a screen reader gets - the stage below
              is decorative absolutely-positioned glyphs. */}
          <p className="dw-sr" aria-live="polite">
            {`Step ${step} of ${WALKTHROUGH_STEP_COUNT}. ` +
              // Step 3's title is a question, and "with?." reads as a stumble.
              `${current.title}${/[.?!]$/.test(current.title) ? "" : "."} ` +
              `${current.sentence} ${current.summary}`}
          </p>

          {narrow ? (
            <div className="dw-answer">
              <p className="dw-answer-label">The answer to match</p>
              <p className="dw-answer-row">
                <span>{a} × {b} = </span>
                <span className={`v${step >= WALKTHROUGH_STEP_COUNT ? " done" : ""}`}>
                  {step >= WALKTHROUGH_STEP_COUNT ? total : "?"}
                </span>
              </p>
              {step >= WALKTHROUGH_STEP_COUNT ? <p className="dw-answer-check">same answer ✓</p> : null}
            </div>
          ) : null}

          <div className="dw-stagewrap" ref={stageWrapRef} style={{ height: STAGE_H * scale }}>
            <p className="dw-sr">{walkthroughEquation(problem)}</p>
            <div
              className="dw-stage"
              aria-hidden="true"
              onClick={advance}
              style={{ width: stageWidth, height: STAGE_H, transform: `scale(${scale})` }}
            >
              {narrow ? null : <div className="dw-panel" />}

              {/* 1 - Rewrite the problem */}
              {live(1) ? (
                <div className="dw-layer" style={layer(1)}>
                  <Mark left={46} top={30} width={68} em={1.45} animation={anim("dw-fade", 520, 0)}>{a}</Mark>
                  <Mark left={118} top={38} width={60} em={1.05} color="var(--dw-muted)" animation={anim("dw-fade", 420, 170)}>×</Mark>
                  <Mark left={178} top={30} width={76} em={1.45} animation={anim("dw-fade", 560, 320)}>{b}</Mark>
                  {narrow ? null : (
                    <>
                      <div
                        className="dw-anim"
                        style={{
                          position: "absolute", left: 664, top: 214, width: 284, textAlign: "center",
                          fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                          color: "var(--dw-muted)", animation: anim("dw-fade", 400, 620, "ease-out"),
                        }}
                      >
                        The answer to match
                      </div>
                      <div style={{ position: "absolute", left: 664, top: 254, width: 284, display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
                        <div className="dw-anim" style={{ fontSize: "1.15em", animation: anim("dw-fade", 520, 760) }}>
                          {a} × {b} =
                        </div>
                        {/* Fixed width so the equation centres identically once
                            the ? is replaced by the total. */}
                        <div style={{ width: 96, textAlign: "left" }}>
                          {step < WALKTHROUGH_STEP_COUNT ? (
                            <div className="dw-anim" style={{ fontSize: "1.15em", color: "var(--dw-faint)", animation: anim("dw-fade", 400, 1120, "ease-out") }}>?</div>
                          ) : null}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : null}

              {/* 2 - Draw the template */}
              {live(2) ? (
                <div className="dw-layer" style={layer(2)}>
                  <TemplateBox left={36} delay={60} />
                  <Mark left={130} top={190} width={36} em={1.9} weight={500} color="var(--dw-muted)" animation={anim("dw-fade", 320, 340, "ease-out")}>(</Mark>
                  <TemplateBox left={168} delay={460} />
                  <Mark left={262} top={200} width={36} em={1.25} color="var(--dw-muted)" animation={anim("dw-fade", 320, 700, "ease-out")}>+</Mark>
                  <TemplateBox left={300} delay={820} />
                  <Mark left={396} top={190} width={36} em={1.9} weight={500} color="var(--dw-muted)" animation={anim("dw-fade", 320, 1020, "ease-out")}>)</Mark>
                </div>
              ) : null}

              {/* 3 - Which factor is easier to work with? The lesson's one decision. */}
              {live(3) ? (
                <div className="dw-layer" style={layer(3)}>
                  <Mark left={8} top={4} em={1.1} hand rotate={-16} color="var(--dw-brown)" animation={anim("dw-fade", 300, 60)}>?</Mark>
                  <Mark left={262} top={22} em={1.1} hand rotate={13} color="var(--dw-brown)" animation={anim("dw-fade", 300, 220)}>?</Mark>
                  <Mark left={428} top={116} em={0.62} hand rotate={-8} color="var(--dw-faint)" animation={anim("dw-fade", 300, 380)}>which one is friendlier?</Mark>
                  <StageOverlay>
                    <Stroke
                      d="M 82 20 C 50 18 32 44 36 72 C 40 102 58 122 82 120 C 106 118 124 96 122 68 C 120 40 104 22 78 19 C 71 18 66 21 62 26"
                      len={320} duration={700} delay={560} color={accent} ease={CIRCLE_EASE}
                    />
                    <Stroke d="M 80 128 C 80 146 80 156 80 166" len={44} duration={320} delay={1320} color={accent} />
                    <Stroke d="M 68 154 L 80 170 L 92 154" len={40} duration={180} delay={1620} color={accent} ease="linear" />
                  </StageOverlay>
                  <Mark left={36} top={190} width={88} em={1.4} color="var(--dw-accent-text)" animation={anim("dw-fade", 480, 1820)}>{a}</Mark>
                </div>
              ) : null}

              {/* 4 - Split the other factor. Both arrows land tip-on at the top
                  edge of the box the number is about to be written into. */}
              {live(4) ? (
                <div className="dw-layer" style={layer(4)}>
                  <StageOverlay>
                    <Stroke d="M 214 112 C 214 134 213 150 212 164" len={60} duration={340} delay={80} color="var(--dw-violet)" />
                    <Stroke d="M 200 152 L 212 170 L 224 152" len={42} duration={170} delay={400} color="var(--dw-violet)" ease="linear" />
                    <Stroke d="M 240 108 C 288 124 322 138 342 160" len={130} duration={400} delay={640} color="var(--dw-violet)" />
                    <Stroke d="M 330 148 L 346 170 L 350 146" len={48} duration={180} delay={1020} color="var(--dw-violet)" ease="linear" />
                  </StageOverlay>
                  <Mark left={168} top={190} width={88} em={1.4} color="var(--dw-violet)" animation={anim("dw-fade", 460, 1200)}>{p}</Mark>
                  <Mark left={300} top={190} width={88} em={1.4} color="var(--dw-violet)" animation={anim("dw-fade", 400, 1540)}>{q}</Mark>
                  <Mark left={470} top={40} em={0.78} weight={600} hand color="var(--dw-muted)" animation={anim("dw-fade", 420, 1880, "ease-out")}>
                    {p} + {q} = {b}
                  </Mark>
                </div>
              ) : null}

              {/* 5 - The multiplication is written before its answer, on purpose. */}
              {live(5) ? (
                <div className="dw-layer" style={layer(5)}>
                  <StageOverlay>
                    <Stroke d="M 80 276 C 80 300 120 306 168 302" len={130} duration={460} delay={80} color="var(--dw-teal)" />
                    <Stroke d="M 154 294 L 172 302 L 155 311" len={40} duration={170} delay={520} color="var(--dw-teal)" ease="linear" />
                    <Stroke d="M 212 276 C 212 288 212 292 212 296" len={24} duration={200} delay={700} color="var(--dw-teal)" ease="ease-out" />
                    <Stroke d="M 212 344 C 212 356 212 360 212 364" len={24} duration={200} delay={1320} color="var(--dw-teal)" ease="ease-out" />
                    <Stroke d="M 203 353 L 212 368 L 221 353" len={34} duration={150} delay={1500} color="var(--dw-teal)" ease="linear" />
                  </StageOverlay>
                  <Mark left={148} top={306} width={128} em={0.78} color="var(--dw-teal-text)" animation={anim("dw-fade", 460, 780)}>
                    {a} × {p}
                  </Mark>
                  <Mark left={156} top={372} width={112} em={1.3} color="var(--dw-teal-text)" animation={anim("dw-pop", 420, 1660)}>
                    {firstProduct}
                  </Mark>
                </div>
              ) : null}

              {/* 6 - Second product, the sum, and the tie back to the target. The
                  sweep is routed BELOW the products row: an earlier version cut
                  through the first product's label and read as a strikethrough. */}
              {live(6) ? (
                <div className="dw-layer" style={layer(6)}>
                  <StageOverlay>
                    <Stroke d="M 74 280 C 52 372 170 392 296 344" len={300} duration={560} delay={80} color="var(--dw-teal)" />
                    <Stroke d="M 282 336 L 302 342 L 287 355" len={40} duration={170} delay={620} color="var(--dw-teal)" ease="linear" />
                    <Stroke d="M 344 276 C 344 286 344 290 344 294" len={24} duration={200} delay={760} color="var(--dw-teal)" ease="ease-out" />
                    <Stroke d="M 344 344 C 344 356 344 360 344 364" len={24} duration={200} delay={1360} color="var(--dw-teal)" ease="ease-out" />
                    <Stroke d="M 335 353 L 344 368 L 353 353" len={34} duration={150} delay={1540} color="var(--dw-teal)" ease="linear" />
                    <Stroke d="M 150 438 C 220 434 300 437 406 433" len={260} duration={440} delay={2260} color="var(--dw-green)" ease="ease-out" />
                    {/* The tie reaches the right-hand panel, so it only exists in
                        the wide layout. Narrow says it with the two totals. */}
                    {narrow ? null : (
                      <>
                        <path
                          className="dw-anim"
                          d="M 344 480 C 460 476 556 400 640 306"
                          style={{
                            stroke: "var(--dw-green)", strokeWidth: 3.5, strokeDasharray: "12 12",
                            animation: anim("dw-fade", 500, 3160, "ease-out"),
                          }}
                        />
                        <Stroke d="M 626 314 L 646 300 L 634 322" len={50} duration={200} delay={3560} color="var(--dw-green)" ease="linear" />
                      </>
                    )}
                  </StageOverlay>
                  <Mark left={288} top={306} width={112} em={0.78} color="var(--dw-teal-text)" animation={anim("dw-fade", 440, 840)}>
                    {a} × {q}
                  </Mark>
                  <Mark left={288} top={372} width={112} em={1.3} color="var(--dw-teal-text)" animation={anim("dw-pop", 420, 1700)}>
                    {secondProduct}
                  </Mark>
                  <Mark left={248} top={382} width={60} em={1} color="var(--dw-muted)" animation={anim("dw-fade", 320, 2060, "ease-out")}>+</Mark>
                  <Mark left={222} top={452} width={112} em={1.45} weight={800} color="var(--dw-green-text)" animation={anim("dw-pop", 480, 2700)}>
                    {total}
                  </Mark>
                  {narrow ? null : (
                    <>
                      <div style={{ position: "absolute", left: 664, top: 254, width: 284, display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
                        <div style={{ fontSize: "1.15em", visibility: "hidden" }}>{a} × {b} =</div>
                        <div style={{ width: 96, textAlign: "left" }}>
                          <div className="dw-anim" style={{ fontSize: "1.15em", fontWeight: 800, color: "var(--dw-green-text)", animation: anim("dw-pop", 480, 3760) }}>
                            {total}
                          </div>
                        </div>
                      </div>
                      <Mark left={664} top={330} width={284} em={0.8} weight={600} hand color="var(--dw-green-text)" animation={anim("dw-fade", 460, 4180, "ease-out")}>
                        same answer ✓
                      </Mark>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          <div className="dw-foot">
            <button className="dw-btn" type="button" onClick={retreat} disabled={step === 1}>Back</button>
            <button className="dw-btn ghost" type="button" onClick={replay}>Replay step</button>
            {/* No arrow key to press on the device that reflowed. */}
            <p className="dw-hint">
              {narrow ? "Tap the work to keep going" : "Tap the work or press the right arrow key to keep going"}
            </p>
            <button className="dw-btn go" type="button" onClick={advance}>
              {step === WALKTHROUGH_STEP_COUNT ? "Start over" : "Next step"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
