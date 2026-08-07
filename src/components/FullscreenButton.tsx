"use client";

// A full-screen toggle for the projector surfaces (/teacher/present and
// /teacher/pace), so the panel browser's URL bar and chrome go away during a
// lesson (Steele, 2026-08-07: "so i dont have to see the url bar up top").
//
// Uses the Fullscreen API on the document element, entered from a real click
// (browsers require a user gesture). While full screen the glyph flips to an
// exit icon so a panel with no keyboard can leave without pressing Esc.
//
// HIDES ITSELF when element fullscreen is unsupported - notably iOS/iPadOS
// Safari, where `requestFullscreen` on a non-video element is not implemented,
// so a button there would be a dead control. The classroom panels run a
// desktop-class browser where it works; this guard just keeps it honest.
// The glyph is a monochrome Tabler-style stroke icon, not an emoji (hard rule 1).

import { useEffect, useState } from "react";

type FsDoc = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
};
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => void };

function fullscreenElement(): Element | null {
  if (typeof document === "undefined") return null;
  const doc = document as FsDoc;
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

export default function FullscreenButton({ className }: { className?: string }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const el = document.documentElement as FsEl;
    setSupported(typeof el.requestFullscreen === "function" || typeof el.webkitRequestFullscreen === "function");
    const onChange = () => setIsFullscreen(Boolean(fullscreenElement()));
    onChange();
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  if (!supported) return null;

  const toggle = () => {
    const el = document.documentElement as FsEl;
    const doc = document as FsDoc;
    try {
      if (fullscreenElement()) {
        (document.exitFullscreen ?? doc.webkitExitFullscreen)?.call(document);
      } else {
        (el.requestFullscreen ?? el.webkitRequestFullscreen)?.call(el);
      }
    } catch {
      /* a refused request just leaves the page as it was */
    }
  };

  return (
    <button
      type="button"
      className={className}
      onClick={toggle}
      aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
      title={isFullscreen ? "Exit full screen" : "Full screen"}
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        {isFullscreen ? (
          <>
            <path d="M15 19v-2a2 2 0 0 1 2 -2h2" />
            <path d="M15 5v2a2 2 0 0 0 2 2h2" />
            <path d="M5 15h2a2 2 0 0 1 2 2v2" />
            <path d="M5 9h2a2 2 0 0 0 2 -2v-2" />
          </>
        ) : (
          <>
            <path d="M4 8v-2a2 2 0 0 1 2 -2h2" />
            <path d="M4 16v2a2 2 0 0 0 2 2h2" />
            <path d="M16 4h2a2 2 0 0 1 2 2v2" />
            <path d="M16 20h2a2 2 0 0 0 2 -2v-2" />
          </>
        )}
      </svg>
    </button>
  );
}
