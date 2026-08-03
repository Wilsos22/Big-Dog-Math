"use client";

// The Direction Screen CONTENT - the native "slide" that renders INSIDE the state's existing board
// frame (band, state word, shared clock, step counter, state strip, ink layer), never replacing it.
// The frame is the moat and already exists on present/pace; this is one way to fill its content
// region - a big "do this now" direction, or a today's-plan list - the same slot an imported Canva /
// Slides image fills through the `slide` frame. That is the frame+imported-slide direction: templated
// info stays native and auto-composed from the Notion step; bespoke info comes in as an image.
//
// It fills whatever content box the frame hands it and centres a single direction, shrinking the
// headline to fit the box (never below the legibility floor). No band, clock, counter, or state strip
// here - those are the frame's, drawn by the surface this mounts in.

import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { DIRECTION_FONT_FLOOR, directionFontSize, planStepFontSize } from "@/lib/directionScreen";

export interface DirectionScreenProps {
  /** The "do this now" headline (Notion Main Display). */
  direction?: string;
  /** An optional smaller line under it (Notion Pace Directions / a support line). */
  support?: string;
  /** Plan mode: when non-empty, renders numbered steps instead of a single direction. */
  steps?: string[];
}

const INK = "#201e1a";
const INK_SOFT = "#6f675c";
const FONT_STACK = "var(--bdb-font, 'Albert Sans', system-ui, sans-serif)";

export default function DirectionScreen({ direction = "", support = "", steps }: DirectionScreenProps) {
  const isPlan = Array.isArray(steps) && steps.length > 0;

  // Shrink-to-fit for the headline against the content box the frame gives us. The deterministic base
  // already guarantees a legible, non-overflowing size for normal lengths; this pulls an unusually
  // long direction down to the box (never below the floor) in a real browser. It re-runs when the web
  // font settles, since Albert Sans metrics change the fit. A synchronous measure in a layout effect,
  // not an animation, so the throttled preview pane handles it.
  const boxRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLDivElement>(null);
  const [fontPx, setFontPx] = useState<number>(() => directionFontSize(direction));

  useLayoutEffect(() => {
    if (isPlan) return;
    const el = headlineRef.current;
    const box = boxRef.current;
    if (!el || !box) return;
    const fit = () => {
      let size = directionFontSize(direction);
      el.style.fontSize = `${size}px`;
      let guard = 0;
      while (size > DIRECTION_FONT_FLOOR && el.scrollHeight > box.clientHeight && guard < 40) {
        size -= 4;
        el.style.fontSize = `${size}px`;
        guard += 1;
      }
      setFontPx(size);
    };
    fit();
    const fonts = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
    fonts?.ready.then(fit).catch(() => {});
  }, [direction, isPlan]);

  const planSize = planStepFontSize(steps?.length ?? 0);
  const planNumSize = Math.round(planSize * 0.84);

  return (
    <div
      ref={boxRef}
      style={{
        width: "100%",
        height: "100%",
        minHeight: 0,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: isPlan ? 46 : 0,
        overflow: "hidden",
        color: INK,
        fontFamily: FONT_STACK,
      }}
    >
      {isPlan ? (
        steps!.map((text, index) => (
          <div key={index} style={{ display: "flex", alignItems: "baseline", gap: 40 }}>
            <span style={{ fontSize: planNumSize, fontWeight: 700, color: "#fcaf38", fontVariantNumeric: "tabular-nums", minWidth: 64 }}>
              {index + 1}
            </span>
            <span style={{ fontSize: planSize, fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.01em", textWrap: "pretty" } as CSSProperties}>
              {text}
            </span>
          </div>
        ))
      ) : (
        <>
          <div ref={headlineRef} style={{ fontSize: fontPx, fontWeight: 700, lineHeight: 1.06, letterSpacing: "-0.015em", maxWidth: 1560, textWrap: "pretty" } as CSSProperties}>
            {direction}
          </div>
          {support ? (
            <div style={{ fontSize: 48, fontWeight: 500, color: INK_SOFT, lineHeight: 1.3, marginTop: 44, maxWidth: 1200, textWrap: "pretty" } as CSSProperties}>
              {support}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
