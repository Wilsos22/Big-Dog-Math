"use client";

// Design bench for the native DirectionScreen CONTENT (not a classroom surface). The point of this
// bench is to show the content rendering INSIDE the state's board frame, never as a new frame: the
// band / state word / shared clock / step counter drawn here stand in for the frame that already
// exists on present/pace (the state strip and ink layer live there too), and the big direction is the
// native "slide" that fills the frame's content region - the same slot an imported Canva image fills.
//
// Paste a real Notion Main Display into the Direction box and watch the headline auto-fit hold inside
// the frame. Clock colour follows the real timer thresholds. No data fetch: /api/today ships
// steps: [] (step wording is private), so real text comes in by paste or ?direction= params.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import DirectionScreen from "@/components/screen/DirectionScreen";
import { formatClock, planSteps, stepLabel } from "@/lib/directionScreen";
import { timerUrgency, timerUrgencyClass, TIMER_URGENCY_CSS } from "@/lib/timerUrgency";

const TEAL = "#50a3a4";
const TEAL_INK = "#2E4A54";
const INK_SOFT = "#6f675c";
const FONT_STACK = "var(--bdb-font, 'Albert Sans', system-ui, sans-serif)";

// Stand-in for the state's board frame (present/pace already draw this). The content slots into the
// flex:1 region in the middle; the accent band, phase word, clock and counter are the frame's, not
// the content's. The real strip lives top-right in the frame - omitted here so the fixed stage does
// not fight the strip's viewport-relative sizing.
function StateFrame({
  phaseWord,
  seconds,
  part,
  total,
  children,
}: {
  phaseWord: string;
  seconds: number;
  part: number;
  total: number;
  children: ReactNode;
}) {
  const urgency = timerUrgency(seconds, { running: true });
  const counter = stepLabel(part, total);
  return (
    <div style={{ position: "relative", width: 1920, height: 1080, background: "#faf6ee", color: "#201e1a", display: "flex", overflow: "hidden", fontFamily: FONT_STACK }}>
      <style>{TIMER_URGENCY_CSS}</style>
      <div style={{ width: 16, background: TEAL, flex: "0 0 16px" }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "92px 120px 84px 108px", minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 60 }}>
          <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: TEAL_INK, paddingTop: 26 }}>
            {phaseWord}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <div className={timerUrgencyClass(urgency)} style={{ fontSize: 148, fontWeight: 700, lineHeight: 0.86, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
              {formatClock(seconds)}
            </div>
            {counter ? <div style={{ fontSize: 30, fontWeight: 500, color: INK_SOFT, letterSpacing: "0.04em" }}>{counter}</div> : null}
          </div>
        </div>
        {/* The content region - this is where the native slide (or an imported image) renders. */}
        <div style={{ flex: 1, minHeight: 0, display: "flex", marginTop: 8 }}>{children}</div>
      </div>
    </div>
  );
}

// Scale a 1920x1080 stage to fill its column while holding 16:9.
function Stage({ children, maxWidth = 1180 }: { children: ReactNode; maxWidth?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useLayoutEffect(() => {
    const measure = () => {
      const width = ref.current?.clientWidth ?? 0;
      if (width > 0) setScale(width / 1920);
    };
    measure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (observer && ref.current) observer.observe(ref.current);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  return (
    <div
      ref={ref}
      style={{ width: "100%", maxWidth, aspectRatio: "16 / 9", position: "relative", overflow: "hidden", borderRadius: 14, boxShadow: "0 24px 60px rgba(32,30,26,0.16)", background: "#faf6ee" }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, width: 1920, height: 1080, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        {children}
      </div>
    </div>
  );
}

export default function DirectionPreviewPage() {
  const [mode, setMode] = useState<"direction" | "plan">("direction");
  const [phaseWord, setPhaseWord] = useState("Independent Practice");
  const [direction, setDirection] = useState("Solve problems 1–4 on your own.");
  const [support, setSupport] = useState("When you finish, check with your table.");
  const [planText, setPlanText] = useState("Warm-up on the half sheet\nRatio tables together\nPractice set, then exit ticket");
  const [seconds, setSeconds] = useState(480);
  const [part, setPart] = useState(3);
  const [total, setTotal] = useState(4);

  // Seed from ?params so a pasted URL renders a specific screen.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const get = (key: string) => q.get(key);
    if (get("mode") === "plan") setMode("plan");
    if (get("phase")) setPhaseWord(get("phase")!);
    if (get("direction")) setDirection(get("direction")!);
    if (get("support") !== null) setSupport(get("support") ?? "");
    if (get("steps")) setPlanText(get("steps")!.replace(/\\n|\|/g, "\n"));
    if (get("seconds")) setSeconds(Number(get("seconds")) || 0);
    if (get("part")) setPart(Number(get("part")) || 1);
    if (get("total")) setTotal(Number(get("total")) || 1);
  }, []);

  return (
    <div className="dp-root">
      <style>{`
        .dp-root { min-height: 100vh; background: #ece5d4; color: #201e1a; font-family: var(--bdb-font, 'Albert Sans', system-ui, sans-serif); padding: 40px clamp(20px, 4vw, 72px) 96px; }
        .dp-h1 { font-size: 34px; font-weight: 800; letter-spacing: -0.02em; margin: 0 0 6px; }
        .dp-sub { font-size: 17px; color: #6f675c; margin: 0 0 32px; max-width: 780px; line-height: 1.5; }
        .dp-grid { display: grid; grid-template-columns: 340px minmax(0, 1fr); gap: 40px; align-items: start; }
        @media (max-width: 900px) { .dp-grid { grid-template-columns: 1fr; } }
        .dp-panel { background: #faf6ee; border: 1px solid #e2d9c6; border-radius: 16px; padding: 22px; display: grid; gap: 16px; position: sticky; top: 24px; }
        .dp-field { display: grid; gap: 6px; }
        .dp-label { font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #6f675c; }
        .dp-field input, .dp-field textarea { font-family: inherit; font-size: 15px; color: #201e1a; background: #fff; border: 1px solid #d8cfbc; border-radius: 9px; padding: 9px 11px; width: 100%; box-sizing: border-box; }
        .dp-field textarea { resize: vertical; line-height: 1.4; }
        .dp-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
        .dp-modes { display: flex; gap: 8px; }
        .dp-modes button { flex: 1; font-family: inherit; font-size: 14px; font-weight: 700; padding: 9px; border-radius: 9px; border: 1px solid #d8cfbc; background: #fff; color: #6f675c; cursor: pointer; }
        .dp-modes button[data-on="true"] { background: #201e1a; color: #fff; border-color: #201e1a; }
        .dp-count { font-size: 12px; color: #a08f74; font-weight: 600; }
        .dp-frame-tag { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #8a7f68; margin: 0 0 10px; }
        .dp-frame-tag b { color: #201e1a; }
        .dp-samples { margin-top: 64px; }
        .dp-samples h2 { font-size: 22px; font-weight: 800; margin: 0 0 4px; }
        .dp-samples p { font-size: 15px; color: #6f675c; margin: 0 0 24px; max-width: 720px; line-height: 1.5; }
        .dp-sample { margin-bottom: 30px; }
        .dp-caption { font-size: 13px; font-weight: 700; letter-spacing: 0.04em; color: #6f675c; margin: 0 0 10px; display: flex; gap: 10px; align-items: baseline; }
        .dp-tag { font-family: ui-monospace, Menlo, monospace; font-size: 12px; background: #fcaf38; color: #201e1a; padding: 2px 8px; border-radius: 5px; }
      `}</style>

      <h1 className="dp-h1">Direction Screen</h1>
      <p className="dp-sub">
        The native content &ldquo;slide&rdquo; that renders <b>inside</b> the state&rsquo;s board frame &mdash; it does not
        replace it. The band, phase word, clock and counter here stand in for the frame you already have; the big
        direction is the content that fills its middle, the same slot an imported Canva image fills. Paste a real Notion
        Main Display and watch the headline auto-fit hold. Clock colour follows the real timer thresholds (amber 30s,
        coral + pulse 15s).
      </p>

      <div className="dp-grid">
        <div className="dp-panel">
          <div className="dp-modes">
            <button type="button" data-on={mode === "direction"} onClick={() => setMode("direction")}>Direction</button>
            <button type="button" data-on={mode === "plan"} onClick={() => setMode("plan")}>Today&rsquo;s plan</button>
          </div>

          <div className="dp-field">
            <span className="dp-label">Phase word <span className="dp-count">frame</span></span>
            <input value={phaseWord} onChange={(e) => setPhaseWord(e.target.value)} />
          </div>

          {mode === "direction" ? (
            <>
              <div className="dp-field">
                <span className="dp-label">Direction <span className="dp-count">{direction.trim().length} chars</span></span>
                <textarea rows={3} value={direction} onChange={(e) => setDirection(e.target.value)} />
              </div>
              <div className="dp-field">
                <span className="dp-label">Support line</span>
                <input value={support} onChange={(e) => setSupport(e.target.value)} />
              </div>
            </>
          ) : (
            <div className="dp-field">
              <span className="dp-label">Plan steps <span className="dp-count">one per line</span></span>
              <textarea rows={4} value={planText} onChange={(e) => setPlanText(e.target.value)} />
            </div>
          )}

          <div className="dp-row">
            <div className="dp-field">
              <span className="dp-label">Seconds</span>
              <input type="number" value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} />
            </div>
            <div className="dp-field">
              <span className="dp-label">Part</span>
              <input type="number" value={part} onChange={(e) => setPart(Number(e.target.value))} />
            </div>
            <div className="dp-field">
              <span className="dp-label">of</span>
              <input type="number" value={total} onChange={(e) => setTotal(Number(e.target.value))} />
            </div>
          </div>
        </div>

        <div>
          <p className="dp-frame-tag">Live preview &mdash; <b>content</b> inside the state <b>frame</b></p>
          <Stage>
            <StateFrame phaseWord={phaseWord} seconds={seconds} part={part} total={total}>
              <DirectionScreen {...(mode === "plan" ? { steps: planSteps(planText) } : { direction, support })} />
            </StateFrame>
          </Stage>
        </div>
      </div>

      <div className="dp-samples">
        <h2>Canonical samples</h2>
        <p>The content from the Claude Design export, now sitting in the state frame instead of drawing its own.</p>

        <div className="dp-sample">
          <p className="dp-caption"><span className="dp-tag">1a</span> short direction — 6 words</p>
          <Stage>
            <StateFrame phaseWord="Independent Practice" seconds={480} part={3} total={4}>
              <DirectionScreen direction="Solve problems 1–4 on your own." support="When you finish, check with your table." />
            </StateFrame>
          </Stage>
        </div>

        <div className="dp-sample">
          <p className="dp-caption"><span className="dp-tag">1b</span> long direction — 20 words, timer urgent (real threshold: coral ≤15s)</p>
          <Stage>
            <StateFrame phaseWord="Independent Practice" seconds={12} part={3} total={4}>
              <DirectionScreen
                direction="Solve problems 1–4 on your own, show every step, and circle the answer you are most sure about."
                support="When you finish, check with your table."
              />
            </StateFrame>
          </Stage>
        </div>

        <div className="dp-sample">
          <p className="dp-caption"><span className="dp-tag">1c</span> today&rsquo;s plan — 3 numbered steps</p>
          <Stage>
            <StateFrame phaseWord="Today's Plan" seconds={2520} part={1} total={4}>
              <DirectionScreen steps={["Warm-up on the half sheet", "Ratio tables together", "Practice set, then exit ticket"]} />
            </StateFrame>
          </Stage>
        </div>
      </div>
    </div>
  );
}
