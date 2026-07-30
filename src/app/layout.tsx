// The root layout applies shared metadata and the global stylesheet for the prototype.
// The Big Dog Board design-system font (Albert Sans) is loaded via globals.css.
import type { Metadata, Viewport } from "next";
import "./globals.css";
import ClassSync from "@/components/ClassSync";
import WarmupJoinSync from "@/components/WarmupJoinSync";
// The Abbie AI feature is OFF THE SITE (Steele, 2026-07-29: "it doesnt contribute
// to the learning"). AbbieStudentBubble and AbbieStudentAsk used to mount here,
// which put them on EVERY page including every student surface. The components
// stay in src/components/ - re-enabling is re-adding two mounts, not a restore
// from git. Do not re-add them without his word.
import DeployRefresh from "@/components/DeployRefresh";
import StudentAttentionSync from "@/components/StudentAttentionSync";

export const metadata: Metadata = {
  title: "Big Dog Math Classroom System",
  description:
    "A classroom math system with student lesson flow, teacher controls, Notion curriculum data, Google Forms warm-up automation, and interactive math tools.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}<ClassSync /><WarmupJoinSync /><DeployRefresh /><StudentAttentionSync /></body>
    </html>
  );
}
