// Makes the pen surface installable to the iPad home screen, exactly as
// /teacher/remote already was. This is the ONLY real full-screen path on
// iPadOS: `requestFullscreen()` is a no-op there (WebKit ships element
// fullscreen on macOS only), so the button on the page could never have done
// what it looked like it did. Standalone also drops the address bar, the
// swipe-back edge gesture and the rubber-band bounce - three of the things
// Steele reported as the screen "moving around" on 2026-08-04.
//
// `scope: "/"` is deliberate and copied from the Remote's manifest: an
// installed web app gets its OWN cookie jar, so the first launch redirects to
// /teacher-login, and a narrower scope would bounce that trip out to Safari
// and strand the sign-in outside the app. One login inside the installed app,
// then the teacher cookie carries for about six months.
//
// A per-segment layout is the idiomatic way to attach this, and /teacher/remote
// established the precedent - CLAUDE.md's "no per-segment layouts" line was
// already stale before this file existed.
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Big Dog Math Pen Surface",
  manifest: "/ipad.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Pen Surface",
  },
  icons: {
    apple: "/big-dog-mark.png",
  },
  // `appleWebApp.capable` NO LONGER EMITS THE APPLE-PREFIXED TAG. Next now
  // renders only `mobile-web-app-capable`, which is the Chrome/Android spelling
  // and which Safari does not read - verified in the browser on 2026-08-05, the
  // head carried `mobile-web-app-capable = yes` and no apple equivalent. iPadOS
  // 16.4+ will fall back to the manifest's `display: standalone`, so this is
  // belt and braces rather than the only path, but it is the spelling that has
  // worked on every iPadOS and it costs one line. /teacher/remote has the same
  // gap for the same reason.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The writing stage runs edge to edge; without this the home indicator area
  // is letterboxed and the board loses a strip it was drawing into.
  viewportFit: "cover",
  themeColor: "#28241e",
};

export default function IpadLayout({ children }: { children: ReactNode }) {
  return children;
}
