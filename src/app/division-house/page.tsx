// The blank long-division house - click the spot, name the operation.
// Its own tool: /long-division is a watch-it demo and /decimal-steps does the
// arithmetic; this one drills WHERE everything goes.
import ToolNav from "@/components/ToolNav";
import DivisionHouseBoard from "@/components/DivisionHouseBoard";

// ?set= is read HERE, on the server, so the first paint is already the
// teacher's set. Read in a mount effect instead, the board painted the built-in
// set for a frame and then swapped - the board keeps that effect as a fallback,
// and with the prop right it now resolves to the same string and changes nothing.
export default async function DivisionHousePage({
  searchParams,
}: {
  searchParams: Promise<{ set?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.set) ? params.set[0] : params.set;

  return (
    <>
      <ToolNav title="Division House" />
      <main style={{ minHeight: "100vh", background: "var(--bdb-ground)", color: "var(--bdb-ink)", fontFamily: "var(--bdb-font)", padding: "20px clamp(14px, 3vw, 34px) 44px" }}>
        <div style={{ maxWidth: "min(1400px, 96vw)", margin: "0 auto" }}>
          <DivisionHouseBoard set={raw ?? null} />
        </div>
      </main>
    </>
  );
}
