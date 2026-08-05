"use client";

// Divisibility Rules - M1.T1.L2-D1 "Factors and Multiples Foundations" (6.NS.4).
//
// Three fixed columns so a sixth grader always knows where to look:
//   LEFT   the rule bank, large, one row per divisor 1 through 6
//   CENTER the number being tested, which travels DOWN the rail one rule at a time
//   RIGHT  the factor family, which builds itself as each rule lands
//
// The run stops when d * d passes N - the lesson's stopping rule - so the arch
// closes on its own and the student can see why no later pair is needed. Once
// the rules are finished the student closes the family themselves: the full
// factor line appears in order, and they click the TWO factors that multiply
// to N. A right pick draws the arch between them and pops the product - green,
// at the apex - so every arch literally says "this pair makes N". A wrong pick
// shows the product they actually made and lets them try again.
//
// D1 covers the rules for 1 through 6 ONLY. Every number offered here has its
// crossing point at or below 6 (all are under 49), so testing 1..6 still finds
// a genuinely complete factor list - and a factor of 7 arrives as a PARTNER
// (35 = 5 x 7, 42 = 6 x 7) rather than needing a rule of its own. The stop is
// always the mathematical crossing d * d > N, never "the board ran out".

import { ReactNode, useMemo, useState } from "react";
import { LiveToolBanner, useLiveToolConfig } from "./useLiveToolConfig";

const C_GREEN = "#2f9e6f";
const C_CORAL = "#f95335";
const C_TEAL = "#50a3a4";
const C_AMBER = "#fcaf38";

const RULES: Record<number, string> = {
  1: "Every whole number is divisible by 1.",
  2: "Last digit is even (0, 2, 4, 6, 8).",
  3: "The digit sum is divisible by 3.",
  4: "Half of the number is even.",
  5: "Last digit is 0 or 5.",
  6: "Passes both the rule for 2 and the rule for 3.",
};

const RAIL = [1, 2, 3, 4, 5, 6];
const MAX_RULE = RAIL[RAIL.length - 1];
// The rail can prove a list complete only while the crossing point is on it,
// i.e. floor(sqrt(N)) <= MAX_RULE. Derived, not hand-flagged, so adding a
// number that the rules cannot finish surfaces itself instead of lying.
const closesOnRail = (n: number) => n < (MAX_RULE + 1) ** 2;

// Each of these reaches its crossing point at or below 6, so the six rules on
// the rail are enough to finish every factor list here.
const NUMBERS = [24, 35, 36, 40, 42, 48];

const digitsOf = (n: number) => String(n).split("").map(Number);
const digitSum = (n: number) => digitsOf(n).reduce((a, b) => a + b, 0);

interface Ev { correct: boolean; idx: Set<number>; mode: "digits" | "sum"; card: ReactNode; reason: string }

// The real answer, which digits to light up, the evidence shown BEFORE the
// student decides, and the rule-based reason used in wrong-answer feedback.
function evidence(N: number, d: number, prior: Record<number, boolean>): Ev {
  const digits = digitsOf(N);
  const last = digits.length - 1;
  const lastDigit = N % 10;
  const sum = digitSum(N);
  const correct = N % d === 0;
  const idxLast = (k: number) => new Set(digits.map((_, i) => i).filter((i) => i > last - k));
  const all = new Set(digits.map((_, i) => i));
  const none = new Set<number>();

  switch (d) {
    case 1:
      // No digit evidence to point at - highlighting every digit would imply one.
      return { correct: true, idx: none, mode: "digits",
        card: <>Every whole number has 1 as a factor.</>,
        reason: "every whole number is divisible by 1" };
    case 2:
      return { correct, idx: idxLast(1), mode: "digits",
        card: <>Last digit: <b>{lastDigit}</b></>,
        reason: `the last digit ${lastDigit} is ${lastDigit % 2 === 0 ? "even" : "odd"}` };
    case 5:
      return { correct, idx: idxLast(1), mode: "digits",
        card: <>Last digit: <b>{lastDigit}</b></>,
        reason: `the last digit is ${lastDigit}, ${correct ? "a 0 or 5" : "not 0 or 5"}` };
    case 4: {
      if (N % 2 !== 0) {
        return { correct: false, idx: none, mode: "digits",
          card: <>{N} is odd</>,
          reason: `${N} is odd, so it cannot be cut in half` };
      }
      const half = N / 2;
      const halfEven = half % 2 === 0;
      return { correct: halfEven, idx: none, mode: "digits",
        card: <>Half of {N}: <b>{half}</b></>,
        reason: halfEven ? `${half} is even` : `half of ${N} is ${half}, which is odd` };
    }
    case 3:
      return { correct, idx: all, mode: "sum",
        card: <>Digit sum: <b>{digits.join(" + ")} = {sum}</b></>,
        reason: `the digit sum ${sum} ${correct ? "is" : "is not"} divisible by 3` };
    case 6: {
      const by2 = prior[2] ?? N % 2 === 0;
      const by3 = prior[3] ?? sum % 3 === 0;
      return { correct, idx: idxLast(1), mode: "digits",
        card: <>You found: divisible by 2 was <b>{by2 ? "yes" : "no"}</b>, by 3 was <b>{by3 ? "yes" : "no"}</b>. Both?</>,
        reason: `6 needs BOTH - even (${by2 ? "yes" : "no"}) and digit sum divisible by 3 (${by3 ? "yes" : "no"})` };
    }
    default:
      return { correct, idx: none, mode: "digits", card: null, reason: "" };
  }
}

export default function DivisibilityRules() {
  // Live-session directions: without this, a teacher publishing this tool
  // through /control or a lesson step would have their prompt silently
  // dropped (the LiveToolRoute wiring contract).
  const liveTool = useLiveToolConfig("/divisibility");
  const [numIdx, setNumIdx] = useState(0);
  const [results, setResults] = useState<{ d: number; isFactor: boolean }[]>([]);
  const [sel, setSel] = useState<number | null>(null);   // first factor of the pair being picked
  const [closed, setClosed] = useState<number[]>([]);    // small factor of each arched pair, in pick order
  const [note, setNote] = useState<string | null>(null);

  const N = NUMBERS[numIdx];
  const closes = closesOnRail(N);

  // Test 1, 2, 3 ... but only while the smaller factor has not passed its
  // partner. This is the lesson's stopping rule, enforced by the tool.
  const sequence = useMemo(() => RAIL.filter((d) => d * d <= N), [N]);

  const step = results.length;
  const currentD: number | undefined = sequence[step];
  const running = currentD != null;

  const priorMap = useMemo(() => {
    const m: Record<number, boolean> = {};
    results.forEach((r) => { m[r.d] = r.isFactor; });
    return m;
  }, [results]);
  const ev = currentD != null ? evidence(N, currentD, priorMap) : null;

  // Each confirmed divisor contributes one pair to the family.
  const pairs = useMemo(
    () => results.filter((r) => r.isFactor).map((r) => [r.d, N / r.d] as const),
    [results, N],
  );

  // The complete ordered factor list, from the pairs found.
  const allFactors = useMemo(() => {
    const s = new Set<number>();
    pairs.forEach(([a, b]) => { s.add(a); s.add(b); });
    return [...s].sort((a, b) => a - b);
  }, [pairs]);

  // The closing step only makes sense when the search actually reached its
  // crossing point; every number offered here does.
  const assembling = !running && closes && pairs.length > 0 && closed.length < pairs.length;
  const finished = !running && pairs.length > 0
    && (!closes || closed.length === pairs.length);

  // Arch geometry. Factors sit on one ascending line; each pair is a curve from
  // its small factor to its partner. Because a complete factor list is
  // symmetric, pair k always spans index k to (count-1-k), so nesting falls out
  // and the widest span is automatically the tallest arch. A perfect square
  // ends on a single factor - one self-loop, never a duplicated number.
  const arch = useMemo(() => {
    const idx = new Map(allFactors.map((f, i) => [f, i] as const));
    const cols = allFactors.length;
    const COL = 74, PAD = 22, H_MIN = 36, H_MAX = 132, SELF_H = 34;
    const items = pairs
      .map(([a, b]) => ({ a, b, i: idx.get(a) ?? 0, j: idx.get(b) ?? 0, self: a === b }))
      .map((it) => ({ ...it, span: it.j - it.i }))
      .sort((p, q) => q.span - p.span); // outermost first: draw order and colour order
    const maxSpan = Math.max(1, ...items.map((it) => it.span));
    const base = H_MAX + 44; // headroom above the outer arch for its product label
    const x = (i: number) => PAD + COL * i + COL / 2;
    const shaped = items.map((it) => {
      const h = it.self ? SELF_H : H_MIN + (it.span / maxSpan) * (H_MAX - H_MIN);
      const x1 = x(it.i), x2 = x(it.j);
      // Both control points at the same height give a symmetric curve whose
      // apex sits at 3/4 of the control offset, so scale by 4/3 to hit h.
      const c = base - h * (4 / 3);
      // Self-pair: a small round loop over the single factor - wide control
      // points and short height so it reads as a little arch, not a teardrop.
      const d = it.self
        ? `M ${x1 - 12} ${base} C ${x1 - 42} ${base - h * 1.6} ${x1 + 42} ${base - h * 1.6} ${x1 + 12} ${base}`
        : `M ${x1} ${base} C ${x1} ${c} ${x2} ${c} ${x2} ${base}`;
      return { ...it, h, x1, x2, d, apex: it.self ? base - h * 1.2 : base - h };
    });
    return {
      shaped, cols, base, x,
      width: PAD * 2 + COL * cols,
      height: base + 52,
      draw: 0.55, pulse: 0.38,
    };
  }, [pairs, allFactors]);

  function answer(said: boolean) {
    if (!ev || currentD == null) return;
    if (said !== ev.correct) {
      const head = ev.correct
        ? `Yes - ${N} = ${currentD} x ${N / currentD}`
        : `No - ${N} ÷ ${currentD} = ${Math.floor(N / currentD)} r ${N % currentD}`;
      setNote(`${head}, because ${ev.reason}.`);
      return;
    }
    setNote(null);
    setResults([...results, { d: currentD, isFactor: ev.correct }]);
  }

  // Pair-picking on the factor line. First click selects a factor; the second
  // click is the claim "these two multiply to N". Right: the arch draws itself
  // and the product pops at its apex. Wrong: show the product they actually
  // made, clear the selection, let them try again. Clicking the same factor
  // twice claims f x f, which is exactly right on a perfect square (6 then 6
  // closes 36) and gets honest feedback anywhere else (3 x 3 = 9, not 24).
  function pickFactor(f: number) {
    const small = Math.min(f, N / f);
    if (closed.includes(small)) { setSel(null); return; } // that arch is already closed
    if (sel == null) { setSel(f); setNote(null); return; }
    if (sel * f === N) {
      setSel(null); setNote(null);
      setClosed([...closed, small]);
    } else {
      setNote(`Not this pair - ${sel} x ${f} = ${sel * f}, not ${N}.`);
      setSel(null);
    }
  }

  function loadNumber(i: number) {
    setNumIdx(i); setResults([]); setSel(null); setClosed([]); setNote(null);
  }

  const digits = digitsOf(N);
  const stoppedAt = sequence[sequence.length - 1];

  return (
    <div className="dv-wrap">
      <style>{`
        .dv-wrap { font-family:var(--bdb-font); color:var(--bdb-ink); max-width:min(1500px,96vw); margin:0 auto; padding:12px clamp(10px,2.5vw,20px) 34px; }
        .dv-top { display:flex; gap:10px; justify-content:center; align-items:center; flex-wrap:wrap; margin-bottom:14px; }
        .dv-npill { font:inherit; font-weight:800; font-size:0.92rem; min-height:40px; padding:0 15px; border-radius:999px; border:1px solid var(--bdb-line); background:var(--bdb-card); color:var(--bdb-ink-soft); cursor:pointer; }
        .dv-npill.on { background:var(--bdb-ink); color:#fff; border-color:var(--bdb-ink); }

        /* THE RULE TABLE - one full-width row per divisor, filling the screen.
           Columns: the rule, the number under test, the factor it yields. */
        .dv-table { --dv-cols:minmax(300px,1.5fr) minmax(120px,0.7fr) minmax(240px,1.5fr); display:flex; flex-direction:column; width:100%; min-height:calc(100vh - 210px); border-bottom:1px solid var(--bdb-line); }
        .dv-table.done { min-height:0; }
        .dv-thead { flex:0 0 auto; display:grid; grid-template-columns:var(--dv-cols); gap:clamp(12px,2vw,30px); padding:0 clamp(8px,2vw,20px) 8px; }
        .dv-thead span { font-size:0.68rem; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; color:var(--bdb-ink-faint); }
        .dv-thead span:nth-child(2) { text-align:center; }
        /* A ROW IS AT LEAST AS TALL AS WHAT IS IN IT. This was flex:1 1 0, and a
           zero basis means every row takes an equal share of the table height no
           matter what it holds - so the ACTIVE row, which is the only one
           carrying three stacked things (the evidence card, the question, and
           the Yes/No buttons), was handed the same 95px as a row showing one
           line of rule text. Its content needed 129px, so the buttons hung 25px
           past the row's own bottom edge and landed in the next row's band:
           Steele, 2026-08-05, "the factor column doesnt line up and cuts a row
           in half, the rest of the row isnt centered". The shaded band no longer
           contained its own contents, which is what made the rule and the number
           read as off-centre - they were centred, just against a band the answer
           had escaped. An auto basis measures the content first and then shares
           out only what is left over, so the tall row asks for what it needs and
           nothing overflows. Do NOT put the zero basis back to make the rows
           equal height again: equal rows and a row that fits its content are the
           same thing here right up until one row has an open question in it. */
        .dv-trow { flex:1 1 auto; min-height:92px; display:grid; grid-template-columns:var(--dv-cols); gap:clamp(12px,2vw,30px); align-items:center; padding:10px clamp(8px,2vw,20px); border-top:1px solid var(--bdb-line); opacity:0.4; transition:opacity .3s, background .3s; }
        .dv-table.done .dv-trow { flex:0 0 auto; min-height:0; }
        .dv-trow.waiting { opacity:0.5; }
        .dv-trow.factor, .dv-trow.no { opacity:1; }
        .dv-trow.past { opacity:0.2; }
        .dv-trow.active { opacity:1; background:var(--bdb-ground-2); box-shadow:inset 5px 0 0 ${C_TEAL}; }
        .dv-c-rule { display:flex; align-items:center; gap:14px; }
        .dv-d { font-weight:900; font-size:clamp(1.7rem,3vw,2.5rem); min-width:64px; letter-spacing:-0.01em; color:var(--bdb-ink); }
        .dv-trow.factor .dv-d { color:var(--bdb-green-deep); }
        .dv-trow.no .dv-d { color:var(--bdb-coral-deep); }
        .dv-trow.active .dv-d { animation:dvPulse 1.4s ease-in-out infinite; }
        @keyframes dvPulse { 50% { transform:scale(1.14); color:var(--bdb-teal-deep); } }
        .dv-rt { font-size:clamp(0.95rem,1.5vw,1.2rem); font-weight:600; line-height:1.3; color:var(--bdb-ink-soft); }
        .dv-trow.active .dv-rt { color:var(--bdb-ink); font-weight:700; }
        .dv-c-num { display:flex; justify-content:center; align-items:center; }
        .dv-num { display:flex; gap:4px; align-items:center; }
        .dv-dig { font-weight:900; font-size:clamp(2.4rem,5vw,3.8rem); line-height:1; padding:2px 6px; border-radius:10px; transition:background .25s, box-shadow .25s; }
        .dv-dig.on { background:color-mix(in srgb, ${C_TEAL} 26%, transparent); box-shadow:inset 0 -5px 0 ${C_TEAL}; }
        .dv-dig.sum { background:color-mix(in srgb, ${C_AMBER} 32%, transparent); box-shadow:inset 0 -5px 0 ${C_AMBER}; }
        .dv-c-res { display:flex; flex-direction:column; gap:7px; align-items:flex-start; }
        .dv-ev { font-size:clamp(0.92rem,1.5vw,1.1rem); font-weight:700; line-height:1.35; color:var(--bdb-ink); }
        .dv-q { font-weight:900; font-size:clamp(0.98rem,1.6vw,1.2rem); }
        .dv-yn { display:flex; gap:10px; }
        .dv-yn button { font:inherit; font-weight:900; font-size:1rem; min-width:96px; min-height:48px; border-radius:12px; cursor:pointer; }
        .dv-yn .yes { background:var(--bdb-green-deep); color:#fff; border:2px solid var(--bdb-green-deep); }
        .dv-yn .no { background:transparent; color:var(--bdb-ink); border:2px solid var(--bdb-ink); }
        .dv-pair { display:flex; align-items:baseline; gap:8px; font-weight:900; font-size:clamp(1.4rem,2.6vw,2rem); animation:dvIn .34s cubic-bezier(.34,.8,.3,1) backwards; }
        .dv-pair .op { color:var(--bdb-ink-faint); font-weight:800; }
        .dv-pair .res { color:var(--bdb-green-deep); }
        .dv-nofit { font-weight:800; font-size:0.9rem; letter-spacing:0.05em; text-transform:uppercase; color:var(--bdb-coral-deep); }
        .dv-stop { display:flex; align-items:center; gap:10px; padding:10px 12px; margin-top:14px; border:2px dashed color-mix(in srgb, ${C_AMBER} 60%, var(--bdb-line)); background:color-mix(in srgb, ${C_AMBER} 10%, transparent); font-size:0.86rem; font-weight:700; line-height:1.35; color:var(--bdb-ink); }
        @keyframes dvIn { from { opacity:0; transform:translateX(16px); } to { opacity:1; transform:none; } }

        /* the completed arch - full width under the table so a ten-factor
           line stays readable without sideways scrolling; flat on the ground,
           no card, so it reads as part of the page */
        .dv-archwrap { margin:22px auto 0; padding:14px clamp(8px,2vw,18px) 10px; border-top:1px solid var(--bdb-line); }
        .dv-archhead { font-size:0.72rem; font-weight:800; letter-spacing:0.07em; text-transform:uppercase; color:var(--bdb-ink-faint); margin-bottom:6px; text-align:center; }
        .dv-archsvg { display:block; width:100%; height:auto; max-height:56vh; margin:0 auto; overflow:visible; }
        .dv-ap { fill:none; stroke-width:3.5; stroke-linecap:round; stroke-dasharray:1; stroke-dashoffset:1; animation:dvDraw var(--dur) cubic-bezier(.4,.75,.35,1) var(--delay) forwards; }
        @keyframes dvDraw { to { stroke-dashoffset:0; } }
        .dv-adot { opacity:0; transform-box:fill-box; transform-origin:center; animation:dvDot var(--pdur) cubic-bezier(.3,.8,.35,1) var(--pdelay) forwards; }
        @keyframes dvDot { 0% { opacity:0; transform:scale(.4); } 55% { opacity:1; transform:scale(1.7); } 100% { opacity:1; transform:scale(1); } }
        .dv-alabel { font-family:var(--bdb-font); font-weight:900; fill:var(--bdb-ink); }
        .dv-aself { font-family:var(--bdb-font); font-weight:800; font-size:15px; opacity:0; animation:dvFadeIn var(--pdur) ease var(--pdelay) forwards; }
        @keyframes dvFadeIn { to { opacity:1; } }
        .dv-abase { stroke:var(--bdb-line); stroke-width:2; }
        /* clickable factor targets on the line */
        .dv-fhit { cursor:pointer; }
        .dv-fhit circle.ring { fill:transparent; stroke:transparent; stroke-width:2.5; transition:fill .15s, stroke .15s; }
        .dv-fhit:hover circle.ring { stroke:color-mix(in srgb, ${C_TEAL} 55%, transparent); }
        .dv-fhit.sel circle.ring { fill:color-mix(in srgb, ${C_TEAL} 20%, transparent); stroke:${C_TEAL}; }
        .dv-fhit.paired { cursor:default; }
        .dv-fhit:focus-visible circle.ring { stroke:var(--bdb-ink); }
        /* the product pops above the apex as the arch closes, settles, then
           fades - it is the "you made N" feedback beat, not a permanent label.
           (Every arch of a symmetric family apexes at the same x, so persistent
           labels would stack into a tower.) */
        .dv-aprod { font-family:var(--bdb-font); font-weight:900; fill:${C_GREEN}; opacity:0; transform-box:fill-box; transform-origin:center; animation:dvPop 1.7s cubic-bezier(.3,.9,.35,1.15) var(--pdelay) forwards; }
        @keyframes dvPop {
          0% { opacity:0; transform:scale(.3) translateY(8px); }
          22% { opacity:1; transform:scale(1.32) translateY(-2px); }
          34% { opacity:1; transform:scale(1) translateY(0); }
          72% { opacity:1; transform:scale(1) translateY(0); }
          100% { opacity:0; transform:scale(1) translateY(0); }
        }

        .dv-note { text-align:center; min-height:26px; margin-top:16px; }
        .dv-note-in { display:inline-block; color:var(--bdb-coral); font-weight:800; font-size:clamp(0.98rem,2.4vw,1.2rem); line-height:1.35; padding:8px 16px; border-radius:12px; background:color-mix(in srgb, var(--bdb-coral) 12%, transparent); }
        .dv-bar { display:flex; gap:8px; justify-content:center; align-items:center; margin-top:16px; flex-wrap:wrap; }
        .dv-btn { font:inherit; font-weight:700; font-size:0.95rem; padding:10px 18px; border-radius:12px; border:1px solid var(--bdb-line); background:var(--bdb-ink); color:#fff; cursor:pointer; }
        .dv-link { font:inherit; font-weight:700; font-size:0.82rem; color:var(--bdb-ink-soft); background:none; border:none; text-decoration:underline; cursor:pointer; }
        .dv-done { font-weight:800; font-size:clamp(1rem,2.5vw,1.2rem); line-height:1.5; text-align:center; margin-top:10px; }
        .dv-done a { color:var(--bdb-teal); font-weight:800; text-decoration:none; border-bottom:2px solid color-mix(in srgb, var(--bdb-teal) 45%, transparent); }

        @media (max-width: 760px) {
          .dv-table, .dv-table.done { --dv-cols:1fr; min-height:0; }
          .dv-thead { display:none; }
          .dv-trow { flex:0 0 auto; grid-template-columns:1fr; min-height:0; row-gap:10px; padding:16px clamp(8px,3vw,16px); }
          .dv-c-num, .dv-c-res { justify-content:flex-start; align-items:flex-start; }
          .dv-trow:not(.active) .dv-c-num, .dv-trow:not(.active) .dv-c-res { display:none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .dv-trow.active .dv-d { animation:none; }
          .dv-pair { animation:none; }
          .dv-dig { transition:none; }
          /* completed arches appear at once, already closed; the transient
             product pop is motion, so it simply does not appear */
          .dv-ap { animation:none !important; stroke-dashoffset:0 !important; }
          .dv-adot, .dv-aself { animation:none !important; opacity:1 !important; transform:none !important; }
          .dv-aprod { animation:none !important; opacity:0 !important; }
        }
      `}</style>

      <LiveToolBanner tool={liveTool} />

      <div className="dv-top">
        {NUMBERS.map((n, i) => (
          <button key={n} className={`dv-npill ${i === numIdx ? "on" : ""}`} onClick={() => loadNumber(i)}>{n}</button>
        ))}
      </div>

      {/* The rule table: one full-width row per divisor. The active rule pulses,
          the number under test sits in its middle cell, and the factor it yields
          lands in the third cell - so the factor family builds itself row by row.
          Rows fill the screen height while running, and compact once the run is
          done so the closing arch below takes the room. */}
      <div className={`dv-table ${running ? "" : "done"}`.trim()}>
        <div className="dv-thead">
          <span>The rule</span>
          <span>The number</span>
          <span>The factor</span>
        </div>
        {RAIL.map((d) => {
          const r = results.find((x) => x.d === d);
          const inRun = sequence.includes(d);
          const isActive = running && d === currentD;
          const state = r ? (r.isFactor ? "factor" : "no") : isActive ? "active" : inRun ? "waiting" : "past";
          return (
            <div key={d} className={`dv-trow ${state}`}>
              <div className="dv-c-rule">
                <span className="dv-d">÷{d}</span>
                <span className="dv-rt">{RULES[d]}</span>
              </div>
              <div className="dv-c-num">
                {isActive && (
                  <span className="dv-num">
                    {digits.map((dg, i) => (
                      <span key={i} className={`dv-dig ${ev?.idx.has(i) ? (ev.mode === "sum" ? "sum" : "on") : ""}`}>{dg}</span>
                    ))}
                  </span>
                )}
              </div>
              <div className="dv-c-res">
                {isActive && ev && (
                  <>
                    <div className="dv-ev">{ev.card}</div>
                    <div className="dv-q">Is {N} divisible by {d}?</div>
                    <div className="dv-yn">
                      <button className="yes" onClick={() => answer(true)}>Yes</button>
                      <button className="no" onClick={() => answer(false)}>No</button>
                    </div>
                  </>
                )}
                {r && r.isFactor && (
                  <span className="dv-pair">
                    <span>{d}</span><span className="op">x</span><span>{N / d}</span>
                    <span className="op">=</span><span className="res">{N}</span>
                  </span>
                )}
                {r && !r.isFactor && <span className="dv-nofit">not a factor</span>}
              </div>
            </div>
          );
        })}
      </div>

      {!running && (
        <div className="dv-stop">
          {`Stop at ${stoppedAt}. The next divisor would pass its partner, so every later pair repeats one you already have.`}
        </div>
      )}

      {/* The closing step and the finished representation are the same surface:
          every factor on one ascending line. The student clicks the two factors
          that multiply to N; the arch draws itself between them and the product
          pops at the apex. Keyed on N so a new number starts clean. */}
      {(assembling || finished) && (
        <div className="dv-archwrap" key={N}>
          <div className="dv-archhead">
            {assembling
              ? `Close the arches: click the two factors that multiply to make ${N}`
              : `The factor arches of ${N}`}
          </div>
          <svg
            className="dv-archsvg"
            viewBox={`0 0 ${arch.width} ${arch.height}`}
            style={{ maxWidth: arch.width * 1.5 }}
            role="img"
            aria-label={assembling
              ? `All factors of ${N} on one line. Click two factors that multiply to ${N} to close their arch. ${closed.length} of ${pairs.length} arches closed.`
              : `All factors of ${N} on one line, each pair joined by an arch: ${pairs.map(([a, b]) => (a === b ? `${a} times itself` : `${a} and ${b}`)).join(", ")}.`}
          >
            <line className="dv-abase" x1={arch.x(0) - 26} y1={arch.base} x2={arch.x(arch.cols - 1) + 26} y2={arch.base} />

            {/* arches appear in the order the student closes them; height still
                comes from the span, so nesting is always right */}
            {closed.map((small) => {
              const k = arch.shaped.findIndex((s) => s.a === small);
              const p = arch.shaped[k];
              if (!p) return null;
              const color = [C_TEAL, C_GREEN, C_AMBER, C_CORAL][k % 4];
              const anim = {
                "--dur": `${arch.draw}s`, "--delay": "0s",
                "--pdur": `${arch.pulse}s`, "--pdelay": `${arch.draw * 0.7}s`,
              } as React.CSSProperties;
              return (
                <g key={`${p.a}-${p.b}`} style={anim}>
                  <path className="dv-ap" d={p.d} stroke={color} pathLength={1} />
                  <circle className="dv-adot" cx={p.x1 - (p.self ? 12 : 0)} cy={arch.base} r={5.5} fill={color} />
                  <circle className="dv-adot" cx={p.x2 + (p.self ? 12 : 0)} cy={arch.base} r={5.5} fill={color} />
                  {/* the pair's product lands green at the apex - every arch
                      says out loud that it makes N */}
                  <text className="dv-aprod" x={(p.x1 + p.x2) / 2} y={p.apex - (p.self ? 24 : 10)} textAnchor="middle" fontSize={22}>
                    {N}
                  </text>
                  {p.self && (
                    <text className="dv-aself" x={p.x1} y={p.apex - 6} textAnchor="middle" fill={color}>
                      {p.a} x {p.b}
                    </text>
                  )}
                </g>
              );
            })}

            {allFactors.map((f, i) => {
              const paired = closed.includes(Math.min(f, N / f));
              const cls = `dv-fhit ${sel === f ? "sel" : ""} ${paired ? "paired" : ""}`;
              return (
                <g
                  key={f}
                  className={cls}
                  role={assembling && !paired ? "button" : undefined}
                  tabIndex={assembling && !paired ? 0 : undefined}
                  aria-label={paired ? `${f}, arch closed` : `factor ${f}`}
                  onClick={() => assembling && pickFactor(f)}
                  onKeyDown={(e) => { if (assembling && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); pickFactor(f); } }}
                >
                  <circle className="ring" cx={arch.x(i)} cy={arch.base + 27} r={20} />
                  <text className="dv-alabel" x={arch.x(i)} y={arch.base + 34} textAnchor="middle" fontSize={f >= 10 ? 21 : 23}>
                    {f}
                  </text>
                </g>
              );
            })}
          </svg>
          {finished && (
            <div className="dv-done">
              {`${N} has ${allFactors.length} factors. The arches are closed. Every factor has a partner, so the list is complete.`}
              <br />
              <a href="/ladder-method">Break it into primes with the Ladder Method</a>
            </div>
          )}
        </div>
      )}

      <div className="dv-note">{note && <span key={note} className="dv-note-in">{note}</span>}</div>

      <div className="dv-bar">
        <button className="dv-btn" onClick={() => loadNumber((numIdx + 1) % NUMBERS.length)}>Next number</button>
        <button className="dv-link" onClick={() => loadNumber(numIdx)}>Start this one again</button>
      </div>
    </div>
  );
}
