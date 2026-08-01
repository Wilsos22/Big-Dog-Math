"use client";

// Teacher rosters are loaded through the protected server API.
//
// FERPA boundary: the site's roster is PSEUDONYMOUS - aliases only. Real
// names and district emails live in the Workspace roster Sheet, which pushes
// { alias, emailHmac, period } rows here via Apps Script. The NAME KEY panel
// below stores the alias-to-name mapping in THIS browser's localStorage only,
// so teacher surfaces can show real names without the server ever holding
// them. See src/lib/pseudonym.ts and src/lib/teacherNameKey.ts.

import { useEffect, useState, useCallback } from "react";
import { teacherApiRequest, teacherPost } from "@/lib/teacherApi";
import SiteNav from "@/components/SiteNav";
import {
  aliasToNameMap,
  clearNameKey,
  labelFor,
  loadNameKey,
  parseNameKey,
  saveNameKey,
  type NameKey,
} from "@/lib/teacherNameKey";

interface Period { id: string; name: string; sort_order: number; }
interface Student { id: string; period_id: string; alias: string | null; }

export default function RosterPage() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newPeriod, setNewPeriod] = useState("");
  const [aliasInputs, setAliasInputs] = useState<Record<string, string>>({});
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [nameKey, setNameKey] = useState<NameKey | null>(null);
  const [keyPaste, setKeyPaste] = useState("");
  const [keyMsg, setKeyMsg] = useState<string | null>(null);

  useEffect(() => { setNameKey(loadNameKey()); }, []);
  const names = aliasToNameMap(nameKey);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await teacherApiRequest<{
        periods: Period[];
        students: Array<{ id: string; periodId: string; alias: string | null }>;
      }>("/api/teacher/roster");
      setPeriods(result.periods);
      setStudents(result.students.map((student) => ({
        id: student.id,
        period_id: student.periodId,
        alias: student.alias,
      })));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Roster could not be loaded.");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function importNameKey() {
    const { entries, error: parseError } = parseNameKey(keyPaste);
    if (parseError) { setKeyMsg(parseError); return; }
    setNameKey(saveNameKey(entries));
    setKeyPaste("");
    setKeyMsg(`Name key loaded: ${entries.length} students. It stays on this device only.`);
  }
  function forgetNameKey() {
    clearNameKey();
    setNameKey(null);
    setKeyMsg("Name key removed from this device.");
  }

  async function addPeriod() {
    if (!newPeriod.trim()) return;
    try {
      await teacherPost("/api/teacher/roster", { action: "create-period", name: newPeriod.trim(), sortOrder: periods.length + 1 });
    } catch (actionError) { setError(actionError instanceof Error ? actionError.message : "Period could not be added."); return; }
    setNewPeriod(""); load();
  }
  async function addStudent(periodId: string) {
    const alias = (aliasInputs[periodId] || "").trim();
    if (!alias) return;
    try {
      await teacherPost("/api/teacher/roster", { action: "create-student", periodId, alias });
    } catch (actionError) { setError(actionError instanceof Error ? actionError.message : "Student could not be added."); return; }
    setAliasInputs((m) => ({ ...m, [periodId]: "" })); load();
  }
  async function removeStudent(student: Student, periodName: string) {
    if (pendingDelete || !student.alias) return;
    const confirmed = window.confirm(
      `Delete ${labelFor(names, student.alias)} from ${periodName}? This only works when the student has no saved instructional history.`,
    );
    if (!confirmed) return;
    setPendingDelete(`student:${student.id}`);
    setError(null);
    try {
      await teacherPost("/api/teacher/roster", {
        action: "delete-student",
        studentId: student.id,
        expectedName: student.alias,
        confirm: true,
      });
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Student could not be deleted.");
    } finally {
      setPendingDelete(null);
    }
  }
  async function removePeriod(period: Period) {
    if (pendingDelete) return;
    const confirmed = window.confirm(
      `Delete class "${period.name}"? This only works when the class has no students or instructional history.`,
    );
    if (!confirmed) return;
    setPendingDelete(`period:${period.id}`);
    setError(null);
    try {
      await teacherPost("/api/teacher/roster", {
        action: "delete-period",
        periodId: period.id,
        expectedName: period.name,
        confirm: true,
      });
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Class could not be deleted.");
    } finally {
      setPendingDelete(null);
    }
  }

  return (
    <main className="rs-page">
      <style>{`
        .rs-page { min-height:100vh; background:#fbf7ef; font-family:Inter,ui-sans-serif,system-ui,sans-serif; padding:0 0 50px; }
        .rs-top { display:flex; align-items:center; justify-content:space-between; padding:16px clamp(16px,4vw,40px); }
        .rs-back { color:#7a7468; font-weight:800; font-size:0.85rem; text-decoration:none; }
        .rs-mark { font-size:0.76rem; font-weight:900; letter-spacing:0.14em; text-transform:uppercase; color:#34c759; }
        .rs-wrap { max-width:680px; margin:0 auto; padding:0 16px; display:grid; gap:16px; }
        .rs-h1 { font-family:Georgia,"Times New Roman",serif; font-size:clamp(1.8rem,5vw,2.6rem); font-weight:700; color:#1c1d22; margin:6px 0 0; }
        .rs-sub { color:#7a7468; font-weight:600; margin:0 0 8px; }
        .rs-card { background:#fff; border:1px solid #efe7d6; border-radius:18px; padding:18px 20px; }
        .rs-card h2 { margin:0 0 12px; font-size:1.1rem; font-weight:900; color:#2a2a2e; }
        .rs-card-head { display:flex; align-items:flex-start; justify-content:space-between; gap:14px; margin-bottom:12px; }
        .rs-card-head h2 { margin:0; }
        .rs-row { display:flex; gap:8px; flex-wrap:wrap; }
        .rs-in { flex:1; min-width:160px; border:2px solid #e7dec9; border-radius:11px; padding:10px 13px; font-size:1rem; font-weight:700; color:#2a2a2e; background:#fbf7ef; }
        .rs-key-paste { width:100%; min-height:96px; border:2px solid #e7dec9; border-radius:11px; padding:10px 13px; font-size:0.9rem; font-weight:600; color:#2a2a2e; background:#fbf7ef; box-sizing:border-box; font-family:inherit; }
        .rs-btn { background:#34c759; color:#063; border:none; border-radius:11px; padding:10px 18px; font-weight:900; cursor:pointer; }
        .rs-btn:disabled, .rs-delete:disabled { cursor:not-allowed; opacity:0.55; }
        .rs-btn-quiet { background:#fff; border:1px solid #e7dec9; color:#7a7468; border-radius:11px; padding:10px 18px; font-weight:800; cursor:pointer; }
        .rs-chip { display:inline-flex; align-items:center; gap:8px; background:#f6f1e6; border:1px solid #efe7d6; border-radius:999px; padding:7px 8px 7px 14px; font-weight:700; color:#4a4636; margin:4px 6px 0 0; }
        .rs-delete { background:#fff; border:1px solid #e7b9b1; color:#b42318; border-radius:9px; padding:7px 10px; cursor:pointer; font-weight:900; font-size:0.78rem; line-height:1; }
        .rs-chip .rs-delete { border-radius:999px; padding:5px 9px; }
        .rs-students { margin-top:12px; }
        .rs-empty { color:#b3aa97; font-weight:600; font-size:0.9rem; }
        .rs-err { background:#fdecea; border:1px solid #f5c6c0; color:#b91c1c; border-radius:12px; padding:12px 16px; font-weight:700; }
        .rs-note { margin:0 0 12px; color:#7a7468; font-weight:600; font-size:0.9rem; line-height:1.5; }
        .rs-key-msg { margin:10px 0 0; font-weight:700; color:#4a4636; font-size:0.9rem; }
      `}</style>

      <SiteNav variant="teacher" />
      <div className="rs-wrap">
        <h1 className="rs-h1">Class rosters</h1>
        <p className="rs-sub">Aliases only on the site. Names stay in your Workspace Sheet and, if you load the key, on this device.</p>

        {error && <div className="rs-err">{error}</div>}
        {loading && <p className="rs-empty">Loading...</p>}

        {!loading && (
          <>
            <div className="rs-card">
              <h2>Where the roster comes from</h2>
              <p className="rs-note">
                The roster Sheet in your district Google Workspace is the source of truth. Run
                pushRosterToSite() in its Apps Script (or wait for its daily trigger) and each student
                arrives here as an alias plus a one-way email code. No name or district email ever
                reaches the site, and nothing here can compute one.
              </p>
            </div>

            <div className="rs-card">
              <h2>Name key (this device only)</h2>
              <p className="rs-note">
                Paste the Alias, Name, and Email columns from the roster Sheet to see real names on
                teacher pages. The key lives in this browser&apos;s local storage - it is never sent
                anywhere, and clearing it leaves only aliases.
              </p>
              {nameKey ? (
                <div className="rs-row">
                  <span className="rs-chip">Key loaded: {nameKey.entries.length} students</span>
                  <button className="rs-btn-quiet" onClick={forgetNameKey}>Remove key from this device</button>
                </div>
              ) : (
                <>
                  <textarea
                    className="rs-key-paste"
                    placeholder={"Alias\tName\tEmail\nAmber Fox\t(student name)\t(district email)"}
                    value={keyPaste}
                    onChange={(event) => setKeyPaste(event.target.value)}
                  />
                  <div className="rs-row" style={{ marginTop: 8 }}>
                    <button className="rs-btn" onClick={importNameKey} disabled={!keyPaste.trim()}>Load name key</button>
                  </div>
                </>
              )}
              {keyMsg && <p className="rs-key-msg">{keyMsg}</p>}
            </div>

            <div className="rs-card">
              <h2>Add a class period</h2>
              <div className="rs-row">
                <input className="rs-in" placeholder="e.g. Period 3" value={newPeriod}
                  onChange={(e) => setNewPeriod(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addPeriod(); }} />
                <button className="rs-btn" onClick={addPeriod}>Add</button>
              </div>
            </div>

            {periods.length === 0 && <p className="rs-empty">No periods yet; add your first one above.</p>}

            {periods.map((p) => {
              const roster = students.filter((s) => s.period_id === p.id);
              return (
                <div className="rs-card" key={p.id}>
                  <div className="rs-card-head">
                    <h2>{p.name} <span style={{ color: "#b3aa97", fontWeight: 700, fontSize: "0.85rem" }}>- {roster.length} students</span></h2>
                    <button
                      className="rs-delete"
                      onClick={() => removePeriod(p)}
                      disabled={Boolean(pendingDelete)}
                    >
                      {pendingDelete === `period:${p.id}` ? "Deleting..." : "Delete class"}
                    </button>
                  </div>
                  <div className="rs-row">
                    <input className="rs-in" placeholder="Add a student alias (never a real name)" value={aliasInputs[p.id] || ""}
                      onChange={(e) => setAliasInputs((m) => ({ ...m, [p.id]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") addStudent(p.id); }} />
                    <button className="rs-btn" onClick={() => addStudent(p.id)}>Add</button>
                  </div>
                  <div className="rs-students">
                    {roster.length === 0 ? <span className="rs-empty">No students yet.</span>
                      : roster.map((s) => (
                        <span className="rs-chip" key={s.id}>
                          {labelFor(names, s.alias)}
                          <button
                            className="rs-delete"
                            onClick={() => removeStudent(s, p.name)}
                            disabled={Boolean(pendingDelete)}
                            aria-label={`Delete ${s.alias || "student"}`}
                          >
                            {pendingDelete === `student:${s.id}` ? "Deleting..." : "Delete"}
                          </button>
                        </span>
                      ))}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </main>
  );
}
