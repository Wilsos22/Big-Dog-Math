"use client";

// The Monday table-captain spinner.
//
// One captain per table, for the week. The teacher taps Spin on the iPad while
// the table-captains slide is up; every table's card reels through names and
// lands, one after another, so the room watches ten picks instead of one. The
// week's result is saved, so re-opening the slide on Wednesday shows Monday's
// captains rather than an empty grid, and a deliberate re-spin overwrites them.
//
// WHY IT WORKS WITHOUT A SEATING CHART. The API returns a candidate pool per
// table. Until the Workspace roster Sheet carries a Table column, every pool is
// the whole period, and this component's job is to keep the ten picks DISTINCT.
// Once the Sheet has tables, each pool narrows to the students who actually sit
// there and nothing here changes. The distinct-pick guard stays correct either
// way, because a seated pool cannot overlap another table's.
//
// FERPA: aliases on the wire and in storage, first names at render only, and
// only through the name key loaded in THIS browser (present runs on the
// classroom laptop). No key means aliases show - never a district name. This is
// the same deliberate room-facing exception the reader spinner carries: a kid
// disowns an alias and derails the spin, and the captain gets called by name
// all week anyway.
//
// Fair rotation across weeks lives in this browser's localStorage: every
// student captains once before anyone repeats.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { firstNameLabelMap, loadNameKey } from "@/lib/teacherNameKey";
import { teacherApiRequest } from "@/lib/teacherApi";
import type { TeacherRemoteCommand } from "@/lib/liveClassFlow";
import { DEFAULT_TABLE_COUNT, tableLabel, type TableCaptain } from "@/lib/tableCaptains";

const FAIR_ROTATION_PREFIX = "bdm-table-captain-fair-v1";
const REEL_TICKS = 12;
const CARD_STAGGER_MS = 260;

interface Candidate {
  id: string;
  alias: string;
}

interface CaptainsResponse {
  periodId: string;
  weekStart: string;
  tableCount: number;
  seatingKnown: boolean;
  tables: { tableNumber: number; candidates: Candidate[] }[];
  captains: TableCaptain[];
}

function shuffled<T>(items: T[]): T[] {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function readUsedIds(periodId: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(`${FAIR_ROTATION_PREFIX}:${periodId}`);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

function writeUsedIds(periodId: string, ids: Set<string>): void {
  try {
    window.localStorage.setItem(`${FAIR_ROTATION_PREFIX}:${periodId}`, JSON.stringify([...ids]));
  } catch {
    /* private mode or quota - rotation just restarts, which is acceptable */
  }
}

/**
 * One captain per table, nobody picked twice in the same spin, and everyone
 * gets a turn before anyone repeats across weeks.
 *
 * Tables are drawn SMALLEST POOL FIRST. With a real seating chart that ordering
 * is irrelevant, but with no seating chart it is what stops a table being left
 * with nothing to draw from: the constrained tables commit while the field is
 * still open. When a pool is genuinely exhausted the table returns null rather
 * than stealing another table's pick - an empty card is honest, a duplicate
 * captain is a fight.
 */
function pickCaptains(
  tables: { tableNumber: number; candidates: Candidate[] }[],
  usedIds: Set<string>,
): { picks: Map<number, Candidate>; nextUsedIds: Set<string> } {
  const liveIds = new Set(tables.flatMap((table) => table.candidates.map((candidate) => candidate.id)));
  let served = new Set([...usedIds].filter((id) => liveIds.has(id)));
  const takenThisSpin = new Set<string>();
  const picks = new Map<number, Candidate>();

  const order = [...tables].sort((a, b) => a.candidates.length - b.candidates.length);
  for (const table of order) {
    const available = table.candidates.filter((candidate) => !takenThisSpin.has(candidate.id));
    if (!available.length) continue;
    let pool = available.filter((candidate) => !served.has(candidate.id));
    if (!pool.length) {
      // Everyone in reach has captained already. Start a fresh cycle, but keep
      // this spin's picks reserved so the reset cannot produce a duplicate.
      served = new Set(takenThisSpin);
      pool = available;
    }
    const pick = shuffled(pool)[0];
    picks.set(table.tableNumber, pick);
    takenThisSpin.add(pick.id);
    served.add(pick.id);
  }

  return { picks, nextUsedIds: served };
}

interface TableCaptainSpinnerProps {
  sessionId: string | null | undefined;
  periodId: string | null | undefined;
  remoteCommand: TeacherRemoteCommand | null | undefined;
  /** The state this spinner belongs to, so a readers spin cannot fire it. */
  expectedStateId?: string;
}

export default function TableCaptainSpinner({
  sessionId,
  periodId,
  remoteCommand,
  expectedStateId = "table-captains",
}: TableCaptainSpinnerProps) {
  const [data, setData] = useState<CaptainsResponse | null>(null);
  const [landed, setLanded] = useState<Map<number, string>>(new Map());
  const [reeling, setReeling] = useState<Map<number, string>>(new Map());
  const [spinning, setSpinning] = useState(false);
  const handledNonce = useRef<string | null>(null);
  const timers = useRef<number[]>([]);

  const firstNames = useMemo(() => firstNameLabelMap(loadNameKey()), []);
  const toFirstName = useCallback(
    (alias: string) => firstNames.get(alias.trim().toLowerCase()) ?? alias,
    [firstNames],
  );

  useEffect(() => {
    if (!periodId && !sessionId) return;
    let cancelled = false;
    const params = new URLSearchParams();
    if (periodId) params.set("periodId", periodId);
    if (sessionId) params.set("sessionId", sessionId);
    void teacherApiRequest<CaptainsResponse>(`/api/teacher/table-captains?${params.toString()}`)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        // Show the week's saved captains straight away - opening this slide on
        // a Wednesday is a reminder, not a re-spin.
        setLanded(new Map(result.captains.map((captain) => [captain.tableNumber, captain.alias])));
      })
      .catch(() => {
        /* leave empty; a spin with no roster is a no-op */
      });
    return () => {
      cancelled = true;
    };
  }, [periodId, sessionId]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }, []);

  const spin = useCallback(() => {
    if (!data || !data.tables.length) return;
    clearTimers();
    const { picks, nextUsedIds } = pickCaptains(data.tables, readUsedIds(data.periodId));
    if (!picks.size) return;
    writeUsedIds(data.periodId, nextUsedIds);

    setSpinning(true);
    setLanded(new Map());
    setReeling(new Map());

    let lastLandingAt = 0;
    data.tables.forEach((table, index) => {
      const pick = picks.get(table.tableNumber);
      if (!pick) return;
      const pool = table.candidates.map((candidate) => toFirstName(candidate.alias));
      const start = index * CARD_STAGGER_MS;
      let elapsed = start;
      for (let tick = 0; tick < REEL_TICKS; tick += 1) {
        elapsed += 45 + tick * tick * 1.1;
        timers.current.push(
          window.setTimeout(() => {
            setReeling((current) => {
              const next = new Map(current);
              next.set(table.tableNumber, pool[Math.floor(Math.random() * pool.length)] ?? "");
              return next;
            });
          }, elapsed),
        );
      }
      const landAt = elapsed + 200;
      lastLandingAt = Math.max(lastLandingAt, landAt);
      timers.current.push(
        window.setTimeout(() => {
          setReeling((current) => {
            const next = new Map(current);
            next.delete(table.tableNumber);
            return next;
          });
          setLanded((current) => {
            const next = new Map(current);
            next.set(table.tableNumber, pick.alias);
            return next;
          });
        }, landAt),
      );
    });

    timers.current.push(
      window.setTimeout(() => {
        setSpinning(false);
        // Save once, after the whole grid has landed, so a mid-spin save can
        // never persist half a week's captains.
        void teacherApiRequest("/api/teacher/table-captains", {
          method: "POST",
          body: JSON.stringify({
            sessionId: sessionId ?? undefined,
            periodId: data.periodId,
            weekStart: data.weekStart,
            captains: [...picks.entries()].map(([tableNumber, pick]) => ({
              tableNumber,
              studentId: pick.id,
              alias: pick.alias,
            })),
          }),
        }).catch(() => {
          /* the wall is still correct; the teacher can re-spin if it did not save */
        });
      }, lastLandingAt + 120),
    );
  }, [data, sessionId, toFirstName, clearTimers]);

  useEffect(() => {
    if (!remoteCommand || remoteCommand.action !== "spin-spinner") return;
    if (remoteCommand.stateId !== expectedStateId) return;
    if (remoteCommand.nonce === handledNonce.current) return;
    handledNonce.current = remoteCommand.nonce;
    spin();
  }, [remoteCommand, expectedStateId, spin]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const tableCount = data?.tableCount ?? DEFAULT_TABLE_COUNT;
  const cards = Array.from({ length: tableCount }, (_, index) => index + 1);
  const filled = cards.filter((tableNumber) => landed.has(tableNumber)).length;

  return (
    <div className="tcs-root">
      <div className="tcs-head">
        <span className="tcs-kicker">This week&apos;s table captains</span>
        <span className="tcs-sub">
          {spinning
            ? "Spinning"
            : filled
              ? "Your captain answers for your table's supplies every day this week"
              : "Waiting on the spin"}
        </span>
      </div>
      <div className="tcs-grid" role="list">
        {cards.map((tableNumber) => {
          const alias = landed.get(tableNumber);
          const reel = reeling.get(tableNumber);
          return (
            <div
              key={tableNumber}
              role="listitem"
              className={`tcs-card${alias ? " is-landed" : ""}${reel ? " is-reeling" : ""}`}
            >
              <span className="tcs-table">{tableLabel(tableNumber)}</span>
              <span className="tcs-name">
                {alias ? toFirstName(alias) : reel || "—"}
              </span>
            </div>
          );
        })}
      </div>
      <style>{`
        .tcs-root { display:grid; gap:clamp(14px,2.4vh,30px); width:100%; height:100%;
          align-content:center; justify-items:center; padding:clamp(12px,2vw,32px); }
        .tcs-head { display:grid; justify-items:center; gap:6px; text-align:center; }
        .tcs-kicker { color:var(--acc-deep, #3c7d7e); font-size:clamp(1rem,2.2vw,1.9rem); font-weight:900;
          letter-spacing:0.14em; text-transform:uppercase; }
        .tcs-sub { color:var(--body, #6f675c); font-size:clamp(0.85rem,1.5vw,1.25rem); font-weight:600; }
        .tcs-grid { display:grid; gap:clamp(8px,1.2vw,18px); width:100%;
          grid-template-columns:repeat(auto-fit, minmax(min(210px, 30%), 1fr)); }
        .tcs-card { display:grid; gap:4px; align-content:center; justify-items:center; min-height:clamp(84px,11vh,140px);
          padding:clamp(8px,1.2vw,18px); border:1px solid var(--hair, #ece4d4); border-radius:18px;
          background:var(--card, #fff); box-shadow:0 14px 34px -26px rgba(32,30,26,0.7); }
        .tcs-card.is-landed { border-color:var(--acc, #50a3a4); border-top-width:6px; border-top-style:solid; }
        .tcs-table { color:var(--body, #6f675c); font-size:clamp(0.7rem,1.1vw,1rem); font-weight:800;
          letter-spacing:0.12em; text-transform:uppercase; }
        .tcs-name { color:var(--head, #201e1a); font-size:clamp(1.3rem,3vw,2.6rem); line-height:1.02;
          font-weight:800; letter-spacing:-0.02em; text-align:center; text-wrap:balance; }
        .tcs-card.is-reeling .tcs-name { color:var(--body, #6f675c); opacity:0.75; }
        .tcs-card.is-landed .tcs-name { color:var(--acc-deep, #3c7d7e); animation:tcs-pop 0.34s ease-out; }
        @keyframes tcs-pop { 0% { transform:scale(0.88); opacity:0.4; } 60% { transform:scale(1.05); } 100% { transform:scale(1); opacity:1; } }
        @media (prefers-reduced-motion: reduce) { .tcs-card.is-landed .tcs-name { animation:none; } }
      `}</style>
    </div>
  );
}
