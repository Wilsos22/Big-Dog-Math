"use client";

// One outside visual filling a projector's content area: an exported slide image, a live Lucid /
// Figma / Canva / Google Slides board, or a plain website. Used by /teacher/present and, when the
// step asks its slide to mirror, /teacher/pace.
//
// THE PROJECTOR IS A DISPLAY, NEVER A WRITER. The iframe carries a transparent shield so a stray
// touch on the laptop driving the projector cannot scroll a board mid-lesson; the pen is the iPad,
// whose ink canvas sits above this whole surface, so strokes land on ink no matter what is nested
// inside. Same rule the board scene already follows.
//
// A site that sends X-Frame-Options: DENY simply refuses to load and there is no way to detect that
// ahead of time, so an embed that has not loaded after four seconds says so in words. A white void
// on a classroom screen reads as a broken lesson.

import { useEffect, useState } from "react";
import { resolveSlideSource } from "@/lib/embedUrl";

export default function SlideFrameScene({
  url,
  fit = "contain",
  className = "stage-slide",
}: {
  url: string;
  fit?: "contain" | "cover";
  className?: string;
}) {
  const source = resolveSlideSource(url);
  const [loaded, setLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setTimedOut(false);
    if (source.kind !== "embed" && source.kind !== "site") return;
    const timer = setTimeout(() => setTimedOut(true), 4000);
    return () => clearTimeout(timer);
  }, [source.kind, source.url]);

  if (source.kind === "none") return null;

  if (source.kind === "image") {
    return (
      <div className={className}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={source.url} alt="" style={{ width: "100%", height: "100%", objectFit: fit, display: "block" }} />
      </div>
    );
  }

  return (
    <div className={className}>
      <iframe
        src={source.url}
        title={source.kind === "site" ? "Lesson website" : "Lesson board"}
        onLoad={() => setLoaded(true)}
        referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        style={{ width: "100%", height: "100%", border: 0, display: "block" }}
      />
      <div style={{ position: "absolute", inset: 0, background: "transparent" }} aria-hidden />
      {timedOut && !loaded ? (
        <div className="stage-slide-fallback">
          <p>{source.kind === "site" ? "Page did not load" : "Board did not load"}</p>
          <span>Keep going - it is not part of the math</span>
        </div>
      ) : null}
    </div>
  );
}
