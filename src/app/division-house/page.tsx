// The blank long-division house - click the spot, name the operation.
// Its own tool: /long-division is a watch-it demo and /decimal-steps does the
// arithmetic; this one drills WHERE everything goes.
import ToolNav from "@/components/ToolNav";
import DivisionHouseBoard from "@/components/DivisionHouseBoard";

export default function DivisionHousePage() {
  return (
    <>
      <ToolNav title="Division House" />
      <main style={{ minHeight: "100vh", background: "var(--bdb-ground)", color: "var(--bdb-ink)", fontFamily: "var(--bdb-font)", padding: "20px clamp(14px, 3vw, 34px) 44px" }}>
        <div style={{ maxWidth: "min(1400px, 96vw)", margin: "0 auto" }}>
          <DivisionHouseBoard />
        </div>
      </main>
    </>
  );
}
