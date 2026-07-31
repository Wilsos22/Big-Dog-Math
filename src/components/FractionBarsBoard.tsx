"use client";

// Fraction Bars — M1.T1.L5 support (6.NS.1: dividing fractions).
// Five modes, all optional support (no scoring):
//   "How many fit?"      — the Count-Draw-Verify loop: BUILD the dividend, TILE
//                          divisor-sized groups under it, COUNT the groups (not
//                          the tick marks), VERIFY with quotient x divisor. The
//                          divisor may be a NON-UNIT fraction, and a problem may
//                          leave part of a group over. A leftover is always named
//                          as a fraction of ONE GROUP ("1/8 of a group") — never
//                          as a fraction of the whole bar and never as a fraction
//                          of the total, which are the two errors the drawing has
//                          to rule out. A dashed outline shows the group the
//                          leftover sits inside, so the referent unit is visible.
//   "Bigger or smaller?" — estimation only: judge the DIRECTION of the answer
//                          with no arithmetic. Two variants (compare to the
//                          starting amount, or division head to head against
//                          multiplication). Nothing is scored, counted, or
//                          stored — it is a three-minute daily habit, and the
//                          feedback names the reasoning, not the result.
//   "Mixed numbers"      — convert a mixed number to an improper fraction by
//                          splitting the wholes into unit pieces and counting.
//   "Keep Change Flip"   — the reciprocal algorithm, walked one badge at a time
//                          with the division sign morphing and the second
//                          fraction physically flipping. (For L5-D3 — the
//                          algorithm is EARNED after the models, not before.)
//   "Explore"            — fraction wall: rows of tapped-in pieces laid end to
//                          end under one whole. The student DECLARES which bar
//                          counts as one whole (the Cuisenaire move: the rods
//                          carry no printed names), and every other name re-bases
//                          live off that choice.

import { ReactNode, useCallback, useEffect, useState } from "react";
import { LiveToolBanner, useLiveToolConfig } from "./useLiveToolConfig";

const C_TEAL = "#50a3a4";
const C_AMBER = "#fcaf38";
const C_CORAL = "#f95335";
const C_GREEN = "#2f9e6f";

// ── Exact fraction arithmetic (shared by every mode — never float compare) ───
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const reduceFrac = (n: number, d: number): [number, number] => {
  const g = gcd(n, d) || 1;
  return [n / g, d / g];
};
// Exact sum of a row of unit fractions, reduced: [numerator, denominator].
const rowSum = (row: number[]): [number, number] => {
  let n = 0, d = 1;
  for (const den of row) {
    n = n * den + d;
    d = d * den;
    const g = gcd(n, d);
    n /= g; d /= g;
  }
  return [n, d];
};
const sumLabel = ([n, d]: [number, number]) => (d === 1 ? `${n}` : `${n}/${d}`);
// The name of a 1/den bar when the 1/wholeDen bar has been declared to be one
// whole: (1/den) / (1/wholeDen) = wholeDen/den. With wholeDen = 1 this gives
// back the printed names, so nothing moves until the student re-declares.
const labelFor = (den: number, wholeDen: number) => sumLabel(reduceFrac(wholeDen, den));
// A wall row's value, measured in declared wholes.
const rowValue = (row: number[], wholeDen: number): [number, number] => {
  const [n, d] = rowSum(row);
  return reduceFrac(n * wholeDen, d);
};

// ── "How many fit?" problems (from the lesson's paper set) ──────────────────
interface DivProblem { n: number; d: number; n2: number; d2: number } // n/d divided by n2/d2
const DIV_PROBLEMS: DivProblem[] = [
  { n: 3, d: 4, n2: 1, d2: 8 },   // 6 groups, exact
  { n: 2, d: 3, n2: 1, d2: 6 },   // 4 groups, exact
  { n: 5, d: 8, n2: 1, d2: 16 },  // 10 groups, exact
  { n: 3, d: 5, n2: 1, d2: 10 },  // 6 groups, exact
  { n: 2, d: 3, n2: 1, d2: 2 },   // 1 group and 1/3 of another (leftover 1/6 of the bar)
  { n: 7, d: 8, n2: 1, d2: 2 },   // 1 group and 3/4 of another (leftover 3/8 of the bar)
  { n: 4, d: 5, n2: 2, d2: 5 },   // 2 groups, exact, non-unit divisor
  { n: 3, d: 4, n2: 3, d2: 8 },   // 2 groups, exact, non-unit divisor
  { n: 3, d: 4, n2: 2, d2: 3 },   // 1 group and 1/8 of another — NOT 1/9, NOT 1/12
];
// Everything the drawing and the checking need for one problem. This replaces the
// old integer quotientOf: with a non-unit divisor the quotient is a fraction, and
// every consumer needs the whole part and the leftover separately.
//   The leftover is carried THREE ways on purpose. remN/remD is the answer — the
// leftover measured in GROUPS. The other two are the named wrong answers: the
// leftover measured against the whole bar, and against the total the student
// started with. In-service teachers asked for 3/4 ÷ 2/3 answer 1/9 (the leftover
// as a part of the total) when it is 1/8 of a group, so the tool has to be able
// to say which unit each of those answers is measured in.
interface DivInfo {
  whole: number;                        // full groups that fit
  exact: boolean;
  remN: number; remD: number;           // leftover as a fraction of ONE GROUP
  ofWholeN: number; ofWholeD: number;   // leftover as a fraction of the whole bar
  ofTotalN: number; ofTotalD: number;   // leftover as a fraction of the dividend
  pieces: number;                       // group pieces to lay down (full groups + a partial)
}
const divInfo = (p: DivProblem): DivInfo => {
  const [qn, qd] = reduceFrac(p.n * p.d2, p.d * p.n2);
  const whole = Math.floor(qn / qd);
  const remN = qn - whole * qd;
  const [ofWholeN, ofWholeD] = reduceFrac(p.n * p.d2 - whole * p.n2 * p.d, p.d * p.d2);
  const [ofTotalN, ofTotalD] = reduceFrac(ofWholeN * p.d, ofWholeD * p.n);
  return {
    whole, exact: remN === 0, remN, remD: qd,
    ofWholeN, ofWholeD, ofTotalN, ofTotalD,
    pieces: whole + (remN === 0 ? 0 : 1),
  };
};

// ── "Bigger or smaller?" problems (estimation, nothing scored) ──────────────
// an/ad OP bn/bd. The list mixes divisors and multipliers on BOTH sides of one
// whole on purpose: if every divisor were under 1, "dividing by a fraction makes
// it bigger" just becomes the next wrong rule. Division is deliberately split
// close to evenly between bigger and smaller so the operator alone predicts
// nothing. `why` says the idea in one sentence — how many groups fit, never
// "correct".
interface EstProblem {
  an: number; ad: number;
  op: "div" | "mul";
  bn: number; bd: number;
  why: string;
}
const EST_PROBLEMS: EstProblem[] = [
  { an: 5, ad: 1, op: "div", bn: 2, bd: 3, why: "Two thirds is less than one whole, so more than one of those groups fits inside each of the 5 wholes." },
  { an: 6, ad: 1, op: "div", bn: 3, bd: 2, why: "Three halves is more than one whole, so each group takes more than 1 of the 6 and fewer groups fit." },
  { an: 4, ad: 1, op: "mul", bn: 3, bd: 4, why: "Multiplying keeps only three fourths of each whole, so what you end up holding is less than 4." },
  { an: 3, ad: 1, op: "mul", bn: 5, bd: 2, why: "Five halves is two and a half wholes, so three of them stacks up to more than 3." },
  { an: 3, ad: 4, op: "div", bn: 1, bd: 8, why: "Eighths are much smaller than three fourths, so a lot of them fit inside it." },
  // Careful one: only 2/3 of a group fits, and 2/3 is still MORE than the 1/2 we
  // started with. "Fewer than one group fits" is true and is not the question, so
  // the reason has to be about the size of the measuring unit.
  { an: 1, ad: 2, op: "div", bn: 3, bd: 4, why: "Three fourths is less than one whole, so you are measuring the 1/2 with a unit smaller than a whole — and a smaller unit always gives a bigger count." },
  { an: 10, ad: 1, op: "div", bn: 5, bd: 4, why: "Five fourths is more than one whole, so every group covers more than 1 and fewer than 10 of them fit." },
  { an: 2, ad: 1, op: "mul", bn: 7, bd: 8, why: "Seven eighths of each whole is just short of a whole, so two of them land just short of 2." },
  { an: 6, ad: 1, op: "div", bn: 3, bd: 4, why: "Three fourths is less than one whole, so more than one group fits in every whole and the count passes 6." },
  { an: 4, ad: 1, op: "mul", bn: 4, bd: 3, why: "Four thirds is more than one whole, so four of them is more than 4." },
  { an: 9, ad: 1, op: "div", bn: 9, bd: 8, why: "Nine eighths is a little more than one whole, so each group takes a little more than 1 and fewer than 9 fit." },
  { an: 3, ad: 5, op: "div", bn: 1, bd: 10, why: "Tenths are smaller than three fifths, so several of them fit inside it." },
  { an: 5, ad: 1, op: "div", bn: 6, bd: 5, why: "Six fifths is more than one whole, so each group swallows more than one of the 5." },
  { an: 8, ad: 1, op: "mul", bn: 1, bd: 2, why: "Half of each whole keeps only part of it, so 8 halves is less than 8." },
  { an: 2, ad: 3, op: "div", bn: 1, bd: 4, why: "Fourths are smaller than two thirds, so more than one of them fits inside it." },
  { an: 4, ad: 1, op: "div", bn: 8, bd: 5, why: "Eight fifths is more than one and a half wholes, so each group eats up more than one of the 4 and fewer than 4 fit." },
];
// Direction of the answer against the starting amount.
const estBigger = (p: EstProblem) => (p.op === "div" ? p.bn < p.bd : p.bn > p.bd);
// Head to head, a divided by b against a times b: for a positive b, dividing
// wins whenever b is under one whole, and multiplying wins whenever it is over.
const estDivWins = (p: EstProblem) => p.bn < p.bd;

// ── Mixed-number problems ───────────────────────────────────────────────────
interface MixedProblem { w: number; n: number; d: number } // w n/d
// Kept small on purpose: the walkthrough draws w+1 pie circles split into d
// slices, so w stays 1-3 and d stays <= 8 or the circles get unreadable.
const MIXED_PROBLEMS: MixedProblem[] = [
  { w: 2, n: 1, d: 3 },  // 2 1/3 = 7/3
  { w: 1, n: 3, d: 4 },  // 1 3/4 = 7/4
  { w: 3, n: 1, d: 2 },  // 3 1/2 = 7/2
  { w: 2, n: 5, d: 8 },  // 2 5/8 = 21/8
  { w: 1, n: 2, d: 3 },  // 1 2/3 = 5/3
  { w: 2, n: 3, d: 5 },  // 2 3/5 = 13/5
  { w: 3, n: 2, d: 3 },  // 3 2/3 = 11/3
  { w: 1, n: 5, d: 6 },  // 1 5/6 = 11/6
];
const nextMixedIndex = (prev: number): number => {
  if (MIXED_PROBLEMS.length < 2) return prev;
  let i = prev;
  while (i === prev) i = Math.floor(Math.random() * MIXED_PROBLEMS.length);
  return i;
};

// ── Keep-Change-Flip problems ───────────────────────────────────────────────
interface KcfProblem { a: [number, number]; b: [number, number] } // a divided by b
// A curated pool the "New problem" generator draws from one at a time - a mix
// of clean integer quotients and a few that stay a fraction, so the reciprocal
// step earns its keep instead of always tidying to a whole.
const KCF_PROBLEMS: KcfProblem[] = [
  { a: [3, 4], b: [1, 8] },   // = 6
  { a: [2, 3], b: [1, 6] },   // = 4
  { a: [5, 6], b: [1, 12] },  // = 10
  { a: [1, 2], b: [1, 4] },   // = 2
  { a: [2, 5], b: [1, 10] },  // = 4
  { a: [4, 5], b: [2, 5] },   // = 2
  { a: [3, 4], b: [2, 3] },   // = 9/8 (stays a fraction)
  { a: [5, 8], b: [1, 4] },   // = 5/2
  { a: [7, 8], b: [1, 2] },   // = 7/4
  { a: [5, 6], b: [1, 3] },   // = 5/2
];
const kcfProduct = (p: KcfProblem): [number, number] => [p.a[0] * p.b[1], p.a[1] * p.b[0]];
// The generator: a fresh problem each press, never the one already on screen.
const nextKcfIndex = (prev: number): number => {
  if (KCF_PROBLEMS.length < 2) return prev;
  let i = prev;
  while (i === prev) i = Math.floor(Math.random() * KCF_PROBLEMS.length);
  return i;
};

// Plural word for a unit-fraction denominator: 3 -> "thirds", 8 -> "eighths".
const NTHS: Record<number, string> = {
  2: "halves", 3: "thirds", 4: "fourths", 5: "fifths", 6: "sixths",
  8: "eighths", 10: "tenths", 12: "twelfths", 16: "sixteenths",
};
const nths = (d: number) => NTHS[d] ?? `${d}ths`;

// ── Explore-mode pieces (fraction wall) ─────────────────────────────────────
const EX_PIECES = [
  { den: 1, label: "1", color: "#674a40" },
  { den: 2, label: "1/2", color: C_TEAL },
  { den: 3, label: "1/3", color: "#7c5cd6" },
  { den: 4, label: "1/4", color: C_AMBER },
  { den: 5, label: "1/5", color: "#3f7fbf" },
  { den: 6, label: "1/6", color: C_CORAL },
  { den: 8, label: "1/8", color: C_GREEN },
  { den: 10, label: "1/10", color: "#c25588" },
  { den: 12, label: "1/12", color: "#a06b2a" },
];

// One pie wedge: slice i of a circle cut into `count` equal pieces, starting at
// twelve o'clock and going clockwise. Used by the Mixed-numbers walkthrough.
const slicePath = (cx: number, cy: number, r: number, i: number, count: number): string => {
  const a0 = (i / count) * 2 * Math.PI - Math.PI / 2;
  const a1 = ((i + 1) / count) * 2 * Math.PI - Math.PI / 2;
  const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
};

// Stacked fraction, written the way it looks in a problem. `flipped` swaps the
// numerator and denominator with a sliding animation (Keep-Change-Flip).
function Frac({ n, d, color, flipped, big }: { n: ReactNode; d: ReactNode; color?: string; flipped?: boolean; big?: boolean }) {
  // Cell height drives the flip distance: the numerator drops one cell-plus-bar
  // and the denominator rises the same, so they trade places exactly. `big`
  // scales the whole thing for the Keep-Change-Flip stage.
  const h = big ? 48 : 30;
  const shift = h + 3;
  return (
    <span className={`fb-frac${big ? " big" : ""}`} style={color ? { color } : undefined}>
      <span className="fb-fn" style={{ height: h, transform: flipped ? `translateY(${shift}px)` : "none" }}>{n}</span>
      <span className="fb-fbar" />
      <span className="fb-fd" style={{ height: h, transform: flipped ? `translateY(-${shift}px)` : "none" }}>{d}</span>
    </span>
  );
}

// One term of an expression: a plain number when the denominator is 1, a stacked
// fraction otherwise. (Estimation problems can start from either.)
function NumTerm({ n, d, color }: { n: number; d: number; color?: string }) {
  if (d === 1) return <span style={color ? { color } : undefined}>{n}</span>;
  return <Frac n={n} d={d} color={color} />;
}

export function FractionBarsBoard() {
  const liveTool = useLiveToolConfig("/fraction-bars");
  const [mode, setModeRaw] = useState<"divide" | "estimate" | "mixed" | "kcf" | "explore">("divide");
  const [note, setNote] = useState<string | null>(null);
  const setMode = (m: typeof mode) => { setModeRaw(m); setNote(null); };

  // ── divide state ───────────────────────────────────────────────────────────
  const [pIdx, setPIdx] = useState(0);
  const prob = DIV_PROBLEMS[pIdx];
  const di = divInfo(prob);
  const divisorText = sumLabel([prob.n2, prob.d2]);
  const totalText = `${prob.n}/${prob.d}`;
  const groupPct = (prob.n2 / prob.d2) * 100;          // one group, as a share of the strip
  const goalPct = (prob.n / prob.d) * 100;             // where the total ends
  const partialPct = goalPct - di.whole * groupPct;    // the leftover, as a share of the strip
  const leftoverText = `${di.remN}/${di.remD}`;        // the leftover IN GROUPS
  const groupsWord = (k: number) => `${k} group${k === 1 ? "" : "s"}`;
  const quotientText = di.exact ? `${di.whole}` : `${groupsWord(di.whole)} and ${leftoverText} of another group`;
  const verifyTarget = di.whole * prob.n2;             // numerator of whole x divisor, over d2
  // The widest thing this problem can draw: an overshoot group laid past the end
  // of the total, or the full-size dashed outline of the leftover's group, either
  // of which can reach past the strip (3/4 ÷ 2/3 reaches 133% of it). Shrink the
  // whole stage to make room rather than letting a bar run off the page — every
  // row shrinks together, so lengths stay comparable inside the problem.
  const maxExtentPct = (di.pieces + (di.exact ? 1 : 0)) * groupPct;
  const stageShrink = Math.max(1, maxExtentPct / 100);
  const stageStyle = stageShrink > 1
    ? { width: `min(${Math.round(620 / stageShrink)}px, ${(100 / stageShrink).toFixed(1)}%)` }
    : undefined;
  const [phase, setPhase] = useState<"build" | "tile" | "count" | "verify" | "done">("build");
  const [built, setBuilt] = useState(0);
  const [tiles, setTiles] = useState(0);
  const [countIn, setCountIn] = useState("");
  const [leftNIn, setLeftNIn] = useState("");
  const [leftDIn, setLeftDIn] = useState("");
  const [verifyIn, setVerifyIn] = useState("");
  const [showTileNums, setShowTileNums] = useState(false);
  const showPartial = !di.exact && tiles > di.whole;

  const startProblem = useCallback((idx: number) => {
    setPIdx(idx);
    setPhase("build"); setBuilt(0); setTiles(0);
    setCountIn(""); setLeftNIn(""); setLeftDIn(""); setVerifyIn(""); setNote(null); setShowTileNums(false);
  }, []);

  useEffect(() => {
    if (phase !== "build" || built !== prob.n) return;
    const t = window.setTimeout(() => { setNote(null); setPhase("tile"); }, 650);
    return () => window.clearTimeout(t);
  }, [phase, built, prob]);

  useEffect(() => {
    if (phase !== "tile" || tiles !== di.pieces) return;
    const t = window.setTimeout(() => { setNote(null); setPhase("count"); }, 650);
    return () => window.clearTimeout(t);
  }, [phase, tiles, di.pieces]);

  const addBuilt = () => {
    if (phase !== "build") return;
    const next = built + 1;
    setBuilt(next);
    if (next > prob.n) setNote(`That is more than ${totalText} now — take some off.`);
    else if (next === prob.n) setNote(`That is ${totalText}.`);
    else setNote(null);
  };
  const removeBuilt = () => { if (phase === "build" && built > 0) { setBuilt(built - 1); setNote(null); } };
  const addTile = () => {
    if (phase !== "tile") return;
    const next = tiles + 1;
    // ONE overshoot group is allowed on an exact problem: watching a group hang
    // past the total is the coral signal, and it is worth seeing. Once a leftover
    // is already drawn there is nothing left to learn from another whole group and
    // it would only run off the strip, so refuse it.
    if (next > di.pieces + (di.exact ? 1 : 0)) {
      setNote(`No more groups fit in ${totalText}.`);
      return;
    }
    setTiles(next);
    if (next > di.pieces) setNote(`That group went PAST ${totalText} — take it off.`);
    else if (next === di.pieces) {
      setNote(di.exact
        ? "The groups fill it exactly."
        : "The dashed outline is one whole group. The leftover fills only part of it.");
    } else if (!di.exact && next === di.whole) {
      setNote("Another whole group will not fit. Add just the leftover piece.");
    } else setNote(null);
  };
  const removeTile = () => { if (phase === "tile" && tiles > 0) { setTiles(tiles - 1); setNote(null); } };

  const submitCount = () => {
    const v = Number(countIn.trim());
    if (!countIn.trim() || !Number.isFinite(v)) return;
    if (v !== di.whole) {
      if (di.exact && v === di.whole + 1) setNote("You counted the tick MARKS. Count the tiles — each tile is one group.");
      else if (!di.exact && v === di.whole + 1) setNote("That last piece does not fill a whole group. Count the FULL groups, then say how much of another group is left.");
      else setNote(`Count the tiles one at a time — each tile is one group of ${divisorText}.`);
      setShowTileNums(true);
      setCountIn("");
      return;
    }
    if (di.exact) { setNote(null); setShowTileNums(false); setPhase("verify"); return; }
    const ln = Number(leftNIn.trim()), ld = Number(leftDIn.trim());
    if (!leftNIn.trim() || !leftDIn.trim() || ld === 0) {
      setNote(`${groupsWord(di.whole)} fit. Now say how much of ANOTHER group the leftover fills.`);
      return;
    }
    if (!Number.isFinite(ln) || !Number.isFinite(ld)) return;
    // The leftover is judged in GROUPS. Equivalent fractions pass; the two
    // classic wrong referents get named instead of a generic "try again".
    if (ln * di.remD === di.remN * ld) { setNote(null); setShowTileNums(false); setPhase("verify"); return; }
    if (ln * di.ofWholeD === di.ofWholeN * ld) {
      setNote(`That leftover IS ${sumLabel([di.ofWholeN, di.ofWholeD])} of the whole bar — but you are counting GROUPS. Hold it against ONE ${divisorText} group: how much of that group does it cover?`);
    } else if (ln * di.ofTotalD === di.ofTotalN * ld) {
      setNote(`That is ${sumLabel([di.ofTotalN, di.ofTotalD])} of the ${totalText} you started with. Measure the leftover against ONE group, not against the total.`);
    } else {
      setNote(`Compare the leftover to the dashed outline of one whole ${divisorText} group: how much of that group is filled?`);
    }
    setLeftNIn(""); setLeftDIn("");
  };
  const submitVerify = () => {
    const v = Number(verifyIn.trim());
    if (!verifyIn.trim() || !Number.isFinite(v)) return;
    if (v === verifyTarget) { setNote(null); setPhase("done"); return; }
    setNote(`${groupsWord(di.whole)} of ${divisorText} makes how many ${nths(prob.d2)} in all?`);
    setVerifyIn("");
  };

  // ── estimation state (nothing counted, nothing stored) ─────────────────────
  const [eIdx, setEIdx] = useState(0);
  const [eVariant, setEVariant] = useState<"start" | "head">("start");
  const [ePick, setEPick] = useState<"bigger" | "smaller" | "div" | "mul" | null>(null);
  const ep = EST_PROBLEMS[eIdx];
  const eStartText = sumLabel([ep.an, ep.ad]);
  const eDivisorText = sumLabel([ep.bn, ep.bd]);
  const eBigger = estBigger(ep);
  const eDivWins = estDivWins(ep);
  const eRight = eVariant === "start"
    ? ePick === (eBigger ? "bigger" : "smaller")
    : ePick === (eDivWins ? "div" : "mul");
  const eVerdictTail = eVariant === "start"
    ? `it is ${eBigger ? "bigger" : "smaller"} than ${eStartText}.`
    : `${eDivWins ? "dividing" : "multiplying"} gives the bigger answer.`;
  // Head to head is one idea every time, so its reason is stated the same way
  // every time. The per-problem `why` belongs to the compare-to-the-start round.
  const eWhy = eVariant === "start"
    ? ep.why
    : eDivWins
      ? `${eDivisorText} is less than one whole: dividing counts how many of those pieces fit inside ${eStartText}, while multiplying keeps only part of ${eStartText}.`
      : `${eDivisorText} is more than one whole: multiplying stretches ${eStartText}, while dividing breaks it into groups bigger than a whole.`;
  const nextEstimate = () => {
    setEPick(null);
    setNote(null);
    if (EST_PROBLEMS.length < 2) return;
    let next = eIdx;
    while (next === eIdx) next = Math.floor(Math.random() * EST_PROBLEMS.length);
    setEIdx(next);
  };

  // ── mixed-number state (circle walkthrough) ────────────────────────────────
  const [mIdx, setMIdx] = useState(0);
  const mp = MIXED_PROBLEMS[mIdx];
  const mImproper = mp.w * mp.d + mp.n;         // the numerator of the answer
  const mCircleCount = mp.w + 1;                // one per whole, plus one for the fraction
  const mTargetFor = (ci: number) => (ci < mp.w ? mp.d : mp.n); // slices to fill in circle ci
  // Stages: say how many wholes -> say the denominator (circles split) -> fill
  // each circle in turn -> add every piece -> the improper fraction.
  const [mStage, setMStage] = useState<"wholes" | "denom" | "fill" | "total" | "done">("wholes");
  const [mIn, setMIn] = useState("");
  const [mFillIdx, setMFillIdx] = useState(0);          // which circle is being filled
  const [mFilled, setMFilled] = useState<number[]>([]); // slices filled in each circle

  const startMixed = useCallback((idx: number) => {
    setMIdx(idx); setMStage("wholes"); setMIn(""); setMFillIdx(0); setMFilled([]); setNote(null);
  }, []);

  const submitMixedWholes = () => {
    const v = Number(mIn.trim());
    if (!mIn.trim() || !Number.isFinite(v)) return;
    if (v === mp.w) { setNote(null); setMIn(""); setMStage("denom"); return; }
    setNote(`Look at the whole-number part of ${mp.w} ${mp.n}/${mp.d} — that is how many whole ones.`);
    setMIn("");
  };
  const submitMixedDenom = () => {
    const v = Number(mIn.trim());
    if (!mIn.trim() || !Number.isFinite(v)) return;
    if (v === mp.d) {
      setNote(null); setMIn("");
      setMFilled(Array.from({ length: mCircleCount }, () => 0));
      setMFillIdx(0); setMStage("fill");
      return;
    }
    setNote(`The denominator is the bottom number of ${mp.n}/${mp.d} — how many equal pieces each circle splits into.`);
    setMIn("");
  };
  // Click-to-here fill: tapping slice i of the active circle fills 0..i. A whole
  // is done at d/d; the leftover circle is done at n/d.
  const fillSlice = (ci: number, i: number) => {
    if (mStage !== "fill" || ci !== mFillIdx) return;
    const count = i + 1;
    setMFilled((prev) => { const next = [...prev]; next[ci] = count; return next; });
    const target = mTargetFor(ci);
    if (count === target) {
      setNote(null);
      if (ci < mp.w) setMFillIdx(ci + 1);          // next whole, or on to the leftover
      else window.setTimeout(() => setMStage("total"), 350);
    } else if (ci === mp.w && count > target) {
      setNote(`The leftover is ${mp.n}/${mp.d} — fill just ${mp.n} piece${mp.n === 1 ? "" : "s"}.`);
    }
  };
  const submitMixedTotal = () => {
    const v = Number(mIn.trim());
    if (!mIn.trim() || !Number.isFinite(v)) return;
    if (v === mImproper) { setNote(null); setMIn(""); setMStage("done"); return; }
    setNote(`Count every filled piece: ${mp.w} whole${mp.w === 1 ? "" : "s"} of ${mp.d}, plus the ${mp.n} left over.`);
    setMIn("");
  };

  // ── keep-change-flip state ─────────────────────────────────────────────────
  const [kIdx, setKIdx] = useState(0);
  const kp = KCF_PROBLEMS[kIdx];
  const [prodN, prodD] = kcfProduct(kp);
  const kInteger = prodN % prodD === 0;
  const [kStep, setKStep] = useState(0); // 0 start, 1 keep, 2 change, 3 flip
  const [kStage, setKStage] = useState<"walk" | "product" | "final" | "done">("walk");
  const [kN, setKN] = useState("");
  const [kD, setKD] = useState("");
  const [kQ, setKQ] = useState("");

  const startKcf = useCallback((idx: number) => {
    setKIdx(idx); setKStep(0); setKStage("walk");
    setKN(""); setKD(""); setKQ(""); setNote(null);
  }, []);

  const kcfAdvance = () => {
    if (kStep < 3) {
      const next = kStep + 1;
      setKStep(next);
      if (next === 3) window.setTimeout(() => setKStage("product"), 900);
      return;
    }
  };
  const submitKcfProduct = () => {
    const n = Number(kN.trim()), d = Number(kD.trim());
    if (!kN.trim() || !kD.trim()) return;
    if (n === prodN && d === prodD) {
      setNote(null);
      setKStage(kInteger ? "final" : "done");
      return;
    }
    setNote("Multiply straight across: top times top, bottom times bottom. Keep the FIRST fraction exactly as it is.");
    setKN(""); setKD("");
  };
  const submitKcfFinal = () => {
    const v = Number(kQ.trim());
    if (!kQ.trim() || !Number.isFinite(v)) return;
    if (v === prodN / prodD) { setNote(null); setKStage("done"); return; }
    setNote(`${prodN} divided by ${prodD} — how many wholes is that?`);
    setKQ("");
  };

  // ── explore state (fraction wall) ──────────────────────────────────────────
  const [exRows, setExRows] = useState<number[][]>([[], []]);
  const [exSel, setExSel] = useState(0);
  // Which bar the student has declared to be one whole. 1 is the printed strip,
  // which is the default and reproduces the original wall exactly.
  const [exWhole, setExWhole] = useState(1);
  const exWholeColor = EX_PIECES.find((p) => p.den === exWhole)?.color ?? EX_PIECES[0].color;

  const exAdd = (den: number) => {
    const row = exRows[exSel] ?? [];
    const [n, d] = rowSum(row);
    // The cap is the STRIP, not the declared whole: once a smaller bar is called
    // one whole, a row running past one whole is the whole point (it reads 3/2),
    // so only the physical strip may stop it.
    if (n * den + d > d * den) {
      setNote(exWhole === 1
        ? "That row already makes one whole. Add a row to keep comparing."
        : "That row already fills the strip. Add a row to keep comparing.");
      return;
    }
    setNote(null);
    setExRows((rs) => rs.map((r, i) => (i === exSel ? [...r, den] : r)));
  };
  const exDeclareWhole = (den: number) => {
    setExWhole(den);
    setNote(den === 1
      ? "The strip is one whole again — every name is back to where it started."
      : "Every bar just got a new name, measured against the bar you called 1.");
  };
  const exRemovePiece = (ri: number, pi: number) => {
    setExSel(ri);
    setNote(null);
    setExRows((rs) => rs.map((r, i) => (i === ri ? r.filter((_, j) => j !== pi) : r)));
  };
  const exAddRow = () => {
    setExSel(exRows.length);
    setNote(null);
    setExRows((rs) => [...rs, []]);
  };
  const exRemoveRow = () => {
    if (exRows.length <= 1) return;
    setExRows((rs) => rs.filter((_, i) => i !== exSel));
    setExSel((s) => Math.min(s, exRows.length - 2));
    setNote(null);
  };
  const exClearRow = () => {
    setExRows((rs) => rs.map((r, i) => (i === exSel ? [] : r)));
    setNote(null);
  };

  const wholeTicks = (den: number) => Array.from({ length: den - 1 }, (_, i) => ((i + 1) / den) * 100);

  return (
    <div className="fb-wrap">
      <style>{`
        .fb-wrap { font-family:var(--bdb-font); color:var(--bdb-ink); max-width:760px; margin:0 auto; padding:14px clamp(10px,3vw,20px) 34px; }
        .fb-modebar { display:flex; justify-content:center; margin:0 0 14px; }
        .fb-modeseg { display:inline-flex; flex-wrap:wrap; justify-content:center; border:2px solid var(--bdb-line); border-radius:22px; overflow:hidden; background:var(--bdb-card); }
        .fb-modeseg button { font:inherit; font-weight:800; font-size:0.86rem; min-height:44px; padding:0 16px; border:none; background:transparent; color:var(--bdb-ink-soft); cursor:pointer; }
        .fb-modeseg button.on { background:var(--bdb-ink); color:#fff; }
        .fb-prompt { text-align:center; font-size:clamp(1.1rem,3.2vw,1.5rem); font-weight:800; margin:2px 0 4px; min-height:30px; }
        .fb-sub { text-align:center; color:var(--bdb-ink-soft); font-size:0.92rem; margin:0 0 12px; min-height:18px; }
        .fb-tbtn { font:inherit; font-weight:700; font-size:0.82rem; padding:6px 16px; min-height:44px; display:inline-flex; align-items:center; justify-content:center; border-radius:999px; border:1px solid var(--bdb-line); background:var(--bdb-card); color:var(--bdb-ink-soft); cursor:pointer; }
        .fb-tbtn.on { background:var(--bdb-ink); color:#fff; border-color:var(--bdb-ink); }
        .fb-tbtn:disabled { opacity:0.42; cursor:not-allowed; }
        .fb-stage { width:min(620px,100%); margin:0 auto; display:grid; gap:14px; }
        .fb-rowlbl { font-size:0.72rem; font-weight:800; letter-spacing:0.06em; text-transform:uppercase; color:var(--bdb-ink-faint); margin-bottom:4px; }
        .fb-track { position:relative; height:46px; border:2px dashed var(--bdb-line); background:var(--bdb-card); }
        .fb-track.solid { border-style:solid; border-color:var(--bdb-ink); }
        .fb-endlbl { position:absolute; top:100%; margin-top:3px; font-size:0.78rem; font-weight:800; color:var(--bdb-ink-faint); }
        .fb-piece { position:absolute; top:0; height:100%; display:grid; place-items:center; color:#fff; font-weight:900; font-size:0.95rem; border-right:2px solid rgba(255,255,255,0.75); box-sizing:border-box; }
        .fb-piece.pop { animation:fbPop .3s cubic-bezier(.34,.8,.3,1) backwards; }
        @keyframes fbPop { from { opacity:0; transform:scale(.6); } to { opacity:1; transform:scale(1); } }
        .fb-tick { position:absolute; top:0; height:100%; width:0; border-left:1px dashed color-mix(in srgb, var(--bdb-ink) 22%, transparent); }
        .fb-goal { position:absolute; top:-8px; bottom:-8px; width:3px; background:var(--bdb-coral); }
        .fb-bar { display:flex; gap:8px; justify-content:center; align-items:center; margin-top:14px; flex-wrap:wrap; }
        .fb-probs { display:flex; gap:8px; justify-content:center; flex-wrap:wrap; margin-bottom:10px; }
        .fb-btn { font:inherit; font-weight:700; font-size:0.9rem; padding:9px 16px; min-height:44px; display:inline-flex; align-items:center; justify-content:center; border-radius:11px; border:1px solid var(--bdb-line); background:var(--bdb-ink); color:#fff; cursor:pointer; }
        .fb-btn.ghost { background:var(--bdb-card); color:var(--bdb-ink); }
        .fb-btn:disabled { opacity:0.42; cursor:not-allowed; }
        .fb-in { width:84px; font:inherit; font-size:1.2rem; font-weight:900; text-align:center; padding:7px; border:3px solid var(--bdb-ink); border-radius:0; background:#fff; color:var(--bdb-ink); }
        .fb-formula { display:flex; flex-wrap:wrap; align-items:center; justify-content:center; gap:12px; font-weight:900; font-size:clamp(1.3rem,4vw,1.8rem); margin-top:14px; }
        .fb-frac { display:inline-grid; justify-items:center; line-height:1; }
        .fb-fn, .fb-fd { display:block; height:30px; display:grid; place-items:center; min-width:26px; padding:0 4px; transition:transform .7s cubic-bezier(.34,.8,.3,1); }
        .fb-fbar { width:100%; height:3px; background:currentColor; border-radius:2px; }
        .fb-op { position:relative; width:38px; height:38px; display:inline-grid; place-items:center; }
        .fb-op span { position:absolute; inset:0; display:grid; place-items:center; transition:opacity .5s ease, transform .6s cubic-bezier(.34,.8,.3,1); }
        .fb-kcol { display:inline-grid; justify-items:center; gap:6px; }
        .fb-badge { font-size:0.66rem; font-weight:900; letter-spacing:0.1em; text-transform:uppercase; padding:3px 10px; border-radius:999px; color:#fff; opacity:0; transform:translateY(6px); transition:opacity .4s ease, transform .4s ease; }
        .fb-badge.on { opacity:1; transform:none; }
        .fb-keepring { border-radius:12px; padding:6px 8px; transition:box-shadow .4s ease; }
        .fb-keepring.on { box-shadow:0 0 0 4px ${C_GREEN}; animation:fbSettle .5s cubic-bezier(.2,.85,.3,1.05); }
        /* KEEP lands like a weight hitting the ground - a short drop and settle */
        @keyframes fbSettle { 0% { transform:translateY(-12px) scale(1.05); } 55% { transform:translateY(3px) scale(.98); } 100% { transform:none; } }
        /* Keep-Change-Flip runs large - it is the whole screen, not a footnote */
        .fb-kcf { font-size:clamp(2.3rem,7vw,3.4rem); gap:18px; }
        .fb-kcf .fb-badge { font-size:0.5em; }
        .fb-frac.big .fb-fn, .fb-frac.big .fb-fd { min-width:42px; padding:0 6px; }
        .fb-across { display:grid; gap:7px; justify-items:center; margin-top:22px; animation:fbPop .32s ease; }
        .fb-across-row { display:flex; gap:11px; align-items:center; font-weight:800; font-size:clamp(0.98rem,2.6vw,1.2rem); color:var(--bdb-ink); }
        .fb-across-row .k { padding:2px 11px; border-radius:999px; color:#fff; font-size:0.78em; letter-spacing:0.04em; text-transform:uppercase; }
        .fb-across-row .ar { color:var(--bdb-ink-faint); font-weight:900; margin:0 3px; }
        .fb-across-note { margin:5px 0 0; max-width:40ch; text-align:center; color:var(--bdb-ink-soft); font-weight:700; font-size:0.96rem; line-height:1.4; }
        /* Mixed-numbers walkthrough: the mixed number large, then pie circles */
        .fb-mixbig { display:flex; align-items:center; justify-content:center; gap:16px; margin:28px 0 10px; font-size:clamp(3rem,9vw,4.6rem); font-weight:900; color:var(--bdb-ink); }
        .fb-circles { display:flex; flex-wrap:wrap; gap:clamp(12px,3vw,28px); justify-content:center; align-items:flex-end; margin:22px 0 8px; }
        .fb-circle { display:grid; justify-items:center; gap:8px; }
        .fb-circlelbl { font-weight:900; font-size:1.15rem; color:var(--bdb-ink); }
        .fb-piewrap { border-radius:999px; padding:5px; transition:box-shadow .25s ease; }
        .fb-circle.active .fb-piewrap { box-shadow:0 0 0 4px color-mix(in srgb, ${C_AMBER} 60%, transparent); }
        .fb-pie { width:clamp(92px,19vw,132px); height:clamp(92px,19vw,132px); display:block; }
        .fb-outline { fill:var(--bdb-card); stroke:var(--bdb-ink); stroke-width:2.5; }
        .fb-slice { stroke:var(--bdb-ink); stroke-width:1.5; transition:fill .2s ease; animation:fbSliceIn .34s ease backwards; }
        .fb-slice.hit { cursor:pointer; }
        .fb-circle.active .fb-slice { stroke-width:2; }
        @keyframes fbSliceIn { from { opacity:0; } to { opacity:1; } }
        .fb-note { text-align:center; min-height:26px; margin-top:12px; }
        .fb-note-in { display:inline-block; color:var(--bdb-coral); font-weight:800; font-size:clamp(1rem,3vw,1.3rem); line-height:1.35; padding:8px 16px; border-radius:12px; background:color-mix(in srgb, var(--bdb-coral) 12%, transparent); }
        .fb-done { text-align:center; font-size:clamp(1.2rem,3.6vw,1.8rem); font-weight:900; margin-top:12px; }
        .fb-palette { display:flex; gap:8px; justify-content:center; align-items:center; flex-wrap:wrap; margin-bottom:10px; }
        .fb-pal { font:inherit; font-weight:900; font-size:1rem; min-height:44px; padding:0 16px; border:2px solid var(--bdb-ink); background:var(--bdb-card); color:var(--bdb-ink); cursor:pointer; }
        .fb-track.exsel { border-style:solid; border-color:var(--bdb-ink); box-shadow:0 0 0 3px color-mix(in srgb, var(--bdb-amber) 55%, transparent); }
        button.fb-piece { border-top:none; border-bottom:none; border-left:none; font:inherit; font-weight:900; font-size:0.95rem; padding:0; cursor:pointer; }
        .fb-rowsum { font-weight:900; color:var(--bdb-ink); text-transform:none; letter-spacing:0; font-size:0.9rem; margin-left:6px; }
        .fb-tilenum { position:absolute; inset:0; display:grid; place-items:center; color:var(--bdb-ink); font-weight:900; }
        .fb-ghost { position:absolute; top:0; height:100%; box-sizing:border-box; background:transparent; border:2px dashed color-mix(in srgb, var(--bdb-ink) 40%, transparent); }
        .fb-partlbl { position:absolute; top:100%; margin-top:5px; transform:translateX(-50%); white-space:nowrap; font-size:0.74rem; font-weight:900; color:var(--bdb-ink); }
        .fb-grouprow { padding-bottom:24px; }
        .fb-big { display:grid; grid-template-columns:1fr 1fr; gap:12px; width:min(560px,100%); margin:18px auto 0; }
        .fb-bigbtn { font:inherit; font-weight:900; font-size:clamp(1rem,3.2vw,1.35rem); min-height:104px; padding:12px 14px; display:flex; align-items:center; justify-content:center; gap:10px; text-align:center; border:3px solid var(--bdb-ink); border-radius:16px; background:var(--bdb-card); color:var(--bdb-ink); cursor:pointer; }
        .fb-bigbtn:disabled { cursor:default; }
        .fb-bigbtn.win { border-color:var(--bdb-green-deep); box-shadow:0 0 0 4px color-mix(in srgb, var(--bdb-green-deep) 22%, transparent); }
        .fb-bigbtn.lose { opacity:0.45; }
        @media (max-width:520px) { .fb-big { grid-template-columns:1fr; } }
        .fb-verdict { text-align:center; font-weight:900; font-size:clamp(1.05rem,3vw,1.35rem); margin-top:18px; }
        .fb-why { max-width:44ch; margin:6px auto 0; text-align:center; color:var(--bdb-ink-soft); font-size:0.98rem; line-height:1.45; }
        .fb-wbar { display:flex; gap:6px; justify-content:center; align-items:center; flex-wrap:wrap; margin-bottom:10px; }
        .fb-wlbl { font-size:0.72rem; font-weight:800; letter-spacing:0.06em; text-transform:uppercase; color:var(--bdb-ink-faint); }
        .fb-wbtn { font:inherit; font-weight:800; font-size:0.86rem; min-height:44px; padding:0 13px; border-radius:999px; border:2px solid var(--bdb-line); background:var(--bdb-card); color:var(--bdb-ink-soft); cursor:pointer; }
        .fb-wbtn.on { background:var(--bdb-ink); color:#fff; border-color:var(--bdb-ink); }
        .fb-wline { position:absolute; top:-4px; bottom:-4px; width:2px; background:color-mix(in srgb, var(--bdb-ink) 45%, transparent); }
        @media (prefers-reduced-motion: reduce) { .fb-piece.pop, .fb-keepring.on, .fb-across, .fb-slice { animation:none; } .fb-fn, .fb-fd, .fb-op span, .fb-badge { transition:none; } }
      `}</style>

      <LiveToolBanner tool={liveTool} />

      <div className="fb-modebar">
        <div className="fb-modeseg">
          <button className={mode === "divide" ? "on" : ""} onClick={() => { setMode("divide"); setNote(null); }}>How many fit?</button>
          <button className={mode === "estimate" ? "on" : ""} onClick={() => { setMode("estimate"); setNote(null); }}>Bigger or smaller?</button>
          <button className={mode === "mixed" ? "on" : ""} onClick={() => { setMode("mixed"); setNote(null); }}>Mixed numbers</button>
          <button className={mode === "kcf" ? "on" : ""} onClick={() => { setMode("kcf"); setNote(null); }}>Keep Change Flip</button>
          <button className={mode === "explore" ? "on" : ""} onClick={() => { setMode("explore"); setNote(null); }}>Explore</button>
        </div>
      </div>

      {mode === "divide" && (
        <>
          <div className="fb-prompt">
            {phase === "build" && `Build the total: ${totalText}`}
            {phase === "tile" && `How many ${divisorText} groups fit in ${totalText}?`}
            {phase === "count" && (di.exact ? "Count the groups" : "Count the groups and the leftover")}
            {phase === "verify" && (di.exact ? "Verify it with multiplication" : "Check the full groups")}
            {phase === "done" && `${totalText} ÷ ${divisorText} = ${quotientText}`}
          </div>
          <div className="fb-sub">
            {phase === "build" && `Tap to add ${nths(prob.d)} until the bar shows ${totalText}.`}
            {phase === "tile" && (di.exact
              ? `Tile ${divisorText} pieces under it until they fill the SAME length.`
              : `Tile ${divisorText} pieces under it until no more whole groups fit.`)}
            {phase === "count" && (di.exact
              ? "Count the tiles — the groups — not the tick marks."
              : "Say the leftover as a fraction of ONE GROUP. Hold it against the dashed outline.")}
            {phase === "verify" && (di.exact
              ? "The quotient counts groups, so the groups must multiply back to the total."
              : `The ${groupsWord(di.whole)} plus the leftover have to cover ${totalText} exactly.`)}
            {phase === "done" && (di.exact
              ? "Counted, drawn, and verified."
              : "The leftover is measured in GROUPS, not in pieces of the bar.")}
          </div>

          <div className="fb-probs">
            {DIV_PROBLEMS.map((pr, i) => (
              <button key={i} className={`fb-tbtn ${i === pIdx ? "on" : ""}`} onClick={() => startProblem(i)}>
                {pr.n}/{pr.d} ÷ {sumLabel([pr.n2, pr.d2])}
              </button>
            ))}
            <button className="fb-tbtn" onClick={() => startProblem(pIdx)}>Reset</button>
          </div>

          <div className="fb-stage" style={stageStyle}>
            <div>
              <div className="fb-rowlbl">The whole</div>
              <div className="fb-track solid">
                {wholeTicks(prob.d).map((pct) => <div key={pct} className="fb-tick" style={{ left: `${pct}%` }} />)}
                <span className="fb-endlbl" style={{ left: 0 }}>0</span>
                <span className="fb-endlbl" style={{ right: 0 }}>1</span>
              </div>
            </div>
            <div>
              <div className="fb-rowlbl">The total: {totalText}</div>
              <div className="fb-track">
                {Array.from({ length: built }).map((_, i) => (
                  <div key={i} className="fb-piece pop" style={{ left: `${(i / prob.d) * 100}%`, width: `${100 / prob.d}%`, background: C_TEAL }}>
                    1/{prob.d}
                  </div>
                ))}
                {phase !== "build" && <div className="fb-goal" style={{ left: `${goalPct}%` }} />}
              </div>
            </div>
            {phase !== "build" && (
              <div className={showPartial ? "fb-grouprow" : undefined}>
                <div className="fb-rowlbl">Groups of {divisorText}</div>
                <div className="fb-track">
                  {/* The group the leftover sits inside, drawn full size. Without it
                      the leftover has no referent unit on screen and 1/8 of a group
                      looks exactly like 1/12 of the bar. */}
                  {showPartial && <div className="fb-ghost" style={{ left: `${di.whole * groupPct}%`, width: `${groupPct}%` }} />}
                  {Array.from({ length: tiles }).map((_, i) => {
                    if (!di.exact && i === di.whole) {
                      return (
                        <div key={i} className="fb-piece pop" aria-hidden="true"
                          style={{
                            left: `${di.whole * groupPct}%`, width: `${partialPct}%`, borderRight: "none",
                            background: `repeating-linear-gradient(45deg, ${C_AMBER} 0 7px, color-mix(in srgb, ${C_AMBER} 38%, var(--bdb-card)) 7px 14px)`,
                          }} />
                      );
                    }
                    // Coral stays the ONE meaning it already had: this group ran past
                    // the total. The leftover is striped, never coral.
                    const over = i >= di.pieces;
                    return (
                      <div key={i} className="fb-piece pop" style={{ left: `${i * groupPct}%`, width: `${groupPct}%`, background: over ? C_CORAL : C_AMBER, color: "var(--bdb-ink)" }}>
                        {showTileNums && !over ? <span className="fb-tilenum">{i + 1}</span> : divisorText}
                      </div>
                    );
                  })}
                  <div className="fb-goal" style={{ left: `${goalPct}%` }} />
                  {showPartial && (
                    <span className="fb-partlbl" style={{ left: `${di.whole * groupPct + partialPct / 2}%` }}>
                      {phase === "tile" || phase === "count" ? "? of a group" : `${leftoverText} of a group`}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {phase === "build" && (
            <div className="fb-bar">
              <button className="fb-btn" onClick={addBuilt}>Add 1/{prob.d}</button>
              <button className="fb-btn ghost" disabled={built === 0} onClick={removeBuilt}>Take one off</button>
            </div>
          )}
          {phase === "tile" && (
            <div className="fb-bar">
              <button className="fb-btn" onClick={addTile}>
                {!di.exact && tiles === di.whole ? "Add the leftover piece" : `Add a ${divisorText} group`}
              </button>
              <button className="fb-btn ghost" disabled={tiles === 0} onClick={removeTile}>Take one off</button>
            </div>
          )}
          {phase === "count" && (
            <div className="fb-formula">
              <Frac n={prob.n} d={prob.d} color={C_TEAL} />
              <span>÷</span>
              <Frac n={prob.n2} d={prob.d2} color="var(--bdb-ink)" />
              <span>=</span>
              <input className="fb-in" style={di.exact ? undefined : { width: 66 }} value={countIn} inputMode="numeric" autoFocus
                aria-label={di.exact ? "how many groups fit" : "how many whole groups fit"}
                onChange={(e) => { setCountIn(e.target.value.replace(/\D/g, "")); setNote(null); }}
                onKeyDown={(e) => e.key === "Enter" && submitCount()} />
              {!di.exact && (
                <>
                  <span style={{ fontSize: "0.62em" }}>groups and</span>
                  <span className="fb-kcol" style={{ gap: 2 }}>
                    <input className="fb-in" style={{ width: 62 }} value={leftNIn} inputMode="numeric" aria-label="leftover numerator, in groups"
                      onChange={(e) => { setLeftNIn(e.target.value.replace(/\D/g, "")); setNote(null); }}
                      onKeyDown={(e) => e.key === "Enter" && submitCount()} />
                    <input className="fb-in" style={{ width: 62 }} value={leftDIn} inputMode="numeric" aria-label="leftover denominator, in groups"
                      onChange={(e) => { setLeftDIn(e.target.value.replace(/\D/g, "")); setNote(null); }}
                      onKeyDown={(e) => e.key === "Enter" && submitCount()} />
                  </span>
                  <span style={{ fontSize: "0.62em" }}>of a group</span>
                </>
              )}
              <button className="fb-btn" disabled={!countIn.trim() || (!di.exact && (!leftNIn.trim() || !leftDIn.trim()))} onClick={submitCount}>Enter</button>
            </div>
          )}
          {phase === "verify" && (
            <div className="fb-formula">
              <span>{di.whole} ×</span>
              <Frac n={prob.n2} d={prob.d2} />
              <span>=</span>
              <input className="fb-in" value={verifyIn} inputMode="numeric" autoFocus aria-label="numerator of the product"
                onChange={(e) => { setVerifyIn(e.target.value.replace(/\D/g, "")); setNote(null); }}
                onKeyDown={(e) => e.key === "Enter" && submitVerify()} />
              <span>/{prob.d2}</span>
              <button className="fb-btn" disabled={!verifyIn.trim()} onClick={submitVerify}>Enter</button>
            </div>
          )}
          {phase === "done" && (
            <>
              <div className="fb-done">
                {di.exact
                  ? `${di.whole} × ${divisorText} = ${verifyTarget}/${prob.d2} = ${totalText}`
                  : `${di.whole} × ${divisorText} = ${verifyTarget}/${prob.d2}, and ${sumLabel([di.ofWholeN, di.ofWholeD])} of the bar is left over — that leftover is ${leftoverText} of one ${divisorText} group.`}
              </div>
              <div className="fb-bar">
                <button className="fb-btn" onClick={() => startProblem((pIdx + 1) % DIV_PROBLEMS.length)}>Next problem</button>
              </div>
            </>
          )}
        </>
      )}

      {mode === "estimate" && (
        <>
          <div className="fb-prompt">
            {eVariant === "start" ? `Will the answer be bigger or smaller than ${eStartText}?` : "Which one is bigger?"}
          </div>
          <div className="fb-sub">
            {eVariant === "start"
              ? "No arithmetic. Pick the direction, read why, keep going."
              : "No arithmetic. Tap the one with the bigger answer, read why, keep going."}
          </div>

          <div className="fb-probs">
            <button className={`fb-tbtn ${eVariant === "start" ? "on" : ""}`}
              onClick={() => { setEVariant("start"); setEPick(null); setNote(null); }}>Compare to the start</button>
            <button className={`fb-tbtn ${eVariant === "head" ? "on" : ""}`}
              onClick={() => { setEVariant("head"); setEPick(null); setNote(null); }}>Head to head</button>
          </div>

          {eVariant === "start" && (
            <div className="fb-formula" style={{ fontSize: "clamp(1.7rem,6vw,2.6rem)", marginTop: 18 }}>
              <NumTerm n={ep.an} d={ep.ad} color={C_TEAL} />
              <span>{ep.op === "div" ? "÷" : "×"}</span>
              <NumTerm n={ep.bn} d={ep.bd} color="var(--bdb-ink)" />
            </div>
          )}

          <div className="fb-big">
            {eVariant === "start" ? (
              <>
                <button className={`fb-bigbtn ${ePick ? (eBigger ? "win" : "lose") : ""}`} disabled={ePick !== null}
                  aria-label={`the answer is bigger than ${eStartText}`} onClick={() => setEPick("bigger")}>
                  Bigger than {eStartText}
                </button>
                <button className={`fb-bigbtn ${ePick ? (eBigger ? "lose" : "win") : ""}`} disabled={ePick !== null}
                  aria-label={`the answer is smaller than ${eStartText}`} onClick={() => setEPick("smaller")}>
                  Smaller than {eStartText}
                </button>
              </>
            ) : (
              <>
                <button className={`fb-bigbtn ${ePick ? (eDivWins ? "win" : "lose") : ""}`} disabled={ePick !== null}
                  aria-label={`${eStartText} divided by ${eDivisorText} is bigger`} onClick={() => setEPick("div")}>
                  <NumTerm n={ep.an} d={ep.ad} color={C_TEAL} />
                  <span>÷</span>
                  <NumTerm n={ep.bn} d={ep.bd} />
                </button>
                <button className={`fb-bigbtn ${ePick ? (eDivWins ? "lose" : "win") : ""}`} disabled={ePick !== null}
                  aria-label={`${eStartText} times ${eDivisorText} is bigger`} onClick={() => setEPick("mul")}>
                  <NumTerm n={ep.an} d={ep.ad} color={C_TEAL} />
                  <span>×</span>
                  <NumTerm n={ep.bn} d={ep.bd} />
                </button>
              </>
            )}
          </div>

          {ePick !== null && (
            <>
              <div className="fb-verdict" style={{ color: eRight ? "var(--bdb-green-deep)" : "var(--bdb-coral-deep)" }}>
                {eRight ? "Yes — " : "Not this time — "}{eVerdictTail}
              </div>
              <div className="fb-why">{eWhy}</div>
              <div className="fb-bar">
                <button className="fb-btn" onClick={nextEstimate}>Next one</button>
              </div>
            </>
          )}
        </>
      )}

      {mode === "mixed" && (
        <>
          <div className="fb-prompt">
            {mStage === "done"
              ? `${mp.w} ${mp.n}/${mp.d} = ${mImproper}/${mp.d}`
              : `Break ${mp.w} ${mp.n}/${mp.d} into ${nths(mp.d)}`}
          </div>
          <div className="fb-sub">
            {mStage === "wholes" && "How many whole ones are in this number?"}
            {mStage === "denom" && "Each circle splits into equal pieces. What is the denominator?"}
            {mStage === "fill" && (mFillIdx < mp.w
              ? `Fill circle ${mFillIdx + 1} completely - a whole is ${mp.d}/${mp.d}.`
              : `Now the leftover: fill in ${mp.n}/${mp.d}.`)}
            {mStage === "total" && "Count every filled piece to name the improper fraction."}
            {mStage === "done" && "Same amount, now written as one fraction."}
          </div>

          <div className="fb-probs">
            <button className="fb-tbtn" onClick={() => startMixed(nextMixedIndex(mIdx))}>New problem</button>
            <button className="fb-tbtn" onClick={() => startMixed(mIdx)}>Reset</button>
          </div>

          {mStage === "wholes" ? (
            <div className="fb-mixbig">
              <span>{mp.w}</span>
              <Frac n={mp.n} d={mp.d} big />
            </div>
          ) : (
            <div className="fb-circles">
              {Array.from({ length: mCircleCount }).map((_, ci) => {
                const isFrac = ci === mp.w;
                const filled = mFilled[ci] ?? 0;
                const active = mStage === "fill" && ci === mFillIdx;
                const color = isFrac ? C_AMBER : C_TEAL;
                return (
                  <div key={ci} className={`fb-circle ${active ? "active" : ""}`}>
                    <div className="fb-circlelbl">{isFrac ? `${mp.n}/${mp.d}` : "1"}</div>
                    <span className="fb-piewrap">
                      <svg className="fb-pie" viewBox="0 0 100 100" role="img"
                        aria-label={isFrac ? `leftover ${mp.n}/${mp.d}` : `whole number ${ci + 1}`}>
                        {mStage === "denom" ? (
                          <circle className="fb-outline" cx="50" cy="50" r="46" />
                        ) : (
                          Array.from({ length: mp.d }).map((_, i) => {
                            const on = i < filled;
                            return (
                              <path key={i} className={`fb-slice ${active ? "hit" : ""}`}
                                d={slicePath(50, 50, 46, i, mp.d)}
                                style={{ fill: on ? color : "var(--bdb-card)", animationDelay: `${i * 45}ms` }}
                                onClick={() => fillSlice(ci, i)} />
                            );
                          })
                        )}
                      </svg>
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {mStage === "wholes" && (
            <div className="fb-formula">
              <span>Whole ones:</span>
              <input className="fb-in" value={mIn} inputMode="numeric" autoFocus aria-label="how many whole ones"
                onChange={(e) => { setMIn(e.target.value.replace(/\D/g, "")); setNote(null); }}
                onKeyDown={(e) => e.key === "Enter" && submitMixedWholes()} />
              <button className="fb-btn" disabled={!mIn.trim()} onClick={submitMixedWholes}>Enter</button>
            </div>
          )}
          {mStage === "denom" && (
            <div className="fb-formula">
              <span>Denominator:</span>
              <input className="fb-in" value={mIn} inputMode="numeric" autoFocus aria-label="the denominator"
                onChange={(e) => { setMIn(e.target.value.replace(/\D/g, "")); setNote(null); }}
                onKeyDown={(e) => e.key === "Enter" && submitMixedDenom()} />
              <button className="fb-btn" disabled={!mIn.trim()} onClick={submitMixedDenom}>Split the circles</button>
            </div>
          )}
          {mStage === "total" && (
            <div className="fb-formula">
              <span>{Array.from({ length: mp.w }, () => `${mp.d}/${mp.d}`).join(" + ")} + {mp.n}/{mp.d} =</span>
              <input className="fb-in" value={mIn} inputMode="numeric" autoFocus aria-label={`total ${nths(mp.d)}`}
                onChange={(e) => { setMIn(e.target.value.replace(/\D/g, "")); setNote(null); }}
                onKeyDown={(e) => e.key === "Enter" && submitMixedTotal()} />
              <span>/{mp.d}</span>
              <button className="fb-btn" disabled={!mIn.trim()} onClick={submitMixedTotal}>Enter</button>
            </div>
          )}
          {mStage === "done" && (
            <>
              <div className="fb-done">{mp.w} {mp.n}/{mp.d} = {mImproper}/{mp.d}</div>
              <div className="fb-bar">
                <button className="fb-btn" onClick={() => startMixed(nextMixedIndex(mIdx))}>New problem</button>
              </div>
            </>
          )}
        </>
      )}

      {mode === "kcf" && (
        <>
          <div className="fb-prompt">
            {kStage === "done"
              ? `${kp.a[0]}/${kp.a[1]} ÷ ${kp.b[0]}/${kp.b[1]} = ${kInteger ? prodN / prodD : `${prodN}/${prodD}`}`
              : "Keep. Change. Flip."}
          </div>
          <div className="fb-sub">
            {kStage === "walk" && kStep === 0 && "Dividing by a fraction has a shortcut you have already earned. Walk it one move at a time."}
            {kStage === "walk" && kStep === 1 && "KEEP the first fraction exactly as it is."}
            {kStage === "walk" && kStep === 2 && "CHANGE the division into multiplication."}
            {kStage === "walk" && kStep === 3 && "FLIP the second fraction — its top and bottom trade places."}
            {kStage === "product" && "Now multiply straight across: top times top, bottom times bottom."}
            {kStage === "final" && "Simplify: how many wholes is that?"}
            {kStage === "done" && "Dividing by a fraction is multiplying by its reciprocal."}
          </div>

          <div className="fb-probs">
            <button className="fb-tbtn" onClick={() => startKcf(nextKcfIndex(kIdx))}>New problem</button>
            <button className="fb-tbtn" onClick={() => startKcf(kIdx)}>Reset</button>
          </div>

          <div className="fb-formula fb-kcf" style={{ marginTop: 40 }}>
            <span className="fb-kcol">
              <span className={`fb-badge ${kStep >= 1 ? "on" : ""}`} style={{ background: C_GREEN }}>Keep</span>
              <span className={`fb-keepring ${kStep >= 1 ? "on" : ""}`}>
                <Frac n={kp.a[0]} d={kp.a[1]} color={C_TEAL} big />
              </span>
            </span>
            <span className="fb-kcol">
              <span className={`fb-badge ${kStep >= 2 ? "on" : ""}`} style={{ background: C_AMBER, color: "var(--bdb-ink)" }}>Change</span>
              <span className="fb-op" aria-label={kStep >= 2 ? "times" : "divided by"}>
                <span style={{ opacity: kStep >= 2 ? 0 : 1, transform: kStep >= 2 ? "rotate(180deg) scale(0.4)" : "none" }}>÷</span>
                <span style={{ opacity: kStep >= 2 ? 1 : 0, transform: kStep >= 2 ? "none" : "rotate(-180deg) scale(0.4)" }}>×</span>
              </span>
            </span>
            <span className="fb-kcol">
              <span className={`fb-badge ${kStep >= 3 ? "on" : ""}`} style={{ background: C_CORAL }}>Flip</span>
              <Frac n={kp.b[0]} d={kp.b[1]} color={C_CORAL} flipped={kStep >= 3} big />
            </span>
            {kStage !== "walk" && (
              <>
                <span>=</span>
                {kStage === "product" ? (
                  <span className="fb-kcol" style={{ gap: 2 }}>
                    <input className="fb-in" style={{ width: 80 }} value={kN} inputMode="numeric" autoFocus aria-label="product numerator"
                      onChange={(e) => { setKN(e.target.value.replace(/\D/g, "")); setNote(null); }} />
                    <input className="fb-in" style={{ width: 80 }} value={kD} inputMode="numeric" aria-label="product denominator"
                      onChange={(e) => { setKD(e.target.value.replace(/\D/g, "")); setNote(null); }}
                      onKeyDown={(e) => e.key === "Enter" && submitKcfProduct()} />
                  </span>
                ) : (
                  <Frac n={prodN} d={prodD} big />
                )}
                {kStage === "final" && (
                  <>
                    <span>=</span>
                    <input className="fb-in" value={kQ} inputMode="numeric" autoFocus aria-label="simplified answer"
                      onChange={(e) => { setKQ(e.target.value.replace(/\D/g, "")); setNote(null); }}
                      onKeyDown={(e) => e.key === "Enter" && submitKcfFinal()} />
                  </>
                )}
                {kStage === "done" && kInteger && <><span>=</span><span>{prodN / prodD}</span></>}
              </>
            )}
          </div>

          {/* Multiply-across cue: once the algorithm is set up, show the two
              multiplications that build the answer - tops across the top,
              bottoms across the bottom - and name the thing students forget,
              that dividing (unlike adding) multiplies the denominators too. */}
          {(kStage === "product" || kStage === "final" || kStage === "done") && (
            <div className="fb-across" aria-hidden>
              <div className="fb-across-row">
                <span className="k" style={{ background: C_GREEN }}>tops</span>
                <span>{kp.a[0]} × {kp.b[1]} <span className="ar">&rarr;</span> numerator</span>
              </div>
              <div className="fb-across-row">
                <span className="k" style={{ background: C_CORAL }}>bottoms</span>
                <span>{kp.a[1]} × {kp.b[0]} <span className="ar">&rarr;</span> denominator</span>
              </div>
              <p className="fb-across-note">Unlike adding and subtracting, dividing multiplies the denominators too.</p>
            </div>
          )}

          <div className="fb-bar">
            {kStage === "walk" && kStep < 3 && (
              <button className="fb-btn" onClick={kcfAdvance}>
                {kStep === 0 ? "KEEP the first fraction" : kStep === 1 ? "CHANGE ÷ to ×" : "FLIP the second fraction"}
              </button>
            )}
            {kStage === "product" && <button className="fb-btn" disabled={!kN.trim() || !kD.trim()} onClick={submitKcfProduct}>Enter</button>}
            {kStage === "final" && <button className="fb-btn" disabled={!kQ.trim()} onClick={submitKcfFinal}>Enter</button>}
            {kStage === "done" && (
              <button className="fb-btn" onClick={() => startKcf(nextKcfIndex(kIdx))}>Next problem</button>
            )}
          </div>
        </>
      )}

      {mode === "explore" && (
        <>
          <div className="fb-prompt">Compare fractions to one whole</div>
          <div className="fb-sub">
            Tap a row to pick it, then tap fractions to lay pieces under the whole. Tap a piece to take it off.
            Change which bar is one whole and every name changes with it.
          </div>

          {/* Cuisenaire rods carry no printed fractions — you declare which rod is
              one, and every other name follows from that. Declaring the whole is
              the referent-unit lesson, so it is a control, not a setting. */}
          <div className="fb-wbar">
            <span className="fb-wlbl">Which bar is one whole?</span>
            {EX_PIECES.map((t) => (
              <button key={t.den} className={`fb-wbtn ${t.den === exWhole ? "on" : ""}`}
                style={t.den === exWhole ? undefined : { borderColor: t.color, color: t.color }}
                aria-pressed={t.den === exWhole}
                aria-label={t.den === exWhole
                  ? "this bar is one whole right now"
                  : `call the ${labelFor(t.den, exWhole)} bar one whole`}
                onClick={() => exDeclareWhole(t.den)}>
                {labelFor(t.den, exWhole)}
              </button>
            ))}
          </div>

          <div className="fb-palette">
            <span className="fb-wlbl">Lay a piece</span>
            {EX_PIECES.map((t) => (
              <button key={t.den} className="fb-pal" style={{ borderColor: t.color, color: t.color }}
                aria-label={`add ${labelFor(t.den, exWhole)} to the row`} onClick={() => exAdd(t.den)}>
                {labelFor(t.den, exWhole)}
              </button>
            ))}
          </div>
          <div className="fb-probs">
            <button className="fb-tbtn" disabled={exRows.length >= 6} onClick={exAddRow}>Add a row</button>
            <button className="fb-tbtn" disabled={exRows.length <= 1} onClick={exRemoveRow}>Remove row</button>
            <button className="fb-tbtn" disabled={!(exRows[exSel] ?? []).length} onClick={exClearRow}>Clear row</button>
          </div>

          <div className="fb-stage">
            <div>
              <div className="fb-rowlbl">
                One whole
                {exWhole !== 1 && <span className="fb-rowsum">= the bar you called 1</span>}
              </div>
              <div className="fb-track solid">
                <div className="fb-piece" style={{ left: 0, width: `${100 / exWhole}%`, background: exWholeColor, boxShadow: exWhole === 1 ? undefined : "inset 0 0 0 3px var(--bdb-ink)" }}>1</div>
                {exWhole !== 1 && <span className="fb-endlbl" style={{ right: 0 }}>{labelFor(1, exWhole)}</span>}
              </div>
            </div>
            {exRows.map((row, ri) => {
              let acc = 0;
              return (
                <div key={ri}>
                  <div className="fb-rowlbl">
                    Row {ri + 1}
                    {row.length > 0 && <span className="fb-rowsum">= {sumLabel(rowValue(row, exWhole))}</span>}
                  </div>
                  <div className={`fb-track ${exSel === ri ? "exsel" : ""}`} onClick={() => setExSel(ri)}>
                    {row.map((den, pi) => {
                      const left = acc;
                      acc += 1 / den;
                      const t = EX_PIECES.find((p) => p.den === den);
                      return (
                        <button key={`${pi}-${den}`} className="fb-piece pop" aria-label={`remove ${labelFor(den, exWhole)}`}
                          style={{ left: `${left * 100}%`, width: `${100 / den}%`, background: t?.color }}
                          onClick={(e) => { e.stopPropagation(); exRemovePiece(ri, pi); }}>
                          {labelFor(den, exWhole)}
                        </button>
                      );
                    })}
                    {exWhole !== 1 && <div className="fb-wline" style={{ left: `${100 / exWhole}%` }} />}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="fb-note">{note && <span key={note} className="fb-note-in">{note}</span>}</div>
    </div>
  );
}
