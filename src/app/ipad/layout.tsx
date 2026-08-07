import type { Viewport } from "next";

// page.tsx is a client component ("use client"), and Next.js refuses a
// metadata/viewport export from one - it has to come from a server
// component in the route, which is what this file is for.
//
// The root layout's viewport permits user scaling (maximumScale unset,
// userScalable defaulted on), so Safari's own pinch and double-tap zoom the
// whole page - and /ipad already implements its OWN pinch/pan for the
// canvas (InkBoard's allowZoom/pinchApply), so the two were fighting over
// the same two-finger gesture. Locking the viewport here, scoped to this
// route only, stops Safari's native zoom without touching any other
// surface's default behavior.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function IpadLayout({ children }: { children: React.ReactNode }) {
  return children;
}
