"use client";

// The lesson screen renderer. Draws ONE surface (main projector / pace + support / student
// Chromebook) at a literal 1920x1080 so projector type sizes are honest; the caller scales the
// whole thing with a CSS transform. Pure presentation - all data and layout come in as props, and
// the optional editor affordances (selection, per-frame toolbar, dashed empty zones) are what the
// studio adds on top. The live surfaces can render the same component with the editor props omitted.

import type { CSSProperties, PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from "react";
import { useEffect, useState } from "react";
import { resolveSlideSource } from "@/lib/embedUrl";
import {
  BLOCK_FLEX,
  MANIP_FREE_DEFAULT,
  MATH_COLORS,
  SCREEN_NEUTRALS,
  ZONE_EMPTY_LABEL,
  ZONE_FLEX,
  isDemoComponentType,
  mmss,
  resolveScreenValue,
  stateStyleFor,
  type ManipState,
  type ScreenBlock,
  type ScreenKey,
  type ScreenStepData,
  type ScreenZones,
} from "@/lib/lessonScreenModel";

export type BlockAction = "up" | "down" | "zone" | "del";

export interface LessonScreenProps {
  data: ScreenStepData;
  screen: ScreenKey;
  zones: ScreenZones;
  totalSteps: number;
  nextTitle?: string;
  studentName?: string;
  editing?: boolean;
  selectedId?: string | null;
  // Let an embedded board or website take pointer input. OFF by default: a projector is a display,
  // and a stray touch on the driving laptop must not scroll a board mid-lesson. See SlideFrame.
  boardInteractive?: boolean;
  // When set (the studio preview), the dotted ground is drawn on this scaled layer and its pattern
  // is divided by the scale so it holds an ~11px grid at preview size. Omitted on a real projector.
  dotScale?: number;
  // Live state for demonstration objects, keyed by block id, plus the callback to update it. Both
  // are supplied only where demo objects are interactive (the studio); omit them elsewhere.
  manip?: Record<string, ManipState>;
  onManipChange?: (id: string, patch: ManipState) => void;
  onSelectBlock?: (id: string) => void;
  onSelectZone?: () => void;
  onBlockAction?: (id: string, action: BlockAction) => void;
}

const lines = (value: string): string[] =>
  String(value || "").split("\n").map((line) => line.trim()).filter(Boolean);

function placeholder(editing: boolean, label: string): string {
  return editing ? label : "";
}

export default function LessonScreen({
  data,
  screen,
  zones,
  totalSteps,
  nextTitle = "end of lesson",
  studentName = "Student name",
  editing = false,
  selectedId = null,
  boardInteractive = false,
  dotScale,
  manip = {},
  onManipChange,
  onSelectBlock,
  onSelectZone,
  onBlockAction,
}: LessonScreenProps) {
  const style = stateStyleFor(data.stateId, data.title);

  // Demo-object drag plumbing. Listeners live on window so a drag survives the cursor leaving the
  // element; deltas are divided by the measured (already-scaled) rect, so the same math works under
  // the studio's CSS transform and unscaled on a projector.
  const runDrag = (onMove: (event: PointerEvent) => void) => {
    const up = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", up);
  };

  const manipSplitDrag = (event: ReactPointerEvent<HTMLDivElement>, id: string) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const apply = (clientX: number) => {
      const fraction = (clientX - rect.left) / rect.width;
      onManipChange?.(id, { split: Math.min(1, Math.max(0, fraction)) });
    };
    apply(event.clientX);
    runDrag((moveEvent) => apply(moveEvent.clientX));
  };

  const manipSnapToggle = (event: ReactMouseEvent, id: string) => {
    event.stopPropagation();
    onManipChange?.(id, { snapped: !manip[id]?.snapped });
  };

  const manipFreeMove = (event: ReactPointerEvent<HTMLDivElement>, id: string) => {
    event.stopPropagation();
    const host = event.currentTarget.parentElement;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const start = { ...MANIP_FREE_DEFAULT, ...(manip[id] || {}) };
    const x0 = event.clientX;
    const y0 = event.clientY;
    runDrag((moveEvent) => {
      const dx = ((moveEvent.clientX - x0) / rect.width) * 100;
      const dy = ((moveEvent.clientY - y0) / rect.height) * 100;
      onManipChange?.(id, {
        fx: Math.min(100 - start.fw, Math.max(0, start.fx + dx)),
        fy: Math.min(100 - start.fh, Math.max(0, start.fy + dy)),
      });
    });
  };

  const manipFreeResize = (event: ReactPointerEvent<HTMLSpanElement>, id: string) => {
    event.stopPropagation();
    const box = event.currentTarget.parentElement;
    const host = box?.parentElement;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const start = { ...MANIP_FREE_DEFAULT, ...(manip[id] || {}) };
    const x0 = event.clientX;
    const y0 = event.clientY;
    runDrag((moveEvent) => {
      const dx = ((moveEvent.clientX - x0) / rect.width) * 100;
      const dy = ((moveEvent.clientY - y0) / rect.height) * 100;
      onManipChange?.(id, {
        fw: Math.min(100 - start.fx, Math.max(8, start.fw + dx)),
        fh: Math.min(100 - start.fy, Math.max(8, start.fh + dy)),
      });
    });
  };

  const demoBody = (block: ScreenBlock) => {
    const value = (key: string) => resolveScreenValue(data, block, key);
    const live = manip[block.id] || {};
    if (block.type === "manipSplit") {
      const cols = Math.max(1, Number(value("cols")) || 28);
      const rows = Math.max(1, Number(value("rows")) || 6);
      const base = data.model.cols ? data.model.split / data.model.cols : 0.7;
      const at = Math.min(cols - 1, Math.max(1, Math.round((live.split === undefined ? base : live.split) * cols)));
      const splitPct = ((at / cols) * 100).toFixed(3) + "%";
      return (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
            <span style={demoTitle}>{value("modelTitle") || "Slide the split"}</span>
            <span style={demoHint}>Drag the line</span>
          </div>
          <div
            onPointerDown={(event) => manipSplitDrag(event, block.id)}
            style={{
              position: "relative",
              minHeight: 230,
              height: "100%",
              border: "4px solid #201E1A",
              borderRadius: 8,
              backgroundColor: "#fff",
              backgroundImage: "linear-gradient(to right,rgba(32,30,26,.17) 1px,transparent 1px),linear-gradient(to bottom,rgba(32,30,26,.17) 1px,transparent 1px)",
              backgroundSize: `calc(100%/${cols}) calc(100%/${rows})`,
              cursor: "ew-resize",
              touchAction: "none",
            }}
          >
            <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, background: MATH_COLORS.firstAddendFill, display: "grid", placeItems: "end center", paddingBottom: 16, width: splitPct }}>
              <span style={{ border: "3px solid #D88A1C", borderRadius: 999, background: "#fff", padding: "6px 20px", fontSize: 34, fontWeight: 900, color: MATH_COLORS.firstAddendInk, fontVariantNumeric: "tabular-nums" }}>{at} wide</span>
            </div>
            <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, background: MATH_COLORS.secondAddendFill, display: "grid", placeItems: "end center", paddingBottom: 16, width: (100 - (at / cols) * 100).toFixed(3) + "%" }}>
              <span style={{ border: "3px solid #67429E", borderRadius: 999, background: "#fff", padding: "6px 20px", fontSize: 34, fontWeight: 900, color: MATH_COLORS.secondAddendInk, fontVariantNumeric: "tabular-nums" }}>{cols - at} wide</span>
            </div>
            <div style={{ position: "absolute", top: -18, bottom: -18, width: 8, marginLeft: -4, borderRadius: 999, background: "#201E1A", left: splitPct }}>
              <span style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 52, height: 52, borderRadius: 999, border: "6px solid #201E1A", background: "#fff", display: "grid", placeItems: "center", fontSize: 24, fontWeight: 900, color: "#201E1A" }}>↔</span>
            </div>
          </div>
        </>
      );
    }
    if (block.type === "manipSnap") {
      const rowsN = Math.max(1, Number(value("snapRows")) || 8);
      const a = Math.max(1, Number(value("snapA")) || 5);
      const c = Math.max(1, Number(value("snapB")) || 4);
      const snapped = Boolean(live.snapped);
      const hint = snapped
        ? `${rowsN} by ${a + c} · area ${rowsN * (a + c)}`
        : `${rowsN} × ${a} = ${rowsN * a}   ·   ${rowsN} × ${c} = ${rowsN * c}`;
      return (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
            <span style={demoTitle}>{value("modelTitle") || "Snap two pieces"}</span>
            <span style={demoHint}>{hint}</span>
          </div>
          <div style={{ display: "grid", justifyItems: "center", gap: 22 }}>
            <div style={{ display: "flex", alignItems: "flex-start", transition: "gap 700ms cubic-bezier(.2,.7,.2,1)", gap: snapped ? 0 : 46 }}>
              <div style={{ display: "grid", gap: 12, justifyItems: "center" }}>
                <div style={{ width: 210, height: 320, border: "4px solid #201E1A", borderRadius: 8, backgroundColor: MATH_COLORS.firstAddendFill, backgroundImage: "linear-gradient(to right,rgba(32,30,26,.2) 1px,transparent 1px),linear-gradient(to bottom,rgba(32,30,26,.2) 1px,transparent 1px)", backgroundSize: `calc(100%/${a}) calc(100%/${rowsN})` }} />
                <span style={{ fontSize: 30, fontWeight: 900, color: MATH_COLORS.firstAddendInk }}>{rowsN} by {a}</span>
              </div>
              <div style={{ display: "grid", gap: 12, justifyItems: "center" }}>
                <div style={{ width: 168, height: 320, border: "4px solid #201E1A", borderRadius: 8, backgroundColor: MATH_COLORS.secondAddendFill, backgroundImage: "linear-gradient(to right,rgba(32,30,26,.2) 1px,transparent 1px),linear-gradient(to bottom,rgba(32,30,26,.2) 1px,transparent 1px)", backgroundSize: `calc(100%/${c}) calc(100%/${rowsN})` }} />
                <span style={{ fontSize: 30, fontWeight: 900, color: MATH_COLORS.secondAddendInk }}>{rowsN} by {c}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={(event) => manipSnapToggle(event, block.id)}
              style={{ border: "3px solid #201E1A", borderRadius: 999, background: "#201E1A", color: "#fff", padding: "16px 40px", fontSize: 30, fontWeight: 900, cursor: "pointer", fontFamily: "inherit" }}
            >
              {snapped ? "Pull apart" : "Push together"}
            </button>
          </div>
        </>
      );
    }
    // manipFree
    const f = { ...MANIP_FREE_DEFAULT, ...live };
    return (
      <>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
          <span style={demoTitle}>{value("modelTitle") || "Move + resize"}</span>
          <span style={demoHint}>Drag to move · corner to resize</span>
        </div>
        <div style={{ position: "relative", minHeight: 250, height: "100%", borderRadius: 10, backgroundColor: "#fff", backgroundImage: "linear-gradient(to right,rgba(32,30,26,.12) 1px,transparent 1px),linear-gradient(to bottom,rgba(32,30,26,.12) 1px,transparent 1px)", backgroundSize: "48px 48px", overflow: "hidden", touchAction: "none" }}>
          <div
            onPointerDown={(event) => manipFreeMove(event, block.id)}
            style={{ position: "absolute", border: "5px solid #201E1A", borderRadius: 6, background: "rgba(80,163,164,.34)", cursor: "move", display: "grid", placeItems: "center", left: f.fx.toFixed(2) + "%", top: f.fy.toFixed(2) + "%", width: f.fw.toFixed(2) + "%", height: f.fh.toFixed(2) + "%" }}
          >
            <span
              onPointerDown={(event) => manipFreeResize(event, block.id)}
              style={{ position: "absolute", right: -14, bottom: -14, width: 44, height: 44, border: "5px solid #201E1A", borderRadius: 10, background: "#fff", cursor: "nwse-resize" }}
            />
          </div>
        </div>
      </>
    );
  };
  const isStudent = screen === "student";
  const bandWidth = isStudent ? 214 : 220;
  const screenLabel = screen === "main" ? "Main projector" : screen === "pace" ? "Pace + Support" : "Student";

  const groundBackground: CSSProperties = dotScale
    ? (() => {
        const divisor = Math.max(dotScale, 0.05);
        return {
          backgroundColor: SCREEN_NEUTRALS.screenBase,
          backgroundImage: `radial-gradient(circle, ${SCREEN_NEUTRALS.dotScreen} ${(0.45 / divisor).toFixed(2)}px, transparent ${(0.7 / divisor).toFixed(2)}px)`,
          backgroundSize: `${(11 / divisor).toFixed(1)}px ${(11 / divisor).toFixed(1)}px`,
        };
      })()
    : { background: SCREEN_NEUTRALS.screenBase };

  const dots = Array.from({ length: totalSteps }, (_, index) => index < data.order);

  const renderBlock = (block: ScreenBlock, zoneIndex: number) => {
    const value = (key: string) => resolveScreenValue(data, block, key);
    const selected = editing && block.id === selectedId;
    const align: CSSProperties["alignContent"] =
      block.type === "model" || block.type === "equation" ? "center" : "start";

    const cardStyle: CSSProperties = {
      position: "relative",
      flex: BLOCK_FLEX[block.type] || "0 0 auto",
      minHeight: 0,
      border: selected ? "3px solid #50A3A4" : "1px solid " + SCREEN_NEUTRALS.hairline,
      borderRadius: 26,
      background: "#fff",
      boxShadow: "0 14px 36px rgba(40,32,20,.1)",
      padding: block.type === "slide" ? 0 : "30px 34px",
      overflow: block.type === "slide" ? "hidden" : undefined,
      display: "grid",
      gap: block.type === "slide" ? 0 : 20,
      alignContent: block.type === "slide" ? "stretch" : align,
      cursor: editing ? "pointer" : "default",
      outline: selected ? "3px solid rgba(80,163,164,.4)" : "none",
      outlineOffset: 7,
    };

    return (
      <div
        key={block.id}
        style={cardStyle}
        onClick={editing ? (event) => { event.stopPropagation(); onSelectBlock?.(block.id); } : undefined}
      >
        {selected ? (
          <div style={{ position: "absolute", top: -30, right: 0, display: "flex", gap: 7, zIndex: 5 }}>
            {(["up", "down"] as const).map((action) => (
              <button
                key={action}
                type="button"
                onClick={(event) => { event.stopPropagation(); onBlockAction?.(block.id, action); }}
                style={toolbarButton}
                aria-label={action === "up" ? "Move up" : "Move down"}
              >
                {action === "up" ? "↑" : "↓"}
              </button>
            ))}
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); onBlockAction?.(block.id, "zone"); }}
              style={{ ...toolbarButton, width: "auto", padding: "0 14px", fontSize: 19 }}
            >
              {zoneIndex === 0 ? "move right" : "move left"}
            </button>
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); onBlockAction?.(block.id, "del"); }}
              style={{ ...toolbarButton, border: "3px solid #F95335", background: "#F95335", color: "#fff" }}
              aria-label="Delete frame"
            >
              {"×"}
            </button>
          </div>
        ) : null}

        {isDemoComponentType(block.type) ? demoBody(block) : blockBody(block, screen, value, style, editing, boardInteractive)}
      </div>
    );
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: 1920,
        height: 1080,
        display: "grid",
        gridTemplateColumns: `${bandWidth}px minmax(0,1fr)`,
        ...groundBackground,
        color: SCREEN_NEUTRALS.ink,
        fontFamily: "var(--bdb-font, 'Albert Sans', system-ui, sans-serif)",
      }}
    >
      {/* Locked band - derived from Notion, never editable from the studio. */}
      <div
        style={{
          display: "grid",
          gridTemplateRows: "auto minmax(0,1fr) auto auto",
          justifyItems: "center",
          gap: 24,
          padding: "40px 0 32px",
          boxShadow: "10px 0 30px -10px rgba(40,32,20,.3)",
          background: style.accent,
        }}
      >
        <span
          style={{
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
            fontSize: 60,
            fontWeight: 900,
            letterSpacing: ".05em",
            textTransform: "uppercase",
            color: "#fff",
            lineHeight: 1,
            alignSelf: "start",
          }}
        >
          {style.word}
        </span>
        <div style={{ display: "grid", gap: 12, alignContent: "center" }}>
          {dots.map((filled, index) => (
            <span
              key={index}
              style={{
                width: 24,
                height: 9,
                borderRadius: 999,
                background: filled ? "#fff" : "rgba(255,255,255,.38)",
              }}
            />
          ))}
        </div>
        <div style={{ display: "grid", justifyItems: "center", gap: 2, color: "#fff" }}>
          <span style={{ fontSize: 68, fontWeight: 800, lineHeight: 0.9, letterSpacing: "-.04em", fontVariantNumeric: "tabular-nums" }}>
            {mmss(data.duration)}
          </span>
          <span style={{ fontSize: 20, fontWeight: 900, letterSpacing: ".12em", textTransform: "uppercase", color: "rgba(255,255,255,.85)" }}>
            Step {data.order} / {totalSteps}
          </span>
        </div>
        <span style={{ fontSize: 19, fontWeight: 900, letterSpacing: ".12em", textTransform: "uppercase", color: "rgba(255,255,255,.82)", textAlign: "center", lineHeight: 1.3 }}>
          {editing ? screenLabel : ""}
        </span>
      </div>

      {/* Content area. */}
      <div style={{ display: "grid", gridTemplateRows: isStudent ? "60px minmax(0,1fr)" : "minmax(0,1fr)", minWidth: 0 }}>
        {isStudent ? (
          <div style={{ display: "flex", alignItems: "center", gap: 26, padding: "0 42px", background: "rgba(255,255,255,.66)", borderBottom: "1px solid rgba(120,110,90,.16)", fontSize: 25, fontWeight: 800, color: "#6F675C", letterSpacing: ".03em" }}>
            <span>Step {data.order} of {totalSteps}</span>
            <span style={{ color: SCREEN_NEUTRALS.placeholder }}>Next: {nextTitle}</span>
            <span style={{ marginLeft: "auto", color: SCREEN_NEUTRALS.placeholder }}>{studentName}</span>
          </div>
        ) : null}
        <div style={{ display: "flex", gap: 44, padding: "44px 48px", minWidth: 0, alignItems: "stretch" }}>
          {/* On the live wall an empty zone is wasted space, so it collapses and the content takes the
              full width; in the studio editor every zone stays visible so a frame can be dropped in. */}
          {(editing ? zones : zones.filter((blocks) => blocks.length > 0)).map((blocks, zoneIndex) => (
            <div
              key={zoneIndex}
              onClick={editing ? () => onSelectZone?.() : undefined}
              // On the live wall the content is centred vertically so a short slide reads as
              // intentional instead of top-heavy; the studio editor keeps top alignment for authoring.
              style={{ display: "flex", flexDirection: "column", justifyContent: editing ? "flex-start" : "center", gap: 26, minWidth: 0, flex: ZONE_FLEX[screen][zoneIndex], borderRadius: 26 }}
            >
              {blocks.map((block) => renderBlock(block, zoneIndex))}
              {blocks.length === 0 && editing ? (
                <div style={{ flex: 1, border: "3px dashed rgba(120,110,90,.42)", borderRadius: 26, background: "transparent", display: "grid", placeItems: "center", alignContent: "center", gap: 10 }}>
                  <span style={{ fontSize: 30, fontWeight: 900, letterSpacing: ".14em", textTransform: "uppercase", color: SCREEN_NEUTRALS.placeholder }}>
                    {ZONE_EMPTY_LABEL[screen][zoneIndex]}
                  </span>
                  {editing ? (
                    <span style={{ fontSize: 23, fontWeight: 800, color: SCREEN_NEUTRALS.placeholderSoft }}>Add a frame from the left</span>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// One outside visual inside the lesson frame: an exported slide image, or a live Lucid / Figma /
// Canva / Google Slides board. The band, the state word, the step counter and the clock are drawn
// by LessonScreen around this and are not this component's business.
//
// A board is view-and-pan only on a projector - editing needs a login the projector does not have.
// That is deliberate: the board is the visual, and the iPad ink sheet on top is where the class
// writes. When ink is armed the sheet captures pointer events and the board stops panning, which
// is the correct trade rather than a bug.
function SlideFrame({ rawUrl, fit, editing, interactive }: { rawUrl: string; fit: "contain" | "cover"; editing: boolean; interactive: boolean }) {
  const source = resolveSlideSource(rawUrl);
  const [loaded, setLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setTimedOut(false);
    if (source.kind !== "embed" && source.kind !== "site") return;
    // School wifi is the real failure mode. Four seconds, then say so in words rather than
    // leaving a white void on the projector.
    const timer = setTimeout(() => setTimedOut(true), 4000);
    return () => clearTimeout(timer);
  }, [source.kind, source.url]);

  const shell: CSSProperties = {
    width: "100%",
    height: "100%",
    minHeight: 0,
    display: "grid",
    placeItems: "center",
    background: SCREEN_NEUTRALS.paper,
  };

  if (source.kind === "image") {
    return (
      <div style={shell}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={source.url}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: fit, display: "block" }}
        />
      </div>
    );
  }

  if (source.kind === "embed" || source.kind === "site") {
    return (
      <div style={{ ...shell, position: "relative" }}>
        <iframe
          src={source.url}
          title={source.kind === "site" ? "Lesson website" : "Lesson board"}
          onLoad={() => setLoaded(true)}
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          style={{ width: "100%", height: "100%", border: "none", display: "block" }}
        />
        {/* An iframe swallows pointer events, so it is shielded unless someone deliberately asks for
            an interactive board. In the studio the shield is always on, or a click meant to select
            the frame would disappear into the embed. This is also what keeps the projector inert
            under the iPad glass sheet - the ink canvas on /ipad sits above this whole surface, so
            the pen already writes over a board; the shield just stops the board fighting back. */}
        {interactive && !editing ? null : (
          <div style={{ position: "absolute", inset: 0, background: "transparent" }} aria-hidden />
        )}
        {timedOut && !loaded ? (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", alignContent: "center", gap: 14, background: SCREEN_NEUTRALS.paper, padding: 40, textAlign: "center" }}>
            <span style={{ fontSize: 46, fontWeight: 900, color: SCREEN_NEUTRALS.body }}>
              {source.kind === "site" ? "Page did not load" : "Board did not load"}
            </span>
            <span style={{ fontSize: 28, fontWeight: 800, color: SCREEN_NEUTRALS.placeholder }}>Keep going - it is not part of the math</span>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div style={{ ...shell, alignContent: "center", gap: 12, padding: 40, textAlign: "center" }}>
      <span style={{ fontSize: 34, fontWeight: 900, letterSpacing: ".1em", textTransform: "uppercase", color: SCREEN_NEUTRALS.placeholder }}>
        Slide or board
      </span>
      <span style={{ fontSize: 26, fontWeight: 800, color: SCREEN_NEUTRALS.placeholderSoft }}>
        {editing ? source.reason || "Paste a slide image, a website, or a Lucid, Figma, Canva or Google Slides link" : ""}
      </span>
    </div>
  );
}

const demoTitle: CSSProperties = {
  fontSize: 27,
  fontWeight: 900,
  letterSpacing: ".1em",
  textTransform: "uppercase",
  color: MATH_COLORS.frontFactorInk,
};

const demoHint: CSSProperties = {
  marginLeft: "auto",
  fontSize: 23,
  fontWeight: 800,
  color: SCREEN_NEUTRALS.placeholder,
};

const toolbarButton: CSSProperties = {
  width: 46,
  height: 46,
  border: "3px solid #201E1A",
  borderRadius: 12,
  background: "#fff",
  color: "#201E1A",
  fontSize: 20,
  fontWeight: 900,
  cursor: "pointer",
  lineHeight: 1,
};

function blockBody(
  block: ScreenBlock,
  screen: ScreenKey,
  value: (key: string) => string,
  style: ReturnType<typeof stateStyleFor>,
  editing: boolean,
  interactive: boolean,
) {
  switch (block.type) {
    case "prompt": {
      const size = screen === "student" ? 52 : screen === "pace" ? 80 : 64;
      const text = value("mainDisplay");
      return (
        <h2 style={{ margin: 0, fontSize: size, fontWeight: 800, lineHeight: 1.02, letterSpacing: "-.03em", color: SCREEN_NEUTRALS.promptInk, textWrap: "balance" } as CSSProperties}>
          {text || placeholder(editing, "Main Display")}
        </h2>
      );
    }
    case "slide": {
      return (
        <SlideFrame
          rawUrl={value("slideUrl")}
          fit={value("slideFit") === "cover" ? "cover" : "contain"}
          editing={editing}
          interactive={interactive}
        />
      );
    }
    case "text": {
      const text = value("screenNotes");
      return (
        <p style={{ margin: 0, fontSize: 32, fontWeight: 750, lineHeight: 1.32, color: text ? SCREEN_NEUTRALS.body : SCREEN_NEUTRALS.placeholder }}>
          {text || placeholder(editing, "Screen note - add text, or type in Notion's Screen Notes")}
        </p>
      );
    }
    case "model": {
      const cols = Math.max(1, Number(value("cols")) || 1);
      const rows = Math.max(1, Number(value("rows")) || 1);
      const split = Math.min(cols, Math.max(0, Number(value("split")) || 0));
      const leftPct = ((split / cols) * 100).toFixed(2) + "%";
      const rightPct = (100 - (split / cols) * 100).toFixed(2) + "%";
      return (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
            <span style={{ fontSize: 27, fontWeight: 900, letterSpacing: ".1em", textTransform: "uppercase", color: MATH_COLORS.frontFactorInk }}>{value("modelTitle")}</span>
            <span style={{ marginLeft: "auto", fontSize: 23, fontWeight: 800, color: SCREEN_NEUTRALS.placeholder }}>{value("modelHint")}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "86px minmax(0,1fr)", gap: 20, alignItems: "center" }}>
            <div style={{ display: "grid", justifyItems: "center", gap: 6, color: MATH_COLORS.frontFactorInk }}>
              <span style={{ fontSize: 66, fontWeight: 900, lineHeight: 0.9, letterSpacing: "-.04em" }}>{rows}</span>
              <span style={{ fontSize: 21, fontWeight: 850, letterSpacing: ".06em", textTransform: "uppercase" }}>rows</span>
            </div>
            <div
              style={{
                position: "relative",
                minHeight: 210,
                height: "100%",
                border: "4px solid #201E1A",
                borderRadius: 8,
                backgroundColor: "#fff",
                backgroundImage: "linear-gradient(to right,rgba(32,30,26,.17) 1px,transparent 1px),linear-gradient(to bottom,rgba(32,30,26,.17) 1px,transparent 1px)",
                backgroundSize: `calc(100%/${cols}) calc(100%/${rows})`,
              }}
            >
              <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, background: MATH_COLORS.firstAddendFill, display: "grid", placeItems: "center", width: leftPct }}>
                <span style={{ fontSize: 52, fontWeight: 900, color: MATH_COLORS.firstAddendInk, fontVariantNumeric: "tabular-nums" }}>{value("leftLabel")}</span>
              </div>
              <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, background: MATH_COLORS.secondAddendFill, display: "grid", placeItems: "center", width: rightPct }}>
                <span style={{ fontSize: 52, fontWeight: 900, color: MATH_COLORS.secondAddendInk, fontVariantNumeric: "tabular-nums" }}>{value("rightLabel")}</span>
              </div>
              <div style={{ position: "absolute", top: -14, bottom: -14, width: 8, marginLeft: -4, borderRadius: 999, background: "#201E1A", left: leftPct }} />
            </div>
          </div>
        </>
      );
    }
    case "doThis": {
      const items = lines(value("paceDirections"));
      return (
        <>
          <p style={{ margin: 0, fontSize: 25, fontWeight: 900, letterSpacing: ".12em", textTransform: "uppercase", color: style.ink }}>{value("doThisTitle")}</p>
          <div style={{ display: "grid", gap: 18 }}>
            {items.length ? items.map((text, index) => (
              <p key={index} style={{ margin: 0, display: "flex", gap: 18, alignItems: "baseline", fontSize: 36, fontWeight: 800, color: "#201E1A" }}>
                <span style={{ minWidth: 54, height: 54, display: "grid", placeItems: "center", borderRadius: 14, background: style.chipBg, color: style.chipInk, fontSize: 28 }}>{index + 1}</span>
                {text}
              </p>
            )) : (
              <p style={{ margin: 0, fontSize: 30, fontWeight: 750, color: SCREEN_NEUTRALS.placeholder }}>{placeholder(editing, "Pace Directions - one step per line")}</p>
            )}
          </div>
        </>
      );
    }
    case "timer":
      return (
        <div style={{ display: "grid", justifyItems: "center", gap: 8 }}>
          <span style={{ fontSize: 132, fontWeight: 800, lineHeight: 0.86, letterSpacing: "-.05em", fontVariantNumeric: "tabular-nums", color: style.ink }}>{value("time")}</span>
          <span style={{ fontSize: 25, fontWeight: 850, letterSpacing: ".1em", textTransform: "uppercase", color: SCREEN_NEUTRALS.muted }}>{value("timerLabel")}</span>
        </div>
      );
    case "support": {
      const items = lines(value("vocabulary"));
      return (
        <>
          <span style={{ fontSize: 23, fontWeight: 900, letterSpacing: ".12em", textTransform: "uppercase", color: style.ink }}>{value("supportTitle")}</span>
          <div style={{ display: "grid", gap: 12 }}>
            {items.length ? items.map((text, index) => (
              <p key={index} style={{ margin: 0, fontSize: 31, fontWeight: 850, color: "#201E1A" }}>{text}</p>
            )) : (
              <p style={{ margin: 0, fontSize: 28, fontWeight: 750, color: SCREEN_NEUTRALS.placeholder }}>{placeholder(editing, "Vocabulary - one term per line")}</p>
            )}
          </div>
        </>
      );
    }
    case "equation":
      return (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, flexWrap: "wrap", fontSize: 66, fontWeight: 900, color: "#201E1A", fontVariantNumeric: "tabular-nums", letterSpacing: "-.02em" }}>
            <span style={{ color: MATH_COLORS.frontFactorInk }}>{value("front")}</span>
            <span>{"× ("}</span>
            <span style={{ color: MATH_COLORS.firstAddendInk }}>{value("partA")}</span>
            <span>+</span>
            <span style={{ color: MATH_COLORS.secondAddendInk }}>{value("partB")}</span>
            <span>) =</span>
            <span style={{ width: 104, height: 96, border: "6px solid #FCAF38", borderRadius: 18, background: "#fff" }} />
            <span>+</span>
            <span style={{ width: 104, height: 96, border: "6px solid #845BC9", borderRadius: 18, background: "#fff" }} />
            <span>=</span>
            <span style={{ width: 124, height: 96, border: "6px solid #201E1A", borderRadius: 18, background: "#fff" }} />
          </div>
          {value("equationNote") ? (
            <p style={{ margin: 0, textAlign: "center", fontSize: 26, fontWeight: 800, color: SCREEN_NEUTRALS.muted }}>{value("equationNote")}</p>
          ) : null}
        </>
      );
    case "legend":
      return (
        <>
          <span style={{ fontSize: 23, fontWeight: 900, letterSpacing: ".12em", textTransform: "uppercase", color: MATH_COLORS.frontFactorInk }}>{value("legendTitle")}</span>
          <div style={{ display: "grid", gap: 14 }}>
            {[
              { color: MATH_COLORS.frontFactor, label: "front factor" },
              { color: MATH_COLORS.firstAddend, label: "first addend" },
              { color: MATH_COLORS.secondAddend, label: "second addend" },
            ].map((swatch) => (
              <span key={swatch.label} style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 28, fontWeight: 800, color: SCREEN_NEUTRALS.body }}>
                <span style={{ width: 26, height: 26, borderRadius: 7, background: swatch.color }} />
                {swatch.label}
              </span>
            ))}
          </div>
        </>
      );
    case "callout": {
      const text = value("studentDirections");
      return (
        <p style={{ margin: 0, fontSize: 30, fontWeight: 850, color: text ? "#201E1A" : SCREEN_NEUTRALS.placeholder }}>
          {text || placeholder(editing, "Student Directions")}
        </p>
      );
    }
    default:
      return null;
  }
}
