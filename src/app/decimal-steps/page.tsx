// Decimals, step by step - all four operations, one decision at a time.
// Its own tool, separate from /long-division (which is whole numbers only).
import ToolNav from "@/components/ToolNav";
import DecimalStepsBoard from "@/components/DecimalStepsBoard";

// ?set= is read on the server so the first paint is already the teacher's set,
// not the built-in one swapped out a frame later.
export default async function DecimalStepsPage({
  searchParams,
}: {
  searchParams: Promise<{ set?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.set) ? params.set[0] : params.set;

  return (
    <>
      <ToolNav title="Decimals, step by step" />
      <main style={{ minHeight: "100vh", background: "var(--bdb-ground)", color: "var(--bdb-ink)", fontFamily: "var(--bdb-font)", padding: "20px clamp(14px, 3vw, 34px) 44px" }}>
        <div style={{ maxWidth: "min(1500px, 96vw)", margin: "0 auto", display: "grid", gap: 16 }}>
          <DecimalStepsBoard set={raw ?? null} />
        </div>
      </main>
    </>
  );
}
