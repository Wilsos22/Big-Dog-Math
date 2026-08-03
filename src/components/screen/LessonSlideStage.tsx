"use client";

// The studio's LessonScreen slide, ready to drop onto a live projector surface. It renders the SAME
// LessonScreen the Lesson Screen Studio composes at a literal 1920x1080, scaled to fill the viewport,
// and floats the classroom state strip (the "what to be doing" cues) top-right so the collapsed empty
// zone is never wasted space. Shared by /teacher/present (screen "main") and /teacher/pace ("pace"),
// mounted as an additive overlay only for plain worded/info states - every interactive scene keeps
// its own surface rendering, and the ink layer stays above this (it is mounted after it).

import { useEffect, useRef, useState, type ComponentProps } from "react";
import LessonScreen from "@/components/screen/LessonScreen";
import { ClassroomStateStrip } from "@/components/ClassroomStateStrip";
import type { ScreenKey, ScreenStepData, ScreenZones } from "@/lib/lessonScreenModel";

export default function LessonSlideStage({
  data,
  zones,
  totalSteps,
  screen,
  strip,
  showWords,
  overridden,
}: {
  data: ScreenStepData;
  zones: ScreenZones;
  totalSteps: number;
  screen: ScreenKey;
  strip: ComponentProps<typeof ClassroomStateStrip>["strip"];
  showWords: boolean;
  overridden: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const measure = () => {
      const el = ref.current;
      if (!el) return;
      const next = Math.min(el.clientWidth / 1920, el.clientHeight / 1080);
      if (next > 0) setScale(next);
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
    <div ref={ref} style={{ position: "fixed", inset: 0, zIndex: 12, background: "#F6F3EC", display: "grid", placeItems: "center", overflow: "hidden" }}>
      <div style={{ position: "relative", width: 1920, height: 1080, flex: "0 0 auto", transform: `scale(${scale})`, transformOrigin: "center" }}>
        <LessonScreen data={data} screen={screen} zones={zones} totalSteps={totalSteps} />
      </div>
      <ClassroomStateStrip strip={strip} showWords={showWords} overridden={overridden} />
    </div>
  );
}
