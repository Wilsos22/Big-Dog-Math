"use client";

import { useCallback, useRef, useState } from "react";

type StageControlAction = "previous" | "toggle-timer" | "next";

interface StageControlToolbarProps {
  sessionId: string | null;
  timerRunning: boolean;
  timerActive: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
}

function ChevronIcon({ direction }: { direction: "left" | "right" | "up" | "down" }) {
  const rotation = { left: 90, right: -90, up: 180, down: 0 }[direction];
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" style={{ transform: `rotate(${rotation}deg)` }}>
      <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
      <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M7 4.5v15l13-7.5-13-7.5z" fill="currentColor" />
    </svg>
  );
}

export default function StageControlToolbar({
  sessionId,
  timerRunning,
  timerActive,
  canGoBack,
  canGoForward,
}: StageControlToolbarProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<StageControlAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const send = useCallback(async (action: StageControlAction) => {
    if (!sessionId || inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(action);
    setError(null);
    try {
      const response = await fetch("/api/control-remote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, sessionId }),
      });
      const data: { error?: string } = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "That did not go through.");
      }
    } catch {
      setError("That did not go through.");
    } finally {
      inFlightRef.current = false;
      setBusy(null);
    }
  }, [sessionId]);

  if (!sessionId) return null;

  return (
    <div className="sct-wrap">
      <style>{`
        .sct-wrap { position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%); z-index: 80;
          display: flex; flex-direction: column; align-items: center; gap: 8px; font-family: var(--bdb-font); }
        .sct-bar { display: flex; align-items: stretch; gap: 8px; background: var(--bdb-card); border: 1px solid var(--bdb-line);
          border-radius: 18px; padding: 8px; box-shadow: 0 12px 30px rgba(40,32,20,0.22); }
        .sct-btn { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
          min-width: 76px; min-height: 60px; padding: 6px 12px; border-radius: 12px; border: 1px solid var(--bdb-line);
          background: var(--bdb-ground); color: var(--bdb-ink); font-family: var(--bdb-font); font-weight: 700;
          font-size: 0.78rem; cursor: pointer; touch-action: manipulation; }
        .sct-btn:disabled { opacity: 0.38; cursor: default; }
        .sct-btn:not(:disabled):active { background: var(--bdb-ground-2); }
        .sct-handle { display: flex; align-items: center; gap: 6px; min-height: 36px; padding: 6px 16px;
          border-radius: 999px; border: 1px solid var(--bdb-line); background: color-mix(in srgb, var(--bdb-card) 88%, transparent);
          color: var(--bdb-ink-soft); font-family: var(--bdb-font); font-weight: 700; font-size: 0.72rem;
          letter-spacing: 0.02em; text-transform: uppercase; cursor: pointer; touch-action: manipulation; }
        .sct-error { max-width: 260px; text-align: center; background: var(--bdb-card); border: 1px solid var(--bdb-coral-deep, var(--bdb-coral));
          color: var(--bdb-coral-deep, var(--bdb-coral)); border-radius: 10px; padding: 6px 12px; font-family: var(--bdb-font);
          font-weight: 700; font-size: 0.74rem; }
      `}</style>
      {open && (
        <div className="sct-bar" role="group" aria-label="Lesson controls">
          <button
            type="button"
            className="sct-btn"
            disabled={!canGoBack || busy !== null}
            onClick={() => { void send("previous"); }}
          >
            <ChevronIcon direction="left" />
            Back
          </button>
          <button
            type="button"
            className="sct-btn"
            disabled={!timerActive || busy !== null}
            onClick={() => { void send("toggle-timer"); }}
          >
            {timerRunning ? <PauseIcon /> : <PlayIcon />}
            {timerRunning ? "Pause" : "Resume"}
          </button>
          <button
            type="button"
            className="sct-btn"
            disabled={!canGoForward || busy !== null}
            onClick={() => { void send("next"); }}
          >
            <ChevronIcon direction="right" />
            Next
          </button>
        </div>
      )}
      {error && <div className="sct-error">{error}</div>}
      <button
        type="button"
        className="sct-handle"
        onClick={() => setOpen((current) => !current)}
        aria-label={open ? "Hide lesson controls" : "Show lesson controls"}
      >
        Controls
        <ChevronIcon direction={open ? "down" : "up"} />
      </button>
    </div>
  );
}
