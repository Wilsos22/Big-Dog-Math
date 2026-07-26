// Reusable problem registry for live Challenges.
//
// Each "skill" mirrors one of the site's math tools and knows how to
// auto-generate a fresh problem at a difficulty level. The student game screen
// (/challenge) renders ANY skill from this list, so adding a new tool to the
// competition is just adding one entry here — no new UI required.

export type AnswerType = "number" | "choice";

export interface Problem {
  prompt: string; // main expression/question, may contain unicode math (× ÷ − ²)
  sub?: string; // optional helper line, e.g. "x = ?"
  answer: string; // canonical correct answer (string form)
  answerType: AnswerType;
  choices?: string[]; // present when answerType === "choice"
  allowNegative?: boolean; // number keypad shows a +/− toggle
  // Wrong choice -> canonical misconception label (the finite vocabulary in the
  // `misconceptions` table). Lets a wrong answer carry a diagnosis, so drill
  // evidence can feed grouping once attempts reach `responses`. Unmapped wrong
  // answers are just wrong; nothing here is required.
  misses?: Record<string, string>;
}

export interface Skill {
  key: string;
  label: string;
  emoji?: string; // legacy decoration; new skills omit it (no emojis - see CLAUDE.md)
  blurb: string; // one-liner shown when picking a challenge
  toolRoute?: string; // matching manipulative, for "show me how" links
  standardId?: string; // dotted-letter CCSS as seeded in `standards`, e.g. "6.NS.B.4"
  levels: string[]; // labels for difficulty 1..3
  generate: (level: number) => Problem;
}

// ---- tiny random helpers -------------------------------------------------
const ri = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}
// parenthesize negative operands, with a unicode minus: 5 → "5", -5 → "(−5)"
const par = (n: number) => (n < 0 ? `(−${Math.abs(n)})` : `${n}`);

function numProb(prompt: string, answer: number, opts?: { sub?: string; allowNegative?: boolean }): Problem {
  return { prompt, answer: String(answer), answerType: "number", sub: opts?.sub, allowNegative: opts?.allowNegative };
}
function choiceProb(prompt: string, correct: string, distractors: string[], sub?: string, misses?: Record<string, string>): Problem {
  const choices: string[] = [correct];
  for (const d of distractors) {
    if (choices.length >= 4) break;
    if (!choices.includes(d)) choices.push(d);
  }
  // pad in the unlikely case we ran short on unique distractors
  let guard = 0;
  while (choices.length < 4 && guard++ < 50) {
    const filler = `${ri(1, 99)}`;
    if (!choices.includes(filler)) choices.push(filler);
  }
  return { prompt, answer: correct, answerType: "choice", choices: shuffle(choices), sub, misses };
}

// ---- shared number theory for the Module 1 drills ------------------------
const COPRIME: [number, number][] = [[2,3],[3,4],[2,5],[3,5],[4,5],[5,6],[2,7],[3,7],[4,7],[5,7],[2,9],[4,9],[5,8],[3,8],[7,8]];
const lcmOf = (a: number, b: number) => (a * b) / gcd(a, b);
function primeFactorList(n: number): number[] {
  const out: number[] = [];
  let x = n;
  for (let p = 2; p * p <= x; p++) while (x % p === 0) { out.push(p); x /= p; }
  if (x > 1) out.push(x);
  return out;
}
function expForm(n: number): string {
  const map = new Map<number, number>();
  for (const p of primeFactorList(n)) map.set(p, (map.get(p) || 0) + 1);
  return [...map.entries()].map(([p, e]) => (e === 1 ? `${p}` : `${p}^${e}`)).join(" × ");
}
// reduce n/d, dropping a denominator of 1 so "6/1" never reaches a student
function frac(n: number, d: number): string {
  const g = gcd(n, d), rn = n / g, rd = d / g;
  return rd === 1 ? `${rn}` : `${rn}/${rd}`;
}
function fracValue(s: string): number {
  const [n, d] = s.split("/").map(Number);
  return d === undefined ? n : n / d;
}

// ---- GCF and LCM (Ladder Method) ----------------------------------------
function gcfLcmProblem(level: number): Problem {
  if (level <= 1) {
    const g = pick([2, 3, 4, 6, 8, 9, 12]);
    const [m, n] = pick(COPRIME.filter(([m2, n2]) => g * m2 <= 120 && g * n2 <= 120));
    return numProb(`GCF of ${g * m} and ${g * n}`, g, { sub: "greatest common factor" });
  }
  if (level === 2) {
    const g = pick([2, 3, 4, 5, 6]);
    const [m, n] = pick(COPRIME.filter(([m2, n2]) => g * m2 * n2 <= 200));
    return numProb(`LCM of ${g * m} and ${g * n}`, g * m * n, { sub: "least common multiple" });
  }
  // level 3 — the student has to decide WHICH one the situation needs, and the
  // other operation's answer sits right there as the tempting distractor.
  const g = pick([2, 3, 4, 6]);
  const [m, n] = pick(COPRIME.filter(([m2, n2]) => g * m2 * n2 <= 120 && g * m2 <= 60 && g * n2 <= 60));
  const a = g * m, b = g * n;
  if (Math.random() < 0.5) {
    return choiceProb(
      `${a} red pens and ${b} blue pens are split into identical packs with none left over. What is the greatest number of packs?`,
      String(g), [String(lcmOf(a, b)), String(a), String(b)], undefined,
      { [String(lcmOf(a, b))]: "GCF/LCM mix-up" },
    );
  }
  return choiceProb(
    `One bus leaves every ${a} minutes and another every ${b} minutes. They just left together. In how many minutes will they leave together again?`,
    String(lcmOf(a, b)), [String(g), String(a + b), String(a * b)], undefined,
    { [String(g)]: "GCF/LCM mix-up" },
  );
}

// ---- prime factorization (Ladder Method / factor trees) ------------------
function primeFactorizationProblem(level: number): Problem {
  if (level <= 1) {
    const n = pick([12, 18, 20, 24, 28, 30, 36, 40, 45, 48, 50, 54, 60, 72]);
    const f = primeFactorList(n);
    const correct = f.join(" × ");
    // Distractors are BUILT, never padded: merging two adjacent primes keeps the
    // product equal to n while leaving it not fully broken down. Guarantees every
    // wrong choice is a real factorization and that exactly one is all-prime.
    const merged = new Set<string>();
    for (let i = 0; i < f.length - 1; i++) {
      const s = f.slice(0, i).concat([f[i] * f[i + 1]], f.slice(i + 2)).join(" × ");
      if (s !== correct) merged.add(s);
    }
    merged.add(`1 × ${n}`);
    return choiceProb(`Which is the prime factorization of ${n}?`, correct, shuffle([...merged]).slice(0, 3), "primes only");
  }
  if (level === 2) {
    const n = pick([24, 36, 40, 48, 54, 60, 72, 80, 96, 100, 108, 120]);
    const map = new Map<number, number>();
    for (const p of primeFactorList(n)) map.set(p, (map.get(p) || 0) + 1);
    const [target, exp] = pick([...map.entries()]);
    const shown = [...map.entries()]
      .map(([p, e]) => (p === target ? `${p}^?` : e === 1 ? `${p}` : `${p}^${e}`))
      .join(" × ");
    return numProb(`${n} = ${shown}`, exp, { sub: "what exponent?" });
  }
  // level 3 — read a factorization and rebuild the number
  const base = pick([[2,3,5],[2,2,3],[2,3,3],[2,2,2,5],[3,3,5],[2,5,5],[2,2,3,3],[2,2,7],[3,5,5]]);
  const n = base.reduce((a, b) => a * b, 1);
  return numProb(`A number's prime factorization is ${expForm(n)}. What is the number?`, n);
}

// ---- divisibility rules -------------------------------------------------
const DIV_RULES: Record<number, (n: number) => boolean> = {
  2: (n) => n % 2 === 0, 3: (n) => n % 3 === 0, 4: (n) => n % 4 === 0, 5: (n) => n % 5 === 0,
  6: (n) => n % 6 === 0, 8: (n) => n % 8 === 0, 9: (n) => n % 9 === 0, 10: (n) => n % 10 === 0,
};
// A "near miss" satisfies a WEAKER related rule but fails the one being asked.
// Those are what make the drill teach: guessing from the family gets it wrong.
const NEAR_MISS: Record<number, number[]> = { 9: [3], 6: [2, 3], 4: [2], 8: [4, 2], 10: [5], 3: [], 5: [], 2: [] };
function uniqueDivisibilitySet(need: number[], lo: number, hi: number): { correct: number; distractors: number[] } | null {
  const near = [...new Set(need.flatMap((d) => NEAR_MISS[d] || []).filter((d) => !need.includes(d)))];
  const fails = (n: number) => !need.every((d) => DIV_RULES[d](n));
  const isNear = (n: number) => fails(n) && (need.length > 1
    ? need.some((d) => DIV_RULES[d](n))    // multi-rule: satisfies part of it
    : near.some((d) => DIV_RULES[d](n)));  // single rule: satisfies a weaker cousin
  for (let attempt = 0; attempt < 500; attempt++) {
    const ok: number[] = [], nearBad: number[] = [], anyBad: number[] = [];
    for (let t = 0; t < 900 && (ok.length < 1 || nearBad.length < 3); t++) {
      const n = ri(lo, hi);
      if (!fails(n)) { if (!ok.includes(n)) ok.push(n); continue; }
      if (isNear(n)) { if (!nearBad.includes(n)) nearBad.push(n); }
      else if (!anyBad.includes(n)) anyBad.push(n);
    }
    const bad = nearBad.concat(anyBad.filter((n) => !nearBad.includes(n)));
    if (ok.length >= 1 && bad.length >= 3) return { correct: ok[0], distractors: bad.slice(0, 3) };
  }
  return null;
}
function divisibilityProblem(level: number): Problem {
  const need: number[] = level <= 1 ? [pick([2, 5, 10])]
    : level === 2 ? [pick([3, 6, 9])]
    : pick([[4], [8], [3, 4], [2, 9], [5, 6]]);
  const set = uniqueDivisibilitySet(need, 100, 999);
  if (!set) return numProb("120 ÷ 6", 20); // unreachable in practice; never ship a broken item
  return choiceProb(
    `Which number is divisible by ${need.length === 1 ? need[0] : need.join(" and ")}?`,
    String(set.correct), set.distractors.map(String),
  );
}

// ---- distributive property (area / box model) ---------------------------
function distributiveDrill(level: number): Problem {
  if (level <= 1) {
    const a = ri(3, 9), t = ri(2, 4) * 10, o = ri(1, 9);
    return choiceProb(`Which is equal to  ${a}(${t} + ${o})?`, `${a} × ${t} + ${a} × ${o}`,
      [`${a} × ${t} + ${o}`, `${a + t} × ${a + o}`, `${a} × ${t + o} + ${o}`], undefined,
      { [`${a} × ${t} + ${o}`]: "distributes to first term only" });
  }
  if (level === 2) {
    const g = pick([3, 4, 6, 8, 12]);
    const [m, n] = pick(COPRIME.filter(([m2, n2]) => g * m2 <= 96 && g * n2 <= 96));
    const pool = [`${g}(${m} + ${n + 1})`, `1(${g * m} + ${g * n})`];
    if (g % 2 === 0) pool.unshift(`${g / 2}(${m * 2} + ${n * 2})`); // partially factored
    return choiceProb(`Rewrite  ${g * m} + ${g * n}  using the GCF:`, `${g}(${m} + ${n})`, pool, "GCF outside the parentheses");
  }
  const a = ri(2, 9), c = ri(2, 12);
  return choiceProb(`Which is equal to  ${a}(x + ${c})?`, `${a}x + ${a * c}`,
    [`${a}x + ${c}`, `x + ${a * c}`, `${a + c}x`], undefined,
    { [`${a}x + ${c}`]: "distributes to first term only" });
}

// ---- area of shapes -----------------------------------------------------
function areaProblem(level: number): Problem {
  if (level <= 1) {
    if (Math.random() < 0.5) {
      let b = ri(3, 15), h = ri(2, 12);
      // 4×4 and 3×6 have area == perimeter, which would make the perimeter
      // distractor a second correct answer. Nudge off those cases.
      let guard = 0;
      while ((b * h === 2 * (b + h) || b * h === b + h) && guard++ < 20) { b = ri(3, 15); h = ri(2, 12); }
      return choiceProb(`A rectangle is ${b} cm by ${h} cm. What is its area in square cm?`, String(b * h),
        [String(2 * (b + h)), String(b + h), String(b * h + b)], undefined,
        { [String(2 * (b + h))]: "confuses area vs perimeter" });
    }
    const b = ri(2, 12) * 2, h = ri(2, 11); // even base keeps the area a whole number
    return choiceProb(`A triangle has base ${b} cm and height ${h} cm. What is its area in square cm?`, String((b * h) / 2),
      [String(b * h), String(b + h), String(2 * (b + h))], undefined,
      { [String(b * h)]: "forgets to halve base × height for triangle area" });
  }
  if (level === 2) {
    if (Math.random() < 0.5) {
      const b = ri(4, 16), h = ri(3, 12), slant = h + ri(1, 4);
      return choiceProb(`A parallelogram has base ${b} m, height ${h} m, and a slanted side of ${slant} m. What is its area in square m?`,
        String(b * h), [String(b * slant), String(b + h), String(2 * (b + h))], undefined,
        { [String(b * slant)]: "uses the slant side instead of the height" });
    }
    const b1 = ri(3, 12);
    let b2 = ri(3, 14);
    const h = ri(2, 6) * 2;
    if (((b1 + b2) * h) % 2 !== 0) b2 += 1;
    return choiceProb(`A trapezoid has bases ${b1} m and ${b2} m with height ${h} m. What is its area in square m?`,
      String(((b1 + b2) * h) / 2), [String((b1 + b2) * h), String(b1 * b2), String(b1 + b2 + h)], undefined,
      { [String((b1 + b2) * h)]: "forgets to halve base × height for triangle area" });
  }
  const w1 = ri(4, 12), h1 = ri(3, 9), w2 = ri(2, 8), h2 = ri(2, 7);
  return numProb(`An L-shape is made of a ${w1} by ${h1} rectangle joined to a ${w2} by ${h2} rectangle. What is the total area?`,
    w1 * h1 + w2 * h2, { sub: "square units" });
}

// ---- long division ------------------------------------------------------
function longDivisionProblem(level: number): Problem {
  if (level <= 1) {
    const d = ri(3, 9), q = ri(11, 99);
    return numProb(`${d * q} ÷ ${d}`, q);
  }
  if (level === 2) {
    const d = ri(12, 25), q = ri(11, 60);
    return numProb(`${d * q} ÷ ${d}`, q);
  }
  // level 3 — terminating decimal quotient; magnitude is the whole point
  const d = pick([4, 5, 8, 20, 25, 40, 50]);
  const q4 = ri(21, 400);
  const n = (d * q4) / 100;
  if (!Number.isInteger(n)) return longDivisionProblem(2);
  const ans = q4 / 100;
  return choiceProb(`${n} ÷ ${d}`, String(ans),
    [String(ans * 10), String(ans / 10), String(Math.round(ans) || 1)], undefined,
    { [String(ans * 10)]: "misplaces decimal in division", [String(ans / 10)]: "misplaces decimal in division" });
}

// ---- dividing fractions -------------------------------------------------
function divideFractionsProblem(level: number): Problem {
  if (level <= 1) {
    const w = ri(2, 9), d = ri(2, 6);
    return choiceProb(`${w} ÷ 1/${d}`, String(w * d),
      [frac(w, d), String(w + d), String(d)], `how many 1/${d} pieces fit in ${w}?`,
      { [frac(w, d)]: "multiplies instead of dividing by the reciprocal" });
  }
  if (level === 2) {
    const a = ri(1, 5), b = ri(2, 6), c = ri(1, 5), d = ri(2, 6);
    if (a >= b || c >= d) return divideFractionsProblem(2);
    if (a * d === b * c) return divideFractionsProblem(2); // quotient 1 makes a flipped distractor also correct
    const correct = frac(a * d, b * c);
    const want = (a / b) / (c / d);
    const pool = [frac(a * c, b * d), frac(a + c, b + d), frac(b * c, a * d), frac(a * d + 1, b * c)]
      .filter((s) => s !== correct && Math.abs(fracValue(s) - want) > 1e-9);
    const mulTrap = frac(a * c, b * d);
    return choiceProb(`${a}/${b} ÷ ${c}/${d}`, correct, pool, undefined,
      pool.includes(mulTrap) ? { [mulTrap]: "multiplies instead of dividing by the reciprocal" } : undefined);
  }
  const total = ri(2, 8), d = pick([2, 3, 4, 6, 8]);
  return choiceProb(`A recipe uses 1/${d} cup of oats per serving. How many servings come from ${total} cups?`,
    String(total * d), [frac(total, d), String(total + d), String(d)], undefined,
    { [frac(total, d)]: "multiplies instead of dividing by the reciprocal" });
}

// ---- fraction / decimal / percent converting ---------------------------
const FDP: [number, number, string, number][] = [
  [1,2,"0.5",50],[1,4,"0.25",25],[3,4,"0.75",75],[1,5,"0.2",20],[2,5,"0.4",40],[3,5,"0.6",60],[4,5,"0.8",80],
  [1,10,"0.1",10],[3,10,"0.3",30],[7,10,"0.7",70],[9,10,"0.9",90],[1,20,"0.05",5],[1,100,"0.01",1],[1,25,"0.04",4]];
function convertFdpProblem(level: number): Problem {
  if (level <= 1) {
    const [n, d, , pct] = pick(FDP);
    return numProb(`${n}/${d} = ___%`, pct, { sub: "answer in percent" });
  }
  if (level === 2) {
    const [, , dec, pct] = pick(FDP);
    return choiceProb(`${dec} = ?`, `${pct}%`,
      [`${dec}%`, `${Number(dec) * 1000}%`, `${Number(dec) / 10}%`], undefined,
      { [`${dec}%`]: "reads the decimal as the percent", [`${Number(dec) * 1000}%`]: "shifts the decimal the wrong way" });
  }
  const [n, d, dec, pct] = pick(FDP);
  const wrongPct = pct === 50 ? 25 : 50;
  return choiceProb("Which set shows the same value three ways?", `${n}/${d} = ${dec} = ${pct}%`,
    [`${n}/${d} = ${dec} = ${wrongPct}%`, `${n}/${d} = ${Number(dec) * 10} = ${pct}%`, `${d}/${n} = ${dec} = ${pct}%`]);
}

// ---- order of operations (GEMS) -----------------------------------------
function gemsProblem(level: number): Problem {
  if (level <= 1) {
    const t = pick([
      () => { const a = ri(2, 9), b = ri(2, 6), c = ri(2, 6); return { p: `${a} + ${b} × ${c}`, ans: a + b * c }; },
      () => { const a = ri(2, 6), b = ri(2, 6), c = ri(1, 9); return { p: `${a} × ${b} + ${c}`, ans: a * b + c }; },
      () => { const a = ri(3, 9), b = ri(2, 6), c = ri(1, 5); return { p: `${a} × ${b} − ${c}`, ans: a * b - c }; },
    ])();
    return numProb(t.p, t.ans);
  }
  if (level === 2) {
    const t = pick([
      () => { const a = ri(2, 8), b = ri(2, 8), c = ri(2, 6); return { p: `(${a} + ${b}) × ${c}`, ans: (a + b) * c }; },
      () => { const a = ri(5, 9), b = ri(1, 4), c = ri(2, 6); return { p: `${c} × (${a} − ${b})`, ans: c * (a - b) }; },
      () => { const a = ri(2, 9), b = ri(2, 6), c = ri(2, 6), d = ri(1, 9); return { p: `${a} + ${b} × ${c} − ${d}`, ans: a + b * c - d }; },
    ])();
    return numProb(t.p, t.ans);
  }
  const t = pick([
    () => { const a = ri(3, 9), b = ri(1, 20); return { p: `${a}² + ${b}`, ans: a * a + b }; },
    () => { const a = ri(4, 9), b = ri(1, 15); return { p: `${a}² − ${b}`, ans: a * a - b }; },
    () => { const a = ri(2, 5), b = ri(2, 4), c = ri(1, 9); return { p: `${a}² × ${b} + ${c}`, ans: a * a * b + c }; },
    () => { const c = ri(2, 9), q = ri(2, 9), b = ri(1, 9); return { p: `${c * q} ÷ ${c} + ${b}`, ans: q + b }; },
  ])();
  return numProb(t.p, t.ans);
}

// ---- multiplication fluency ---------------------------------------------
function multiplicationProblem(level: number): Problem {
  if (level <= 1) { const a = ri(2, 9), b = ri(2, 9); return numProb(`${a} × ${b}`, a * b); }
  if (level === 2) { const a = ri(3, 12), b = ri(3, 12); return numProb(`${a} × ${b}`, a * b); }
  const a = ri(11, 25), b = ri(3, 9); return numProb(`${a} × ${b}`, a * b);
}

// ---- integers (number line) ---------------------------------------------
function integerProblem(level: number): Problem {
  if (level <= 1) {
    const t = pick([
      () => { const a = -ri(1, 12), b = ri(1, 15); return { p: `${par(a)} + ${b}`, ans: a + b }; },
      () => { const a = ri(1, 15), b = -ri(1, 12); return { p: `${a} + ${par(b)}`, ans: a + b }; },
    ])();
    return numProb(t.p, t.ans, { allowNegative: true });
  }
  if (level === 2) {
    const t = pick([
      () => { const a = -ri(1, 12), b = ri(1, 12); return { p: `${par(a)} − ${b}`, ans: a - b }; },
      () => { const a = ri(1, 12), b = -ri(1, 12); return { p: `${a} − ${par(b)}`, ans: a - b }; },
      () => { const a = -ri(1, 12), b = -ri(1, 12); return { p: `${par(a)} − ${par(b)}`, ans: a - b }; },
    ])();
    return numProb(t.p, t.ans, { allowNegative: true });
  }
  const t = pick([
    () => { const a = -ri(2, 9), b = ri(2, 9); return { p: `${par(a)} × ${b}`, ans: a * b }; },
    () => { const a = -ri(2, 9), b = -ri(2, 9); return { p: `${par(a)} × ${par(b)}`, ans: a * b }; },
    () => { const a = -ri(1, 9), b = ri(1, 9), c = ri(1, 9); return { p: `${par(a)} + ${b} − ${c}`, ans: a + b - c }; },
  ])();
  return numProb(t.p, t.ans, { allowNegative: true });
}

// ---- solve for x (equation builder) -------------------------------------
function equationProblem(level: number): Problem {
  if (level <= 1) {
    const x = ri(1, 12), b = ri(1, 12);
    return numProb(`${b} + x = ${x + b}`, x, { sub: "x = ?" });
  }
  if (level === 2) {
    const a = ri(2, 5), x = ri(1, 10), b = ri(1, 12);
    return numProb(`${a}x + ${b} = ${a * x + b}`, x, { sub: "x = ?" });
  }
  const t = pick([
    () => { const a = ri(2, 6), x = ri(2, 12), b = ri(1, 15); return { p: `${a}x − ${b} = ${a * x - b}`, x }; },
    () => { const a = ri(2, 5), x = -ri(1, 8), b = ri(1, 12); return { p: `${a}x + ${b} = ${a * x + b}`, x }; },
  ])();
  return numProb(t.p, t.x, { sub: "x = ?", allowNegative: true });
}

// ---- combining like terms (multiple choice) -----------------------------
function fmtLinear(coef: number, c: number): string {
  const parts: string[] = [];
  if (coef !== 0) {
    if (coef === 1) parts.push("x");
    else if (coef === -1) parts.push("−x");
    else parts.push(`${coef < 0 ? "−" : ""}${Math.abs(coef)}x`);
  }
  if (c !== 0) {
    if (parts.length === 0) parts.push(`${c < 0 ? "−" : ""}${Math.abs(c)}`);
    else parts.push(`${c < 0 ? "− " : "+ "}${Math.abs(c)}`);
  }
  return parts.length ? parts.join(" ") : "0";
}
function combineProblem(level: number): Problem {
  let a: number, b: number, c2: number, d: number, prompt: string;
  if (level <= 1) {
    a = ri(1, 6); b = ri(1, 9); c2 = ri(1, 6); d = ri(1, 9);
    prompt = `${a}x + ${b} + ${c2}x + ${d}`;
  } else if (level === 2) {
    a = ri(3, 8); b = ri(2, 9); c2 = ri(1, a - 1); d = ri(1, b);
    prompt = `${a}x + ${b} − ${c2}x − ${d}`;
    c2 = -c2; d = -d;
  } else {
    a = ri(2, 7); b = ri(1, 9); c2 = ri(2, 7) * (Math.random() < 0.5 ? -1 : 1); d = ri(1, 9) * (Math.random() < 0.5 ? -1 : 1);
    prompt = `${b} ${c2 < 0 ? "−" : "+"} ${Math.abs(c2)}x + ${a}x ${d < 0 ? "−" : "+"} ${Math.abs(d)}`;
  }
  const coef = a + c2;
  const cst = b + d;
  const correct = fmtLinear(coef, cst);
  const distractors = [
    fmtLinear(coef + cst, 0), // mashed every term into x
    fmtLinear(0, coef + cst), // mashed every term into a constant
    fmtLinear(coef, -cst), // flipped the constant's sign
    fmtLinear(a + Math.abs(c2), b + Math.abs(d)), // ignored subtraction
    fmtLinear(coef, cst + 1),
  ].filter((s) => s !== correct);
  return choiceProb(`Simplify:  ${prompt}`, correct, distractors);
}

// ---- fractions (multiple choice) ----------------------------------------
function fractionProblem(level: number): Problem {
  if (level <= 1) {
    const bases = [[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [1, 6], [5, 6]];
    const [n, d] = pick(bases);
    const k = ri(2, 5);
    const correct = `${n * k}/${d * k}`;
    const val = n / d;
    const pool = [`${n * k + 1}/${d * k}`, `${n * k}/${d * k + 1}`, `${n * (k + 1)}/${d * k}`, `${n * k}/${d * (k + 1)}`]
      .filter((s) => {
        const [pn, pd] = s.split("/").map(Number);
        return Math.abs(pn / pd - val) > 1e-9;
      });
    return choiceProb(`Which is equal to  ${n}/${d}?`, correct, pool);
  }
  if (level === 2) {
    const fracs: { s: string; v: number }[] = [];
    let guard = 0;
    while (fracs.length < 4 && guard++ < 200) {
      const d = ri(2, 9), n = ri(1, d - 1);
      const v = n / d;
      if (!fracs.some((f) => Math.abs(f.v - v) < 1e-9)) fracs.push({ s: `${n}/${d}`, v });
    }
    const best = fracs.reduce((m, f) => (f.v > m.v ? f : m), fracs[0]);
    return { prompt: "Which fraction is the largest?", answer: best.s, answerType: "choice", choices: shuffle(fracs.map((f) => f.s)) };
  }
  const bases = [[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [2, 5], [3, 5], [4, 5], [5, 6]];
  const [n, d] = pick(bases);
  const k = ri(2, 4);
  const correct = `${n}/${d}`;
  const val = n / d;
  const pool = [`${n * k}/${d * k}`, `${n}/${d * 2}`, `${n * 2}/${d}`, `${n + 1}/${d}`]
    .filter((s) => {
      const [pn, pd] = s.split("/").map(Number);
      return Math.abs(pn / pd - val) > 1e-9;
    });
  return choiceProb(`Simplify  ${n * k}/${d * k}`, correct, pool);
}

// ---- percents (percent bar) ---------------------------------------------
function percentProblem(level: number): Problem {
  const friendly = level <= 1 ? [10, 20, 25, 50, 75, 100] : [5, 15, 30, 40, 60, 80, 90];
  const p = pick(friendly);
  const step = 100 / gcd(p, 100);
  const W = step * ri(1, Math.max(2, Math.floor(160 / step)));
  const part = (p * W) / 100;
  if (level <= 2) {
    return numProb(`What is ${p}% of ${W}?`, part);
  }
  // level 3 — work backwards
  if (Math.random() < 0.5) {
    return numProb(`What percent of ${W} is ${part}?`, p, { sub: "answer in %" });
  }
  return numProb(`${p}% of what number is ${part}?`, W);
}

// ---- registry -----------------------------------------------------------
export const SKILLS: Skill[] = [
  {
    key: "order-of-operations",
    label: "Order of Operations",
    emoji: "🧮",
    blurb: "GEMS — evaluate the expression",
    toolRoute: "/order-of-operations",
    levels: ["No parentheses", "Parentheses", "Exponents & ÷"],
    generate: gemsProblem,
  },
  {
    key: "solve-for-x",
    label: "Solve for x",
    emoji: "⚖️",
    blurb: "One-step & two-step equations",
    toolRoute: "/equation-builder",
    levels: ["x + b = c", "ax + b = c", "Harder / negatives"],
    generate: equationProblem,
  },
  {
    key: "combine-like-terms",
    label: "Combine Like Terms",
    emoji: "🟰",
    blurb: "Simplify the expression",
    toolRoute: "/combine-like-terms",
    levels: ["All positive", "With subtraction", "Mixed order"],
    generate: combineProblem,
  },
  {
    key: "multiplication",
    label: "Multiplication Facts",
    emoji: "✖️",
    blurb: "Fast multiplication fluency",
    toolRoute: "/multiplication-fluency",
    levels: ["Up to 9×9", "Up to 12×12", "2-digit × 1-digit"],
    generate: multiplicationProblem,
  },
  {
    key: "percent",
    label: "Percents",
    emoji: "％",
    blurb: "Percent of a number",
    toolRoute: "/percent-bar",
    levels: ["Friendly %", "Trickier %", "Work backwards"],
    generate: percentProblem,
  },
  {
    key: "integers",
    label: "Integer Operations",
    emoji: "➕",
    blurb: "Add, subtract & multiply with negatives",
    toolRoute: "/number-line-plus",
    levels: ["Adding", "Subtracting", "Multiply / mixed"],
    generate: integerProblem,
  },
  {
    key: "fractions",
    label: "Fractions",
    emoji: "🍕",
    blurb: "Equivalent, compare & simplify",
    toolRoute: "/fraction-bars",
    levels: ["Equivalent", "Compare", "Simplify"],
    generate: fractionProblem,
  },
  // ---- Module 1 coverage (added 2026-07-26). No emoji: see CLAUDE.md rule 1.
  // standardId uses the dotted-letter form seeded in the `standards` table.
  {
    key: "gcf-lcm",
    label: "GCF and LCM",
    blurb: "Greatest common factor and least common multiple",
    toolRoute: "/ladder-method",
    standardId: "6.NS.B.4",
    levels: ["GCF", "LCM", "Decide which one"],
    generate: gcfLcmProblem,
  },
  {
    key: "prime-factorization",
    label: "Prime Factorization",
    blurb: "Break a number into its prime factors",
    toolRoute: "/ladder-method",
    standardId: "6.NS.B.4",
    levels: ["Factor tree", "Exponent form", "Rebuild the number"],
    generate: primeFactorizationProblem,
  },
  {
    key: "divisibility",
    label: "Divisibility Rules",
    blurb: "Decide what a number divides by without dividing",
    toolRoute: "/divisibility",
    standardId: "6.NS.B.4",
    levels: ["2, 5, 10", "3, 6, 9", "4, 8 and two rules at once"],
    generate: divisibilityProblem,
  },
  {
    key: "distributive",
    label: "Distributive Property",
    blurb: "Expand and factor with the area model",
    toolRoute: "/distributive-area",
    standardId: "6.EE.A.3",
    levels: ["Expand", "Factor out the GCF", "With a variable"],
    generate: distributiveDrill,
  },
  {
    key: "area",
    label: "Area of Shapes",
    blurb: "Rectangles, triangles, parallelograms, trapezoids",
    toolRoute: "/area-explorer",
    standardId: "6.G.A.1",
    levels: ["Rectangle and triangle", "Parallelogram and trapezoid", "Composite figures"],
    generate: areaProblem,
  },
  {
    key: "long-division",
    label: "Long Division",
    blurb: "Divide whole numbers and place the decimal",
    toolRoute: "/long-division",
    standardId: "6.NS.B.3",
    levels: ["1-digit divisor", "2-digit divisor", "Decimal quotient"],
    generate: longDivisionProblem,
  },
  // The next two have no tool route yet - a drill does not need one. Wire
  // toolRoute when the dividing-fractions and converting tools ship.
  {
    key: "divide-fractions",
    label: "Dividing Fractions",
    blurb: "How many groups fit inside",
    standardId: "6.NS.A.1",
    levels: ["Whole by a unit fraction", "Fraction by a fraction", "Word problems"],
    generate: divideFractionsProblem,
  },
  {
    key: "convert-fdp",
    label: "Fraction, Decimal, Percent",
    blurb: "Same value, three ways",
    standardId: "6.RP.A.3c",
    levels: ["Fraction to percent", "Decimal to percent", "All three ways"],
    generate: convertFdpProblem,
  },
];

export function getSkill(key: string): Skill | undefined {
  return SKILLS.find((s) => s.key === key);
}

// Lenient answer check: trims, treats unicode/ascii minus the same, ignores
// trailing % and surrounding spaces. Numbers compare numerically.
export function checkAnswer(input: string, problem: Problem): boolean {
  const norm = (s: string) =>
    s.trim().replace(/−/g, "-").replace(/\s+/g, "").replace(/%$/, "").toLowerCase();
  const a = norm(input);
  const b = norm(problem.answer);
  if (!a) return false;
  if (problem.answerType === "number") {
    const na = Number(a);
    const nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na === nb;
  }
  return a === b;
}
