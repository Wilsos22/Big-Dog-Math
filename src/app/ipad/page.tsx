"use client";

// iPad pen surface - write from anywhere in the room.
//
// ONE SURFACE, ONE ROOM (simplified 2026-07-30 on Steele's word). The pen
// always writes on `<room>__over`, which every display already renders
// unconditionally: /teacher/present and /teacher/pace through ScreenInkOverlay,
// and /board directly. Whatever the hand writes is on the wall - no mode to be
// in, no live session required, nothing to open first.
//
// It replaced a two-surface design that was the source of every ink report in
// this repo's history. "Board" annotated the screen and "Whiteboard" was a
// separate 42% panel on a SECOND room, which the projector only showed when a
// live session was running with the work space open. Two buttons that looked
// alike, behaved differently, and silently reached the wall on different
// conditions - so "it doesn't show up on the projector" was true half the time
// and impossible to tell apart from a bug.
//
// PAPER IS A BACKGROUND, NOT A SECOND SURFACE. Toggling Paper makes this one
// board opaque - dotted paper instead of the live slide behind the same ink -
// and tells the displays to do the same over the ctrl channel, so the wall and
// the hand always agree. Same room, same strokes, same undo history.
//
// PENCIL ONLY. Fingers never mark, with no switch to get that wrong - a
// resting palm cannot leave ink, and there is no state in which it can. That
// frees the finger to be a gesture: a touch on the stage puts the tool palette
// away, so the board is never buried under its own toolbar mid-sentence. The
// screen wake lock keeps the iPad awake through a whole lesson.

import { useEffect, useRef, useState } from "react";
import InkBoard, { type InkTool } from "@/components/InkBoard";
import { joinInkRoom, type InkChannel, type InkConnectionStatus } from "@/lib/inkSync";
import UpdateReadyChip from "@/components/UpdateReadyChip";

function classroomDate(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const v = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${v.year}-${v.month}-${v.day}`;
}

const COLORS = ["#111827", "#f95335", "#4d8df6", "#2f9e6f", "#fcaf38"];
const WIDTHS: { label: string; px: number }[] = [
  { label: "S", px: 3 },
  { label: "M", px: 6 },
  { label: "L", px: 12 },
];

export default function IpadPage() {
  const [room, setRoom] = useState("main");
  const [paper, setPaper] = useState(false);
  // The split whiteboard: a clean white work area on the left 42% to write on,
  // mirrored to every display. It does NOT change the pen - the glass sheet
  // still covers the whole screen and writes exactly as before - it only ADDS
  // a white background section (Steele, 2026-07-30).
  const [whiteboard, setWhiteboard] = useState(false);
  const [color, setColor] = useState(COLORS[0]);
  const [tool, setTool] = useState<InkTool>("pen");
  const [penWidth, setPenWidth] = useState(6);
  const [clearSignal, setClearSignal] = useState(0);
  const [undoSignal, setUndoSignal] = useState(0);
  const [redoSignal, setRedoSignal] = useState(0);
  const [exportSignal, setExportSignal] = useState(0);
  const [history, setHistory] = useState<{ undo: boolean; redo: boolean }>({ undo: false, redo: false });
  const [toast, setToast] = useState<string | null>(null);
  // The tool palette floats translucently over the writing surface and can be
  // put away entirely - the board owns the whole screen (Steele, 7/22).
  const [toolsOpen, setToolsOpen] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);
  const [boardStatus, setBoardStatus] = useState<InkConnectionStatus>("connecting");
  const [barkCooling, setBarkCooling] = useState(false);
  const [screenAr, setScreenAr] = useState(16 / 9);
  // Mirrored from InkBoard, which owns the zoom, and applied to the SLIDE so
  // the content moves with the writing. The ink needs no CSS transform - it is
  // redrawn vectorially at the new scale, which is what keeps it sharp.
  const [view, setView] = useState({ s: 1, x: 0, y: 0 });
  const ctrlRef = useRef<InkChannel | null>(null);
  const paperRef = useRef(false);
  useEffect(() => { paperRef.current = paper; }, [paper]);
  const whiteboardRef = useRef(false);
  useEffect(() => { whiteboardRef.current = whiteboard; }, [whiteboard]);

  function flashToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast((t) => (t === message ? null : t)), 4500);
  }

  // Export downloads a copy and publishes it through the protected teacher API.
  async function handleExport(dataUrl: string) {
    const date = classroomDate();
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `big-dog-board-${date}.png`;
    a.click();

    try {
      const blob = await (await fetch(dataUrl)).blob();
      const form = new FormData();
      form.set("date", date);
      form.set("file", new File([blob], `big-dog-board-${date}.png`, { type: "image/png" }));
      const response = await fetch("/api/teacher/board", { method: "POST", body: form });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) flashToast(`Exported - couldn't save to lesson: ${result.error || "Upload failed."}`);
      else flashToast("Saved to today's lesson");
    } catch {
      flashToast("Exported. (Couldn't reach the lesson to save.)");
    }
  }

  useEffect(() => {
    try {
      const r = new URLSearchParams(window.location.search).get("room");
      if (r) setRoom(r.trim());
      if (localStorage.getItem("bdm-ipad-tools-open") === "0") setToolsOpen(false);
    } catch { /* ignore */ }
  }, []);

  // A finger on the writing surface puts the palette away. Safe precisely
  // because the finger cannot draw: the gesture can never cost a stroke.
  function closeTools() {
    setToolsOpen((open) => {
      if (!open) return open;
      try { localStorage.setItem("bdm-ipad-tools-open", "0"); } catch { /* ignore */ }
      return false;
    });
  }

  function toggleTools() {
    setToolsOpen((v) => {
      const next = !v;
      try { localStorage.setItem("bdm-ipad-tools-open", next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  }

  // Keep the iPad awake through a whole lesson; re-acquire when the tab
  // returns to the foreground (Safari releases the lock in the background).
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    let stopped = false;
    const acquire = async () => {
      try {
        const wl = (navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock;
        if (!wl || stopped || document.visibilityState !== "visible") return;
        lock = await wl.request("screen");
      } catch { /* not supported or denied - the iPad just sleeps as before */ }
    };
    void acquire();
    const onVisible = () => { if (document.visibilityState === "visible") void acquire(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, []);

  // Control channel: the attention call, and the paper background the displays
  // mirror. A display that joins (or reconnects) says hello; answer with where
  // this surface is, so a projector opened mid-lesson does not sit on the slide
  // while the hand is on paper.
  useEffect(() => {
    const ctrl = joinInkRoom(`${room}__ctrl`, (m) => {
      if (m.t === "hello") {
        // A display opened (or reconnected): tell it where this surface is, so
        // a projector switched on mid-lesson never sits on the slide while the
        // hand is already on paper or in the split whiteboard.
        ctrl.send({ t: "paper", on: paperRef.current });
        ctrl.send({ t: "whiteboard", on: whiteboardRef.current });
      }
    });
    ctrlRef.current = ctrl;
    return () => ctrl.close();
  }, [room]);

  // Ink is an annotation ON a slide, so it belongs to that slide. When the
  // lesson advances, the last step's writing must not be left sitting over the
  // new one - on the iPad or, worse, on the wall. Clearing here rather than on
  // the displays is deliberate: the pen surface holds the authoritative board,
  // and its clearSignal already broadcasts { t: "clear" } to every display, so
  // one clear reaches all of them without a second wire message.
  //
  // The pen surface polls for this itself instead of being told by the Remote,
  // because it has to behave the same standing alone in its own tab as it does
  // embedded in the Remote's work space.
  // TURNED OFF 2026-08-03, AND IT NEVER ONCE RAN. The poll below asked
  // GET /api/control-remote with NO sessionId, and that route answers
  // `session: requestedSession ? ... : null` where requestedSession is null
  // unless a sessionId was passed (route.ts ~927) - so `index` was never a
  // number and the clear never fired, from the day it shipped. What it DID do
  // was fetch and JSON.parse `sessions.map(serializeSession)` - every open
  // session, each carrying its whole liveFlow snapshot - on the pen surface's
  // main thread, every 2 seconds, at moments it cannot choose. A parse landing
  // between two quick strokes is indistinguishable from the pen being slow to
  // start, which is exactly the complaint that led here.
  //
  // NOT re-wired, on purpose: passing a session id would switch on a
  // DESTRUCTIVE behaviour the board has never actually had, so the first time
  // Steele saw it would be his board wiping itself mid-lesson. Turning it on
  // is his call, and it is small - pass ?sessionId= (or read sessions[0],
  // given one open session at a time is an invariant here) and restore the
  // effect. Until then the pen pays nothing for a feature it does not have.

  // ── The stage: fit to the wall's shape, then pinch the whole thing ─────────
  // Sized in JS because the CSS version could not letterbox: width:100% plus an
  // aspect-ratio ran the box taller than the stage, and clamping the height left
  // the width at 100%, so the box stopped matching the projector and the right
  // edge simply was not on screen.
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [fit, setFit] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      const el = stageRef.current;
      if (!el) return;
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      // A zero rect means the layout has not settled (or this is an iframe that
      // has not been given a size yet); keep asking rather than baking in 0.
      if (!cw || !ch) { frame = window.requestAnimationFrame(measure); return; }
      const w = Math.min(cw, ch * screenAr);
      setFit({ w, h: w / screenAr });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, [screenAr]);

  // The projector overlay announces its aspect ratio; letterbox to match so
  // strokes land on the wall exactly where the pen put them.
  useEffect(() => {
    const view = joinInkRoom(`${room}__over`, (m) => {
      if (m.t === "view" && Number.isFinite(m.ar) && m.ar > 0.5 && m.ar < 4) setScreenAr(m.ar);
    });
    return () => view.close();
  }, [room]);

  // The attention call: one tap booms the room sound + Eyes-up pulse on the
  // board and main projector, and flashes the same pulse (visual only, no
  // audio) on every joined student Chromebook - the eyes-down kid is exactly
  // who the redirect is for. Short cooldown so a grabbed iPad or a
  // double-tap cannot spam the class.
  function sendBark() {
    if (barkCooling) return;
    ctrlRef.current?.send({ t: "attention" });
    setBarkCooling(true);
    window.setTimeout(() => setBarkCooling(false), 4000);
  }

  function togglePaper() {
    setPaper((v) => {
      const next = !v;
      ctrlRef.current?.send({ t: "paper", on: next });
      return next;
    });
  }

  // Split in / out the white work area. Broadcast on __ctrl so every display -
  // and the /teacher/present embedded in this very iframe - shifts the slide to
  // the right and reveals the white panel on the left, keeping the hand and the
  // wall identical.
  function toggleWhiteboard() {
    setWhiteboard((v) => {
      const next = !v;
      ctrlRef.current?.send({ t: "whiteboard", on: next });
      return next;
    });
  }

  function toggleFullscreen() {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
    } catch { /* ignore */ }
  }

  return (
    <main className="ip-page">
      <style>{`
        .ip-page { position:fixed; inset:0; background:var(--bdb-ground); font-family:var(--bdb-font); }
        .ip-topbar { position:fixed; top:10px; left:10px; z-index:30; display:flex; gap:8px; }
        .ip-handle { display:inline-flex; align-items:center; gap:8px; min-height:40px; padding:0 15px; border-radius:999px; border:1px solid rgba(32,30,26,0.14); background:rgba(255,255,255,0.72); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); font:inherit; font-weight:800; font-size:0.85rem; color:var(--bdb-ink); cursor:pointer; touch-action:manipulation; box-shadow:0 8px 22px rgba(40,32,20,0.14); }
        .ip-bark { display:inline-flex; align-items:center; min-height:40px; padding:0 16px; border-radius:999px; border:1px solid color-mix(in srgb, var(--bdb-amber) 65%, rgba(32,30,26,0.14)); background:var(--bdb-amber); color:var(--bdb-ink); font:inherit; font-weight:800; font-size:0.85rem; cursor:pointer; touch-action:manipulation; box-shadow:0 8px 22px rgba(252,175,56,0.35); }
        .ip-bark:disabled { opacity:0.45; cursor:default; }
        .ip-dot { width:8px; height:8px; border-radius:50%; background:#c78b24; }
        .ip-dot.connected { background:#2f9e6f; }
        .ip-dot.disconnected { background:#d05f3c; }
        /* NO backdrop-filter here, deliberately. This panel is 620px wide,
           fixed over the writing stage, and open by default - and a
           backdrop-filtered box has to re-sample and re-blur whatever is
           behind it every time that changes. Behind it is the ink canvas,
           which repaints on every frame of every stroke, so the blur was
           being recomputed per frame across the area the teacher writes in.
           It is opaque instead: same panel, none of the per-frame cost. The
           small handle keeps its blur - it is a corner chip, not a sheet over
           the page. If the pen ever feels heavy again, "Hide tools" is the
           one-gesture A/B that tells you whether an overlay is the cause. */
        .ip-palette { position:fixed; top:58px; left:10px; z-index:29; width:min(620px, calc(100vw - 20px)); display:flex; flex-direction:column; gap:8px; padding:12px; border-radius:16px; border:1px solid rgba(32,30,26,0.10); background:#fffdf8; box-shadow:0 18px 44px rgba(40,32,20,0.18); }
        .ip-row { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
        .ip-group { display:flex; align-items:center; gap:6px; }
        .ip-sub { color:var(--bdb-ink-faint); font-size:0.72rem; font-weight:700; }
        .ip-sw { width:27px; height:27px; border-radius:50%; border:2px solid #fff; box-shadow:0 0 0 1px rgba(32,30,26,0.2); cursor:pointer; padding:0; }
        .ip-sw.on { box-shadow:0 0 0 3px var(--bdb-ink); }
        .ip-btn { min-height:38px; padding:0 12px; border-radius:9px; border:1px solid rgba(32,30,26,0.14); background:rgba(255,255,255,0.85); color:var(--bdb-ink); font-weight:700; font-size:0.82rem; cursor:pointer; touch-action:manipulation; }
        .ip-btn.on { background:var(--bdb-ink); color:#fff; border-color:var(--bdb-ink); }
        .ip-btn.warn { color:var(--bdb-coral); border-color:color-mix(in srgb, var(--bdb-coral) 40%, rgba(32,30,26,0.14)); }
        .ip-divider { width:1px; align-self:stretch; background:rgba(32,30,26,0.12); margin:2px 4px; }
        /* touch-action:none stops Safari's own pinch/double-tap page zoom, which
           fought the pen and could never zoom the slide anyway. The stage owns
           the gesture now. */
        .ip-screen-stage { position:absolute; inset:0; display:grid; place-items:center; overflow:hidden; background:#26221c; touch-action:none; }
        /* The SLIDE mirrors InkBoard's own view. CSS-scaling the ink instead
           stretched an already-rasterised canvas (pixelated) and left InkBoard's
           cached rect blind to the ancestor transform, so strokes landed away
           from the pencil. InkBoard redraws its strokes vectorially at the new
           scale, so the writing stays crisp; only the slide needs mirroring.
           transform-origin MUST be 0 0 - InkBoard's page layer uses that, and a
           mirror with a different origin drifts as it scales. */
        .ip-screen-frame { transform-origin:0 0; }
        /* Sized in JS. width:100% + aspect-ratio let the box run taller than the
           stage, and max-height then clamped the height while the width stayed
           100% - so it quietly stopped being the projector's ratio and the right
           edge of the wall was off screen. */
        .ip-screen-box { position:relative; }
        .ip-screen-frame { position:absolute; inset:0; width:100%; height:100%; border:0; pointer-events:none; background:#fff; }
        /* The split whiteboard: a clean white work area on the left 42%, the
           exact geometry /teacher/present gives .stage-board-panel, so the hand
           matches the wall. A BACKGROUND under the glass sheet (z 5 < the ink
           layer's 6) - the pen writes across it just as it writes over the
           slide, and the panel can never take a stroke. */
        .ip-wb-panel { position:absolute; z-index:5; inset:0 auto 0 0; width:42%; background:#fff; border-right:5px solid var(--bdb-amber); box-shadow:18px 0 40px rgba(40,32,20,0.16); }
        /* The layer never captures; the ink canvas inside opts back in when it
           is interactive. A plain wrapper div defaults to auto and would
           swallow the stroke before it reached the board. */
        .ip-ink-layer { position:absolute; inset:0; z-index:6; pointer-events:none; }
        .ip-screen-note { position:absolute; top:8px; left:50%; transform:translateX(-50%); z-index:7; background:rgba(32,30,26,0.78); color:#fff; font-size:0.72rem; font-weight:800; padding:5px 12px; border-radius:999px; pointer-events:none; }
        .ip-spacer { flex:1; }
      `}</style>

      <div className="ip-topbar">
        <button className="ip-handle" onClick={toggleTools} aria-expanded={toolsOpen}>
          <span className={`ip-dot ${boardStatus}`} aria-hidden="true" />
          {toolsOpen ? "Hide tools" : "Tools"}
        </button>
        <button className="ip-bark" onClick={sendBark} disabled={barkCooling} aria-label="Play the class attention call on the room displays">
          Bark
        </button>
      </div>

      {toolsOpen && (
        <div className="ip-palette" role="toolbar" aria-label="Writing tools">
          <div className="ip-row">
            <div className="ip-group" role="group" aria-label="Colors">
              {COLORS.map((c) => (
                <button
                  key={c}
                  className={`ip-sw${tool !== "erase" && tool !== "pixel" && tool !== "laser" && color === c ? " on" : ""}`}
                  style={{ background: c }}
                  aria-label={`Color ${c}`}
                  onClick={() => { setColor(c); if (tool === "erase" || tool === "pixel" || tool === "laser") setTool("pen"); }}
                />
              ))}
            </div>
            <div className="ip-group" role="group" aria-label="Width">
              {WIDTHS.map((w) => (
                <button key={w.px} className={`ip-btn${penWidth === w.px ? " on" : ""}`} onClick={() => setPenWidth(w.px)}>{w.label}</button>
              ))}
            </div>
            <span className="ip-spacer" />
            {room !== "main" && <span className="ip-sub">room {room}</span>}
          </div>

          <div className="ip-row">
            <button className={`ip-btn${tool === "pen" ? " on" : ""}`} onClick={() => setTool("pen")}>Pen</button>
            <button className={`ip-btn${tool === "hl" ? " on" : ""}`} onClick={() => setTool("hl")}>Highlight</button>
            <button className={`ip-btn${tool === "laser" ? " on" : ""}`} onClick={() => setTool("laser")}>Laser</button>
            <button className={`ip-btn${tool === "erase" ? " on" : ""}`} onClick={() => setTool("erase")}>Eraser</button>
            <button className={`ip-btn${tool === "pixel" ? " on" : ""}`} onClick={() => setTool("pixel")}>Pixel</button>
          </div>

          <div className="ip-row">
            <button className="ip-btn" disabled={!history.undo} style={!history.undo ? { opacity: 0.4 } : undefined} onClick={() => setUndoSignal((n) => n + 1)}>Undo</button>
            <button className="ip-btn" disabled={!history.redo} style={!history.redo ? { opacity: 0.4 } : undefined} onClick={() => setRedoSignal((n) => n + 1)}>Redo</button>
            <span className="ip-divider" />
            {/* Paper is a BACKGROUND on the same board, not a second surface:
                the ink, the room and the undo history are unchanged, only what
                sits behind them. The displays mirror it over __ctrl. */}
            <button className={`ip-btn${paper ? " on" : ""}`} onClick={togglePaper}>
              {paper ? "Paper" : "Screen"}
            </button>
            {/* Splits a clean white work area onto the left of the screen. The
                pen is unchanged - this only adds a background to write on. */}
            <button className={`ip-btn${whiteboard ? " on" : ""}`} onClick={toggleWhiteboard}>Whiteboard</button>
            <button className="ip-btn warn" onClick={() => setClearSignal((n) => n + 1)}>Clear</button>
            <span className="ip-spacer" />
            <button className={`ip-btn${moreOpen ? " on" : ""}`} onClick={() => setMoreOpen((v) => !v)}>More</button>
          </div>

          {moreOpen && (
            <div className="ip-row">
              <button className="ip-btn" onClick={() => setExportSignal((n) => n + 1)}>Export</button>
              <button className="ip-btn" onClick={toggleFullscreen}>Full screen</button>
            </div>
          )}
        </div>
      )}

      {/* One stage, letterboxed to the projector's own aspect ratio so what the
          hand sees is what the wall shows. The live screen renders behind; on
          paper the board goes opaque and covers it. */}
      <div
        className="ip-screen-stage"
        ref={stageRef}
        onPointerDownCapture={(e) => { if (e.pointerType === "touch") closeTools(); }}
      >
        <div className="ip-screen-box" style={fit.w ? { width: fit.w, height: fit.h } : { aspectRatio: String(screenAr), width: "100%" }}>
          <iframe
            className="ip-screen-frame"
            style={view.s === 1 && view.x === 0 && view.y === 0
              ? undefined
              : { transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})` }}
            src={`/teacher/present?embed=1${room !== "main" ? `&room=${encodeURIComponent(room)}` : ""}`}
            title="Live class screen"
          />
          {/* White work area. A pure background - no ink room of its own - so
              the pen stays one surface on one room. The embedded present shifts
              the slide off the left 42% to sit behind it. */}
          {whiteboard && <div className="ip-wb-panel" aria-hidden />}
          <div className="ip-ink-layer">
            <InkBoard
              room={`${room}__over`}
              interactive
              // InkBoard owns the zoom: it redraws strokes at the new scale so
              // they stay sharp, and its own coordinate math already accounts
              // for the view, so a stroke lands under the pencil. The slide
              // follows via onViewChange below.
              allowZoom
              onViewChange={setView}
              transparent={!paper}
              paper="dots"
              color={color}
              tool={tool}
              penWidth={penWidth}
              clearSignal={clearSignal}
              undoSignal={undoSignal}
              redoSignal={redoSignal}
              exportSignal={exportSignal}
              onExport={handleExport}
              onHistoryChange={(undo, redo) => setHistory({ undo, redo })}
              onConnectionChange={setBoardStatus}
            />
          </div>
          <span className="ip-screen-note">
            {paper ? "Paper - the wall shows this too" : whiteboard ? "Whiteboard - the wall shows this too" : "Writing over the class screen"}
          </span>
        </div>
      </div>

      {/* The pen surface never reloads itself - it holds the room's ink - so it
          has to SAY when a new build is waiting, or it silently runs old code
          and a shipped fix looks like it never landed. */}
      <UpdateReadyChip />

      {toast && (
        <div
          role="status"
          style={{
            position: "fixed", left: "50%", bottom: 18, transform: "translateX(-50%)", zIndex: 50,
            background: "#201e1a", color: "#fff", padding: "11px 18px", borderRadius: 12,
            fontFamily: "var(--bdb-font)", fontWeight: 700, fontSize: "0.92rem",
            boxShadow: "0 12px 30px rgba(0,0,0,0.3)",
          }}
        >
          {toast}
        </div>
      )}
    </main>
  );
}
