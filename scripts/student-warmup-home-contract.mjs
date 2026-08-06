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
// 2026-08-05 (Steele): the warm-up is EMBEDDED in the page, not a button that
// opens a tab. Google Forms cannot redirect on submit, so keeping the student
// on this page is what makes the handoff to the challenge possible at all.
// Anchored on the RENDERED iframe, not on the class name: `st-warmup-frame`
// also appears in the page's <style> block, so a className-only check stays
// green while nothing is on screen. (This contract shipped that way for one
// mutation-test cycle - the same trap CLAUDE.md records for the /present logo
// and the .dh-slot.act rule.)
const warmupFrame = sliceBetween(home, "<iframe", "/>");
if (!warmupFrame
  || !warmupFrame.includes('className="st-warmup-frame"')
  || !warmupFrame.includes("src={embeddedFormUrl(warmupHref)}")) {
  throw new Error("The accepted-code homepage must embed the assigned warm-up in the page.");
}
// The prefill query carries the receipt token (entry.NNN=<token>). Rebuilding
// the URL instead of extending it would break identity while the form still
// looked perfectly fine on screen - a silent failure with no symptom.
const embedHelper = sliceBetween(home, "function embeddedFormUrl", "export default function");
if (!embedHelper.includes("new URL(href)") || !embedHelper.includes('searchParams.set("embedded", "true")')) {
  throw new Error("The embed URL must extend the personalized form URL, never rebuild it.");
}
// A browser not already signed in to the district account gets Google's
// sign-in page, which refuses to render in an iframe and shows a blank box.
// The new-tab escape is the only way through that, so it is load-bearing.
if (!home.includes("Warm-up not showing up?") || !home.includes('target="_blank"')) {
  throw new Error("The embedded warm-up must keep a new-tab escape for the iframe sign-in case.");
}
if (!home.includes("Today&apos;s lesson") || !home.includes("Module {moduleNumber}") || !home.includes("Topic {topicNumber}")) {
  throw new Error("The accepted-code homepage must show today's lesson, module, and topic before the warm-up action.");
}
// REVERSES the 2026-07-26 "onward links stay live" rule (Steele, 2026-08-05:
// "right now they have access to the tools the lesson and the warm up"). The
// accepted-code view is the warm-up and nothing else; where a student goes
// next is the teacher's call, via the Notion pick and then class-mode sync.
// /explore and /demo remain on the CODE-ENTRY view, which is a different
// screen and is deliberately untouched.
if (home.includes("st-home-card") || home.includes("HOME_LINKS")) {
  throw new Error("The accepted-code home base must not carry the lesson/practice/tools link grid.");
}
// The /homework-help chip survives the cut: it is a support affordance for a
// stuck student, not somewhere to wander, and CLAUDE.md pins it to this view.
if (!home.includes('href="/homework-help"')) {
  throw new Error("The Stuck walkthrough chip must remain on the student home base.");
}
if (!home.includes("Warm-up connected")) {
  throw new Error("The warm-up card must adapt to identity state instead of locking the page.");
}
// The handoff itself. It hangs off VERIFICATION (the receipt chain), never off
// anything the cross-origin iframe could report. It resolves through
// warmupChallengeDestination, NOT the bare warmupChallengeHref: the destination
// is what applies the default for a lesson nobody authored, and calling the raw
// resolver here is exactly the regression that left every student parked on the
// home base while the property did not yet exist in Notion.
if (!home.includes("warmupChallengeDestination") || !home.includes("router.push(challenge.href)")) {
  throw new Error("A confirmed warm-up must hand off through warmupChallengeDestination.");
}
const handoff = sliceBetween(home, "if (!identityReady || !challenge) return;", "}, [identityReady, challenge, router]);");
if (!handoff.includes("setTimeout")) {
  throw new Error("The challenge handoff must pause on the confirmation instead of navigating instantly.");
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
// The teacher-tab guard is CORRECT and must stay - a device that has held a
// teacher session must not be dragged around by class mode. What it must not do
// is return in silence: a held student looks exactly like a lesson that has not
// advanced, and the marker dies on tab close and tab restore. That silence has
// now cost two debugging sessions (2026-07-22, 2026-08-06).
const tabGuardStart = classSync.indexOf("if (getStoredTeacherSessionId() && !isStudentTab()) {");
const tabGuardEnd = classSync.indexOf("setNotFollowing(false);");
if (tabGuardStart === -1 || tabGuardEnd === -1 || tabGuardEnd < tabGuardStart) {
  throw new Error("The teacher-tab guard must remain, and must clear the not-following state once it passes.");
}
const tabGuard = classSync.slice(tabGuardStart, tabGuardEnd);
if (!tabGuard.includes("setNotFollowing(")) {
  throw new Error("The teacher-tab guard must surface that this device is not following, never return in silence.");
}
// Projector safety: this guard runs BEFORE the isTeacherRoute check below it, so
// without an explicit exclusion the notice renders on /control and
// /teacher/present - which are on the wall in front of the class.
if (!tabGuard.includes("!isTeacherRoute(currentPath)")) {
  throw new Error("The not-following notice must never render on a teacher surface - those are on the projector.");
}
if (!tabGuard.includes("getStoredStudentSessionId()")) {
  throw new Error("The not-following notice must only appear when there is a student session being held.");
}
// It never heals on its own, so it must not inherit the transient-failure copy
// that tells the student to sit tight and wait for the screen to catch up.
if (!classSync.includes("Enter the class code again to reconnect")) {
  throw new Error("The not-following notice must tell the student how to recover.");
}
if (!classSync.includes("if (!reconnecting && !notFollowing) return null;")) {
  throw new Error("The status chip must render for the not-following case, not just the reconnecting one.");
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
