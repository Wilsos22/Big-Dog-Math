"use client";

import {
  STATE_STRIP_SLOTS,
  STATE_STRIP_SLOT_COLORS,
  STATE_STRIP_SLOT_LABELS,
  type ClassroomStateStrip as StripValues,
  type StateStripSlot,
  voiceDigit,
  voiceWords,
} from "@/lib/classroomStateStrip";

/**
 * The four-slot classroom state strip, for the pace and support projector.
 *
 * A VERTICAL group pinned to the top right of the stage (Steele, 2026-07-29).
 * It started as a full-width bottom rail; top right keeps it in the same place
 * on both projectors, out of the way of the mathematics, and reads as one
 * object the room can glance at rather than a band across the screen.
 *
 * Fixed slot order forever - eyes, voice, supplies, body, top to bottom -
 * because POSITION is one of the three redundant cues a student reads it by. The
 * other two are the per-slot colour and the glyph. Glyphs are monochrome stroke
 * SVG, not pictographs: see rule 1 in CLAUDE.md, icons are not emoji.
 *
 * `showWords` carries the words beside the glyphs for the first weeks and comes
 * off once the room reads the strip cold. The VOICE DIGIT is never affected by
 * it - the digit is the part that has to survive.
 *
 * Renders nothing when `strip` is null. That is the contract: a strip that is
 * sometimes blank is a strip students stop scanning, so an incomplete step gets
 * no strip at all and is named in the /control load message instead.
 */

function SlotGlyph({ slot }: { slot: StateStripSlot }) {
  const common = {
    width: 30,
    height: 30,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (slot === "eyes") {
    return (
      <svg {...common}>
        <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" />
        <circle cx="12" cy="12" r="2.8" />
      </svg>
    );
  }
  if (slot === "voice") {
    return (
      <svg {...common}>
        <path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" />
        <path d="M15.5 9.2a4 4 0 0 1 0 5.6" />
        <path d="M18.6 6.4a8 8 0 0 1 0 11.2" />
      </svg>
    );
  }
  if (slot === "supplies") {
    return (
      <svg {...common}>
        <path d="M3 8.5h18l-1.6 9.1a2 2 0 0 1-2 1.6H6.6a2 2 0 0 1-2-1.6L3 8.5Z" />
        <path d="M7.6 8.5V6.2a1.8 1.8 0 0 1 1.8-1.8h5.2a1.8 1.8 0 0 1 1.8 1.8v2.3" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="5.4" r="2.6" />
      <path d="M12 8.4v6.2" />
      <path d="M8.4 11.2h7.2" />
      <path d="M9.2 20.2l2.8-5.6 2.8 5.6" />
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
           different slot value. */
        .css-strip.overridden { border-color:var(--bdb-amber); box-shadow:inset 3px 0 0 var(--bdb-amber),0 2px 12px rgba(40,32,20,0.07); }
        .css-slot { display:flex; align-items:center; gap:clamp(7px,0.8vw,11px); min-width:0; color:var(--slot); }
        .css-slot + .css-slot { border-top:1px solid var(--bdb-line); padding-top:clamp(5px,0.7vh,9px); }
        .css-glyph { display:flex; align-items:center; justify-content:center; flex:0 0 auto; width:clamp(26px,2.2vw,32px); }
        .css-text { display:grid; gap:0; min-width:0; }
        .css-cap { color:var(--bdb-ink-faint); font-size:clamp(0.5rem,0.62vw,0.62rem); font-weight:800; letter-spacing:0.13em; text-transform:uppercase; line-height:1.3; }
        .css-val { color:var(--bdb-ink); font-size:clamp(0.76rem,0.95vw,1rem); font-weight:800; line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .css-digit { display:flex; align-items:center; justify-content:center; flex:0 0 auto;
          width:clamp(26px,2.2vw,32px); height:clamp(26px,2.2vw,32px);
          border-radius:50%; background:var(--slot); color:#fff; font-size:clamp(0.88rem,1.1vw,1.15rem); font-weight:900; font-variant-numeric:tabular-nums; }
        @media (max-height:640px) {
          .css-cap { display:none; }
          .css-val { font-size:0.76rem; }
        }
      `}</style>
      {STATE_STRIP_SLOTS.map((slot) => {
        const isVoice = slot === "voice";
        const value = strip[slot];
        // The digit replaces the glyph for voice - it is the more legible cue at
        // room distance and the one that stays after the words come off.
        const text = isVoice ? voiceWords(strip.voice) : value;
        return (
          <div className="css-slot" key={slot} style={{ ["--slot" as string]: STATE_STRIP_SLOT_COLORS[slot] }}>
            {isVoice ? (
              <span className="css-digit">{voiceDigit(strip.voice)}</span>
            ) : (
              <span className="css-glyph"><SlotGlyph slot={slot} /></span>
            )}
            <span className="css-text">
              {showWords ? <span className="css-cap">{STATE_STRIP_SLOT_LABELS[slot]}</span> : null}
              {showWords || isVoice ? <span className="css-val">{text}</span> : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}
