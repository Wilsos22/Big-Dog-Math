"use client";

import { useId } from "react";
import {
  STATE_STRIP_SLOTS,
  STATE_STRIP_SLOT_LABELS,
  stripGlyphId,
  stripIntensity,
  type ClassroomStateStrip as StripValues,
  type StateStripSlot,
} from "@/lib/classroomStateStrip";

/**
 * The four-slot classroom state strip, for the pace and support projector.
 * State Strip Icons v3 (Steele's design handoff, 2026-07-29).
 *
 * A VERTICAL group pinned to the top right of the stage. Fixed slot order
 * forever - eyes, voice, supplies, body - because POSITION is one of the three
 * cues a student reads it by. The other two changed in v3: the GLYPH now
 * distinguishes the value (one per value, so "The speaker" and "The screen" are
 * two silhouettes, not the same eye twice), and COLOUR is a single teal ramp
 * encoding how much is happening in the room rather than a per-slot hue.
 *
 * Each glyph is a true KNOCKOUT: a hole cut in a ramp-coloured square, so
 * whatever the strip sits on shows through the strokes. That is why the glyph
 * reads on both the cream ground and, when the work space opens and the group
 * hops left, whatever is behind it there.
 *
 * The word stays beside every glyph permanently (Steele: "it can say what it
 * means under it no problem"), so nothing depends on memorising a symbol.
 * `showWords` can still drop the slot LABEL and value to leave a pure glyph
 * column, but it defaults on.
 *
 * Renders nothing when `strip` is null. That is the contract: a strip that is
 * sometimes blank is a strip students stop scanning, so an incomplete step gets
 * no strip at all and is named in the /control load message instead.
 */

// One teal hue at four lightness steps. Kept in the darker half so every tile
// holds against the cream pace screen; the knockout means the ground reads
// straight back through the glyph. This is the v3 "teal" ramp.
const RAMP = ["#10312c", "#145c50", "#148a76", "#14b8a6"] as const;

// The twelve v3 glyphs, in 0-24 space, 2px stroke, round caps. Keyed by the id
// `stripGlyphId` returns. Objects and device-volume shapes a 6th grader already
// reads: a page, a word bubble, a chalkboard; mute / one wave / two; an x, a
// check and a down arrow over the desk line; a seat, a standing figure, the
// walk-sign figure.
function GlyphPaths({ id }: { id: string }) {
  switch (id) {
    case "eyes-own-work":
      return (<><path d="M5.6 2.8 H14.4 L18.4 6.8 V21.2 H5.6 Z" /><path d="M14.4 2.8 V6.8 H18.4" /></>);
    case "eyes-speaker":
      return (<><rect x="2.6" y="3.4" width="18.8" height="13" rx="3" /><path d="M8 16.4 L6.4 21 L12.6 16.4" /></>);
    case "eyes-board":
      return (<><rect x="2.2" y="3" width="19.6" height="13.4" rx="1" /><path d="M6 12.8 H14" /><path d="M6.6 16.4 V21.4" /><path d="M17.4 16.4 V21.4" /></>);
    case "voice-0":
      return (<><path d="M3 9.6 H6 L10 5.8 V18.2 L6 14.4 H3 Z" /><path d="M13.6 9.4 L19.4 15.2" /><path d="M19.4 9.4 L13.6 15.2" /></>);
    case "voice-1":
      return (<><path d="M3 9.6 H6 L10 5.8 V18.2 L6 14.4 H3 Z" /><path d="M12.6 9.2 A3.4 3.4 0 0 1 12.6 14.8" /></>);
    case "voice-2":
      return (<><path d="M3 9.6 H6 L10 5.8 V18.2 L6 14.4 H3 Z" /><path d="M12.6 9.2 A3.4 3.4 0 0 1 12.6 14.8" /><path d="M14 7.1 A6 6 0 0 1 14 16.9" /></>);
    case "supplies-away":
      return (<><path d="M7.4 6 L16.6 15.2" /><path d="M16.6 6 L7.4 15.2" /><path d="M3 19 H21" /></>);
    case "supplies-using":
      return (<><path d="M6.2 11 L10.4 15.2 L17.8 5.4" /><path d="M3 19 H21" /></>);
    case "supplies-flat":
      return (<><path d="M12 4.2 V14.6" /><path d="M7.8 10.4 L12 14.6 L16.2 10.4" /><path d="M3 19 H21" /></>);
    case "body-seated":
      return (<><path d="M6.2 2.8 L6.8 12.4" /><path d="M5.4 12.4 H17.8" /><path d="M8.2 12.4 V21.2" /><path d="M16.4 12.4 V21.2" /></>);
    case "body-standing":
      return (<><circle cx="12" cy="4.2" r="2.6" /><path d="M12 6.8 V13.8" /><path d="M12 8.8 L10.2 13.6" /><path d="M12 8.8 L13.8 13.6" /><path d="M12 13.8 L10.6 21.4" /><path d="M12 13.8 L13.4 21.4" /></>);
    case "body-moving":
      return (<><circle cx="13" cy="3.8" r="2.4" /><path d="M12.8 6.2 L11.4 13" /><path d="M12.2 8.4 L16.8 6.6" /><path d="M12.2 8.4 L7.6 11.2" /><path d="M11.4 13 L16 16.4 L17 21.4" /><path d="M11.4 13 L6.4 21.2" /></>);
    default:
      return null;
  }
}

/**
 * A knockout tile: a rounded ramp-coloured square with the glyph cut out of it.
 * The mask paints the glyph strokes black, so those pixels are removed from the
 * fill and the surface behind shows through. maskId must be unique per tile in
 * the document, so it is prefixed with a useId() value from the parent.
 */
function KnockoutTile({ glyphId, step, maskId }: { glyphId: string; step: number; maskId: string }) {
  return (
    <svg viewBox="-4 -4 32 32" className="css-tile" aria-hidden="true">
      <mask id={maskId} maskUnits="userSpaceOnUse" x="-4" y="-4" width="32" height="32">
        <rect x="-4" y="-4" width="32" height="32" fill="#fff" />
        <g fill="none" stroke="#000" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <GlyphPaths id={glyphId} />
        </g>
      </mask>
      <rect x="-4" y="-4" width="32" height="32" rx={7} mask={`url(#${maskId})`} fill={RAMP[step] ?? RAMP[0]} />
    </svg>
  );
}

export function ClassroomStateStrip({
  strip,
  showWords = true,
  overridden = false,
  className,
}: {
  strip: StripValues | null;
  showWords?: boolean;
  overridden?: boolean;
  className?: string;
}) {
  const uid = useId();
  if (!strip) return null;
  return (
    <div className={`css-strip${overridden ? " overridden" : ""}${className ? ` ${className}` : ""}`} aria-label="Classroom state">
      <style>{`
        .css-strip { position:absolute; z-index:14; top:clamp(10px,1.4vh,20px); right:clamp(12px,1.5vw,26px);
          display:grid; gap:clamp(5px,0.7vh,9px); width:max-content; max-width:min(30vw,300px);
          border:1px solid var(--bdb-line); border-radius:14px; background:var(--bdb-ground-2);
          padding:clamp(8px,1vh,13px) clamp(10px,1.1vw,15px); box-shadow:0 2px 12px rgba(40,32,20,0.07); }
        /* An override is the one thing on this group that is not the plan, so it
           gets its own edge rather than a colour change that could read as a
           different ramp step. */
        .css-strip.overridden { border-color:var(--bdb-amber); box-shadow:inset 3px 0 0 var(--bdb-amber),0 2px 12px rgba(40,32,20,0.07); }
        .css-slot { display:flex; align-items:center; gap:clamp(7px,0.8vw,11px); min-width:0; }
        .css-slot + .css-slot { border-top:1px solid var(--bdb-line); padding-top:clamp(5px,0.7vh,9px); }
        .css-tile { display:block; flex:0 0 auto; width:clamp(30px,2.7vw,40px); height:clamp(30px,2.7vw,40px); }
        .css-text { display:grid; gap:0; min-width:0; }
        .css-cap { color:var(--bdb-ink-faint); font-size:clamp(0.5rem,0.62vw,0.62rem); font-weight:800; letter-spacing:0.13em; text-transform:uppercase; line-height:1.3; }
        .css-val { color:var(--bdb-ink); font-size:clamp(0.76rem,0.95vw,1rem); font-weight:800; line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        @media (max-height:640px) {
          .css-cap { display:none; }
          .css-val { font-size:0.76rem; }
        }
      `}</style>
      {STATE_STRIP_SLOTS.map((slot) => {
        const value = strip[slot];
        return (
          <div className="css-slot" key={slot}>
            <KnockoutTile glyphId={stripGlyphId(slot, value)} step={stripIntensity(slot, value)} maskId={`${uid}-${slot}`} />
            {showWords ? (
              <span className="css-text">
                <span className="css-cap">{STATE_STRIP_SLOT_LABELS[slot]}</span>
                <span className="css-val">{value}</span>
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
