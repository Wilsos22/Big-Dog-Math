"use client";

// The closeout supply check, on two surfaces.
//
//   mode="remote"  the iPad. Tappable. Tapping a table's card marks it GREEN,
//                  because most tables are fine and the common case should cost
//                  one tap. The small Missing control marks it RED. Either tap
//                  overwrites the other, so a mis-tap is fixed by tapping again
//                  rather than by finding an undo.
//   mode="board"   the main projector at closeout. Read-only, polls, and fills
//                  in live as the teacher taps - the room watches its own status
//                  appear, which is the entire accountability loop.
//
// The rule the colours encode is Steele's: CONSECUTIVE misses. Two reds in a
// row and the table is flagged for the privilege conversation; any green wipes
// the streak. The card shows "one away" after a single miss precisely so the
// captain hears the warning BEFORE the consequence, not after.
//
// FERPA: the captain rides as an ALIAS and renders as a first name only through
// the name key loaded in THIS browser - the same deliberate room-facing
// exception the spinners carry, and for the same reason: a table needs to know
// which person is answering for it, and the teacher says that name out loud
// anyway. No key loaded means the alias shows. Nothing here writes a name.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { firstNameLabelMap, loadNameKey } from "@/lib/teacherNameKey";
import { teacherApiRequest } from "@/lib/teacherApi";
import {
  DEFAULT_TABLE_COUNT,
  STANDING_LABELS,
  standingFromStreak,
  tableLabel,
  type SupplyStatus,
  type TableStanding,
} from "@/lib/tableCaptains";

const BOARD_POLL_MS = 2500;

interface SupplyTable {
  tableNumber: number;
  status: SupplyStatus | null;
  missing: string | null;
  captainAlias: string | null;
  redStreak: number;
  redTotal: number;
  checksTotal: number;
  lastChecked: string | null;
  standing: TableStanding;
}

interface SupplyCheckResponse {
  sessionId: string;
  periodId: string;
  classDate: string;
  weekStart: string;
  tables: SupplyTable[];
}

interface SupplyCheckBoardProps {
  sessionId: string | null | undefined;
  mode: "board" | "remote";
}

function emptyTables(count: number): SupplyTable[] {
  return Array.from({ length: count }, (_, index) => ({
    tableNumber: index + 1,
    status: null,
    missing: null,
    captainAlias: null,
    redStreak: 0,
    redTotal: 0,
    checksTotal: 0,
    lastChecked: null,
    standing: "clear" as TableStanding,
  }));
}

export default function SupplyCheckBoard({ sessionId, mode }: SupplyCheckBoardProps) {
  const [tables, setTables] = useState<SupplyTable[]>(() => emptyTables(DEFAULT_TABLE_COUNT));
  const [error, setError] = useState<string | null>(null);
  const [busyTable, setBusyTable] = useState<number | null>(null);
  const mounted = useRef(true);

  const firstNames = useMemo(() => firstNameLabelMap(loadNameKey()), []);
  const toFirstName = useCallback(
    (alias: string | null) => (alias ? firstNames.get(alias.trim().toLowerCase()) ?? alias : null),
    [firstNames],
  );

  const load = useCallback(async () => {
    if (!sessionId) return;
    try {
      const result = await teacherApiRequest<SupplyCheckResponse>(
        `/api/teacher/supply-check?sessionId=${encodeURIComponent(sessionId)}`,
      );
      if (!mounted.current) return;
      setTables(result.tables?.length ? result.tables : emptyTables(DEFAULT_TABLE_COUNT));
      setError(null);
    } catch (loadError) {
      if (!mounted.current) return;
      setError(loadError instanceof Error ? loadError.message : "Could not read the supply check.");
    }
  }, [sessionId]);

  useEffect(() => {
    mounted.current = true;
    void load();
    // Only the projector polls. The iPad is the thing generating the taps, so
    // it already knows; polling there would just fight the optimistic update.
    if (mode !== "board") {
      return () => {
        mounted.current = false;
      };
    }
    const timer = window.setInterval(() => void load(), BOARD_POLL_MS);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
    };
  }, [load, mode]);

  const mark = useCallback(
    async (tableNumber: number, status: SupplyStatus) => {
      if (!sessionId || busyTable) return;
      setBusyTable(tableNumber);
      // Optimistic: the tap has to feel instant with thirty kids waiting to be
      // dismissed. The server answer overwrites it a moment later.
      setTables((current) =>
        current.map((table) =>
          table.tableNumber === tableNumber ? { ...table, status, missing: null } : table,
        ),
      );
      try {
        const result = await teacherApiRequest<{
          tableNumber: number;
          status: SupplyStatus;
          redStreak: number;
          redTotal: number;
          checksTotal: number;
          standing: TableStanding;
        }>("/api/teacher/supply-check", {
          method: "POST",
          body: JSON.stringify({ sessionId, tableNumber, status }),
        });
        if (!mounted.current) return;
        setTables((current) =>
          current.map((table) =>
            table.tableNumber === tableNumber
              ? {
                  ...table,
                  status: result.status,
                  redStreak: result.redStreak,
                  redTotal: result.redTotal,
                  checksTotal: result.checksTotal,
                  standing: result.standing,
                }
              : table,
          ),
        );
        setError(null);
      } catch (markError) {
        if (!mounted.current) return;
        setError(markError instanceof Error ? markError.message : "That tap did not save.");
        void load();
      } finally {
        if (mounted.current) setBusyTable(null);
      }
    },
    [sessionId, busyTable, load],
  );

  const checked = tables.filter((table) => table.status).length;
  const flagged = tables.filter((table) => standingFromStreak(table.redStreak) === "flagged");

  if (mode === "board") {
    return (
      <div className="scb-board">
        <div className="scb-board-head">
          <span className="scb-board-kicker">Supplies away, area clean</span>
          <span className="scb-board-sub">
            Captains, answer for your table. {checked} of {tables.length} checked.
          </span>
        </div>
        <div className="scb-board-grid" role="list">
          {tables.map((table) => {
            const captain = toFirstName(table.captainAlias);
            const standing = standingFromStreak(table.redStreak);
            return (
              <div
                key={table.tableNumber}
                role="listitem"
                className={`scb-board-card${table.status ? ` is-${table.status}` : ""}`}
              >
                <span className="scb-board-table">{tableLabel(table.tableNumber)}</span>
                <span className="scb-board-captain">{captain || "No captain set"}</span>
                {table.status === "red" && standing !== "clear" ? (
                  <span className="scb-board-standing">{STANDING_LABELS[standing]}</span>
                ) : null}
              </div>
            );
          })}
        </div>
        <style>{`
          .scb-board { display:grid; gap:clamp(12px,2vh,26px); width:100%; height:100%;
            align-content:center; justify-items:center; padding:clamp(12px,2vw,32px); }
          .scb-board-head { display:grid; justify-items:center; gap:6px; text-align:center; }
          .scb-board-kicker { color:var(--acc-deep, #3c7d7e); font-size:clamp(1rem,2.2vw,1.9rem); font-weight:900;
            letter-spacing:0.14em; text-transform:uppercase; }
          .scb-board-sub { color:var(--body, #6f675c); font-size:clamp(0.85rem,1.5vw,1.25rem); font-weight:600; }
          .scb-board-grid { display:grid; gap:clamp(8px,1.2vw,18px); width:100%;
            grid-template-columns:repeat(auto-fit, minmax(min(200px, 30%), 1fr)); }
          .scb-board-card { display:grid; gap:3px; align-content:center; justify-items:center;
            min-height:clamp(78px,10vh,132px); padding:clamp(8px,1.2vw,18px);
            border:1px solid var(--hair, #ece4d4); border-top:6px solid var(--hair, #ece4d4); border-radius:18px;
            background:var(--card, #fff); box-shadow:0 14px 34px -26px rgba(32,30,26,0.7);
            transition:border-color 0.2s ease, background 0.2s ease; }
          .scb-board-card.is-green { border-color:#2f9e6f; border-top-color:#2f9e6f; background:#f0faf5; }
          .scb-board-card.is-red { border-color:#f95335; border-top-color:#f95335; background:#fdf3f0; }
          .scb-board-table { color:var(--body, #6f675c); font-size:clamp(0.68rem,1.1vw,1rem); font-weight:800;
            letter-spacing:0.12em; text-transform:uppercase; }
          .scb-board-captain { color:var(--head, #201e1a); font-size:clamp(1.1rem,2.4vw,2.1rem); line-height:1.04;
            font-weight:800; letter-spacing:-0.02em; text-align:center; text-wrap:balance; }
          .scb-board-standing { color:#c2371c; font-size:clamp(0.62rem,1vw,0.9rem); font-weight:900;
            letter-spacing:0.08em; text-transform:uppercase; }
        `}</style>
      </div>
    );
  }

  return (
    <section className="scb" aria-label="Closeout supply check, private">
      <div className="scb-head">
        <h3 className="scb-title">Supply check</h3>
        <span className={`scb-chip${checked === tables.length ? " clear" : ""}`}>
          {checked} of {tables.length}
        </span>
      </div>
      <p className="scb-note">Tap a table for all clear. Tap Missing if something did not come back.</p>
      {flagged.length ? (
        <p className="scb-warn">
          {flagged.map((table) => tableLabel(table.tableNumber)).join(", ")}
          {flagged.length === 1 ? " has" : " have"} missed twice in a row. Site privilege paused until a clean day.
        </p>
      ) : null}
      <div className="scb-rows">
        {tables.map((table) => {
          const captain = toFirstName(table.captainAlias);
          const standing = standingFromStreak(table.redStreak);
          return (
            <div key={table.tableNumber} className={`scb-row${table.status ? ` is-${table.status}` : ""}`}>
              <button
                type="button"
                className="scb-main"
                disabled={!sessionId || busyTable === table.tableNumber}
                onClick={() => void mark(table.tableNumber, "green")}
              >
                <span className="scb-table">{tableLabel(table.tableNumber)}</span>
                <span className="scb-captain">{captain || "No captain"}</span>
                {standing !== "clear" ? (
                  <span className={`scb-standing ${standing}`}>{STANDING_LABELS[standing]}</span>
                ) : null}
              </button>
              <button
                type="button"
                className={`scb-miss${table.status === "red" ? " is-on" : ""}`}
                disabled={!sessionId || busyTable === table.tableNumber}
                onClick={() => void mark(table.tableNumber, "red")}
              >
                Missing
              </button>
            </div>
          );
        })}
      </div>
      {error ? <p className="scb-error">{error}</p> : null}
      <style>{`
        /* Matches the Remote's private-section card language (see .vlp and
           .private-plan): tinted panel, 5px accent left border, white inner
           cards, uppercase micro-labels. Green family because most of this
           panel's life is confirming a room that is fine. */
        .scb { display:grid; gap:10px; border:1px solid #bfdccc; border-left:5px solid #2f9e6f; border-radius:15px; background:#f2faf6; padding:13px; color:#28241e; font-family:var(--bdb-font); }
        .scb-head { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
        .scb-title { margin:0; color:#1f7a52; font-size:0.7rem; font-weight:900; letter-spacing:0.11em; text-transform:uppercase; }
        .scb-chip { font-size:0.6rem; font-weight:900; letter-spacing:0.08em; text-transform:uppercase; padding:3px 9px; border-radius:999px; border:1px solid #c9d9cf; background:#fff; color:#6f675c; }
        .scb-chip.clear { border-color:#9ed3b4; background:#eefaf2; color:#1f7a52; }
        .scb-note { margin:0; color:#6b7b71; font-size:0.68rem; font-weight:730; }
        .scb-warn { margin:0; border:1px solid #e0b8ac; border-radius:10px; background:#fff; padding:10px 12px; color:#a33518; font-size:0.8rem; font-weight:850; line-height:1.4; }
        .scb-rows { display:grid; gap:8px; }
        .scb-row { display:flex; align-items:stretch; gap:8px; }
        .scb-main { flex:1; font:inherit; text-align:left; display:grid; gap:2px; min-height:52px; padding:8px 12px; border:1px solid #d8e3dc; border-left:4px solid #d8e3dc; border-radius:10px; background:#fff; color:#28241e; cursor:pointer; }
        .scb-main:disabled, .scb-miss:disabled { opacity:0.45; cursor:default; }
        .scb-row.is-green .scb-main { border-color:#9ed3b4; border-left-color:#2f9e6f; background:#f4fbf7; }
        .scb-row.is-red .scb-main { border-color:#e0b8ac; border-left-color:#c93818; background:#fdf6f4; }
        .scb-table { font-size:0.58rem; font-weight:900; letter-spacing:0.1em; text-transform:uppercase; color:#6b7b71; }
        .scb-captain { font-size:0.92rem; font-weight:900; color:#28241e; }
        .scb-standing { font-size:0.58rem; font-weight:900; letter-spacing:0.09em; text-transform:uppercase; }
        .scb-standing.warning { color:#a86735; }
        .scb-standing.flagged { color:#a33518; }
        .scb-miss { font:inherit; font-size:0.68rem; font-weight:850; min-width:76px; min-height:52px; padding:0 10px; border-radius:10px; border:1px solid #c9c1b2; background:#fff; color:#6f675c; cursor:pointer; }
        .scb-miss.is-on { border-color:#c93818; background:#fdf3f0; color:#a33518; }
        .scb-error { margin:0; color:#a33518; font-size:0.7rem; font-weight:800; }
      `}</style>
    </section>
  );
}
