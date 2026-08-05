import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Big Dog Math Lesson Remote",
  manifest: "/teacher-remote.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Lesson Remote",
  },
  icons: {
    apple: "/big-dog-mark.png",
  },
  // Next's `appleWebApp.capable` emits only `mobile-web-app-capable` now, which
  // is the Chrome/Android spelling Safari ignores - so the Remote has been
  // relying on the manifest alone for standalone mode. Additive, and the
  // spelling that works on every iPadOS. See the same note on /ipad.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fbf6ea",
};

export default function TeacherRemoteLayout({ children }: { children: ReactNode }) {
  return children;
}
