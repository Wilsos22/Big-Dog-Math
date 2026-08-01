"use client";

// Day review — what each student did in the in-app tools today (across all
// periods), read from the proficiency spine. Reads only through the gated
// /api/submissions route. The old push-to-Notion button is gone for good:
// student work may not leave the site for Notion (FERPA boundary). Grade-book
// export happens in the district Google Workspace, where aliases resolve back
// to names.

import { useCallback, useEffect, useState } from "react";
import SiteNav from "@/components/SiteNav";

interface Activity { student: string; period: string | null; tool: string; toolLabel: string; score: number; misconception: string | null }
interface Data { connected?: boolean; today?: string; activities: Activity[]; error?: string }

export default function DayReviewPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await fetch("/api/submissions", { cache: "no-store" }); setData(await r.json()); }
    catch { setData({ activities: [], error: "Couldn't load today's work." }); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const d = data;
  return (
    <div className="dr-page">
      <SiteNav variant="teacher" />
      <style>{`
        .dr-page { min-height:100vh; background:var(--bdb-ground); color:var(--bdb-ink); font-family:var(--bdb-font); padding-bottom:56px; }
        .dr-wrap { max-width:960px; margin:0 auto; padding:20px clamp(16px,3vw,28px); }
        .dr-h1 { font-size:1.7rem; font-weight:700; letter-spacing:-0.02em; margin:6px 0 2px; }
        .dr-sub { color:var(--bdb-ink-soft); font-size:0.95rem; margin:0 0 16px; }
        .dr-note { background:var(--bdb-card); border:1px solid var(--bdb-line); border-left:5px solid var(--bdb-amber); border-radius:var(--bdb-r); padding:12px 16px; margin:0 0 16px; font-size:0.9rem; color:var(--bdb-ink-soft); }
        .dr-empty { color:var(--bdb-ink-faint); font-size:0.92rem; padding:8px 2px; }
        table.dr-t { width:100%; border-collapse:collapse; background:var(--bdb-card); border:1px solid var(--bdb-line); border-radius:var(--bdb-r); overflow:hidden; }
        .dr-t th { text-align:left; font-size:0.7rem; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:var(--bdb-ink-faint); padding:10px 14px; border-bottom:1px solid var(--bdb-line); }
        .dr-t td { padding:10px 14px; border-bottom:1px solid var(--bdb-line); font-size:0.92rem; }
        .dr-t tr:last-child td { border-bottom:none; }
        .dr-tag { font-size:0.74rem; font-weight:700; padding:2px 8px; border-radius:999px; background:var(--bdb-ground-2); color:var(--bdb-ink-soft); }
        .dr-tag.m { background:#fff2ea; color:#b04a1e; }
      `}</style>

      <div className="dr-wrap">
        <h1 className="dr-h1">Day review</h1>
        <p className="dr-sub">What each student did in the tools today{d?.today ? ` (${d.today})` : ""}. Students appear by alias; the roster Sheet in Google Workspace is the key.</p>

        {loading && <div className="dr-empty">Loading.</div>}
        {d && !d.connected && !d.error && <div className="dr-note">Supabase isn&apos;t connected yet — add the keys in Vercel and redeploy.</div>}
        {d?.error && <div className="dr-note">{d.error}</div>}

        {d && (d.connected || d.activities.length > 0) && (
          <>
            {d.activities.length === 0 ? (
              <div className="dr-empty">No in-app tool work recorded today yet. (Students need to have joined a session; the Area Model, Equation Builder, GEMS, Combine Like Terms, and Balance Beam log their work.)</div>
            ) : (
              <table className="dr-t">
                <thead><tr><th>Student</th><th>Period</th><th>Tool</th><th>Score</th><th>Watch</th></tr></thead>
                <tbody>
                  {d.activities.map((a, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 700 }}>{a.student}</td>
                      <td>{a.period || "—"}</td>
                      <td>{a.toolLabel}</td>
                      <td>{a.score}/5</td>
                      <td>{a.misconception ? <span className="dr-tag m">{a.misconception}</span> : <span className="dr-tag">clean</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}
