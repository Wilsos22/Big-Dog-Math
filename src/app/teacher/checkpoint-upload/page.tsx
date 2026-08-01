"use client";

// Checkpoint CSV upload — drop in a Tier-2 checkpoint (or Tier-1 practice check)
// results file and mastery updates immediately: bars move, stages gate
// (Approaching → Mastered → Complete).
//
// FERPA boundary: the server accepts ALIASES only. A grading export that
// carries emails is translated to aliases RIGHT HERE in the browser, using
// the name key loaded on /roster - the emails never leave this page, and the
// upload is blocked until every row translates.

import { useCallback, useMemo, useState } from "react";
import SiteNav from "@/components/SiteNav";
import { parseCheckpointCsv, serializeAliasCsv, translateRowsToAliases } from "@/lib/checkpointCsv";
import { emailToAliasMap, loadNameKey } from "@/lib/teacherNameKey";

interface UploadResult {
  checkpoints: string[]; tier: number; itemRuns: number; resultsInserted: number;
  skippedExisting: number; studentsMatched: number; unmatchedAliases: string[];
  parseWarnings: string[]; periodsRecomputed: number; error?: string;
}

export default function CheckpointUpload() {
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [tier, setTier] = useState<1 | 2>(2);
  const [sbacItem, setSbacItem] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preview = csv.trim() ? parseCheckpointCsv(csv) : null;
  const translation = useMemo(() => {
    if (!preview || preview.rows.length === 0) return null;
    return translateRowsToAliases(preview.rows, emailToAliasMap(loadNameKey()));
  }, [preview]);
  const untranslated = translation?.unmatchedEmails.length ?? 0;
  const readyRows = translation ? translation.translated.filter((row) => row.alias) : [];

  const onFile = useCallback((f: File | undefined) => {
    if (!f) return;
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result || ""));
    reader.readAsText(f);
  }, []);

  const upload = useCallback(async () => {
    if (!translation || untranslated > 0 || readyRows.length === 0 || busy) return;
    setBusy(true); setError(null); setResult(null);
    try {
      const res = await fetch("/api/checkpoints/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: serializeAliasCsv(readyRows), tier, sbacItem: sbacItem ? Number(sbacItem) : undefined }),
      });
      const d = await res.json();
      if (!res.ok || d.error) setError(d.error || `Upload failed (${res.status}).`);
      else setResult(d);
    } catch { setError("Network error."); }
    finally { setBusy(false); }
  }, [translation, untranslated, readyRows, tier, sbacItem, busy]);

  return (
    <div className="cu-page">
      <SiteNav variant="teacher" />
      <style>{`
        .cu-page { min-height: 100vh; background: #fbf7ef; padding-bottom: 48px; }
        .cu-wrap { max-width: 860px; margin: 0 auto; padding: 20px 24px; }
        .cu-h1 { font-family: Georgia, serif; font-size: 2rem; margin: 10px 0 4px; color: #2b2620; }
        .cu-sub { color: #7a7264; font-size: 0.95rem; margin-bottom: 18px; line-height: 1.5; }
        .cu-card { background: #fff; border: 1px solid #efe8d8; border-radius: 18px; padding: 20px 22px; margin-bottom: 16px; }
        .cu-row { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin-bottom: 12px; }
        .cu-label { font-size: 0.8rem; font-weight: 800; color: #7a7264; text-transform: uppercase; letter-spacing: 0.04em; }
        .cu-select, .cu-num { font: inherit; padding: 10px 14px; border-radius: 12px; border: 1px solid #e5ddcd; background: #fff; }
        .cu-num { width: 90px; }
        .cu-drop { border: 2px dashed #dcd2ba; border-radius: 14px; padding: 18px; text-align: center; color: #7a7264; font-weight: 600; cursor: pointer; background: #fdfbf5; }
        .cu-ta { width: 100%; min-height: 140px; border: 1px solid #e5ddcd; border-radius: 12px; padding: 12px; font-family: ui-monospace, Menlo, monospace; font-size: 0.8rem; box-sizing: border-box; margin-top: 10px; }
        .cu-btn { font: inherit; font-weight: 800; padding: 12px 22px; border-radius: 12px; border: none; background: #14b8a6; color: #fff; cursor: pointer; }
        .cu-btn:disabled { opacity: 0.5; cursor: default; }
        .cu-note { font-size: 0.85rem; color: #7a7264; }
        .cu-good { background: #e9f7ef; border: 1px solid #bfe8cf; border-radius: 14px; padding: 14px 18px; color: #1e6b41; font-weight: 600; line-height: 1.7; }
        .cu-bad { background: #fdeeee; border: 1px solid #f5c6c0; border-radius: 14px; padding: 14px 18px; color: #b91c1c; font-weight: 600; }
        .cu-warn { background: #fff7e6; border: 1px solid #ffe2a8; border-radius: 12px; padding: 10px 14px; color: #92660a; font-size: 0.85rem; margin-top: 10px; }
        .cu-links a { color: #0f5e5f; font-weight: 800; margin-right: 16px; }
      `}</style>

      <div className="cu-wrap">
        <h1 className="cu-h1">Checkpoint upload</h1>
        <div className="cu-sub">
          Upload a checkpoint (or practice-day) results CSV and mastery updates instantly — checkpoints are
          the produced-work evidence, so this is what moves students into <b>Mastered</b> and <b>Complete</b>.
          Columns: Date, Alias (or Email — translated to aliases in this browser before upload),
          Checkpoint, Item #, Lesson, CCSS, Correct (Y/N), Misconception. Emails never leave this page.
        </div>

        <div className="cu-card">
          <div className="cu-row">
            <span className="cu-label">This file is a</span>
            <select className="cu-select" value={tier} onChange={(e) => setTier(Number(e.target.value) === 1 ? 1 : 2)}>
              <option value={2}>Tier-2 Checkpoint (moves the bar hard)</option>
              <option value={1}>Tier-1 practice-day check (nudges)</option>
            </select>
            <span className="cu-label">SBAC item #</span>
            <input className="cu-num" type="number" min={1} placeholder="e.g. 8" value={sbacItem} onChange={(e) => setSbacItem(e.target.value)} />
            <span className="cu-note">(optional — the transfer item that counts toward Complete)</span>
          </div>

          <label className="cu-drop" style={{ display: "block" }}>
            {fileName ? `${fileName}` : "Click to choose the results CSV (or paste it below)"}
            <input type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          <textarea className="cu-ta" placeholder="…or paste CSV text here" value={csv} onChange={(e) => { setCsv(e.target.value); setFileName(null); }} spellCheck={false} />

          {preview && (
            <div className="cu-note" style={{ margin: "10px 0" }}>
              Preview: <b>{preview.rows.length}</b> item results · checkpoints: <b>{preview.checkpoints.join(", ") || "—"}</b>
              {preview.errors.length > 0 && <div className="cu-warn">{preview.errors.slice(0, 5).join(" ")}</div>}
              {untranslated > 0 && (
                <div className="cu-warn">
                  {untranslated} email{untranslated === 1 ? "" : "s"} could not be translated to an alias.
                  Load (or refresh) your name key on the Rosters page, then re-paste this file.
                  Nothing uploads until every row is an alias.
                </div>
              )}
            </div>
          )}

          <button className="cu-btn" disabled={busy || !translation || untranslated > 0 || readyRows.length === 0} onClick={() => void upload()}>
            {busy ? "Uploading + recomputing…" : "Upload → update mastery"}
          </button>
        </div>

        {error && <div className="cu-bad">{error}</div>}
        {result && (
          <div className="cu-good">
            ✓ <b>{result.checkpoints.join(", ")}</b> ingested as Tier-{result.tier} —
            {" "}{result.resultsInserted} results across {result.itemRuns} items, {result.studentsMatched} students matched
            {result.skippedExisting > 0 && <> · {result.skippedExisting} already existed (skipped)</>}
            {" "}· {result.periodsRecomputed} period(s) recomputed.
            {result.unmatchedAliases.length > 0 && (
              <div className="cu-warn">Unmatched aliases (no student row — push the roster from the Workspace Sheet and re-upload): {result.unmatchedAliases.join(", ")}</div>
            )}
            {result.parseWarnings.length > 0 && <div className="cu-warn">{result.parseWarnings.slice(0, 5).join(" ")}</div>}
            <div className="cu-links" style={{ marginTop: 10 }}>
              <a href="/teacher/mastery">→ Mastery board</a>
              <a href="/teacher/rightnow">→ Right now</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
