// Decimals, step by step - all four operations, one decision at a time.
// Its own tool, separate from /long-division (which is whole numbers only).
import ToolNav from "@/components/ToolNav";
import DecimalStepsBoard from "@/components/DecimalStepsBoard";

// Static, like every other tool page. ?set= is read in the board before the
// first paint - see the note on /division-house.
export default function DecimalStepsPage() {
  return (
    <>
      <ToolNav title="Decimals, step by step" />
      <main style={{ minHeight: "100vh", background: "var(--bdb-ground)", color: "var(--bdb-ink)", fontFamily: "var(--bdb-font)", padding: "20px clamp(14px, 3vw, 34px) 44px" }}>
        <div style={{ maxWidth: "min(1500px, 96vw)", margin: "0 auto", display: "grid", gap: 16 }}>
          <DecimalStepsBoard />
        </div>
      </main>
    </>
  );
}
