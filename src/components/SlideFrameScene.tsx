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

import { useEffect, useRef, useState } from "react";
import { resolveSlideSource } from "@/lib/embedUrl";
import type { SlideVideoCommand } from "@/lib/slideVideo";

export default function SlideFrameScene({
  url,
  fit = "contain",
  className = "stage-slide",
  videoCommand = null,
}: {
  url: string;
  fit?: "contain" | "cover";
  className?: string;
  // The teacher's last play/pause/restart tap, carried straight off the session row. Null on every
  // surface that is not the main projector, which is why pace mirrors a video without ever driving it.
  videoCommand?: SlideVideoCommand | null;
}) {
  const source = resolveSlideSource(url);
  const [loaded, setLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [failed, setFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const handledNonce = useRef<string | null>(null);

  useEffect(() => {
    setLoaded(false);
    setTimedOut(false);
    setFailed(false);
    if (source.kind !== "embed" && source.kind !== "site") return;
    const timer = setTimeout(() => setTimedOut(true), 4000);
    return () => clearTimeout(timer);
  }, [source.kind, source.url]);

  // The session row is re-read about once a second and re-delivers the same command every time, so
  // the nonce ref is what stops a single tap replaying forever. Same guard SpeakerSpinner uses.
  useEffect(() => {
    if (!videoCommand) return;
    if (videoCommand.nonce === handledNonce.current) return;
    handledNonce.current = videoCommand.nonce;
    const el = videoRef.current;
    if (!el) return;
    if (videoCommand.action === "slide-video-restart") {
      el.currentTime = 0;
      // play() rejects under autoplay policy until the page has been tapped. Swallow it - an
      // unhandled rejection here would surface in front of the class and change nothing.
      void el.play().catch(() => {});
      return;
    }
    if (videoCommand.action === "slide-video-pause") {
      el.pause();
      return;
    }
    void el.play().catch(() => {});
  }, [videoCommand]);

  if (source.kind === "none") return null;

  if (source.kind === "video") {
    // NO autoplay and NO loop, both deliberate. Autoplay with sound is blocked until the page has
    // been tapped, so a narrated video would open silent on a projector nobody has touched since the
    // last deploy; and a loop would restart under the teacher mid-sentence. It holds on the last
    // frame instead - the state ends when the teacher advances it, not when the file runs out.
    return (
      <div className={className}>
        {failed ? null : (
          <video
            ref={videoRef}
            src={source.url}
            playsInline
            preload="auto"
            onError={() => setFailed(true)}
            style={{ width: "100%", height: "100%", objectFit: fit, display: "block", background: "#000" }}
          />
        )}
        {failed ? (
          <div className="stage-slide-fallback">
            <p>Video did not load</p>
            <span>Keep going - it is not part of the math</span>
          </div>
        ) : null}
      </div>
    );
  }

  if (source.kind === "image") {
    // AN IMAGE NEEDS THE SAME WORDED FALLBACK AS AN EMBED. A same-origin path is the recommended
    // slide source, which makes "the file was never committed" or a mistyped name the most likely
    // failure there is - and a bare <img> answers that with the browser's broken-image glyph,
    // which at 25 feet is indistinguishable from a broken lesson. Hide it and say so in words.
    return (
      <div className={className}>
        {failed ? null : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={source.url}
            alt=""
            onError={() => setFailed(true)}
            style={{ width: "100%", height: "100%", objectFit: fit, display: "block" }}
          />
        )}
        {failed ? (
          <div className="stage-slide-fallback">
            <p>Slide did not load</p>
            <span>Keep going - it is not part of the math</span>
          </div>
        ) : null}
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
