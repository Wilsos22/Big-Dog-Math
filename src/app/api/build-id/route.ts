export const dynamic = "force-dynamic";

// The deployed build's identity. Classroom display pages poll this and reload
// themselves when a new deploy ships, so a projector tab left open for days
// can never keep running last week's code.
export async function GET() {
  const id = process.env.VERCEL_GIT_COMMIT_SHA
    || process.env.VERCEL_DEPLOYMENT_ID
    || "dev";
  return Response.json({ id }, { headers: { "cache-control": "no-store" } });
}
