"use client";

// Public preview of the DEFAULT projector slide (no login, no session). It renders the SAME
// LessonScreen the projector shows for a plain worded/info state - the studio frame with the
// auto-composed content, centred, at a real 1920x1080 scaled to fit. Type into the box to watch a
// long direction auto-fit and stay in the frame. This exists so the slide can be seen in a browser
// directly instead of only in a screenshot.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import LessonScreen from "@/components/screen/LessonScreen";
import { stepScreenData, defaultZones } from "@/lib/lessonScreenModel";

const STATES: { id: string; label: string }[] = [
  { id: "concrete", label: "Build it (green)" },
  { id: "independent", label: "Work time (orange)" },
  { id: "review", label: "Review (teal)" },
  { id: "launch", label: "Launch (brown)" },
];

// Scale a 1920x1080 stage to the column width, holding 16:9 so it fits exactly (no overflow).
function Stage({ children, maxWidth = 1180 }: { children: ReactNode; maxWidth?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useLayoutEffect(() => {
    const measure = () => {
      const width = ref.current?.clientWidth ?? 0;
      if (width > 0) setScale(width / 1920);
    };
    measure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (observer && ref.current) observer.observe(ref.current);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  return (
    <div
      ref={ref}
      style={{ width: "100%", maxWidth, aspectRatio: "16 / 9", position: "relative", overflow: "hidden", borderRadius: 14, boxShadow: "0 24px 60px rgba(32,30,26,0.16)", background: "#F6F3EC" }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, width: 1920, height: 1080, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <div style={{ position: "relative", width: 1920, height: 1080 }}>{children}</div>
      </div>
    </div>
  );
}

export default function DirectionPreviewPage() {
  const [direction, setDirection] = useState("Make as many rectangles as you can with 24 tiles. Write the dimensions on your whiteboard.");
  const [stateId, setStateId] = useState("concrete");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("direction")) setDirection(q.get("direction")!);
    if (q.get("state")) setStateId(q.get("state")!);
  }, []);

  const label = STATES.find((s) => s.id === stateId)?.label.replace(/\s*\(.*\)$/, "") || "Concrete";
  const data = stepScreenData({
    order: 3,
    duration: 8,
    title: label,
    stateId,
    mainDisplay: direction,
    paceDirections: "",
    studentDirections: "",
    vocabulary: "",
    question: "",
    responseMode: "None",
    screenNotes: "",
    slideUrl: "",
  });
  const zones = defaultZones(data, "main");

  return (
    <div className="dp-root">
      <style>{`
        .dp-root { min-height:100vh; background:#ece5d4; color:#201e1a; font-family:var(--bdb-font,'Albert Sans',system-ui,sans-serif); padding:36px clamp(20px,4vw,64px) 80px; }
        .dp-h1 { font-size:30px; font-weight:800; letter-spacing:-0.02em; margin:0 0 6px; }
        .dp-sub { font-size:16px; color:#6f675c; margin:0 0 26px; max-width:760px; line-height:1.5; }
        .dp-ctrls { display:flex; flex-wrap:wrap; gap:16px; align-items:flex-start; margin:0 0 24px; }
        .dp-field { display:grid; gap:6px; }
        .dp-label { font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#6f675c; }
        .dp-ctrls textarea, .dp-ctrls select { font-family:inherit; font-size:15px; color:#201e1a; background:#fff; border:1px solid #d8cfbc; border-radius:9px; padding:9px 11px; box-sizing:border-box; }
        .dp-ctrls textarea { width:min(560px,80vw); resize:vertical; line-height:1.4; }
        .dp-count { color:#a08f74; font-weight:600; }
        .dp-cap { font-size:13px; font-weight:700; color:#6f675c; margin:0 0 10px; }
      `}</style>

      <h1 className="dp-h1">Default projector slide</h1>
      <p className="dp-sub">
        This is exactly what the front wall shows for a plain slide &mdash; the studio frame with the content
        auto-composed and centred, at a real 1920&times;1080 scaled to fit. Type a long direction and watch it
        stay in the frame instead of running off the edge (the bug that was live last night, now fixed).
      </p>

      <div className="dp-ctrls">
        <div className="dp-field">
          <span className="dp-label">Direction <span className="dp-count">{direction.trim().length} chars</span></span>
          <textarea rows={3} value={direction} onChange={(e) => setDirection(e.target.value)} />
        </div>
        <div className="dp-field">
          <span className="dp-label">State (band colour)</span>
          <select value={stateId} onChange={(e) => setStateId(e.target.value)}>
            {STATES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      </div>

      <p className="dp-cap">Live preview</p>
      <Stage>
        <LessonScreen data={data} screen="main" zones={zones} totalSteps={8} />
      </Stage>
    </div>
  );
}
