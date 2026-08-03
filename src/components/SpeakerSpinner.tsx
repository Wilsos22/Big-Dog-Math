"use client";

// The on-demand speaker spinner. The teacher taps "Pick a speaker" on the iPad
// (a `spin-speaker` remote command); this overlay - mounted on the main projector
// only - shuffles and lands on ONE student, ANY time, in any state. It is
// deliberately separate from ClassroomSpinner, which is a full scene bound to the
// readers / iPad-Kid slides.
//
// FERPA: the roster fetch and the fair rotation carry ALIASES; only the render
// resolves the first name, and only through the name key loaded in THIS browser
// (present runs on the classroom laptop). No key = the alias shows, never a
// district name, and student devices never mount this at all.
//
// Fair rotation lives in this browser's localStorage: every student is called
// once before anyone repeats, then the cycle resets. The remaining count is
// deliberately NEVER shown - a student who can count the names left knows when
// they are "safe."

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { firstNameLabelMap, loadNameKey } from "@/lib/teacherNameKey";
import { teacherApiRequest } from "@/lib/teacherApi";
import type { TeacherRemoteCommand } from "@/lib/liveClassFlow";

const FAIR_ROTATION_KEY = "bdm-speaker-spinner-fair-v1";
const HOLD_MS = 9000;

interface SpeakerStudent {
  id: string;
  alias: string;
}

interface SpeakerRosterResponse {
  students: { id: string; fullName: string }[];
  source: "session" | "period";
}

function shuffled<T>(items: T[]): T[] {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

// One fair pick. Every student is drawn once before anyone repeats; when the
// pool of unused students empties, the cycle resets on the next pick. Scoped by
// the live student id set, so a roster change never strands stale ids forever.
function pickFair(
  students: SpeakerStudent[],
  usedIds: Set<string>,
): { pick: SpeakerStudent; nextUsedIds: Set<string> } | null {
  if (!students.length) return null;
  const liveIds = new Set(students.map((student) => student.id));
  const validUsed = new Set([...usedIds].filter((id) => liveIds.has(id)));
  const unused = students.filter((student) => !validUsed.has(student.id));
  if (unused.length === 0) {
    // Everyone has been called - reset and start a fresh cycle with this pick.
    const pick = shuffled(students)[0];
    return { pick, nextUsedIds: new Set([pick.id]) };
  }
  const pick = shuffled(unused)[0];
  validUsed.add(pick.id);
  return { pick, nextUsedIds: validUsed };
}

function readUsedIds(): Set<string> {
  try {
    const raw = window.localStorage.getItem(FAIR_ROTATION_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

function writeUsedIds(ids: Set<string>): void {
  try {
    window.localStorage.setItem(FAIR_ROTATION_KEY, JSON.stringify([...ids]));
  } catch {
    /* private mode / quota - rotation just resets each spin, which is acceptable */
  }
}

interface SpeakerSpinnerProps {
  sessionId: string | null | undefined;
  periodId: string | null | undefined;
  remoteCommand: TeacherRemoteCommand | null | undefined;
}

export default function SpeakerSpinner({ sessionId, periodId, remoteCommand }: SpeakerSpinnerProps) {
  const [students, setStudents] = useState<SpeakerStudent[]>([]);
  const [reelName, setReelName] = useState<string | null>(null);
  const [landedName, setLandedName] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const handledNonce = useRef<string | null>(null);
  const timers = useRef<number[]>([]);

  const firstNames = useMemo(() => firstNameLabelMap(loadNameKey()), []);
  const toFirstName = useCallback(
    (alias: string) => firstNames.get(alias.trim().toLowerCase()) ?? alias,
    [firstNames],
  );

  useEffect(() => {
    if (!periodId) {
      setStudents([]);
      return;
    }
    let cancelled = false;
    const params = new URLSearchParams({ periodId, minimum: "1" });
    if (sessionId) params.set("sessionId", sessionId);
    void teacherApiRequest<SpeakerRosterResponse>(`/api/teacher/spinner-roster?${params.toString()}`)
      .then((result) => {
        if (cancelled) return;
        setStudents(
          (result.students || [])
            .filter((student) => student.id && student.fullName)
            .map((student) => ({ id: student.id, alias: student.fullName })),
        );
      })
      .catch(() => {
        /* leave students empty; a spin with no roster is a no-op */
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
    if (!students.length) return;
    clearTimers();
    const result = pickFair(students, readUsedIds());
    if (!result) return;
    writeUsedIds(result.nextUsedIds);
    const pool = students.map((student) => toFirstName(student.alias));
    const landed = toFirstName(result.pick.alias);

    setVisible(true);
    setLandedName(null);
    setReelName(pool[Math.floor(Math.random() * pool.length)] ?? landed);

    // Shuffle that decelerates: fast flicker easing out into the landed name.
    let elapsed = 0;
    const ticks = 18;
    for (let index = 0; index < ticks; index += 1) {
      elapsed += 55 + index * index * 1.5;
      timers.current.push(
        window.setTimeout(() => setReelName(pool[Math.floor(Math.random() * pool.length)] ?? landed), elapsed),
      );
    }
    timers.current.push(
      window.setTimeout(() => {
        setReelName(null);
        setLandedName(landed);
      }, elapsed + 240),
    );
    // Hold the name up long enough to read and call on, then clear the wall.
    timers.current.push(window.setTimeout(() => setVisible(false), elapsed + 240 + HOLD_MS));
  }, [students, toFirstName, clearTimers]);

  useEffect(() => {
    if (!remoteCommand || remoteCommand.action !== "spin-speaker") return;
    if (remoteCommand.nonce === handledNonce.current) return;
    handledNonce.current = remoteCommand.nonce;
    spin();
  }, [remoteCommand, spin]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  if (!visible) return null;

  return (
    <div className="speaker-spin" role="status" aria-live="polite" aria-label="Selected speaker">
      <div className="speaker-spin-card">
        <span className="speaker-spin-label">{landedName ? "Sharing next" : "Picking someone"}</span>
        <span className={`speaker-spin-name${landedName ? " landed" : ""}`}>{landedName ?? reelName ?? "…"}</span>
      </div>
      <style>{`
        .speaker-spin { position:absolute; inset:0; z-index:60; display:grid; place-items:center;
          background:color-mix(in srgb, var(--ink, #201e1a) 30%, transparent); backdrop-filter:blur(2px); }
        .speaker-spin-card { display:grid; justify-items:center; gap:clamp(10px,2vw,22px);
          min-width:min(72vw,760px); padding:clamp(30px,5vw,64px) clamp(40px,7vw,96px);
          border:1px solid var(--hair, #ece4d4); border-top:8px solid var(--acc, #50a3a4); border-radius:26px;
          background:var(--card, #fff); box-shadow:0 30px 80px -30px rgba(32,30,26,0.6); }
        .speaker-spin-label { color:var(--acc-deep, #3c7d7e); font-size:clamp(0.9rem,1.8vw,1.3rem);
          font-weight:900; letter-spacing:0.16em; text-transform:uppercase; }
        .speaker-spin-name { color:var(--head, #201e1a); font-size:clamp(3.4rem,10vw,8rem); line-height:0.98;
          font-weight:800; letter-spacing:-0.03em; text-align:center; text-wrap:balance; }
        .speaker-spin-name.landed { color:var(--acc-deep, #3c7d7e); animation:speaker-pop 0.4s ease-out; }
        @keyframes speaker-pop { 0% { transform:scale(0.86); opacity:0.4; } 60% { transform:scale(1.06); } 100% { transform:scale(1); opacity:1; } }
        @media (prefers-reduced-motion: reduce) { .speaker-spin-name.landed { animation:none; } }
      `}</style>
    </div>
  );
}
