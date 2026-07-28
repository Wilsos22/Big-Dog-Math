"use client";

// The ranked visit list for the private iPad Remote.
//
// This replaced named work stations with staged movement. Nobody moves: the
// teacher walks a ranked list and taps each student off it, so what stays on
// screen is always WHO HAS NOT BEEN REACHED. At minute 46 that is the answer
// the teacher actually needs, and no seating chart can give it.
//
// PRIVACY: teacher-only, always. No student ever sees their own tier, another
// student's status, a group name, or a count, and none of this may reach a
// public projector. It renders only inside the private Remote.

import { useCallback, useEffect, useRef, useState } from "react";
import type { VisitCheckInStatus, VisitList, VisitTier } from "@/lib/visitList";

type PanelState = VisitList & {
  lessonCode: string;
  questionCount: number;
  /** False until visit-check-ins.sql has been hand-run in Supabase. */
  checkInsAvailable: boolean;
};

const POLL_MS = 6000;

const TIER_ACCENT: Record<VisitTier, string> = {
  1: "#c93818",
  2: "#c07a12",
  3: "#3c7d7e",
  4: "#6f675c",
};

const CHECK_IN_LABEL: Record<VisitCheckInStatus, string> = {
  "got-it": "Got it",
  partly: "Partly",
  "still-stuck": "Still stuck",
};

const CHECK_IN_ORDER: VisitCheckInStatus[] = ["got-it", "partly", "still-stuck"];

export default function VisitListPanel({ sessionId }: { sessionId: string }) {
  const [state, setState] = useState<PanelState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/live/visit-list?sessionId=${encodeURIComponent(sessionId)}`,
        { cache: "no-store" },
      );
      const body = await response.json();
      if (!response.ok) {
        setError(body.error || `The visit list is unavailable (${response.status}).`);
        return;
      }
      setState(body);
      setError(null);
    } catch {
      setError("The visit list could not reach the server.");
    }
  }, [sessionId]);

  useEffect(() => {
    void refresh();
    timerRef.current = setInterval(() => void refresh(), POLL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [refresh]);

  const checkIn = useCallback(
    async (studentKey: string, displayName: string, status: VisitCheckInStatus) => {
      setBusy(`${studentKey}|${status}`);
      setError(null);
      try {
        const response = await fetch("/api/live/visit-list", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId, studentKey, displayName, status }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          setError(body.error || `That check-in did not save (${response.status}).`);
          return;
        }
        await refresh();
      } catch {
        setError("That check-in did not reach the server.");
      } finally {
        setBusy(null);
      }
    },
    [refresh, sessionId],
  );

  const rows = state?.rows || [];
  const reached = state?.cleared.length || 0;
  const unreached = state?.unreached || 0;

  return (
    <section className="vlp" aria-label="Visit list, private">
      <style>{`
        /* Matches the Remote's private-section card language (see .private-plan
           and .crp): tinted panel, 5px accent left border, white inner cards,
           uppercase micro-labels. Coral family so the walking order reads as
           more urgent than the teal City Routes panel beside it. */
        .vlp { display:grid; gap:10px; border:1px solid #e4c6bc; border-left:5px solid #c93818; border-radius:15px; background:#fdf4f1; padding:13px; color:#28241e; font-family:var(--bdb-font); }
        .vlp-head { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
        .vlp-title { margin:0; color:#a33518; font-size:0.7rem; font-weight:900; letter-spacing:0.11em; text-transform:uppercase; }
        .vlp-chip { font-size:0.6rem; font-weight:900; letter-spacing:0.08em; text-transform:uppercase; padding:3px 9px; border-radius:999px; border:1px solid #d9c9c2; background:#fff; color:#6f675c; }
        .vlp-chip.clear { border-color:#9ed3b4; background:#eefaf2; color:#1f7a52; }
        .vlp-note { margin:0; color:#7b6b64; font-size:0.68rem; font-weight:730; }
        .vlp-warn { margin:0; border:1px solid #e0b8ac; border-radius:10px; background:#fff; padding:10px 12px; color:#a33518; font-size:0.82rem; font-weight:850; line-height:1.4; }
        .vlp-rows { display:grid; gap:8px; }
        .vlp-row { border:1px solid #e6d9d3; border-left:4px solid var(--vlp-accent); border-radius:10px; background:#fff; padding:10px 12px; display:grid; gap:7px; }
        .vlp-row-head { display:flex; align-items:baseline; gap:8px; flex-wrap:wrap; }
        .vlp-tier { font-size:0.58rem; font-weight:900; letter-spacing:0.1em; text-transform:uppercase; color:var(--vlp-accent); }
        .vlp-names { margin:0; font-size:0.95rem; font-weight:900; color:#28241e; }
        .vlp-headline { margin:0; color:#5e534c; font-size:0.75rem; font-weight:750; line-height:1.4; }
        .vlp-taps { display:flex; gap:6px; flex-wrap:wrap; }
        .vlp-tap { font:inherit; font-size:0.7rem; font-weight:850; min-height:40px; padding:0 12px; border-radius:9px; border:1px solid #c9c1b2; background:#fff; color:#28241e; cursor:pointer; }
        .vlp-tap:hover:not(:disabled) { border-color:#c93818; }
        .vlp-tap:disabled { opacity:0.45; cursor:default; }
        .vlp-tap.got-it { border-color:#9ed3b4; color:#1f7a52; }
        .vlp-group-taps { display:grid; gap:5px; }
        .vlp-group-row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .vlp-group-name { font-size:0.8rem; font-weight:850; min-width:8ch; }
        .vlp-cleared { display:flex; gap:6px; flex-wrap:wrap; }
        .vlp-cleared-chip { font-size:0.62rem; font-weight:850; padding:3px 9px; border-radius:999px; border:1px solid #d9c9c2; background:#fff; color:#6f675c; }
        .vlp-error { margin:0; color:#a33518; font-size:0.7rem; font-weight:800; }
      `}</style>

      <div className="vlp-head">
        <h2 className="vlp-title">Visit list</h2>
        {/* The number that matters at minute 46. */}
        <span className={`vlp-chip${unreached === 0 ? " clear" : ""}`}>
          {unreached === 0 ? "Everyone reached" : `${unreached} not reached`}
        </span>
        {reached > 0 ? <span className="vlp-chip">{reached} checked in</span> : null}
      </div>

      {error ? <p className="vlp-error">{error}</p> : null}

      {state && !state.checkInsAvailable ? (
        /* Without the table the taps cannot save, and a list that refuses to
           shorten is worse than no list - say so rather than let the teacher
           tap into nothing. */
        <p className="vlp-warn">
          Check-ins are not saving yet. Run supabase/visit-check-ins.sql in the Supabase SQL Editor.
        </p>
      ) : null}

      {state?.reteach ? (
        /* Routing is sometimes the wrong answer, and the list has to say so
           instead of handing over sixteen names. */
        <p className="vlp-warn">
          Stop and reteach: {state.reteach.count} of {state.reteach.total} show &ldquo;{state.reteach.error}&rdquo;.
          Walking this one at a time will not fix it.
        </p>
      ) : null}

      {!state ? (
        <p className="vlp-note">Reading the readiness checks.</p>
      ) : rows.length === 0 ? (
        <p className="vlp-note">
          {state.cleared.length || state.leaveAlone.length
            ? "Nobody is waiting. Every student has been reached or is working independently."
            : "No readiness answers yet. The list fills in as students respond."}
        </p>
      ) : (
        <div className="vlp-rows">
          {rows.map((row) => (
            <article
              className="vlp-row"
              key={row.id}
              style={{ "--vlp-accent": TIER_ACCENT[row.tier] } as React.CSSProperties}
            >
              <div className="vlp-row-head">
                <span className="vlp-tier">{row.tierLabel}</span>
                <p className="vlp-names">{row.students.map((student) => student.name).join(", ")}</p>
              </div>
              <p className="vlp-headline">{row.headline}</p>
              {row.grouped ? (
                /* One stop, but each student still clears individually - the
                   teacher rarely reaches all nine in one pass. */
                <div className="vlp-group-taps">
                  {row.students.map((student) => (
                    <div className="vlp-group-row" key={student.studentKey}>
                      <span className="vlp-group-name">{student.name}</span>
                      {CHECK_IN_ORDER.map((status) => (
                        <button
                          className={`vlp-tap ${status}`}
                          key={status}
                          type="button"
                          disabled={busy !== null}
                          onClick={() => void checkIn(student.studentKey, student.name, status)}
                        >
                          {CHECK_IN_LABEL[status]}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="vlp-taps">
                  {CHECK_IN_ORDER.map((status) => (
                    <button
                      className={`vlp-tap ${status}`}
                      key={status}
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void checkIn(row.students[0].studentKey, row.students[0].name, status)}
                    >
                      {CHECK_IN_LABEL[status]}
                    </button>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {state && state.cleared.length > 0 ? (
        <div className="vlp-cleared">
          {state.cleared.map((entry) => (
            <span className="vlp-cleared-chip" key={entry.studentKey}>
              {entry.name}: {CHECK_IN_LABEL[entry.status]}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
