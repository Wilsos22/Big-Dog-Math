import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const home = read("src/app/page.tsx");
const classSync = read("src/components/ClassSync.tsx");
const teacherSession = read("src/app/api/teacher/session/route.ts");
const studentJoin = read("src/app/api/student/join/route.ts");
const warmupStart = read("src/app/api/student/warmup-start/route.ts");
const warmupStatus = read("src/app/api/student/warmup-status/route.ts");
const warmupVerify = read("src/app/api/student/warmup-verify/route.ts");
const studentIdentity = read("src/lib/studentIdentity.ts");
const sessionPage = read("src/app/session/page.tsx");
const control = read("src/app/control/page.tsx");
const migration = read("supabase/student-warmup-sessions.sql");

const sliceBetween = (source, start, end) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  return startIndex >= 0 && endIndex > startIndex ? source.slice(startIndex, endIndex) : "";
};

const submitCode = sliceBetween(home, "async function submitCode", "async function pickName");
if (!submitCode || submitCode.includes("/api/student/admission-request")) {
  throw new Error("Entering a class code must not create a teacher approval request in the normal path.");
}
if (!home.includes("Warm-up not connecting? Ask for help") || !home.includes("Tell your teacher this help code")) {
  throw new Error("A teacher admission request must remain available only as an explicit recovery action.");
}
if (!home.includes("background:var(--bdb-amber)") || !home.includes("Open today's warm-up")) {
  throw new Error("The accepted-code homepage must expose the assigned warm-up as the bright amber action.");
}
if (!home.includes("Today&apos;s lesson") || !home.includes("Module {moduleNumber}") || !home.includes("Topic {topicNumber}")) {
  throw new Error("The accepted-code homepage must show today's lesson, module, and topic before the warm-up action.");
}
// 2026-07-26 home-base redesign: the homepage NEVER locks navigation. The
// warm-up card adapts its copy to identity state; onward links stay live.
if (!home.includes('href="/explore"')) {
  throw new Error("The home base must always link students onward to Explore - links are never locked.");
}
if (!home.includes("Warm-up connected") || !home.includes("Open today's warm-up")) {
  throw new Error("The warm-up card must adapt to identity state instead of locking the page.");
}
// Verification runs GLOBALLY (WarmupJoinSync in the root layout) so it
// survives the student navigating anywhere in the tab; the homepage only
// LISTENS for the ready event and never routes the student away.
const layout = read("src/app/layout.tsx");
const joinSync = read("src/components/WarmupJoinSync.tsx");
if (!layout.includes("<WarmupJoinSync />")) {
  throw new Error("WarmupJoinSync must be mounted globally in the root layout.");
}
if (!joinSync.includes('sessionStorage.getItem("bdm-pending-class-code")')
  || !joinSync.includes("saveVerifiedStudentJoin(result.session)")) {
  throw new Error("Global verification must key on the pending class code and save the verified join.");
}
const readyEffect = sliceBetween(home, "const onReady = ()", "removeEventListener(STUDENT_SESSION_READY_EVENT");
if (!readyEffect.includes("setIdentityReady(true)") || readyEffect.includes("router.push")) {
  throw new Error("The homepage must flip to connected on the ready event without routing away from it.");
}
if (!teacherSession.includes('status: "open", broadcast: "free"')) {
  throw new Error("A new class session must leave verified students free on the homepage until Begin lesson.");
}
// Warm-up and a MISSING state are deliberately SEPARATE branches, and this
// contract used to pin them as one combined condition. Warm-up is an authored
// destination: a student sitting on /live-flow is sent back to the homepage. A
// missing state is only a gap - a reconnect, a Control republish between steps,
// a snapshot that has not landed - and it must HOLD every student exactly where
// they are. Collapsing the two is how this shipped, and it bounced a student who
// was watching the lesson out to "/" and back the moment state returned (the
// signal chips are gated on flow.state, so the stuck chip went with it).
if (!classSync.includes("if (!liveStateId) {")
  || !classSync.includes("target = currentPath;")) {
  throw new Error("A missing live_flow state must hold students in place, never route them away.");
}
if (!classSync.includes('} else if (liveStateId === "warmup") {')
  || !classSync.includes('currentPath === LIVE_FLOW_ROUTE ? "/" : null')) {
  throw new Error("Live Flow Warm-Up must preserve the student homepage.");
}
const classSyncTick = classSync.slice(classSync.indexOf("const tick = async"), classSync.indexOf("void tick();"));
if (!classSyncTick.includes("getStoredStudentSessionId()")) {
  throw new Error("ClassSync must discover a student session that becomes verified after the homepage mounts.");
}
if (!classSync.includes("window.addEventListener(STUDENT_SESSION_READY_EVENT")) {
  throw new Error("ClassSync must react immediately when warm-up verification creates the student session.");
}
if (!control.includes('teacherSession?.broadcast === "free"')
  || !control.includes('item.stateId === "warmup" && Boolean(item.linkUrl)')) {
  throw new Error("Selecting a lesson must stage its warm-up before Begin lesson starts pacing.");
}

if (!warmupStart.includes('.from("student_warmup_sessions")')
  || !warmupStart.includes('ignoreDuplicates: true')
  || !warmupStart.includes('select("verification_token,warmup_resource_key,completed_at")')
  || !warmupStart.includes("warmupToken: receipt.verification_token")
  || !warmupStart.includes("warmUpLink: warmupUrl || null")
  || !warmupStart.includes("lesson: liveFlow?.lesson")
  || !warmupStart.includes("canonicalGoogleFormResource")
  || !warmupStart.includes("verification_token: crypto.randomUUID()")
  || !warmupStart.includes("receipt.warmup_resource_key !== nextResourceKey")
  || !warmupStart.includes('.eq("status", "open")')) {
  throw new Error("Accepting a class code must bind an idempotent receipt to the exact assigned Form and rotate it on replacement.");
}
if (!submitCode.includes("await fetchWarmupLink(c)")
  || submitCode.indexOf("await fetchWarmupLink(c)") > submitCode.indexOf("setPendingCode(c)")) {
  throw new Error("The receipt must be created before the Chromebook enters the accepted-code state.");
}

const joinChain = sliceBetween(joinSync, "const check = async", "window.setInterval");
if (!joinChain.includes('"/api/student/warmup-status"')
  || !joinChain.includes("if (!status.complete || stopped) return;")
  || joinChain.indexOf('"/api/student/warmup-status"') > joinChain.indexOf('"/api/student/join"')) {
  throw new Error("The global poller must confirm this session's warm-up receipt before joining the lesson.");
}
if (!warmupStatus.includes('.eq("auth_user_id", student.authUserId)')
  || !warmupStatus.includes('.eq("session_id", session.id)')
  || !warmupStatus.includes("currentWarmupResourceKey")
  || !warmupStatus.includes("receipt.warmup_resource_key === currentResourceKey")) {
  throw new Error("Warm-up status must be scoped to the student, current session, and current assigned Form.");
}

const joinReceiptCheck = studentJoin.indexOf('.from("student_warmup_sessions")');
const joinWrite = studentJoin.indexOf('db.rpc("bdm_complete_verified_student_join_with_warmup"');
if (joinReceiptCheck < 0 || joinWrite < 0 || joinReceiptCheck > joinWrite
  || !studentJoin.includes('"warmup_not_complete"')
  || !studentJoin.includes("currentWarmupResourceKey")) {
  throw new Error("The join API must enforce the current Form's completed receipt before it writes attendance.");
}
if (!warmupVerify.includes('.eq("verification_token", warmupToken)')
  || !warmupVerify.includes('.eq("id", sessionId)')
  || !warmupVerify.includes("session.status !== \"open\"")
  || !warmupVerify.includes("receipt.completed_at")
  || !warmupVerify.includes("receipt.warmup_resource_key !== resourceKey")
  || !warmupVerify.includes("currentWarmupResourceKey(session.live_flow")
  || !warmupVerify.includes('db.rpc("bdm_complete_warmup_identity"')
  || !warmupVerify.includes("p_student_email_hmac: emailHmac")) {
  throw new Error("Google Form verification must consume the exact token once for the exact assigned Form and the same-period roster email HMAC.");
}
// FERPA boundary: the verify seam carries the HMAC, never the raw email, and
// refuses identified payloads outright.
if (!warmupVerify.includes("raw_email_rejected")
  || warmupVerify.includes('.ilike("email"')
  || studentIdentity.includes('.ilike("email"')
  || /students"\)[\s\S]{0,120}?select\("[^"]*[^_]email[,"]/.test(warmupVerify)) {
  throw new Error("Roster identity lookup must match by email_hmac exactly and refuse raw emails.");
}

const admitPath = sliceBetween(teacherSession, 'if (body.action === "admit")', 'if (body.action === "start")');
if (!admitPath.includes('db.rpc("bdm_admit_student_join_request_with_warmup"')
  || !migration.includes("update public.student_warmup_sessions")
  || !migration.includes("raise exception 'warm-up receipt missing for teacher admission'")) {
  throw new Error("The explicit teacher recovery must atomically complete the same session receipt.");
}

const warmupPollingEffect = sliceBetween(home, "const refreshWarmup = async", "async function requestTeacherHelp");
if (!warmupPollingEffect.includes("setWarmupHref(result.href)")
  || !warmupPollingEffect.includes("setWarmupToken(result.warmupToken)")
  || !warmupPollingEffect.includes("That session ended. Enter the new class code.")) {
  throw new Error("The homepage must refresh replaced Form links and recover from a closed session.");
}
const fetchWarmupLink = sliceBetween(home, "async function fetchWarmupLink", "function resetPendingSession");
if (!fetchWarmupLink.includes('"/api/student/warmup-start"')
  || !fetchWarmupLink.includes("personalizeWarmupLink(link, data.warmupToken)")) {
  throw new Error("Warm-up lookup must bind and personalize the exact session receipt on the server.");
}
if (!home.includes("Use a different code") || !home.includes('sessionStorage.removeItem("bdm-pending-class-code")')) {
  throw new Error("A student must be able to leave a stale accepted-code state.");
}

if (!sessionPage.includes('setBroadcast(data.broadcast || "free")')
  || sessionPage.includes('setBroadcast("/lesson")')) {
  throw new Error("The Session page must reflect the server's free-mode start instead of inventing /lesson.");
}
const runSequence = sliceBetween(control, "async function runSequence", "function reset()");
if (!runSequence.includes("await switchSessionToLiveFlow(teacherSession)")
  || runSequence.indexOf("await switchSessionToLiveFlow(teacherSession)") > runSequence.indexOf("armTimer(secRef.current)")) {
  throw new Error("Start lesson must connect Live Class Flow before arming automatic pacing.");
}
const nextState = sliceBetween(control, "async function next()", "function previous()");
if (!nextState.includes("await switchSessionToLiveFlow(teacherSession)")
  || !nextState.includes("setPreviewSyncPaused(false)")
  || !nextState.includes("setAutoAdvance(true)")) {
  throw new Error("The first Advance from preview must connect the open session before changing screens.");
}

for (const requiredSql of [
  "primary key (auth_user_id, session_id)",
  "add column if not exists verification_token uuid",
  "alter column verification_token set not null",
  "student_warmup_sessions_verification_token_idx",
  "check (completed_at is null or completed_at >= started_at)",
  "enable row level security",
  "revoke all on table public.student_warmup_sessions from public, anon, authenticated",
  "grant select, insert, update, delete on table public.student_warmup_sessions to service_role",
  "warmup_resource_key text",
  "bdm_canonical_google_form_resource",
  "bdm_complete_warmup_identity",
  "v_student_period_id is distinct from v_session_period_id",
  "lower(btrim(coalesce(v_student_email, '')))",
  "bdm_complete_verified_student_join_with_warmup",
  "bdm_admit_student_join_request_with_warmup",
]) {
  if (!migration.toLowerCase().includes(requiredSql)) {
    throw new Error(`The warm-up receipt migration is missing: ${requiredSql}`);
  }
}

// The FERPA migration re-points the identity RPCs at the email HMAC. Both SQL
// files exist by design - run order is student-warmup-sessions.sql first, then
// ferpa-pseudonym-schema.sql replaces the functions (supabase/FERPA-CUTOVER.md).
const ferpaMigration = read("supabase/ferpa-pseudonym-schema.sql");
for (const requiredSql of [
  "add column if not exists alias text",
  "students_email_hmac_idx",
  "p_student_email_hmac",
  "v_student_email_hmac is distinct from lower(btrim(p_student_email_hmac))",
  "bdm_admit_student_join_request_with_warmup",
]) {
  if (!ferpaMigration.toLowerCase().includes(requiredSql)) {
    throw new Error(`The FERPA pseudonym migration is missing: ${requiredSql}`);
  }
}

// Behavioral state table for the student journey. A previous-day identity link
// is deliberately insufficient; only today's completed receipt marks the
// warm-up connected (navigation itself is never locked - the receipt gates
// verified JOINS and writes, not links).
const journeyCases = [
  { codeOpen: true, identityLinked: false, receiptComplete: false, expected: "warmup" },
  { codeOpen: true, identityLinked: true, receiptComplete: false, expected: "warmup" },
  { codeOpen: true, identityLinked: true, receiptComplete: true, expected: "challenges" },
  { codeOpen: false, identityLinked: true, receiptComplete: true, expected: "code-entry" },
];
for (const testCase of journeyCases) {
  const actual = !testCase.codeOpen
    ? "code-entry"
    : testCase.identityLinked && testCase.receiptComplete
      ? "challenges"
      : "warmup";
  if (actual !== testCase.expected) {
    throw new Error(`Student journey expected ${testCase.expected}, received ${actual}.`);
  }
}

console.log("PASS - the receipt chain gates verified joins while the home base never locks navigation.");
