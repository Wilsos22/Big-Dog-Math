"use client";

// The studio's LessonScreen slide, ready to drop onto a live projector surface. It renders the SAME
// LessonScreen the Lesson Screen Studio composes at a literal 1920x1080, scaled to fill the viewport,
// and floats the classroom state strip (the "what to be doing" cues) top-right so the collapsed empty
// zone is never wasted space. Shared by /teacher/present (screen "main") and /teacher/pace ("pace"),
// mounted as an additive overlay only for plain worded/info states - every interactive scene keeps
// its own surface rendering, and the ink layer stays above this (it is mounted after it).
//
// SCALING: the stage is anchored top-left and scaled from the top-left, then translated to centre the
// scaled box in the viewport. An earlier version centred the UNSCALED 1920x1080 element in a grid and
// scaled from its centre - which put an oversized element's box at the cell start and then shifted the
// scaled result right, so it overflowed and clipped at every resolution except an exact 1920x1080.
// Measuring window.innerWidth/innerHeight (the true viewport, reliable on a real projector) and
// re-measuring briefly after mount avoids a stale scale on the classroom display.

import { useEffect, useState, type ComponentProps } from "react";
import LessonScreen from "@/components/screen/LessonScreen";
import { ClassroomStateStrip } from "@/components/ClassroomStateStrip";
import type { ScreenKey, ScreenStepData, ScreenZones } from "@/lib/lessonScreenModel";

function fitBox() {
  if (typeof window === "undefined") return { scale: 1, x: 0, y: 0 };
  const vw = window.innerWidth || 1920;
  const vh = window.innerHeight || 1080;
  const scale = Math.min(vw / 1920, vh / 1080);
  return {
    scale,
    x: Math.max(0, (vw - 1920 * scale) / 2),
    y: Math.max(0, (vh - 1080 * scale) / 2),
  };
}

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
  const [box, setBox] = useState(fitBox);
  useEffect(() => {
    const measure = () => setBox(fitBox());
    measure();
    window.addEventListener("resize", measure);
    // Re-measure briefly after mount: a classroom display can lay out late, and a single
    // measurement then locks in a wrong scale for the rest of the period.
    const interval = window.setInterval(measure, 400);
    const stop = window.setTimeout(() => window.clearInterval(interval), 4000);
    return () => {
      window.removeEventListener("resize", measure);
      window.clearInterval(interval);
      window.clearTimeout(stop);
    };
  }, []);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 12, background: "#F6F3EC", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 1920,
          height: 1080,
          transform: `translate(${box.x}px, ${box.y}px) scale(${box.scale})`,
          transformOrigin: "top left",
        }}
      >
        <LessonScreen data={data} screen={screen} zones={zones} totalSteps={totalSteps} />
      </div>
      <ClassroomStateStrip strip={strip} showWords={showWords} overridden={overridden} />
    </div>
  );
}
