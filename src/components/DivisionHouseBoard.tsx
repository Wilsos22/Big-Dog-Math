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
  type HouseSlot,
  type HouseTrace,
} from "@/lib/divisionHouse";
import { buildArc, houseLayout, houseWidthUnits, type ArcGeometry } from "@/lib/divisionHouseArcs";
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
// The floor is set by the 44px touch target, not by taste: a cell is `rowPx`
// tall less 4px of margin top and bottom, and rowPx is cellPx * 96/104.
const CELL_MIN = 58;
const CELL_MAX = 168;
/** Space between the plaque naming the parts and the top of the house. */
const PLAQUE_GAP = 46;
/**
 * One colour per round, cycling. "each round should keep the arched arrow
 * lines, but the new round should be a different color."
 *
 * The fourth is the design system's orange-600, which is the one orange in the
 * token set that clears AA on cream - `--bdb-amber` does not, and is spoken for
 * by the target pulse anyway.
 */
const ARC_COLORS = [
  "var(--bdb-coral-deep)",
  "var(--bdb-teal-deep)",
  "var(--bdb-brown)",
  // NOT the ring's orange. A four-round problem would otherwise draw its last
  // round in the same colour as the "tap here" ring. Ink-soft reads as pencil,
  // is clearly none of the other three, and clears AA on cream at 5.6:1.
  "var(--bdb-ink-soft)",
];
/**
 * What a finished round dims to.
 *
 * 0.32 was the first number tried and it was wrong: composited over cream a
 * coral arc at 0.32 measures about 1.6:1, which on a projector at the back of
 * the room is not a faded pathway, it is no pathway. The whole point of keeping
 * the rounds is that they can still be SEEN. 0.55 lands near 2.6:1 - clearly
 * behind the live round, still legibly there.
 */
const ARC_FADED = 0.55;
/**
 * The ring round the spot to tap. NOT `--bdb-amber`, which measures 1.72:1 on
 * cream - the ring exists because Steele said the amber pulse alone was easy to
 * miss from the back of the room, so drawing it in the same amber would have
 * missed for the same reason. This is the design system's orange-600, 3.71:1,
 * which clears the 3:1 floor for a non-text mark and still reads as amber's
 * darker cousin over the pulse it sits on.
 */
const RING_COLOR = "#c4660a";

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

  /**
   * True on the projector. `/teacher/present` embeds this tool in an iframe as
   * `?presentation=1&embed=1`, and NOBODY EVER CLICKS THAT COPY - it sits at
   * step 0 for the whole state. Anything that waits to be dismissed has to know
   * that, or it parks over the middle of the board for the rest of the lesson,
   * and it cannot even be cleared from the iPad: the pen surface lays a
   * pointer-events:none sheet over the present iframe, so the only way to get
   * rid of it is to walk to the laptop.
   */
  const [presentation, setPresentation] = useState(false);

  useBeforePaint(() => {
    const q = new URLSearchParams(window.location.search);
    const raw = q.get("set");
    if (raw && parseHouseSet(raw).problems.length) setLinked(raw);
    const embedded = q.get("presentation") === "1" || q.get("embed") === "1";
    setPresentation(embedded);
    if (!embedded) setShowStart(true);
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
  /**
   * The card that opens each problem - "select the number closest to the door".
   *
   * Starts FALSE and is turned on before the first paint, not on by default.
   * This page is deliberately static, so the server-rendered HTML is what the
   * browser paints first - and with it defaulted on, the projector showed the
   * card for a beat on every state change and every deploy reload before
   * hydration could work out it was a projector. Off-then-on costs a normal
   * student nothing, because the layout effect lands before their first paint
   * too.
   */
  const [showStart, setShowStart] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const plaqueRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef<HTMLButtonElement | null>(null);
  const askRef = useRef<HTMLDivElement | null>(null);
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
    setShowStart(true);
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
      // THE PLAQUE IS INSIDE THE MEASURED REGION AND HAS TO COME OFF THE TOP.
      // Spending all of the stage's height on the board put the last round back
      // below the fold on a 1366x768 Chromebook - the exact failure this sizing
      // code was written to fix, reintroduced the moment the headline moved
      // from the page header into the stage.
      // The gap under the plaque SCALES, so reading the constant under-counted
      // it by up to 23px on a projector and put the board back below the fold
      // on the one surface nobody can scroll. Read what is actually applied.
      const pEl = plaqueRef.current;
      const plaque = pEl
        ? pEl.offsetHeight + (parseFloat(window.getComputedStyle(pEl).marginBottom) || PLAQUE_GAP)
        : 0;
      const h = Math.max(300, window.innerHeight - rect.top - 28 - plaque);
      // A 1px wobble must not restart this: the plaque's own type scales with
      // the cell size, so an exact-equality test can chase its own tail.
      if (w > 0) setBox((b) => (b.w === w && Math.abs(b.h - h) <= 3 ? b : { w, h }));
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
    // On a SLOT step the spot to tap is what has to stay on screen. On an
    // OPERATION step there is no spot, so this used to do nothing at all -
    // while the four buttons sit in the right-hand rail, which a tall board can
    // have pushed off the top. The room got a scroll on one step and none on
    // the next, which mid-lesson is a fumble.
    const el = targetRef.current ?? askRef.current;
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [step]);

  if (!trace) return <p style={{ padding: 24, fontWeight: 700 }}>That problem cannot be drawn in the house.</p>;

  const prompt: HousePrompt | undefined = trace.prompts[step];
  const done = step >= trace.prompts.length;
  const filledSet = new Set(filled);
  /**
   * EVERY connector drawn so far, oldest first - not just this round's.
   *
   * This inverts what the board used to do. One `activeVisual` was found for
   * the current round and everything before it was thrown away, so a student
   * saw six separate moments and never the shape they add up to. Steele:
   * "each round should keep the arched arrow lines, but the new round should be
   * a different color. I want students to see the pathway the numbers take
   * every time." They also survive `done` now, because the completed pathway is
   * the thing worth looking at once the arithmetic is finished.
   */
  const liveRound = trace.prompts[Math.min(step, Math.max(0, trace.prompts.length - 1))]?.round ?? 0;
  const drawnPrompts = trace.prompts.slice(0, step).filter((p) => p.visual);

  const advance = (p: HousePrompt) => {
    setFilled((f) => [...f, ...p.fill]);
    setMissed(null);
    // Left set, the coral mark outlives the miss: `.dh-slot.wrong` comes after
    // `.filled` and `.target` at the same specificity, so a cell they once got
    // wrong renders coral instead of green when it is filled, and its shake
    // overrides the amber pulse when it later becomes the spot to tap.
    setWrongSlot(null);
    setCheer((c) => c + 1);
    if (p.visual) setVisualKey((v) => v + 1);
    // A right answer dismisses the opening card as surely as the button does -
    // otherwise it hangs over the board for the rest of the problem.
    setShowStart(false);
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
  /** The board's width in CELL units, with the gutter counted at half. */
  const widthUnits = houseWidthUnits(trace);
  const cellPx = (() => {
    if (!box.w) return CELL;
    const byWidth = box.w / widthUnits;
    const byHeight = (box.h / trace.rows) * (CELL / ROW);
    return Math.round(clamp(Math.min(byWidth, byHeight), CELL_MIN, CELL_MAX));
  })();
  const rowPx = Math.round(cellPx * (ROW / CELL));
  // Text on the rail rides the same scale, floored so it never gets smaller
  // than it already was and capped so it does not run away on a projector.
  const k = clamp(cellPx / CELL, 1, 1.7);

  // THE GRID IS NOT UNIFORM, and the arithmetic for that lives in the lib so a
  // contract can check it. Nothing in this file may compute an x from a column
  // by hand.
  const layout = houseLayout(trace, cellPx, rowPx);
  const { colW, colX, colMid, centre, boardW, boardH, gutterX, houseLeft, gridColumns } = layout;
  const gutterPx = colW(trace.divisorWidth);
  /** The cell the scroll keeper follows - the first spot the prompt names. */
  const firstTargetId = prompt?.kind === "slot" ? prompt.slots?.[0] : undefined;

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
      const left = Math.min(existing?.left ?? Infinity, ...cols.map((c) => colX(c) + 6));
      const right = Math.max(
        existing ? existing.left + existing.width : 0,
        ...cols.map((c) => colX(c) + colW(c) - 6),
      );
      acc[s.row] = { key: s.row, left, top: (s.rowIndex + 1) * rowPx - 5, width: right - left };
      return acc;
    }, {});
  const subtractionRuleList = Object.values(subtractionRules);
  const houseTop = rowPx; // the dividend row

  const done_ = done;

  /** Arrowhead size, scaled with the board but never a dot and never a wedge. */
  const headPx = clamp(cellPx * 0.115, 8, 26);
  /**
   * The sign's knockout disc is SIZED TO THE GUTTER, not to the font.
   *
   * Every ÷, x and = anchors in the gutter column, and the gutter is half a
   * cell now - a disc sized in rem spilled over the divisor on one side and the
   * first digit inside the house on the other, and it does that once per round
   * on a board that keeps every round.
   */
  const signPx = Math.max(26, Math.min(gutterPx * 1.15, cellPx * 0.62));
  /** The plaque's chrome rides the same scale as everything else on the board. */
  const plaqueGap = Math.round(PLAQUE_GAP * clamp(k, 1, 1.5));
  const arrowW = Math.max(3, Math.round(3 * k));
  const arrowHead = Math.max(9, Math.round(10 * k));

  /**
   * Every cell showing a digit right now - what an arc may not be drawn over.
   *
   * The arcs paint ABOVE the cells, so this is not a nicety: without it the
   * "the answer goes up here" arc is a solid line struck through the answers
   * already up there, which happens from round one on every problem in the
   * built-in set.
   */
  const shownDigits = trace.slots
    .filter((s) => s.given || filledSet.has(s.id))
    .map((s) => ({ x: colMid(s.col), y: (s.rowIndex + 0.5) * rowPx }));

  /**
   * What each cell of a merged number should CALL itself.
   *
   * The boxes merge so that "16" reads as one number rather than a 1 and a 6 -
   * and a screen reader was still hearing "1 at row 5 column 3" then "6 at row 5
   * column 4", which is the exact split the picture now fixes. Every cell of a
   * run answers with the whole number.
   */
  const runLabel = new Map<string, string>();
  {
    const rows = new Map<number, HouseSlot[]>();
    for (const s of trace.slots) {
      if (s.given || !filledSet.has(s.id)) continue;
      const list = rows.get(s.rowIndex);
      if (list) list.push(s);
      else rows.set(s.rowIndex, [s]);
    }
    rows.forEach((list) => {
      list.sort((x, y) => x.col - y.col);
      let run: HouseSlot[] = [];
      const flush = () => {
        if (run.length > 1) {
          const text = run.map((x) => x.text).join("");
          run.forEach((x) => runLabel.set(x.id, text));
        }
        run = [];
      };
      for (const s of list) {
        if (run.length && s.col !== run[run.length - 1].col + 1) flush();
        run.push(s);
      }
      flush();
    });
  }
  const arcBoard = { cellPx, rowPx, boardW, boardH, gutterX, houseLeft, digits: shownDigits };
  const arcs = drawnPrompts
    .map((p) => {
      const v = p.visual;
      const a = v ? centre(v.from) : null;
      const b = v ? centre(v.to) : null;
      if (!v || !a || !b) return null;
      return buildArc({ key: p.id, round: p.round, sign: v.sign, from: a, to: b }, arcBoard);
    })
    .filter((x): x is ArcGeometry => Boolean(x));
  const arcColor = (round: number) => ARC_COLORS[round % ARC_COLORS.length];
  const arcOpacity = (round: number) => (round < liveRound ? ARC_FADED : 1);
  const newestArc = arcs[arcs.length - 1];

  /**
   * The ring drawn round the spot to click. Steele: "Draw attention to this
   * number more by either make it flash more demonstrably or animate a circle
   * being drawn around it". The amber pulse stays underneath it - on a
   * projector at the back of the room the pulse alone was easy to miss.
   */
  const targetRing = (() => {
    if (!prompt || prompt.kind !== "slot") return null;
    const ss = (prompt.slots ?? [])
      .map((id) => trace.slots.find((s) => s.id === id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s));
    if (!ss.length) return null;
    const cols = ss.map((s) => s.col);
    const lo = Math.min(...cols);
    const hi = Math.max(...cols);
    const left = colX(lo);
    const right = colX(hi) + colW(hi);
    return {
      cx: (left + right) / 2,
      cy: (ss[0].rowIndex + 0.5) * rowPx,
      // Wider than the cells it circles, and a touch flatter, so it reads as a
      // ring round the NUMBER rather than a second border on the box.
      rx: (right - left) / 2 + Math.max(5, cellPx * 0.06),
      ry: rowPx / 2 - 3,
    };
  })();

  const houseMid = houseLeft + (boardW - houseLeft) / 2;
  const divisorMid = colX(0) + (colX(trace.divisorWidth) - colX(0)) / 2;
  /**
   * The card that opens a problem. The "closest to the door" wording only holds
   * when one digit is the answer - when the divisor does not fit the first
   * digit the nearest number is exactly the wrong click, so that case borrows
   * the prompt's own words instead.
   */
  const startCopy = (trace.prompts[0]?.slots?.length ?? 1) > 1
    ? trace.prompts[0].ask
    : "Select the number closest to the house door.";

  return (
    <div className="dh-root" style={{ ["--dh-k" as string]: k }}>
      <style>{`
        .dh-root { width:100%; display:grid; gap:18px; }
        .dh-top { display:flex; align-items:flex-end; justify-content:space-between; gap:14px; flex-wrap:wrap; }
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

        /* THE PROBLEM, NAMED, OVER THE HOUSE. Steele: it "should be centered
           over the top of the long division house in a box with an arrow
           identifying the 94 as the dividend (david in the house) and 4 as the
           divisor (da visitor outside the house)". The mnemonic is his and it
           is the point - the two words are near-identical on the page and a
           sixth grader mixes them up all year. */
        /* z-index 2 puts the plaque's overflowing arrow ABOVE the empty cells it
           descends through and BELOW the arcs and their signs.
           It was 6, and that was a bug of exactly the kind it was meant to fix:
           .dh-board sets no stacking context, so 6 sat above .dh-arcs at 3, and
           the dividend arrow descends the gutter - the one column every divide,
           multiply and equals sign anchors in. Measured, the teal line passed
           within 0-2px of the centre of the equals and multiply glyphs on every
           round of every problem, and crossed four to nine retained arcs. A
           cream halo cannot defend against something stacked on top of it. */
        .dh-plaque { position:relative; z-index:2; display:grid; gap:7px; }
        .dh-plaque-title { display:flex; justify-content:center; min-width:0; }
        .dh-plaque-eq { display:inline-block; padding:7px 20px; border-radius:14px;
          border:2px solid var(--bdb-line); background:var(--bdb-card);
          font-size:calc(1.85rem * var(--dh-k)); font-weight:900;
          font-variant-numeric:tabular-nums; line-height:1.15;
          /* A short house plus a two-digit divisor makes the box wider than the
             span it is centred over, and a flex item will not shrink below its
             own min-content without this. */
          max-width:100%; box-sizing:border-box; }
        .dh-plaque-tags { display:grid; align-items:start; }
        .dh-tag { display:grid; justify-items:center; gap:1px; text-align:center; padding:0 4px; }
        .dh-tag i { font-style:normal; font-size:calc(0.66rem * var(--dh-k)); font-weight:800;
          letter-spacing:0.13em; text-transform:uppercase; }
        .dh-tag b { font-size:calc(0.8rem * var(--dh-k)); font-weight:800; line-height:1.2; }
        .dh-tag.visitor { color:var(--bdb-brown); }
        .dh-tag.david { color:var(--bdb-teal-deep); }
        .dh-plaque-arrows { position:absolute; left:0; top:100%; pointer-events:none; overflow:visible; }
        .dh-plaque-arrow { fill:none; stroke-linecap:round; stroke-linejoin:round; }

        /* The card that opens each problem. */
        .dh-start { position:absolute; left:50%; top:44%; transform:translate(-50%,-50%); z-index:9;
          display:grid; gap:10px; justify-items:start; padding:18px 20px;
          border-radius:16px; border:2px solid var(--bdb-brown); background:var(--bdb-card);
          box-shadow:0 18px 40px rgba(32,30,26,0.18);
          animation:dh-start-in 260ms cubic-bezier(.2,1.4,.4,1); }
        @keyframes dh-start-in { from { opacity:0; transform:translate(-50%,-42%) scale(0.94); } }
        .dh-start-t { margin:0; font-size:calc(0.72rem * var(--dh-k)); font-weight:800;
          letter-spacing:0.14em; text-transform:uppercase; color:var(--bdb-brown); }
        .dh-start-b { margin:0; font-size:calc(1.1rem * var(--dh-k)); font-weight:800; line-height:1.32; }
        @media (prefers-reduced-motion: reduce) { .dh-start { animation:none; } }
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
        /* A NUMBER IS ONE BOX. Steele: "make these green boxes combine into 1
           box when they select the number" - two green rectangles side by side
           read as two numbers, which is the exact thing this tool spends the
           rest of its time teaching against. The cells are pulled together and
           their inner borders go transparent, so the green fill runs straight
           through the join. Transparent rather than zero-width on purpose: the
           background already paints under the border box, and removing 2px of
           border would shift the digit inside it. */
        .dh-slot.filled.mg-l { margin-left:0; border-left-color:transparent;
          border-top-left-radius:0; border-bottom-left-radius:0; }
        .dh-slot.filled.mg-r { margin-right:0; border-right-color:transparent;
          border-top-right-radius:0; border-bottom-right-radius:0; }

        /* the L: vertical down the dividend, bar across its top */
        .dh-l { position:absolute; border-left:5px solid var(--bdb-ink); border-top:5px solid var(--bdb-ink);
          border-top-left-radius:14px; pointer-events:none; z-index:0; }

        /* CONNECTORS ARE SOLID AND ARCHED, AND THEY DRAW.
           Steele, 2026-08-03: "make the connectors not dashed lines but a solid
           line", and "have them appear like starting at the back where it
           starts from and make it slowly appear moving toward the end of the
           arrow". pathLength:1 makes one dash cover a curve of any length, so
           the same rule animates a 40px drop and a 600px sweep at one speed. */
        /* STROKE WIDTHS RIDE THE BOARD'S SCALE. At a 168px cell the digits are
           54px tall, and a fixed 3.4px pathway - the thing Steele asked to be
           kept visible - was a hairline behind them on a 55-inch panel. */
        .dh-arcs { position:absolute; left:0; top:0; z-index:3; pointer-events:none; overflow:visible; }
        .dh-arc { fill:none; stroke-width:calc(3.4px * var(--dh-k)); stroke-linecap:round;
          stroke-dasharray:1; stroke-dashoffset:1; animation:dh-arc-draw 520ms ease-out forwards; }
        @keyframes dh-arc-draw { to { stroke-dashoffset:0; } }
        /* The head waits for the line to reach it. As an SVG marker it appeared
           at the destination before the line had left, which reads backwards. */
        .dh-arrowhead { animation:dh-head-in 220ms ease-out 430ms both; }
        @keyframes dh-head-in { from { opacity:0; } to { opacity:1; } }

        /* ONLY THE LIVE MOVE KEEPS ITS GLYPH, and it is SVG text with a cream
           halo rather than an HTML disc.
           Steele asked for the LINES to persist - "each round should keep the
           arched arrow lines" - and keeping the signs too was the builder's
           addition, not his. It did not survive contact with the geometry: four
           signs a round all anchor in the gutter, the gutter is half a cell, and
           an opaque disc big enough to read is bigger than the gap between two
           of them. Measured on 96/4, the FIRST problem in the built-in set: 13
           overlapping pairs, the worst 13px apart under 51px discs, each one
           erasing the one before it. The halo knocks the line out of the glyph's
           own outline instead of out of a circle, so it cannot bite the bracket
           or a neighbouring digit either. */
        .dh-sign { paint-order:stroke fill; stroke:var(--bdb-ground); stroke-linejoin:round;
          text-anchor:middle; dominant-baseline:central; font-weight:900;
          animation:dh-settle 700ms ease-out; }
        @keyframes dh-settle { 0%,45% { opacity:0; } 100% { opacity:1; } }
        /* Only the NEWEST sign bursts. On a board that now keeps every earlier
           move, the pop is what says which one just happened. */
        .dh-pop { position:absolute; z-index:5; pointer-events:none; transform:translate(-50%,-50%);
          font-size:calc(3.6rem * var(--dh-k)); font-weight:900;
          animation:dh-burst 780ms cubic-bezier(.2,1.5,.4,1) forwards; }
        @keyframes dh-burst {
          0% { transform:translate(-50%,-50%) scale(0.25) rotate(-22deg); opacity:0; }
          30% { transform:translate(-50%,-50%) scale(1.25) rotate(5deg); opacity:1; }
          55% { transform:translate(-50%,-50%) scale(1.05) rotate(0); opacity:0.9; }
          100% { transform:translate(-50%,-50%) scale(1.5) rotate(0); opacity:0; }
        }
        /* The rule under the number being subtracted; the difference goes below it. */
        .dh-subrule { position:absolute; z-index:2; height:calc(4px * var(--dh-k)); border-radius:2px;
          background:var(--bdb-ink); animation:dh-rule 300ms ease-out; transform-origin:left center; }
        @keyframes dh-rule { from { transform:scaleX(0); } to { transform:scaleX(1); } }

        /* A ring drawn round the spot to tap, and drawn again every couple of
           seconds. Steele: "animate a circle being drawn around it" - the amber
           pulse alone was easy to miss from the back of the room, so the ring
           sits on top of the pulse rather than replacing it. */
        .dh-ring { fill:none; stroke:${RING_COLOR}; stroke-width:calc(4px * var(--dh-k)); stroke-linecap:round;
          stroke-dasharray:1; stroke-dashoffset:1; animation:dh-ring 2.4s ease-out infinite; }
        @keyframes dh-ring {
          0% { stroke-dashoffset:1; opacity:1; }
          30% { stroke-dashoffset:0; opacity:1; }
          82% { stroke-dashoffset:0; opacity:1; }
          100% { stroke-dashoffset:0; opacity:0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .dh-pop { display:none; }
          .dh-sign, .dh-arrowhead { animation:none; }
          .dh-arc { animation:none; stroke-dashoffset:0; }
          .dh-ring { animation:none; stroke-dashoffset:0; }
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
        {/* The headline moved onto the plaque over the house, where it can name
            which number is which. This keeps the count and the controls. */}
        <p className="dh-count">Problem {Math.min(idx, problems.length - 1) + 1} of {problems.length}</p>
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          <button className="dh-btn" onClick={reset} type="button">Start over</button>
          {problems.length > 1 && <button className="dh-btn" onClick={nextProblem} type="button">Next problem</button>}
        </div>
      </div>

      <div className="dh-grid">
        <div className="dh-stage" ref={stageRef}>
          {/* Centred over the HOUSE, not over the whole board - the divisor is
              outside it, which is the whole joke the mnemonic runs on. */}
          <div className="dh-plaque" ref={plaqueRef} style={{ width: boardW, marginBottom: plaqueGap }}>
            <div className="dh-plaque-title" style={{ marginLeft: houseLeft }}>
              <span className="dh-plaque-eq">
                {trace.headline}
                {done_ ? ` = ${trace.quotient}${trace.remainder ? ` r${trace.remainder}` : ""}` : ""}
              </span>
            </div>
            <div className="dh-plaque-tags" style={{ gridTemplateColumns: `${houseLeft}px 1fr` }}>
              <span className="dh-tag visitor"><i>divisor</i><b>da visitor, outside</b></span>
              <span className="dh-tag david"><i>dividend</i><b>David, in the house</b></span>
            </div>
            {/* BOTH ARROWS REACH THEIR ACTUAL TARGET, and the dividend's goes
                in through the door.

                Stopping them above the board was the first attempt and it was
                wrong: the board's first row is the QUOTIENT, so a teal arrow
                labelled "dividend / David, in the house" pointing down at the
                column was pointing at the answer the moment the first quotient
                digit landed. On a plaque whose whole job is to stop those two
                words being confused, that taught a third confusion.

                Carrying it straight down would cross the quotient row for the
                same reason. So it swings left into the GUTTER - the one column
                with no cell in any row - drops down it, and turns right through
                the bracket into the dividend. Which is also, usefully, exactly
                what "the door" means in the card that opens each problem. */}
            <svg
              className="dh-plaque-arrows"
              width={boardW}
              height={plaqueGap + rowPx * 1.62}
              aria-hidden="true"
            >
              <path
                className="dh-plaque-arrow"
                strokeWidth={arrowW}
                stroke="var(--bdb-brown)"
                d={`M ${houseLeft / 2} 2 Q ${houseLeft / 2} ${plaqueGap * 0.6} ${divisorMid} ${plaqueGap + rowPx * 0.98}`}
              />
              {/* Reaches INTO the divisor's own row, the way the teal one
                  reaches into the dividend's. Stopping in the empty quotient
                  row above it read as pointing at nothing. */}
              <path
                fill="var(--bdb-brown)"
                d={`M ${divisorMid} ${plaqueGap + rowPx * 1.18} l ${-arrowHead / 2} ${-arrowHead} l ${arrowHead} 0 z`}
              />
              <path
                className="dh-plaque-arrow"
                strokeWidth={arrowW}
                stroke="var(--bdb-teal-deep)"
                d={`M ${houseMid} 2`
                  + ` Q ${houseMid} ${plaqueGap * 0.42} ${(houseMid + gutterX) / 2} ${plaqueGap * 0.55}`
                  + ` Q ${gutterX} ${plaqueGap * 0.74} ${gutterX} ${plaqueGap + rowPx * 0.7}`
                  + ` Q ${gutterX} ${plaqueGap + rowPx * 1.5} ${houseLeft - arrowHead - 3} ${plaqueGap + rowPx * 1.5}`}
              />
              <path
                fill="var(--bdb-teal-deep)"
                d={`M ${houseLeft - 2} ${plaqueGap + rowPx * 1.5} l ${-arrowHead} ${-arrowHead / 2} l 0 ${arrowHead} z`}
              />
            </svg>
          </div>

          <div className="dh-board" style={{ width: boardW, height: boardH }}>
            <div
              className="dh-l"
              style={{ left: houseLeft, top: houseTop, width: boardW - houseLeft, height: boardH - houseTop }}
            />
            <div
              className="dh-cells"
              style={{
                gridTemplateColumns: gridColumns,
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
                // A filled cell whose neighbour in the same row is also filled
                // is half of ONE number - "16" is not a 1 and a 6 - so the two
                // boxes are joined into one.
                const boxed = Boolean(slot && !slot.given && filledSet.has(slot.id));
                const neighbourBoxed = (c: number) => trace.slots.some(
                  (o) => o.rowIndex === row && o.col === c && !o.given && filledSet.has(o.id),
                );
                const mergeCls = boxed
                  ? `${neighbourBoxed(col - 1) ? "mg-l" : ""} ${neighbourBoxed(col + 1) ? "mg-r" : ""}`
                  : "";
                const place = `row ${row + 1}, column ${col + 1}`;
                return (
                  <button
                    key={i}
                    ref={slot && slot.id === firstTargetId ? targetRef : undefined}
                    className={`dh-slot ${slot?.given ? "given" : ""} ${shown && !slot?.given ? "filled land" : ""} ${mergeCls} ${isTarget ? "target" : ""} ${wrongCls}`.replace(/\s+/g, " ").trim()}
                    style={{ gridColumn: col + 1, gridRow: row + 1 }}
                    onClick={() => clickSlot(id)}
                    disabled={done_}
                    // Up to sixty buttons used to share "empty spot", which told
                    // a screen reader nothing about where any of them were.
                    aria-label={shown ? `${runLabel.get(slot!.id) ?? slot!.text} at ${place}` : `empty spot at ${place}`}
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

            {/* THE PATHWAY, and the ring round the next spot. One SVG for both:
                they share the board's coordinate space, and the ring has to
                paint over the cells the same way the arcs do. */}
            {(arcs.length > 0 || targetRing) && (
              <svg className="dh-arcs" width={boardW} height={boardH} aria-hidden="true">
                {arcs.map((arc) => (
                  <g key={arc.key} opacity={arcOpacity(arc.round)}>
                    <path className="dh-arc" d={arc.d} pathLength={1} stroke={arcColor(arc.round)} />
                    <path
                      className="dh-arrowhead"
                      fill={arcColor(arc.round)}
                      d={`M 0 0 L ${-headPx} ${-headPx * 0.52} L ${-headPx} ${headPx * 0.52} Z`}
                      transform={`translate(${arc.head.x} ${arc.head.y}) rotate(${arc.head.angle})`}
                    />
                  </g>
                ))}
                {/* The glyph for the move that just happened, and only that
                    one. It rides inside the SVG so its halo can knock the arc
                    out of its own outline. */}
                {newestArc?.sign ? (
                  <text
                    key={`sign-${newestArc.key}`}
                    className="dh-sign"
                    x={newestArc.signAt.x}
                    y={newestArc.signAt.y}
                    fill={arcColor(newestArc.round)}
                    fontSize={Math.round(signPx * 0.92)}
                    strokeWidth={Math.max(5, Math.round(signPx * 0.24))}
                  >
                    {newestArc.sign}
                  </text>
                ) : null}
                {targetRing && (
                  <ellipse
                    className="dh-ring"
                    pathLength={1}
                    cx={targetRing.cx}
                    cy={targetRing.cy}
                    rx={targetRing.rx}
                    ry={targetRing.ry}
                  />
                )}
              </svg>
            )}

            {newestArc?.sign ? (
              <span
                key={`pop-${visualKey}`}
                className="dh-pop"
                style={{ left: newestArc.signAt.x, top: newestArc.signAt.y, color: arcColor(newestArc.round) }}
              >
                {newestArc.sign}
              </span>
            ) : null}

            {/* Steele: "This should be a pop out to get started." One per
                problem - it clears on the first right click or on the button,
                and never comes back mid-problem. */}
            {showStart && !presentation && !done_ && step === 0 && (
              <div className="dh-start" role="note" style={{ width: `min(${Math.round(430 * k)}px, 90%)` }}>
                <p className="dh-start-t">Get started</p>
                <p className="dh-start-b">{startCopy}</p>
                <button className="dh-btn go" onClick={() => setShowStart(false)} type="button">Got it</button>
              </div>
            )}
          </div>
        </div>

        {/* The question and the two feedback lines announce themselves. The
            whole column would announce the step strip and the trail with them,
            which is a paragraph of speech on every tap. */}
        <div className="dh-ask" ref={askRef}>
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
              {/* The confirmation stays up THROUGH a miss. Hiding it while the
                  nudge showed took "13 is the number under the bracket now" off
                  the screen at the moment the student needed it - and the trail
                  below deliberately excludes it, so it was in neither place. */}
              {step > 0 && <p className="dh-say" aria-live="polite">{trace.prompts[step - 1].say}</p>}
              {missed && <p className="dh-hint" role="alert">{missed}</p>}
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
