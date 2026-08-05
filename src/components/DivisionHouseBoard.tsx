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
  houseRailState,
  parseHouseSet,
  serializeHouseSet,
  type HouseOp,
  type HousePrompt,
  type HouseSlot,
} from "@/lib/divisionHouse";
import { houseLayout, houseWidthUnits } from "@/lib/divisionHouseArcs";
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
 * One colour per round, cycling. "the new round should be a different color."
 *
 * The colour survives the cut to one arc at a time and still earns its place:
 * the line changing colour is what says a NEW round has started, on a board
 * where every round otherwise draws the same six shapes in the same six places.
 */
const ARC_COLORS = [
  "var(--bdb-coral-deep)",
  "var(--bdb-teal-deep)",
  "var(--bdb-brown)",
  // Ink-soft reads as pencil, is clearly none of the other three, and clears AA
  // on cream at 5.6:1.
  "var(--bdb-ink-soft)",
];
/** The five letters, in cycle order, and what each one is filled with. */
const CYCLE_COLORS: Record<string, string> = {
  divide: "var(--bdb-teal)",
  multiply: "var(--bdb-amber)",
  subtract: "var(--bdb-coral)",
  bringdown: "var(--bdb-brown)",
  repeat: "var(--bdb-green)",
};
/**
 * How long a number takes to travel to its spot. Steele asked for it SLOWLY -
 * "they click the spot and it slowly moves to it" - and slow is the point: it
 * is the one moment in this tool where a student watches a number take up its
 * role instead of being asked something.
 */
const FLY_MS = 850;
/**
 * Pointer travel under which a press counts as a TAP, not a drag.
 *
 * A tap PICKS THE NUMBER UP and leaves it held, so the next tap on a zone
 * places it. Fraction Bars learned this the hard way: a drop handler that reads
 * zones first swallows every tap on touch, which is exactly the hardware this
 * runs on.
 */
const TAP_SLOP = 12;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** The two numbers the student puts on the board before the drill starts. */
type SetupPart = "dividend" | "divisor";

/** Which drop zone is under a point, whatever is capturing the pointer. */
const zoneUnder = (x: number, y: number): string | null => {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  return el?.closest<HTMLElement>("[data-drop]")?.dataset.drop ?? null;
};


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
  const [wrapped, setWrapped] = useState(false);
  /**
   * THE SET-UP ACT, which is how every problem now opens.
   *
   * Steele: "have students drag the divisor to the outside and dividend inside.
   * then say yes! make this an animation showing the divisor and dividend moving
   * down to their places. following the arrows, then the arrows can disappear."
   *
   * It replaces the "Get started" pop-out, which said "select the number closest
   * to the house door" - a sentence the first prompt already says, and which two
   * of the same batch of comments asked to be carried by words rather than by a
   * mark on the board. So the opening is now a thing the student DOES.
   *
   * The board starts blank: neither the dividend nor the divisor is printed
   * until it has been put there.
   *
   * READ IT THROUGH `setupPhase`, NEVER DIRECTLY. The projector has to skip this
   * act - nobody ever touches that copy, so a phase waiting to be dragged
   * through would leave the wall showing an empty house with two hovering
   * numbers for the whole state, the same trap the opening card fell into. That
   * skip cannot live in `reset`: the layout effect that discovers `?embed=1`
   * lands AFTER the first render's `reset` has already run, so a reset that
   * consulted `presentation` would read false and put the projector right back
   * into setup. A derived gate has no such ordering to get wrong.
   */
  const [phase, setPhase] = useState<"setup" | "solve">("setup");
  const [placed, setPlaced] = useState<Record<SetupPart, "out" | "flying" | "in">>(
    { dividend: "out", divisor: "out" },
  );
  /** Picked up by a tap, waiting for a zone to be tapped. */
  const [held, setHeld] = useState<SetupPart | null>(null);
  const [drag, setDrag] = useState<SetupPart | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [setupMiss, setSetupMiss] = useState<string | null>(null);
  const [wrongZone, setWrongZone] = useState<{ zone: string; n: number } | null>(null);
  /**
   * The number in transit, in viewport pixels: where it started and how far it
   * has to go. Steele: "they click the spot and it slowly moves to it".
   *
   * A straight travel between two measured points, not a curve traced along
   * something - the arrows it used to follow are gone ("no arrows or lines"),
   * and a slow line from the equation to the box is the whole of what he asked
   * for. `go` is flipped a frame later so the transition has a start state to
   * move away from.
   */
  const [fly, setFly] = useState<{ part: SetupPart; x: number; y: number; dx: number; dy: number } | null>(null);
  const [flyGo, setFlyGo] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const flyTimers = useRef<number[]>([]);
  const tryPlaceRef = useRef<(part: SetupPart, zone: string) => void>(() => {});
  const stageRef = useRef<HTMLDivElement | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
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
    flyTimers.current.forEach((t) => window.clearTimeout(t));
    flyTimers.current = [];
    setPlaced({ dividend: "out", divisor: "out" });
    setHeld(null);
    setDrag(null);
    setDragPos(null);
    setDragOver(null);
    setSetupMiss(null);
    setWrongZone(null);
    setFly(null);
    setFlyGo(false);
    setPhase("setup");
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

  /** Both numbers home: say yes, then hand over to the drill. */
  useEffect(() => {
    if (phase !== "setup" || presentation) return;
    if (placed.dividend !== "in" || placed.divisor !== "in") return;
    setCheer((c) => c + 1);
    const b = window.setTimeout(() => setPhase("solve"), 700);
    return () => window.clearTimeout(b);
  }, [phase, presentation, placed]);

  /**
   * THE SET-UP DRAG, ON POINTER CAPTURE.
   *
   * Fraction Bars does this with window listeners attached from an effect keyed
   * on the drag state, and that works - do not go "fix" it on the strength of
   * this comment. Capture is used here because it needs nothing to be attached
   * in time: the pointerdown that starts the gesture also claims every later
   * move and the release for that one button, so there is no window between the
   * press and React's re-render for a fast flick to fall into, and no window
   * listener to leak if the component goes away mid-gesture.
   *
   * `touch-action:none` on the chip is the other half - without it the browser
   * claims the gesture as a scroll before we see a single move.
   *
   * The one rule it keeps from Fraction Bars: TEST THE TAP BEFORE THE ZONE. A
   * tap and a missed drop are identical from the pointer's side, so resolving
   * the zone first swallows every tap on touch.
   */
  const onChipMove = (e: React.PointerEvent) => {
    if (!drag) return;
    setDragPos({ x: e.clientX, y: e.clientY });
    setDragOver(zoneUnder(e.clientX, e.clientY));
  };
  const onChipUp = (e: React.PointerEvent) => {
    if (!drag) return;
    const start = dragStartRef.current;
    const moved = start ? Math.hypot(e.clientX - start.x, e.clientY - start.y) > TAP_SLOP : false;
    const zone = zoneUnder(e.clientX, e.clientY);
    setDrag(null);
    setDragPos(null);
    setDragOver(null);
    // A tap leaves the number HELD, so the next tap on a zone places it.
    if (!moved) return;
    if (zone) tryPlaceRef.current(drag, zone);
    else setHeld(null);
  };


  useEffect(() => () => flyTimers.current.forEach((t) => window.clearTimeout(t)), []);

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
  /** The set-up act, with the projector held out of it. */
  const setupPhase = phase === "setup" && !presentation;
  /**
   * THE CURRENT MOVE, SHOWN BY LIGHTING THE TWO NUMBERS IN IT. NO LINE.
   *
   * Steele, 2026-08-04, in three steps and they all point the same way: "maybe
   * no arrows. Just use the higlighting pulse to show what is happening", then
   * "no arrows or lines", then "the animation is clunky".
   *
   * What went is the whole connector system - the arched line that drew itself
   * over 520ms, the arrowhead that faded in behind it, and the sign glyph that
   * burst in at 1.5x and rotated. On a board where four of every six moves
   * anchor on the same half-cell gutter, that was a lot of motion saying
   * something the two lit cells say at a glance.
   *
   * The move itself is unchanged: the engine still traces the same six per
   * round, and `visual.from` / `visual.to` are still exactly the two numbers
   * being operated on. They are now READ as a highlight rather than drawn as a
   * curve, and the arithmetic is spelled out in numbers in the rail beside it.
   *
   * The geometry that used to draw them is still in `divisionHouseArcs.ts` and
   * still under contract - this decision has flipped twice in two days, and the
   * routing in there took a review cycle to get right.
   */
  const liveVisual = trace.prompts.slice(0, step).filter((p) => p.visual).slice(-1)[0];
  const actSlots = new Set(liveVisual?.visual ? [liveVisual.visual.from, liveVisual.visual.to] : []);
  const actColor = ARC_COLORS[(liveVisual?.round ?? 0) % ARC_COLORS.length];

  const advance = (p: HousePrompt) => {
    setFilled((f) => [...f, ...p.fill]);
    setMissed(null);
    // Left set, the coral mark outlives the miss: `.dh-slot.wrong` comes after
    // `.filled` and `.target` at the same specificity, so a cell they once got
    // wrong renders coral instead of green when it is filled, and its shake
    // overrides the amber pulse when it later becomes the spot to tap.
    setWrongSlot(null);
    setCheer((c) => c + 1);
    setStep((s) => s + 1);
  };

  const startDrag = (part: SetupPart, e: React.PointerEvent) => {
    if (!setupPhase || placed[part] !== "out") return;
    // Without this the browser starts its own text/image drag and the pointer
    // stream stops arriving halfway through the gesture.
    e.preventDefault();
    // Everything from here to the release comes to this button, so nothing
    // depends on a listener being attached in time.
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* older engines */ }
    setDrag(part);
    setHeld(part);
    setDragPos({ x: e.clientX, y: e.clientY });
    dragStartRef.current = { x: e.clientX, y: e.clientY };
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
  const { colW, colX, boardW, boardH, houseLeft, gridColumns } = layout;
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

  /** The plaque's chrome rides the same scale as everything else on the board. */
  const plaqueGap = Math.round(PLAQUE_GAP * clamp(k, 1, 1.5));

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
  /**
   * NOTHING MARKS THE SPOT UNTIL THEY HAVE MISSED IT.
   *
   * Steele, having watched a ring draw itself round the answer: "get rid of the
   * circle. have it say to select the number closest to the door inside the
   * house and if they get it wrong then have it pulse." So the words carry the
   * instruction, and the amber pulse becomes what a miss buys you rather than
   * what the question opens with. `missed` already holds exactly that state -
   * set on a wrong tap, cleared by `advance`.
   */
  const revealTarget = Boolean(missed);

  /**
   * WHERE EACH NUMBER IS GOING, in the board's own coordinates.
   *
   * The divisor lands on the middle of its own columns; the dividend lands on
   * the middle of the house, because it is one number spread across every
   * column in there. Both sit in the dividend ROW, which is row 1 - the
   * quotient row is above it and stays empty until the drill starts.
   */
  const partTarget: Record<SetupPart, { x: number; y: number }> = {
    divisor: { x: colX(0) + (colX(trace.divisorWidth) - colX(0)) / 2, y: rowPx * 1.5 },
    dividend: { x: houseLeft + (boardW - houseLeft) / 2, y: rowPx * 1.5 },
  };
  const partValue: Record<SetupPart, number> = { divisor: trace.divisor, dividend: trace.dividend };
  /** A given digit is on the board only once its number has been put there. */
  const givenShown = (s: HouseSlot) =>
    !setupPhase || placed[s.row === "divisor" ? "divisor" : "dividend"] === "in";

  /**
   * Put a number where the student dropped it, or say why it does not go there.
   *
   * The nudge names what the SPOT is for, never which number belongs in it -
   * deciding that 96 is the one being divided up is the whole content of this
   * act, and a hint that hands it over turns the drag into a formality.
   */
  const tryPlace = (part: SetupPart, zone: string) => {
    if (zone !== "divisor" && zone !== "dividend") return;
    if (zone !== part) {
      setSetupMiss(zone === "divisor"
        ? "That spot outside is for da visitor - the number we are dividing BY."
        : "The house is David's - the number being divided up lives in there.");
      setWrongZone((w) => ({ zone, n: (w?.n ?? 0) + 1 }));
      return;
    }
    setSetupMiss(null);
    setWrongZone(null);
    setHeld(null);
    setPlaced((p) => (p[part] === "out" ? { ...p, [part]: "flying" } : p));
    // Measure both ends NOW, while the chip is still on screen, and travel
    // between them. Read off the live DOM rather than computed from the layout:
    // the chip sits inside a plaque whose type scales with the board, so where
    // it actually is depends on wrapping this file does not model.
    const chip = document.querySelector<HTMLElement>(`.dh-chip[data-part="${part}"]`);
    const board = boardRef.current;
    if (chip && board) {
      const c = chip.getBoundingClientRect();
      const b = board.getBoundingClientRect();
      const from = { x: c.x + c.width / 2, y: c.y + c.height / 2 };
      const to = { x: b.x + partTarget[part].x, y: b.y + partTarget[part].y };
      setFly({ part, x: from.x, y: from.y, dx: to.x - from.x, dy: to.y - from.y });
      setFlyGo(false);
      // Two frames: one to paint it at the start, one to move it. A single rAF
      // can be coalesced into the same paint and the travel never happens.
      requestAnimationFrame(() => requestAnimationFrame(() => setFlyGo(true)));
    }
    flyTimers.current.push(window.setTimeout(() => {
      setPlaced((p) => (p[part] === "flying" ? { ...p, [part]: "in" } : p));
      setFly((f) => (f?.part === part ? null : f));
    }, FLY_MS));
  };
  tryPlaceRef.current = tryPlace;

  /**
   * THE ARITHMETIC, IN NUMBERS, BESIDE THE WORDS. Steele: "show the math
   * happening in numbers next to the step so show the 9 divide sign 4 between
   * the blocks and the words on the right."
   *
   * One line per fact of the round the student is in, each showing exactly what
   * has been earned - the engine grows them a piece at a time, so the panel can
   * simply print the latest state of each and never leak an answer.
   */
  const workLines = (() => {
    if (setupPhase || done || !prompt) return [];
    const byKey = new Map<string, string>();
    const order: string[] = [];
    for (const p of trace.prompts.slice(0, step)) {
      if (!p.work || p.round !== prompt.round) continue;
      if (!byKey.has(p.work.key)) order.push(p.work.key);
      byKey.set(p.work.key, p.work.text);
    }
    return order.map((key, i) => ({ key, text: byKey.get(key)!, live: i === order.length - 1 }));
  })();

  /**
   * THE D-M-S-B-R RAIL. Steele: "make the mnemonic device rail on the left side.
   * A Big D, M, S, B, R just like we did on the other tools like gems."
   *
   * The state machine lives in the lib, under contract - it was inlined here and
   * it was wrong in two ways nothing could see. See `houseRailState`.
   */
  const railTiles = houseRailState(trace, step);

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

        /* THREE COLUMNS NOW: the mnemonic rail, the house, the words. Steele
           asked for the rail "on the left side ... just like we did on the other
           tools like gems", which is also the manipulative convention in this
           repo - reference in a large left rail, the thing being acted on in the
           middle, what the student is building on the right. */
        .dh-grid { display:grid; grid-template-columns:auto minmax(280px,1.5fr) minmax(260px,1fr);
          gap:22px; align-items:start; }
        /* The words drop under the board before the rail does: the rail is the
           reference you glance at, and it is worth far less once it is below a
           board taller than the screen. */
        @media (max-width:1180px) {
          .dh-grid { grid-template-columns:auto minmax(0,1fr); }
          .dh-ask { grid-column:1 / -1; }
        }
        @media (max-width:760px) { .dh-grid { grid-template-columns:1fr; } }

        .dh-stage { display:grid; justify-items:center; padding:10px 0 20px; min-width:0; }
        .dh-board { position:relative; }

        /* THE PROBLEM, NAMED, OVER THE HOUSE. Steele: it "should be centered
           over the top of the long division house in a box with an arrow
           identifying the 94 as the dividend (david in the house) and 4 as the
           divisor (da visitor outside the house)". The mnemonic is his and it
           is the point - the two words are near-identical on the page and a
           sixth grader mixes them up all year. */
        .dh-plaque { position:relative; z-index:2; display:grid; gap:7px; }
        .dh-plaque-title { display:flex; justify-content:center; min-width:0; }
        .dh-plaque-eq { display:inline-block; padding:7px 20px; border-radius:14px;
          border:2px solid var(--bdb-line); background:var(--bdb-card);
          font-size:calc(1.85rem * var(--dh-k)); font-weight:900;
          font-variant-numeric:tabular-nums; line-height:1.15;
          /* A short house plus a two-digit divisor makes the box wider than the
             span it is centred over, and a flex item will not shrink below its
             own min-content without this. */
          max-width:100%; box-sizing:border-box;
          /* NEVER BREAK THE EQUATION ACROSS TWO LINES. In set-up the two numbers
             are chips with their own padding and borders, which pushed "96 ÷ 4"
             just past the width of a two-column house and wrapped the divisor
             onto its own row - the one arrangement that makes a division problem
             unreadable. Overflowing the span it is centred over is the lesser
             evil, and only happens on the narrowest houses. */
          white-space:nowrap; }
        .dh-plaque-tags { display:grid; align-items:start; }
        .dh-tag { display:grid; justify-items:center; gap:1px; text-align:center; padding:0 4px; }
        .dh-tag i { font-style:normal; font-size:calc(0.66rem * var(--dh-k)); font-weight:800;
          letter-spacing:0.13em; text-transform:uppercase; }
        .dh-tag b { font-size:calc(0.8rem * var(--dh-k)); font-weight:800; line-height:1.2; }
        .dh-tag.visitor { color:var(--bdb-brown); }
        .dh-tag.david { color:var(--bdb-teal-deep); }
        /* THE SET-UP ACT: the two numbers start in the equation and get dragged
           to their places. A chip is a real button so a keyboard or a switch can
           pick it up, and touch-action:none is what stops a Chromebook or an
           iPad scrolling the page instead of dragging the number. */
        /* A ONE-DIGIT DIVISOR IS THE SMALLEST DRAG HANDLE ON THE TOOL, and it is
           the first thing a finger touches. At 1px/7px padding the "4" of 96/4
           measured 37x40 - under the 44px floor every other target on this board
           clears. min-width does the work, so a four-digit dividend is unchanged. */
        .dh-chip { font:inherit; font-size:inherit; font-weight:inherit; color:inherit;
          font-variant-numeric:tabular-nums; padding:3px 10px; margin:0 2px; border-radius:10px;
          min-width:44px; min-height:44px; box-sizing:border-box;
          border:2px dashed var(--bdb-brown); background:color-mix(in srgb, var(--bdb-amber) 20%, transparent);
          cursor:grab; touch-action:none; transition:transform 120ms ease, opacity 200ms ease; }
        .dh-chip:hover { transform:translateY(-2px); }
        .dh-chip.held { border-style:solid; background:color-mix(in srgb, var(--bdb-amber) 46%, transparent);
          transform:translateY(-3px) scale(1.04); }
        .dh-chip.gone { opacity:0.2; border-color:transparent; background:transparent; cursor:default; }
        .dh-chip:disabled { cursor:default; }

        /* Where the two numbers land. Big targets on purpose - these are the
           first thing a finger touches on this tool. */
        .dh-zone { position:absolute; z-index:4; font:inherit; border-radius:12px; cursor:pointer;
          border:2px dashed var(--bdb-brown); background:color-mix(in srgb, var(--bdb-brown) 7%, transparent);
          display:grid; place-items:end center; padding-bottom:3px;
          font-size:calc(0.62rem * var(--dh-k)); font-weight:800; letter-spacing:0.1em;
          text-transform:uppercase; color:var(--bdb-brown);
          transition:background 140ms ease, border-color 140ms ease, transform 140ms ease; }
        .dh-zone.over { border-style:solid; background:color-mix(in srgb, var(--bdb-teal) 22%, transparent);
          border-color:var(--bdb-teal-deep); color:var(--bdb-teal-deep); transform:scale(1.02); }
        .dh-zone.set { opacity:0; pointer-events:none; }
        .dh-zone.bad-a { animation:dh-shake 320ms ease; border-color:var(--bdb-coral-deep);
          background:color-mix(in srgb, var(--bdb-coral) 16%, transparent); }
        .dh-zone.bad-b { animation:dh-shake-b 320ms ease; border-color:var(--bdb-coral-deep);
          background:color-mix(in srgb, var(--bdb-coral) 16%, transparent); }

        /* THE NUMBER MOVING TO ITS SPOT. Steele: "just have the divisor and
           dividend BOTH slowly fade into their spots ... they click the spot and
           it slowly moves to it."
           A plain transform transition between two measured points - one
           straight line, no path to trace, nothing drawn behind it. It is
           position:fixed so it can cross out of the plaque and into the board
           without either one clipping it. */
        .dh-fly { position:fixed; z-index:80; pointer-events:none;
          font-size:calc(1.9rem * var(--dh-k)); font-weight:800; font-variant-numeric:tabular-nums;
          color:var(--bdb-ink); transform:translate(-50%,-50%);
          transition:transform ${FLY_MS}ms cubic-bezier(.32,0,.24,1); }
        .dh-fly.go { transform:translate(-50%,-50%) translate(var(--dx), var(--dy)); }
        /* Under reduce it simply appears where it was going. */
        @media (prefers-reduced-motion: reduce) {
          .dh-fly { transition:none; transform:translate(-50%,-50%) translate(var(--dx), var(--dy)); }
        }

        /* The number under the pointer while it is being dragged. */
        .dh-ghost { position:fixed; z-index:80; pointer-events:none; transform:translate(-50%,-52%);
          font-size:calc(1.8rem * var(--dh-k)); font-weight:900; font-variant-numeric:tabular-nums;
          color:var(--bdb-ink); padding:4px 12px; border-radius:12px;
          border:2px solid var(--bdb-brown); background:var(--bdb-card);
          box-shadow:0 12px 26px rgba(32,30,26,0.22); }
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
        /* A DIGIT ARRIVING SETTLES, IT DOES NOT BOUNCE. This was 420ms of
           scale 0.4 -> 1.15 -> 1, and a springy overshoot on every one of the
           twenty-odd placements in a problem is a good part of what "the
           animation is clunky" was about. */
        .dh-slot.land { animation:dh-land 260ms ease-out; }
        @keyframes dh-land { from { transform:scale(0.92); opacity:0; } to { transform:scale(1); opacity:1; } }
        /* The dividend and the divisor fade up as they arrive, so the travelling
           number hands over to the printed one instead of snapping. */
        .dh-slot.given.arrive { animation:dh-arrive 320ms ease-out; }
        @keyframes dh-arrive { from { opacity:0; } to { opacity:1; } }
        @media (prefers-reduced-motion: reduce) { .dh-slot.given.arrive { animation:none; } }
        /* THE PULSE IS WHAT A MISS BUYS YOU, not what the question opens with.
           Steele: "have it say to select the number closest to the door inside
           the house and if they get it wrong then have it pulse." So the ask
           carries the instruction and the board stays quiet until the student
           has actually got it wrong - the target class is only applied once a
           miss has been recorded. The drawn ring that used to sit on top of
           this went with the same comment ("get rid of the circle"). */
        /* THE BORDER IS ORANGE-600, NOT AMBER, AND THAT IS NOT A STYLE CHOICE.
           The amber token measures 1.72:1 on cream and its 30% wash 1.18:1 - which
           was survivable while a drawn ring sat on top of it and the pulse was
           only a second voice. It is not survivable now: this is the ONLY thing
           that ever marks the spot, it appears only after a student has already
           got it wrong, and under prefers-reduced-motion the motion carrying it
           is gone too. #c4660a is the design system's orange-600 at 3.71:1,
           clearing the 3:1 floor for a non-text mark - the same colour, for the
           same reason, as the ring that used to do this job. */
        .dh-slot.target { border-style:solid; border-color:#c4660a;
          animation:dh-target 1.15s ease-in-out infinite; }
        @keyframes dh-target {
          0%,100% { background:color-mix(in srgb, var(--bdb-amber) 16%, transparent); box-shadow:0 0 0 0 color-mix(in srgb, #c4660a 55%, transparent); }
          50% { background:color-mix(in srgb, var(--bdb-amber) 42%, transparent); box-shadow:0 0 0 8px color-mix(in srgb, #c4660a 0%, transparent); }
        }
        /* Reduced motion loses the pulse, so it must not also lose the mark: the
           border stays and the wash sits at its brightest, not its dimmest. */
        @media (prefers-reduced-motion: reduce) {
          .dh-slot.target { animation:none; background:color-mix(in srgb, var(--bdb-amber) 42%, transparent);
            box-shadow:0 0 0 3px color-mix(in srgb, #c4660a 45%, transparent); }
        }
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

        /* WHAT IS HAPPENING, SAID BY THE TWO NUMBERS IN IT.
           Steele, 2026-08-04: "maybe no arrows. Just use the higlighting pulse
           to show what is happening", then "no arrows or lines", then "the
           animation is clunky". The connector layer that used to sit here - an
           arched line drawing itself over 520ms, an arrowhead fading in behind
           it, and a sign glyph bursting in at 1.5x and rotating - is gone.
           What replaces it is the pair of cells the move runs between, lit in
           the round's colour. It is a state, not an animation: 180ms to arrive
           and then it holds, so a student glancing up mid-step sees the same
           thing as one who watched it change.
           It is deliberately NOT the amber the target class uses, which now
           means something else entirely - that one only appears after a miss
           and says "here is the spot you were looking for".
           IT IS A RING, NOT A FILL, so that it composes with every other thing
           a cell can be. Painted as a background it fought the green of a spot
           the student had just placed - a coral box with a green numeral in it -
           and the placed-stays-green rule is load-bearing on this board. A ring
           sits outside all of that, in the 4px margin the cells already carry. */
        .dh-slot.act { box-shadow:0 0 0 3px var(--act); transition:box-shadow 180ms ease; }

        /* The rule under the number being subtracted; the difference goes below it. */
        .dh-subrule { position:absolute; z-index:2; height:calc(4px * var(--dh-k)); border-radius:2px;
          background:var(--bdb-ink); animation:dh-rule 300ms ease-out; transform-origin:left center; }
        @keyframes dh-rule { from { transform:scaleX(0); } to { transform:scaleX(1); } }

        @media (prefers-reduced-motion: reduce) {
          .dh-slot.act { transition:none; }
          /* The rule was still sweeping in under reduce - it had no override. */
          .dh-subrule { animation:none; transform:scaleX(1); }
          .dh-zone.bad-a, .dh-zone.bad-b { animation:none; }
        }

        .dh-ask { display:grid; gap:12px; align-content:start; }
        .dh-round { font-size:calc(0.86rem * var(--dh-k)); font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:var(--bdb-ink-soft); }
        .dh-q { font-size:calc(clamp(1.2rem,2.5vw,1.55rem) * var(--dh-k)); font-weight:800; margin:0; line-height:1.28; }
        /* THE D-M-S-B-R RAIL, built to the shape /order-of-operations uses for
           GEMS: a square tile, one big letter, a small caption under it, and one
           colour per step carried on --c so every state reads from the same
           token. Ink labels on the bright fills - white fails AA on teal, coral
           and green - with brown the one exception, where it is the fill that is
           dark and white is what passes. */
        /* THE RAIL SIZES ITSELF, NOT OFF THE BOARD SCALE. That scale is derived from the
           CELL size, which is height-bound, so it pins at 1 exactly when the
           problem has the most rounds - which put the captions at 8px on a
           1366x768 Chromebook AND on a 1920x1080 projector. A mnemonic whose
           expansion cannot be read is five letters. GEMS uses a 72-108px tile
           with a 0.62rem caption and is legible on the same wall. */
        .dh-rail { display:flex; flex-direction:column; gap:9px; }
        /* THE STACKED OVERRIDE LIVES HERE, NOT UP WITH THE GRID BREAKPOINTS. It
           did, and it never applied: same specificity as the base rule, earlier
           in the source, so the column direction won and a stacked phone got a
           tall vertical rail above the board instead of a row across the top. */
        @media (max-width:760px) { .dh-rail { flex-direction:row; flex-wrap:wrap; justify-content:center; } }
        .dh-tile { width:clamp(64px,5vw,104px); height:clamp(64px,5vw,104px); border-radius:16px;
          display:grid; place-items:center; position:relative; padding-bottom:15px; box-sizing:border-box;
          background:var(--bdb-card); border:2px solid var(--bdb-line);
          transition:background 200ms ease, border-color 200ms ease, transform 200ms ease; }
        .dh-tile .L { font-size:clamp(1.6rem,2.6vw,2.7rem); font-weight:900; color:var(--bdb-ink-faint); line-height:1; }
        /* The caption scales too. GEMS pins its own at 0.62rem, and matching
           that fixed the 8px Chromebook case but left the word at 9.9px on a
           1920 wall - which is the surface the rail most needs to be read from. */
        .dh-tile .S { position:absolute; bottom:5px; font-size:clamp(0.62rem,0.72vw,0.95rem); font-weight:800;
          letter-spacing:0.02em; line-height:1.12; text-transform:uppercase; color:var(--bdb-ink-faint);
          text-align:center; width:94%; }
        .dh-tile.active { background:var(--c); border-color:var(--c); transform:scale(1.05);
          box-shadow:0 10px 26px -10px var(--c); }
        /* Done is the same colour, washed out - NOT the same colour with the
           letter struck through, which GEMS can afford and this cannot: a
           capital D with a line through it is a letter in its own right, and the
           first tile of a rail whose entire job is D-M-S-B-R was rendering as
           something else. The wash reads as "been there" without touching the
           letterform, and it stays clearly behind the solid active tile. */
        .dh-tile.done { background:color-mix(in srgb, var(--c) 42%, var(--bdb-card));
          border-color:var(--c); }
        .dh-tile.active .L, .dh-tile.active .S { color:var(--bdb-ink); }
        .dh-tile.done .L, .dh-tile.done .S { color:var(--bdb-ink); }
        .dh-tile.cat-bringdown.active .L, .dh-tile.cat-bringdown.active .S { color:var(--bdb-card); }
        /* B on the last round: there is nothing left to bring down, and saying
           so is more use than leaving the tile looking merely unvisited. */
        /* NOT an opacity fade. At 0.5 the caption measured 1.91:1 - the tile carrying
           "there is nothing left to bring down, this problem is ending" was the
           least readable thing on screen, and reads as a broken button rather
           than a finished step. A flat quiet fill with real ink-soft text is
           4.7:1 and still clearly the calmest tile on the rail. */
        .dh-tile.skipped { background:var(--bdb-ground-2); border-color:var(--bdb-line); }
        .dh-tile.skipped .L, .dh-tile.skipped .S { color:var(--bdb-ink-soft); }
        /* Not a strikethrough here either, for the same reason - and B does not
           need one: greyed out beside four coloured tiles already reads. */
        .dh-tile.skipped .S { text-decoration:line-through; }
        @media (prefers-reduced-motion: reduce) { .dh-tile.active { transform:none; } }

        /* The numbers beside the words. */
        .dh-work { display:grid; gap:4px; justify-items:start; }
        .dh-work span { font-variant-numeric:tabular-nums; font-size:calc(1.15rem * var(--dh-k));
          font-weight:800; color:var(--bdb-ink-soft); padding:3px 12px; border-radius:9px; }
        .dh-work span.live { color:var(--bdb-ink); font-size:calc(1.5rem * var(--dh-k));
          background:color-mix(in srgb, var(--bdb-amber) 17%, transparent); }
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
        {/* The mnemonic, in a left rail, the way GEMS carries its own. It is a
            reference the student glances at, so it holds no aria-live - the
            question column is what announces. */}
        <div className="dh-rail">
          {railTiles.map((t) => (
            <div
              key={t.key}
              className={`dh-tile cat-${t.key} ${t.state}`}
              style={{ ["--c" as string]: CYCLE_COLORS[t.key] }}
            >
              <span className="L">{t.letter}</span>
              <span className="S">{t.label}</span>
            </div>
          ))}
        </div>

        <div className="dh-stage" ref={stageRef}>
          {/* Centred over the HOUSE, not over the whole board - the divisor is
              outside it, which is the whole joke the mnemonic runs on. */}
          <div className="dh-plaque" ref={plaqueRef} style={{ width: boardW, marginBottom: plaqueGap }}>
            <div className="dh-plaque-title" style={{ marginLeft: houseLeft }}>
              {/* IN SET-UP THE TWO NUMBERS ARE THE THINGS YOU PICK UP. Steele:
                  "have students drag the divisor to the outside and dividend
                  inside". The equation stays legible while they go, because a
                  placed chip fades rather than vanishing. */}
              <span className="dh-plaque-eq">
                {setupPhase ? (
                  <>
                    <button
                      className={`dh-chip ${held === "dividend" ? "held" : ""} ${placed.dividend !== "out" ? "gone" : ""}`.replace(/\s+/g, " ").trim()}
                      data-part="dividend"
                      onPointerDown={(e) => startDrag("dividend", e)}
                      onPointerMove={onChipMove}
                      onPointerUp={onChipUp}
                      onPointerCancel={onChipUp}
                      onClick={() => { if (placed.dividend === "out") setHeld("dividend"); }}
                      disabled={placed.dividend !== "out"}
                      aria-label={`${trace.dividend}, pick up to place`}
                      type="button"
                    >
                      {trace.dividend}
                    </button>
                    {" ÷ "}
                    <button
                      className={`dh-chip ${held === "divisor" ? "held" : ""} ${placed.divisor !== "out" ? "gone" : ""}`.replace(/\s+/g, " ").trim()}
                      data-part="divisor"
                      onPointerDown={(e) => startDrag("divisor", e)}
                      onPointerMove={onChipMove}
                      onPointerUp={onChipUp}
                      onPointerCancel={onChipUp}
                      onClick={() => { if (placed.divisor === "out") setHeld("divisor"); }}
                      disabled={placed.divisor !== "out"}
                      aria-label={`${trace.divisor}, pick up to place`}
                      type="button"
                    >
                      {trace.divisor}
                    </button>
                  </>
                ) : (
                  <>
                    {trace.headline}
                    {done_ ? ` = ${trace.quotient}${trace.remainder ? ` r${trace.remainder}` : ""}` : ""}
                  </>
                )}
              </span>
            </div>
            <div className="dh-plaque-tags" style={{ gridTemplateColumns: `${houseLeft}px 1fr` }}>
              <span className="dh-tag visitor"><i>divisor</i><b>da visitor, outside</b></span>
              <span className="dh-tag david"><i>dividend</i><b>David, in the house</b></span>
            </div>
            {/* THE PLAQUE DRAWS NO ARROWS. It ran a brown one down to the
                divisor and a teal one in through the door, and those were
                what the numbers travelled along - then Steele, 2026-08-04:
                "no arrows or lines". The two tags still sit over their own
                columns, so which side is which is still said by position,
                and a number now goes to its spot in a straight slow line
                rather than tracing a curve. */}
          </div>

          <div className="dh-board" ref={boardRef} style={{ width: boardW, height: boardH }}>
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
                // In set-up the house is EMPTY: a given digit is printed only
                // once the student has put its number there.
                const shown = slot && (slot.given ? givenShown(slot) : filledSet.has(slot.id));
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
                    className={`dh-slot ${slot?.given ? "given" : ""} ${setupPhase && shown ? "arrive" : ""} ${shown && !slot?.given ? "filled land" : ""} ${mergeCls} ${slot && actSlots.has(slot.id) ? "act" : ""} ${isTarget && revealTarget ? "target" : ""} ${wrongCls}`.replace(/\s+/g, " ").trim()}
                    style={{
                      gridColumn: col + 1,
                      gridRow: row + 1,
                      ...(slot && actSlots.has(slot.id) ? { ["--act" as string]: actColor } : null),
                    }}
                    onClick={() => clickSlot(id)}
                    disabled={done_ || setupPhase}
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

            {/* NO CONNECTOR LAYER. The arched line, its arrowhead and the
                sign glyph that burst in over it all lived here in one SVG
                at z-index 3. Steele ran it: "no arrows or lines", "the
                animation is clunky". What is happening is now said by the
                two cells in the move lighting up together - `.dh-slot.act`
                - with the arithmetic spelled out in the rail beside it. */}

            {/* THE TWO PLACES A NUMBER CAN GO. They cover the dividend row
                only - which is the one row that exists before the drill starts -
                and the divisor zone stops at the gutter, so the clear column
                between them stays clear. */}
            {setupPhase && (
              <>
                <button
                  className={`dh-zone ${dragOver === "divisor" ? "over" : ""} ${placed.divisor !== "out" ? "set" : ""} ${wrongZone?.zone === "divisor" ? (wrongZone.n % 2 ? "bad-b" : "bad-a") : ""}`.replace(/\s+/g, " ").trim()}
                  data-drop="divisor"
                  style={{ left: colX(0), top: houseTop, width: colX(trace.divisorWidth) - colX(0), height: rowPx }}
                  onClick={() => { if (held) tryPlace(held, "divisor"); }}
                  type="button"
                >
                  outside
                </button>
                <button
                  className={`dh-zone ${dragOver === "dividend" ? "over" : ""} ${placed.dividend !== "out" ? "set" : ""} ${wrongZone?.zone === "dividend" ? (wrongZone.n % 2 ? "bad-b" : "bad-a") : ""}`.replace(/\s+/g, " ").trim()}
                  data-drop="dividend"
                  style={{ left: houseLeft, top: houseTop, width: boardW - houseLeft, height: rowPx }}
                  onClick={() => { if (held) tryPlace(held, "dividend"); }}
                  type="button"
                >
                  in the house
                </button>
              </>
            )}
          </div>
        </div>

        {/* The question and the two feedback lines announce themselves. The
            whole column would announce the step strip and the trail with them,
            which is a paragraph of speech on every tap. */}
        <div className="dh-ask" ref={askRef}>
          {setupPhase ? (
            <>
              <p className="dh-q" aria-live="polite">Set up the house. Drag each number to its place.</p>
              <p className="dh-say">
                One of them waits outside and one of them lives in the house. Drag a number, or tap it and
                then tap where it goes.
              </p>
              {setupMiss && <p className="dh-hint" role="alert">{setupMiss}</p>}
            </>
          ) : done_ ? (
            <>
              {/* Steele: "No remainder = All done, Nice!" - the finish says
                  which of the two endings this was, because "there is nothing
                  left over" is the thing a student is checking for and it used
                  to be left for them to work out of the equation. */}
              <p className="dh-q">
                {trace.remainder ? "Every step is placed." : "No remainder. All done. Nice!"}
              </p>
              <p className="dh-done">
                {trace.headline} = {trace.quotient}{trace.remainder ? ` remainder ${trace.remainder}` : ""}
              </p>
              {trace.remainder > 0 && (
                <p className="dh-say">
                  {trace.remainder} could not be shared out - that is the remainder.
                </p>
              )}
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
              {/* The same fact in numbers, right under the words for it.
                  aria-hidden because the sentence above already says it out
                  loud - a screen reader does not need "9 ÷ 4 = 2" twice. */}
              {workLines.length > 0 && (
                <div className="dh-work" aria-hidden="true">
                  {workLines.map((l) => (
                    <span key={l.key} className={l.live ? "live" : ""}>{l.text}</span>
                  ))}
                </div>
              )}
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

      {drag && dragPos && (
        <span className="dh-ghost" style={{ left: dragPos.x, top: dragPos.y }} aria-hidden="true">
          {partValue[drag]}
        </span>
      )}

      {/* "they click the spot and it slowly moves to it" - a straight travel
          from the equation to the box, over the whole board rather than inside
          it, because the two ends are measured in viewport pixels. */}
      {fly && (
        <span
          className={`dh-fly ${flyGo ? "go" : ""}`.trim()}
          style={{
            left: fly.x,
            top: fly.y,
            ["--dx" as string]: `${fly.dx}px`,
            ["--dy" as string]: `${fly.dy}px`,
          }}
          aria-hidden="true"
        >
          {partValue[fly.part]}
        </span>
      )}

      {cheer > 0 && <span className="dh-yes" key={cheer}>Yes!</span>}
    </div>
  );
}
