"use client";

// iPad pen surface - write from anywhere in the room.
//
// Two surfaces, one toolbar:
//   Board            - the classic white board, mirrored on /board.
//   Write on screen  - the glass sheet: the live projector view (the
//                      /teacher/present stage) renders under a transparent
//                      ink layer, letterboxed to the projector's exact aspect
//                      ratio, so strokes land on the wall precisely where the
//                      pen put them. Covers everything the app shows; content
//                      outside the app still goes through Background.
//
// Pencil-first: fingers never mark unless "Finger draws" is switched on, so a
// resting palm cannot leave ink even before the first pen touch. The screen
// wake lock keeps the iPad awake through a whole lesson.

import { useEffect, useRef, useState } from "react";
import InkBoard, { type InkTool } from "@/components/InkBoard";
import { joinInkRoom, type InkChannel, type InkConnectionStatus } from "@/lib/inkSync";
import { BOARD_TEMPLATES } from "@/lib/boardTemplates";

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

type Surface = "annotate" | "whiteboard";

// Per-page controls: each board page carries its own signals and furniture,
// so Undo, Clear, Background, and Problem always act on the page in view.
type PageState = {
  clear: number;
  undo: number;
  redo: number;
  exportSig: number;
  bg: string | null;
  problem: string | null;
};

const freshPage = (): PageState => ({ clear: 0, undo: 0, redo: 0, exportSig: 0, bg: null, problem: null });
const MAX_PAGES = 8;

export default function IpadPage() {
  const [room, setRoom] = useState("main");
  const [surface, setSurface] = useState<Surface>("annotate");
  const [color, setColor] = useState(COLORS[0]);
  const [tool, setTool] = useState<InkTool>("pen");
  const [penWidth, setPenWidth] = useState(6);
  const [fingerDraws, setFingerDraws] = useState(false);
  const [pages, setPages] = useState<PageState[]>([freshPage()]);
  const [activePage, setActivePage] = useState(0);
  const [showProblem, setShowProblem] = useState(false);
  const [screenClearSignal, setScreenClearSignal] = useState(0);
  const [undoSignal, setUndoSignal] = useState(0);
  const [redoSignal, setRedoSignal] = useState(0);
  const [scratchUndoSignal, setScratchUndoSignal] = useState(0);
  const [history, setHistory] = useState<{ undo: boolean; redo: boolean }>({ undo: false, redo: false });
  const [toast, setToast] = useState<string | null>(null);
  // The tool palette floats translucently over the writing surface and can be
  // put away entirely - the board owns the whole screen (Steele, 7/22).
  const [toolsOpen, setToolsOpen] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [scratchOpen, setScratchOpen] = useState(false);
  const [scratchClear, setScratchClear] = useState(0);
  const [boardStatus, setBoardStatus] = useState<InkConnectionStatus>("connecting");
  const [barkCooling, setBarkCooling] = useState(false);
  const [screenAr, setScreenAr] = useState(16 / 9);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const ctrlRef = useRef<InkChannel | null>(null);

  // Live values the ctrl-channel handler and history callbacks read.
  const activePageRef = useRef(0);
  useEffect(() => { activePageRef.current = activePage; }, [activePage]);
  const pageCountRef = useRef(1);
  useEffect(() => { pageCountRef.current = pages.length; }, [pages.length]);
  const scratchOpenRef = useRef(false);
  useEffect(() => { scratchOpenRef.current = scratchOpen; }, [scratchOpen]);
  const surfaceRef = useRef<Surface>("annotate");
  useEffect(() => { surfaceRef.current = surface; }, [surface]);
  const historiesRef = useRef<Record<number, { undo: boolean; redo: boolean }>>({});
  const screenHistoryRef = useRef({ undo: false, redo: false });

  // The Remote and the pen surface are the same iPad, so switching here opens
  // and closes the ROOM's work space too. Otherwise the teacher would leave the
  // pen surface, load /teacher/remote on the same device, press Open work space,
  // and come back - and until they did, the wall and the hand would disagree
  // about which half is the whiteboard. Board closes it on purpose: the glass
  // sheet annotates the whole screen, and a 42% panel would cover the very
  // thing being annotated.
  const liveSessionRef = useRef<string | null>(null);
  const lastBoardModeRef = useRef<boolean | null>(null);
  useEffect(() => {
    let stopped = false;
    void (async () => {
      try {
        const response = await fetch("/api/control-remote", { cache: "no-store" });
        const data = await response.json() as { session?: { id?: string } | null };
        if (!stopped) liveSessionRef.current = data.session?.id || null;
      } catch { /* No session is normal - the pen works without one. */ }
    })();
    return () => { stopped = true; };
  }, []);
  useEffect(() => {
    const sessionId = liveSessionRef.current;
    // No session yet means nothing to tell; never force the room's panel shut
    // on mount just because this surface booted in Board.
    if (!sessionId) return;
    const open = surface === "whiteboard";
    if (lastBoardModeRef.current === open) return;
    lastBoardModeRef.current = open;
    void fetch("/api/control-remote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: open ? "show-board" : "hide-board", sessionId }),
    }).catch(() => { /* The room keeps its current panel; the pen still writes. */ });
  }, [surface]);

  const page = pages[activePage] ?? pages[0];

  function patchPage(i: number, patch: Partial<PageState>) {
    setPages((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  }
  function bumpPage(key: "clear" | "undo" | "redo" | "exportSig") {
    setPages((ps) => ps.map((p, j) => (j === activePage ? { ...p, [key]: p[key] + 1 } : p)));
  }
  function flipTo(i: number) {
    setActivePage(i);
    setHistory(historiesRef.current[i] ?? { undo: false, redo: false });
  }
  function addPage() {
    if (pages.length >= MAX_PAGES) return;
    setPages((ps) => [...ps, freshPage()]);
    flipTo(pages.length);
  }
  function switchSurface(next: Surface) {
    // History belongs to the glass sheet in both modes now, so switching does
    // not swap it - the strokes on screen are the same strokes either way.
    setSurface(next);
    setHistory(screenHistoryRef.current);
  }

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

  // Control channel: scratch overlay open/close and page flips. A display
  // that joins (or reconnects) says hello; answer with where we are.
  useEffect(() => {
    const ctrl = joinInkRoom(`${room}__ctrl`, (m) => {
      if (m.t === "scratch") setScratchOpen(m.open);
      else if (m.t === "hello") {
        ctrl.send({ t: "pageflip", index: activePageRef.current, count: pageCountRef.current });
        if (scratchOpenRef.current) ctrl.send({ t: "scratch", open: true });
      }
    });
    ctrlRef.current = ctrl;
    return () => ctrl.close();
  }, [room]);

  // Tell the displays which page is up whenever it changes.
  useEffect(() => {
    ctrlRef.current?.send({ t: "pageflip", index: activePage, count: pages.length });
  }, [activePage, pages.length]);

  // The projector overlay announces its aspect ratio; letterbox to match so
  // strokes land on the wall exactly where the pen put them. Held for the whole
  // room, not only while Write on screen is showing: the projector announces on
  // ITS mount, so a listener that only exists while the surface is up misses the
  // announcement and letterboxes to a guessed 16:9 until the display happens to
  // reconnect. (Joining for the room's lifetime is also one less subscribe /
  // unsubscribe cycle on the topic the glass sheet itself is using.)
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

  function toggleScratch() {
    setScratchOpen((v) => {
      const next = !v;
      ctrlRef.current?.send({ t: "scratch", open: next });
      return next;
    });
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const target = activePage;
    const reader = new FileReader();
    reader.onload = () => patchPage(target, { bg: typeof reader.result === "string" ? reader.result : null });
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function toggleFullscreen() {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
    } catch { /* ignore */ }
  }

  const onWhiteboard = surface === "whiteboard";

  return (
    <main className="ip-page">
      <style>{`
        .ip-page { position:fixed; inset:0; background:var(--bdb-ground); font-family:var(--bdb-font); }
        .ip-stage { position:absolute; inset:0; }
        .ip-topbar { position:fixed; top:10px; left:10px; z-index:30; display:flex; gap:8px; }
        .ip-handle { display:inline-flex; align-items:center; gap:8px; min-height:40px; padding:0 15px; border-radius:999px; border:1px solid rgba(32,30,26,0.14); background:rgba(255,255,255,0.72); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); font:inherit; font-weight:800; font-size:0.85rem; color:var(--bdb-ink); cursor:pointer; touch-action:manipulation; box-shadow:0 8px 22px rgba(40,32,20,0.14); }
        .ip-bark { display:inline-flex; align-items:center; min-height:40px; padding:0 16px; border-radius:999px; border:1px solid color-mix(in srgb, var(--bdb-amber) 65%, rgba(32,30,26,0.14)); background:var(--bdb-amber); color:var(--bdb-ink); font:inherit; font-weight:800; font-size:0.85rem; cursor:pointer; touch-action:manipulation; box-shadow:0 8px 22px rgba(252,175,56,0.35); }
        .ip-bark:disabled { opacity:0.45; cursor:default; }
        .ip-dot { width:8px; height:8px; border-radius:50%; background:#c78b24; }
        .ip-dot.connected { background:#2f9e6f; }
        .ip-dot.disconnected { background:#d05f3c; }
        .ip-palette { position:fixed; top:58px; left:10px; z-index:29; width:min(620px, calc(100vw - 20px)); display:flex; flex-direction:column; gap:8px; padding:12px; border-radius:16px; border:1px solid rgba(32,30,26,0.10); background:rgba(255,255,255,0.80); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px); box-shadow:0 18px 44px rgba(40,32,20,0.18); }
        .ip-row { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
        .ip-group { display:flex; align-items:center; gap:6px; }
        .ip-sub { color:var(--bdb-ink-faint); font-size:0.72rem; font-weight:700; }
        .ip-seg { display:inline-flex; border:2px solid rgba(32,30,26,0.14); border-radius:11px; overflow:hidden; background:rgba(255,255,255,0.85); }
        .ip-seg button { font:inherit; font-weight:800; font-size:0.82rem; min-height:38px; padding:0 12px; border:none; background:transparent; color:var(--bdb-ink-soft); cursor:pointer; touch-action:manipulation; }
        .ip-seg button.on { background:var(--bdb-ink); color:#fff; }
        .ip-sw { width:27px; height:27px; border-radius:50%; border:2px solid #fff; box-shadow:0 0 0 1px rgba(32,30,26,0.2); cursor:pointer; padding:0; }
        .ip-sw.on { box-shadow:0 0 0 3px var(--bdb-ink); }
        .ip-btn { min-height:38px; padding:0 12px; border-radius:9px; border:1px solid rgba(32,30,26,0.14); background:rgba(255,255,255,0.85); color:var(--bdb-ink); font-weight:700; font-size:0.82rem; cursor:pointer; touch-action:manipulation; }
        .ip-btn.on { background:var(--bdb-ink); color:#fff; border-color:var(--bdb-ink); }
        .ip-btn.warn { color:var(--bdb-coral); border-color:color-mix(in srgb, var(--bdb-coral) 40%, rgba(32,30,26,0.14)); }
        .ip-divider { width:1px; align-self:stretch; background:rgba(32,30,26,0.12); margin:2px 4px; }
        .ip-problem-in { flex:1; resize:vertical; min-height:42px; border:1px solid rgba(32,30,26,0.16); border-radius:10px; padding:9px 11px; font-family:var(--bdb-font); font-size:0.9rem; color:var(--bdb-ink); background:rgba(255,255,255,0.9); }
        .ip-screen-stage { position:absolute; inset:0; display:grid; place-items:center; background:#26221c; }
        .ip-screen-box { position:relative; width:100%; max-height:100%; }
        .ip-screen-frame { position:absolute; inset:0; width:100%; height:100%; border:0; pointer-events:none; background:#fff; }
        .ip-screen-note { position:absolute; top:8px; left:50%; transform:translateX(-50%); z-index:6; background:rgba(32,30,26,0.78); color:#fff; font-size:0.72rem; font-weight:800; padding:5px 12px; border-radius:999px; pointer-events:none; }
        /* Mirrors .stage-board-panel on /teacher/present exactly - left 42%,
           white, accent edge on the content side. If that panel ever moves,
           this moves with it or the pen stops matching the wall. */
        .ip-wb-panel { position:absolute; z-index:5; inset:0 auto 0 0; width:42%; overflow:hidden; border-right:5px solid var(--bdb-amber); background:#fff; box-shadow:18px 0 40px rgba(0,0,0,0.22); }
        /* Above the panel on purpose - the pen is never fenced into the white
           area, it just gains a clean place to land. */
        .ip-ink-layer { position:absolute; inset:0; z-index:6; }
        .ip-scratch { position:absolute; inset:0; z-index:5; display:flex; flex-direction:column; background:#fff; }
        .ip-scratch-bar { display:flex; align-items:center; gap:8px; padding:8px 14px; padding-left:210px; background:var(--bdb-card); border-bottom:1px solid var(--bdb-line); }
        .ip-scratch-title { font-weight:800; color:var(--bdb-ink); }
        .ip-scratch-stage { position:relative; flex:1; }
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
            <div className="ip-seg" role="group" aria-label="Writing surface">
              <button className={!onWhiteboard ? "on" : ""} onClick={() => switchSurface("annotate")}>Board</button>
              <button className={onWhiteboard ? "on" : ""} onClick={() => switchSurface("whiteboard")}>Whiteboard</button>
            </div>
            {onWhiteboard && (
              <div className="ip-group" role="group" aria-label="Pages">
                {pages.map((_, i) => (
                  <button key={i} className={`ip-btn${i === activePage ? " on" : ""}`} onClick={() => flipTo(i)}>{i + 1}</button>
                ))}
                {pages.length < MAX_PAGES && (
                  <button className="ip-btn" aria-label="Add page" onClick={addPage}>+</button>
                )}
              </div>
            )}
            <span className="ip-spacer" />
            {room !== "main" && <span className="ip-sub">room {room}</span>}
          </div>

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
          </div>

          <div className="ip-row">
            <button className={`ip-btn${tool === "pen" ? " on" : ""}`} onClick={() => setTool("pen")}>Pen</button>
            <button className={`ip-btn${tool === "hl" ? " on" : ""}`} onClick={() => setTool("hl")}>Highlight</button>
            <button className={`ip-btn${tool === "laser" ? " on" : ""}`} onClick={() => setTool("laser")}>Laser</button>
            <button className={`ip-btn${tool === "erase" ? " on" : ""}`} onClick={() => setTool("erase")}>Eraser</button>
            <button className={`ip-btn${tool === "pixel" ? " on" : ""}`} onClick={() => setTool("pixel")}>Pixel</button>
          </div>

          <div className="ip-row">
            {/* All ink is the glass sheet now, in both modes, so these act on it
                unconditionally. Routing Undo to the page under the panel put the
                button on a surface the pen no longer writes to. */}
            <button className="ip-btn" disabled={!history.undo} style={!history.undo ? { opacity: 0.4 } : undefined} onClick={() => setUndoSignal((n) => n + 1)}>Undo</button>
            <button className="ip-btn" disabled={!history.redo} style={!history.redo ? { opacity: 0.4 } : undefined} onClick={() => setRedoSignal((n) => n + 1)}>Redo</button>
            <span className="ip-divider" />
            {onWhiteboard ? (
              <>
                <button className="ip-btn warn" onClick={() => setScreenClearSignal((n) => n + 1)}>Clear ink</button>
                <button className="ip-btn warn" onClick={() => bumpPage("clear")}>Clear paper</button>
                <button className={`ip-btn${scratchOpen ? " on" : ""}`} onClick={toggleScratch}>Scratch</button>
              </>
            ) : (
              <button className="ip-btn warn" onClick={() => setScreenClearSignal((n) => n + 1)}>Clear ink</button>
            )}
            <span className="ip-spacer" />
            <button className={`ip-btn${moreOpen ? " on" : ""}`} onClick={() => setMoreOpen((v) => !v)}>More</button>
          </div>

          {moreOpen && (
            <div className="ip-row">
              {onWhiteboard && (
                <>
                  <button className={`ip-btn${showProblem ? " on" : ""}`} onClick={() => setShowProblem((v) => !v)}>Problem</button>
                  <button className={`ip-btn${showTemplates ? " on" : ""}`} onClick={() => setShowTemplates((v) => !v)}>Templates</button>
                  <button className="ip-btn" onClick={() => fileRef.current?.click()}>Background</button>
                  {page.bg && <button className="ip-btn warn" onClick={() => patchPage(activePage, { bg: null })}>Remove bg</button>}
                  <button className="ip-btn" onClick={() => bumpPage("exportSig")}>Export</button>
                </>
              )}
              <button className={`ip-btn${fingerDraws ? " on" : ""}`} onClick={() => setFingerDraws((v) => !v)}>Finger draws</button>
              <button className="ip-btn" onClick={toggleFullscreen}>Full screen</button>
            </div>
          )}

          {onWhiteboard && showProblem && (
            <div className="ip-row">
              <textarea
                className="ip-problem-in"
                placeholder="One problem per line - they show on the board with space to solve."
                value={page.problem ?? ""}
                onChange={(e) => patchPage(activePage, { problem: e.target.value ? e.target.value : null })}
                rows={2}
              />
              <button className="ip-btn warn" onClick={() => patchPage(activePage, { problem: null })}>Clear problem</button>
            </div>
          )}

          {onWhiteboard && showTemplates && (
            <div className="ip-row">
              {BOARD_TEMPLATES.map((t) => (
                <button key={t.id} className="ip-btn" onClick={() => { patchPage(activePage, { bg: t.build() }); setShowTemplates(false); }}>{t.label}</button>
              ))}
            </div>
          )}
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} style={{ display: "none" }} />

      <div className="ip-stage">
        {onWhiteboard && scratchOpen && (
          <div className="ip-scratch">
            <div className="ip-scratch-bar">
              <span className="ip-scratch-title">Scratch</span>
              <span className="ip-spacer" />
              <button className="ip-btn" onClick={() => setScratchUndoSignal((n) => n + 1)}>Undo</button>
              <button className="ip-btn warn" onClick={() => setScratchClear((n) => n + 1)}>Clear</button>
              <button className="ip-btn" onClick={toggleScratch}>Done</button>
            </div>
            <div className="ip-scratch-stage">
              <InkBoard
                room={`${room}__scratch`}
                interactive
                color={color}
                tool={tool}
                penWidth={penWidth}
                fingerDraws={fingerDraws}
                clearSignal={scratchClear}
                undoSignal={scratchUndoSignal}
              />
            </div>
          </div>
        )}
        {/* ONE writing surface for both modes. THE PEN IS ALWAYS THE GLASS
            SHEET - transparent ink over the entire live screen - so the teacher
            writes wherever he wants, always. The Whiteboard button does not
            move the pen or fence it in; it only ADDS a clean white area on the
            left 42%, the exact geometry /teacher/present gives
            .stage-board-panel, to write on instead of over the lesson content.
            Getting this wrong once already: confining the pen to the panel is
            NOT what "half whiteboard half screen" means.
            The panel stays an ink-room member rather than a plain white div so
            Background, Template and the file import keep syncing to the wall on
            room <room> with no new wire protocol - it carries the paper, the
            glass sheet on top carries the writing. The stage is letterboxed to
            the projector's own aspect ratio, so hand and wall always match. */}
        <div className="ip-screen-stage">
          <div className="ip-screen-box" style={{ aspectRatio: String(screenAr) }}>
            <iframe
              className="ip-screen-frame"
              src={`/teacher/present?embed=1${room !== "main" ? `&room=${encodeURIComponent(room)}` : ""}`}
              title="Live class screen"
            />
            <div className="ip-wb-panel" style={onWhiteboard ? undefined : { display: "none" }}>
              {pages.map((p, i) => (
                <InkBoard
                  key={i}
                  room={i === 0 ? room : `${room}__p${i}`}
                  interactive
                  hidden={!onWhiteboard || i !== activePage}
                  allowZoom
                  paper="dots"
                  color={color}
                  tool={tool}
                  penWidth={penWidth}
                  fingerDraws={fingerDraws}
                  background={p.bg}
                  problem={p.problem}
                  clearSignal={p.clear}
                  undoSignal={p.undo}
                  redoSignal={p.redo}
                  exportSignal={p.exportSig}
                  onExport={handleExport}
                  onHistoryChange={(undo, redo) => { historiesRef.current[i] = { undo, redo }; }}
                  onConnectionChange={i === 0 ? setBoardStatus : undefined}
                />
              ))}
            </div>
            {/* LAST and highest, so it takes every pointer event and the panel
                below can never steal a stroke. This is the pen in both modes. */}
            <div className="ip-ink-layer">
              <InkBoard
                room={`${room}__over`}
                interactive
                transparent
                color={color}
                tool={tool}
                penWidth={penWidth}
                fingerDraws={fingerDraws}
                clearSignal={screenClearSignal}
                undoSignal={undoSignal}
                redoSignal={redoSignal}
                onHistoryChange={(undo, redo) => {
                  screenHistoryRef.current = { undo, redo };
                  setHistory({ undo, redo });
                }}
              />
            </div>
            <span className="ip-screen-note">
              {onWhiteboard ? "Whiteboard open - write anywhere" : "Writing over the class screen"}
            </span>
          </div>
        </div>
      </div>

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
