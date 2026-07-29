"use client";

/**
 * /stuck - the distributive walkthrough, full screen with nothing else around it.
 *
 * Public and session-free on purpose: this is the link that can sit in a lesson
 * page, a Notion Help Path line, or a handout, and it has to work at 8pm from a
 * kitchen table with no join code. It carries the problem in the URL
 * (?a=5&b=14&split=10,4) so a teacher can point it at whichever example they
 * want; with no params it opens the example the lesson is taught from.
 *
 * The numbers are read after mount, the way /distributive-area reads ?set=, so
 * the first paint is the default example rather than a hydration mismatch.
 */

import { useEffect, useState } from "react";
import DistributiveWalkthrough from "@/components/DistributiveWalkthrough";
import {
  DEFAULT_WALKTHROUGH,
  parseWalkthroughParams,
  type WalkthroughProblem,
} from "@/lib/distributiveWalkthrough";

export default function StuckPage() {
  const [problem, setProblem] = useState<WalkthroughProblem>(DEFAULT_WALKTHROUGH);

  useEffect(() => {
    setProblem(parseWalkthroughParams(new URLSearchParams(window.location.search)));
  }, []);

  return (
    <DistributiveWalkthrough
      problem={problem}
      closeLabel="I've got it"
      onClose={() => {
        // Back to whatever they were doing when they got stuck. A student who
        // landed here from a pasted link has nothing to go back to, so send
        // them somewhere real instead of leaving the button dead.
        const cameFromHere =
          typeof document !== "undefined" &&
          document.referrer.startsWith(window.location.origin);
        if (cameFromHere) window.history.back();
        else window.location.href = "/";
      }}
    />
  );
}
