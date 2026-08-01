"use client";

// Warm-up insights — links into each day's Google Forms summary charts.
//
// The per-student weekly triage (missing days, low averages, follow-up flags)
// used to render here from a Notion summaries database. That read is RETIRED
// (FERPA boundary): student data may not live in Notion, so the triage now
// lives in the Workspace response spreadsheet beside the export sheets that
// feed it. This page keeps what carries no student data - the form links.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";

interface WarmupForm {
  id: string;
  name: string;
  className: string;
  date: string;
  summaryUrl: string;
  responseSheet: string;
}

const SCOPES = [
  { label: "Last 2 weeks", days: 14 },
  { label: "This week", days: 7 },
  { label: "Last 4 weeks", days: 28 },
];

function fmtDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function WarmupInsightsPage() {
  const [forms, setForms] = useState<WarmupForm[]>([]);
  const [days, setDays] = useState(14);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let stop = false;
    setLoading(true); setError("");
    (async () => {
      try {
        const res = await fetch(`/api/warmup-summaries?days=${days}`);
        const data = await res.json() as { forms?: WarmupForm[]; error?: string };
        if (stop) return;
        if (!res.ok || data.error) throw new Error(data.error || "Could not load warm-up insights.");
        setForms(data.forms ?? []);
      } catch (err) {
        if (!stop) setError(err instanceof Error ? err.message : "Could not load warm-up insights.");
      } finally {
        if (!stop) setLoading(false);
      }
    })();
    return () => { stop = true; };
  }, [days]);

  const formsByDate = useMemo(() => {
    const map = new Map<string, WarmupForm[]>();
    for (const f of forms) { const k = f.date || "—"; (map.get(k) ?? map.set(k, []).get(k)!).push(f); }
    return Array.from(map.entries()).sort((a, b) => (b[0]).localeCompare(a[0]));
  }, [forms]);

  return (
    <div className="wi">
      <SiteNav variant="teacher" />
      <style>{`
        .wi { min-height:100vh; background:var(--bdb-ground); color:var(--bdb-ink); font-family:var(--bdb-font); }
        .wi-wrap { max-width:1100px; margin:0 auto; padding:clamp(16px,3vw,30px) clamp(14px,3vw,28px) 56px; }
        .wi-top { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:6px; }
        .wi-h1 { margin:0; font-size:clamp(1.6rem,3.4vw,2.2rem); font-weight:700; letter-spacing:-0.02em; }
        .wi-sub { margin:4px 0 0; color:var(--bdb-ink-soft); font-size:0.96rem; }
        .wi-back { color:var(--bdb-ink-soft); font-weight:600; font-size:0.86rem; text-decoration:none; border:1px solid var(--bdb-line); background:var(--bdb-card); border-radius:var(--bdb-r-pill); padding:8px 14px; }

        .wi-controls { display:flex; gap:10px; align-items:end; flex-wrap:wrap; margin:18px 0 6px; }
        .wi-field { display:grid; gap:5px; font-size:0.74rem; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:var(--bdb-ink-faint); }
        .wi-seg { display:inline-flex; background:var(--bdb-card); border:1px solid var(--bdb-line); border-radius:var(--bdb-r-pill); padding:3px; gap:3px; }
        .wi-seg button { border:none; background:transparent; border-radius:var(--bdb-r-pill); padding:7px 14px; font:inherit; font-weight:600; font-size:0.86rem; color:var(--bdb-ink-soft); cursor:pointer; }
        .wi-seg button.on { background:var(--bdb-ink); color:#fff; }

        .wi-card { background:var(--bdb-card); border:1px solid var(--bdb-line); border-radius:var(--bdb-r); box-shadow:var(--bdb-shadow-sm); padding:18px 20px; margin-top:18px; }
        .wi-card.accent { border-left:5px solid var(--bdb-amber); }
        .wi-card h2 { margin:0 0 3px; font-size:1.08rem; font-weight:700; }
        .wi-card .ch { color:var(--bdb-ink-soft); font-size:0.86rem; margin:0 0 14px; }
        .wi-card p.body { margin:0; color:var(--bdb-ink-soft); font-size:0.92rem; line-height:1.6; }
        .wi-empty { color:var(--bdb-ink-faint); font-size:0.92rem; }

        .wi-daily { display:grid; gap:14px; }
        .wi-day h3 { margin:0 0 8px; font-size:0.82rem; font-weight:700; color:var(--bdb-ink-soft); }
        .wi-forms { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:10px; }
        .wi-form { border:1px solid var(--bdb-line); border-radius:var(--bdb-r-sm); padding:12px 14px; background:var(--bdb-ground); }
        .wi-form .fn { font-weight:600; font-size:0.92rem; margin:0 0 8px; }
        .wi-form .fl { display:flex; gap:8px; flex-wrap:wrap; }
        .wi-form a { font-size:0.8rem; font-weight:700; text-decoration:none; padding:6px 11px; border-radius:var(--bdb-r-pill); }
        .wi-form a.primary { background:var(--bdb-teal-deep); color:#fff; }
        .wi-form a.ghost { border:1px solid var(--bdb-line); color:var(--bdb-ink-soft); }

        .wi-err { background:color-mix(in srgb,var(--bdb-coral) 8%,white); border:1px solid color-mix(in srgb,var(--bdb-coral) 30%,white); color:#9a3412; border-radius:var(--bdb-r); padding:16px; white-space:pre-wrap; font-size:0.9rem; }
        @media (max-width:640px){ .wi-card { overflow-x:auto; } }
      `}</style>

      <div className="wi-wrap">
        <header className="wi-top">
          <div>
            <h1 className="wi-h1">Warm-up insights</h1>
            <p className="wi-sub">Each day&apos;s Google Forms summary, one click away.</p>
          </div>
          <Link className="wi-back" href="/teacher">← Back to tools</Link>
        </header>

        <div className="wi-controls">
          <div className="wi-field">Scope
            <div className="wi-seg">
              {SCOPES.map((s) => (
                <button key={s.days} className={days === s.days ? "on" : ""} onClick={() => setDays(s.days)}>{s.label}</button>
              ))}
            </div>
          </div>
        </div>

        <section className="wi-card accent">
          <h2>Per-student triage moved to Workspace</h2>
          <p className="body">
            Missing days, low weekly averages, and follow-up flags now live in the warm-up response
            spreadsheet in your district Google Workspace, next to the export sheets that feed them.
            Student data does not live in Notion or on this site anymore; the mastery bars on
            the Mastery board still update from the pseudonymous evidence pipeline as before.
          </p>
        </section>

        {loading && <section className="wi-card"><p className="wi-empty">Loading warm-up form links…</p></section>}
        {!loading && error && (
          <section className="wi-card"><pre className="wi-err">{error}

If this mentions sharing: open the Warm up Links database in Notion, then Connections, and add Big Dog Math.</pre></section>
        )}

        {!loading && !error && (
          <section className="wi-card">
            <h2>Daily summaries by period</h2>
            <p className="ch">Open each day&apos;s Google Forms summary for the full charts.</p>
            {forms.length === 0 ? (
              <p className="wi-empty">No form links in range. (Share the Warm up Links database with the Big Dog Math integration to show these.)</p>
            ) : (
              <div className="wi-daily">
                {formsByDate.map(([date, list]) => (
                  <div className="wi-day" key={date}>
                    <h3>{fmtDate(date)}</h3>
                    <div className="wi-forms">
                      {list.map((f) => (
                        <div className="wi-form" key={f.id}>
                          <p className="fn">{f.className || f.name || "Warm-up"}</p>
                          <div className="fl">
                            {f.summaryUrl && <a className="primary" href={f.summaryUrl} target="_blank" rel="noopener noreferrer">Open summary ↗</a>}
                            {f.responseSheet && <a className="ghost" href={f.responseSheet} target="_blank" rel="noopener noreferrer">Responses</a>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
