"use client";

// The room-facing half of the attention call: when `signal` increments, play
// the class sound (see attentionCall.ts) and flash a two-beat "Eyes up."
// pulse over whatever the display is showing. Renders nothing between calls.
//
// Arming: Chrome will not sound audio until the page has received one real
// tap or click, so this component arms silently on any tap, shows a small
// chip for the first 90 seconds after load (morning setup), and brings the
// chip back whenever a call arrives while the display is still silent.
// Tapping the chip arms the audio AND plays the call - a built-in speaker
// check. The visual pulse always fires, armed or not.

import { useEffect, useRef, useState } from "react";
import {
  armAttentionAudio,
  attentionAudioArmed,
  onAttentionAudioChange,
  playAttentionCall,
} from "@/lib/attentionCall";

const PULSE_MS = 3200;

export default function AttentionPulse({ signal, visualOnly = false }: { signal: number; visualOnly?: boolean }) {
  const [armed, setArmed] = useState(false);
  const [chip, setChip] = useState(false);
  const [pulse, setPulse] = useState(0);
  const lastSignal = useRef(0);

  useEffect(() => {
    if (visualOnly) return;
    setArmed(attentionAudioArmed());
    const off = onAttentionAudioChange(setArmed);
    const onTap = () => {
      void armAttentionAudio();
    };
    window.addEventListener("pointerdown", onTap, { capture: true });
    return () => {
      off();
      window.removeEventListener("pointerdown", onTap, { capture: true });
    };
  }, [visualOnly]);

  // Setup window: offer the chip briefly after load, then stay out of the way.
  useEffect(() => {
    if (visualOnly || armed) {
      setChip(false);
      return;
    }
    setChip(true);
    const t = window.setTimeout(() => setChip(false), 90_000);
    return () => window.clearTimeout(t);
  }, [armed, visualOnly]);

  useEffect(() => {
    if (signal <= 0 || signal === lastSignal.current) return;
    lastSignal.current = signal;
    if (!visualOnly) {
      playAttentionCall();
      if (!attentionAudioArmed()) setChip(true);
    }
    setPulse(signal);
    const t = window.setTimeout(() => setPulse((p) => (p === signal ? 0 : p)), PULSE_MS);
    return () => window.clearTimeout(t);
  }, [signal, visualOnly]);

  async function armNow() {
    const ok = await armAttentionAudio();
    if (ok) playAttentionCall();
  }

  return (
    <div data-attn={signal} style={{ display: "contents" }}>
      <style>{`
        .attn-stage { position:fixed; inset:0; z-index:70; pointer-events:none; display:grid; place-items:center; font-family:var(--bdb-font); animation:attnFade ${PULSE_MS}ms ease forwards; }
        .attn-wash { position:absolute; inset:0; background:var(--bdb-amber); opacity:0; animation:attnWash ${PULSE_MS}ms ease forwards; }
        .attn-ring { position:absolute; width:34vmin; height:34vmin; border-radius:50%; border:2.2vmin solid var(--bdb-amber); opacity:0; animation:attnRing 1.15s cubic-bezier(0.16,0.84,0.44,1) forwards; }
        .attn-ring.r2 { animation-delay:0.66s; }
        .attn-label { position:relative; padding:2.2vmin 5vmin; border-radius:999px; background:rgba(32,30,26,0.92); color:#fff; font-weight:800; font-size:7vmin; letter-spacing:-0.01em; opacity:0; animation:attnLabel 0.5s ease 0.85s forwards; }
        .attn-chip { position:fixed; right:14px; bottom:14px; z-index:71; min-height:44px; padding:0 18px; border-radius:999px; border:1px solid color-mix(in srgb, var(--bdb-amber) 55%, transparent); background:rgba(32,30,26,0.88); color:#fff; font-family:var(--bdb-font); font-weight:800; font-size:0.9rem; cursor:pointer; box-shadow:0 10px 26px rgba(40,32,20,0.25); }
        @keyframes attnRing { 0% { opacity:0; transform:scale(0.25); } 12% { opacity:0.95; } 100% { opacity:0; transform:scale(1.9); } }
        @keyframes attnWash { 0%, 100% { opacity:0; } 4% { opacity:0.22; } 12% { opacity:0; } 21% { opacity:0.22; } 30% { opacity:0; } }
        @keyframes attnLabel { from { opacity:0; transform:translateY(1.5vmin); } to { opacity:1; transform:none; } }
        @keyframes attnFade { 0%, 86% { opacity:1; } 100% { opacity:0; } }
      `}</style>
      {pulse > 0 && (
        <div className="attn-stage" key={pulse} aria-hidden>
          <div className="attn-wash" />
          <div className="attn-ring" />
          <div className="attn-ring r2" />
          <div className="attn-label">Eyes up.</div>
        </div>
      )}
      {chip && !armed && (
        <button className="attn-chip" onClick={armNow}>Tap once to turn on class sound</button>
      )}
    </div>
  );
}
