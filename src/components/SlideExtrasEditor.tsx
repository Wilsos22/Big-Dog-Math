"use client";

// The slide-extras stage, add toolbar, and format panel for ONE step's Slide
// Overlay - extracted from /teacher/slides so Screen Studio can mount the same
// editor beside the Main Display box. That is the point: the words on a slide
// and the format of the components sitting on it are edited in one place.
//
// The parent owns the element array, dirty tracking, and persistence. This
// component owns only selection and drag, so it drops into any host.

import { useCallback, useEffect, useRef, useState } from "react";
import { OverlayElementView } from "@/components/SlideOverlayLayer";
import {
  SLIDE_OVERLAY_COLORS,
  type SlideOverlayElement,
  type SlideOverlayElementType,
} from "@/lib/slideOverlay";

const ADDABLE: Array<{ type: SlideOverlayElementType; label: string }> = [
  { type: "text", label: "Text" },
  { type: "equation", label: "Equation" },
  { type: "rect", label: "Rectangle" },
  { type: "circle", label: "Circle" },
  { type: "line", label: "Line" },
  { type: "arrow", label: "Arrow" },
  { type: "image", label: "Image" },
];

function newElement(type: SlideOverlayElementType): SlideOverlayElement {
  const id = Math.random().toString(36).slice(2, 10);
  if (type === "line" || type === "arrow") {
    return { id, type, x: 34, y: 50, x2: 66, y2: 50, color: "#201e1a", thickness: 5 };
  }
  if (type === "rect" || type === "circle") {
    return { id, type, x: 38, y: 36, w: 24, h: type === "circle" ? 28 : 22, color: "#4d8df6", thickness: 5, fill: true };
  }
  if (type === "image") {
    return { id, type, x: 34, y: 30, w: 32, h: 36, url: "" };
  }
  return {
    id,
    type,
    x: 30,
    y: 42,
    w: 40,
    text: type === "equation" ? "4(10 + 6) = 4 {x}/{y}" : "New text",
    color: "#201e1a",
    size: type === "equation" ? 7 : 6,
  };
}

export interface SlideExtrasEditorProps {
  elements: SlideOverlayElement[];
  onChange: (next: SlideOverlayElement[]) => void;
  // Ghosted behind the stage so the teacher can place extras against the real
  // auto-slide text. Main Display and the overlay are independent layers on the
  // projector, so this is the only warning about collisions.
  backgroundText?: string;
  disabled?: boolean;
}

export default function SlideExtrasEditor({ elements, onChange, backgroundText, disabled }: SlideExtrasEditorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Measured, not read from the ref during render: OverlayElementView sizes
  // text as a percentage of stage height, and a ref read lags a render, which
  // made every element paint at the wrong size on first load.
  const [stageHeight, setStageHeight] = useState(540);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    id: string;
    mode: "move" | "resize" | "start" | "end";
    startX: number;
    startY: number;
    origin: SlideOverlayElement;
  } | null>(null);
  const elementsRef = useRef(elements);
  elementsRef.current = elements;

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const measure = () => setStageHeight(node.clientHeight || 540);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const selected = elements.find((element) => element.id === selectedId) || null;

  const updateSelected = useCallback((patch: Partial<SlideOverlayElement>) => {
    if (disabled) return;
    onChange(elementsRef.current.map((el) => (el.id === selectedId ? { ...el, ...patch } : el)));
  }, [disabled, onChange, selectedId]);

  function addElement(type: SlideOverlayElementType) {
    if (disabled) return;
    const element = newElement(type);
    onChange([...elementsRef.current, element]);
    setSelectedId(element.id);
  }

  function removeSelected() {
    if (disabled || !selectedId) return;
    onChange(elementsRef.current.filter((el) => el.id !== selectedId));
    setSelectedId(null);
  }

  function stagePercent(event: PointerEvent | React.PointerEvent): { x: number; y: number } | null {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return null;
    return {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    };
  }

  function onStagePointerMove(event: PointerEvent) {
    const drag = dragRef.current;
    const point = stagePercent(event);
    if (!drag || !point) return;
    const dx = point.x - drag.startX;
    const dy = point.y - drag.startY;
    const origin = drag.origin;
    const patch: Partial<SlideOverlayElement> = {};
    if (drag.mode === "move") {
      patch.x = origin.x + dx;
      patch.y = origin.y + dy;
      if (origin.x2 != null) patch.x2 = origin.x2 + dx;
      if (origin.y2 != null) patch.y2 = origin.y2 + dy;
    } else if (drag.mode === "resize") {
      // Only elements that already carry a height get resized vertically -
      // a text box has width only, and inventing an h would change how it wraps.
      patch.w = Math.max(4, (origin.w ?? 20) + dx);
      if (origin.h != null) patch.h = Math.max(4, origin.h + dy);
    } else if (drag.mode === "start") {
      patch.x = origin.x + dx;
      patch.y = origin.y + dy;
    } else {
      patch.x2 = (origin.x2 ?? origin.x) + dx;
      patch.y2 = (origin.y2 ?? origin.y) + dy;
    }
    onChange(elementsRef.current.map((el) => (el.id === drag.id ? { ...el, ...patch } : el)));
  }

  function onStagePointerUp() {
    dragRef.current = null;
    window.removeEventListener("pointermove", onStagePointerMove);
  }

  function beginDrag(event: React.PointerEvent, id: string, mode: "move" | "resize" | "start" | "end") {
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();
    const point = stagePercent(event);
    const origin = elementsRef.current.find((el) => el.id === id);
    if (!point || !origin) return;
    setSelectedId(id);
    dragRef.current = { id, mode, startX: point.x, startY: point.y, origin };
    window.addEventListener("pointermove", onStagePointerMove);
    window.addEventListener("pointerup", onStagePointerUp, { once: true });
  }

  return (
    <div className="sx-body">
      <style>{`
        .sx-body { display:grid; grid-template-columns:minmax(0,1fr) 250px; gap:14px; align-items:start; }
        @media (max-width:1100px) { .sx-body { grid-template-columns:1fr; } }
        .sx-stagewrap { display:grid; gap:10px; min-width:0; }
        .sx-toolbar { display:flex; flex-wrap:wrap; gap:8px; }
        .sx-tool { border:1px solid var(--bdb-line); border-radius:999px; background:var(--bdb-card); color:var(--bdb-ink); padding:9px 15px; font:inherit; font-weight:800; font-size:0.88rem; cursor:pointer; }
        .sx-tool:hover { border-color:var(--bdb-teal); }
        .sx-tool:disabled { opacity:0.45; cursor:default; }
        .sx-stage { position:relative; width:100%; aspect-ratio:16 / 9; overflow:hidden; border:1px solid var(--bdb-line); border-radius:16px;
          background-color:#F3F0E7; background-image:radial-gradient(circle,#CBC4B2 1px,transparent 1.3px); background-size:18px 18px;
          box-shadow:0 2px 10px rgba(40,32,20,0.06); touch-action:none; }
        .sx-underlay { position:absolute; inset:0; display:grid; place-items:center; padding:6%; text-align:center; pointer-events:none; }
        .sx-underlay p { margin:0; color:var(--bdb-ink); opacity:0.26; font-size:clamp(1.1rem,2.6vw,2.2rem); font-weight:800; white-space:pre-wrap; }
        .sx-underlay span { position:absolute; top:10px; left:14px; color:var(--bdb-ink-faint); font-size:0.64rem; font-weight:900; letter-spacing:0.1em; text-transform:uppercase; opacity:0.8; }
        .sx-el { position:absolute; inset:0; }
        .sx-hit { position:absolute; cursor:grab; border:2px dashed transparent; border-radius:10px; }
        .sx-hit.selected { border-color:var(--bdb-teal); }
        .sx-handle { position:absolute; width:16px; height:16px; border-radius:50%; background:var(--bdb-teal); border:2px solid #fff; box-shadow:0 1px 4px rgba(0,0,0,0.3); cursor:nwse-resize; }
        .sx-panel { display:grid; gap:12px; border:1px solid var(--bdb-line); border-radius:16px; background:var(--bdb-card); padding:14px; }
        .sx-panel h2 { margin:0; font-size:0.72rem; font-weight:900; letter-spacing:0.1em; text-transform:uppercase; color:var(--bdb-ink-faint); }
        .sx-panel textarea, .sx-panel input[type="text"] { width:100%; box-sizing:border-box; border:2px solid var(--bdb-line); border-radius:10px; background:var(--bdb-ground); color:var(--bdb-ink); padding:9px 10px; font:inherit; font-size:0.9rem; font-weight:600; resize:vertical; }
        .sx-swatches { display:flex; flex-wrap:wrap; gap:7px; }
        .sx-swatch { width:28px; height:28px; border-radius:50%; border:2px solid var(--bdb-line); cursor:pointer; }
        .sx-swatch.on { border-color:var(--bdb-ink); box-shadow:0 0 0 2px #fff inset; }
        .sx-row { display:flex; align-items:center; gap:9px; font-size:0.84rem; font-weight:700; color:var(--bdb-ink-soft); }
        .sx-row input[type="range"] { flex:1; }
        .sx-del { border:1px solid #efd6d2; border-radius:11px; background:#fff; color:#b91c1c; padding:10px 14px; font:inherit; font-weight:900; cursor:pointer; }
        .sx-hint { margin:0; color:var(--bdb-ink-faint); font-size:0.78rem; font-weight:650; line-height:1.4; }
      `}</style>

      <div className="sx-stagewrap">
        <div className="sx-toolbar">
          {ADDABLE.map((item) => (
            <button key={item.type} type="button" className="sx-tool" disabled={disabled} onClick={() => addElement(item.type)}>
              Add {item.label}
            </button>
          ))}
        </div>
        <div className="sx-stage" ref={stageRef} onPointerDown={() => setSelectedId(null)}>
          <div className="sx-underlay">
            <span>Auto slide underneath</span>
            {backgroundText ? <p>{backgroundText}</p> : null}
          </div>
          <div className="sx-el">
            {elements.map((element) => (
              <OverlayElementView key={element.id} element={element} stageHeight={stageHeight} />
            ))}
          </div>
          {elements.map((element) => {
            if (element.type === "line" || element.type === "arrow") {
              return (
                <span key={element.id}>
                  <span
                    className="sx-handle"
                    style={{ left: `calc(${element.x}% - 8px)`, top: `calc(${element.y}% - 8px)`, cursor: "grab" }}
                    onPointerDown={(event) => beginDrag(event, element.id, "start")}
                  />
                  <span
                    className="sx-handle"
                    style={{ left: `calc(${element.x2 ?? element.x}% - 8px)`, top: `calc(${element.y2 ?? element.y}% - 8px)`, cursor: "grab" }}
                    onPointerDown={(event) => beginDrag(event, element.id, "end")}
                  />
                </span>
              );
            }
            const height = element.h != null ? `${element.h}%` : "12%";
            return (
              <span key={element.id}>
                <span
                  className={`sx-hit${element.id === selectedId ? " selected" : ""}`}
                  style={{ left: `${element.x}%`, top: `${element.y}%`, width: `${element.w ?? 20}%`, height }}
                  onPointerDown={(event) => beginDrag(event, element.id, "move")}
                />
                {element.id === selectedId ? (
                  <span
                    className="sx-handle"
                    style={{ left: `calc(${element.x + (element.w ?? 20)}% - 8px)`, top: `calc(${element.y}% + ${height} - 8px)` }}
                    onPointerDown={(event) => beginDrag(event, element.id, "resize")}
                  />
                ) : null}
              </span>
            );
          })}
        </div>
        <p className="sx-hint">Drag an element to move it, the corner dot to resize. Equations take {"{a}/{b}"} for a fraction and ^2 for a power.</p>
      </div>

      <aside className="sx-panel">
        <h2>{selected ? `Selected: ${selected.type}` : "Nothing selected"}</h2>
        {selected ? (
          <>
            {(selected.type === "text" || selected.type === "equation") && (
              <textarea
                rows={3}
                value={selected.text || ""}
                maxLength={400}
                disabled={disabled}
                onChange={(event) => updateSelected({ text: event.target.value })}
              />
            )}
            {selected.type === "image" && (
              <input
                type="text"
                placeholder="Image URL (/lesson-covers/... or https://...)"
                value={selected.url || ""}
                disabled={disabled}
                onChange={(event) => updateSelected({ url: event.target.value })}
              />
            )}
            {selected.type !== "image" && (
              <div className="sx-swatches">
                {SLIDE_OVERLAY_COLORS.map((swatch) => (
                  <button
                    key={swatch.value}
                    type="button"
                    className={`sx-swatch${selected.color === swatch.value ? " on" : ""}`}
                    style={{ background: swatch.value }}
                    title={swatch.name}
                    disabled={disabled}
                    onClick={() => updateSelected({ color: swatch.value })}
                  />
                ))}
              </div>
            )}
            {(selected.type === "text" || selected.type === "equation") && (
              <label className="sx-row">
                Size
                <input
                  type="range" min={2} max={18} step={0.5}
                  value={selected.size ?? 6}
                  disabled={disabled}
                  onChange={(event) => updateSelected({ size: Number(event.target.value) })}
                />
              </label>
            )}
            {(selected.type === "rect" || selected.type === "circle" || selected.type === "line" || selected.type === "arrow") && (
              <label className="sx-row">
                Thickness
                <input
                  type="range" min={1} max={16} step={1}
                  value={selected.thickness ?? 4}
                  disabled={disabled}
                  onChange={(event) => updateSelected({ thickness: Number(event.target.value) })}
                />
              </label>
            )}
            {(selected.type === "rect" || selected.type === "circle") && (
              <label className="sx-row">
                <input
                  type="checkbox"
                  checked={Boolean(selected.fill)}
                  disabled={disabled}
                  onChange={(event) => updateSelected({ fill: event.target.checked })}
                />
                Deeper wash
              </label>
            )}
            <button type="button" className="sx-del" disabled={disabled} onClick={removeSelected}>Delete element</button>
          </>
        ) : (
          <p className="sx-hint">Add an element from the toolbar, or tap one on the stage to edit it.</p>
        )}
      </aside>
    </div>
  );
}
