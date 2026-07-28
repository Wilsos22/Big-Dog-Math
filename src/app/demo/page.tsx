import type { Metadata } from "next";
import DemoClient from "./DemoClient";

export const metadata: Metadata = {
  title: "Big Dog Math - watch a class period run",
  description:
    "A live demo of the real classroom surfaces: two projectors, a student Chromebook, and the all-day boards, driven through a scripted mock lesson. Fictional class, real software.",
};

export default function DemoPage() {
  return <DemoClient />;
}
