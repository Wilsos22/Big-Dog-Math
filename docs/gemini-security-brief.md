# Paste-into-Gemini brief — Big Dog Math student data handling

> Copy everything below the line. It is self-contained — it assumes no prior context.
> It deliberately contains **no** student names, no email addresses, no API keys, no tokens,
> and no infrastructure identifiers, so it is safe to paste into an AI tool.
> Edit the **WHAT I NEED FROM YOU** section at the bottom to match what you're asking.

---

## Who I am and what this is

I'm a 6th grade math teacher in the Clark County School District (CCSD) in Las Vegas, Nevada.
I built a website that runs the operational side of my classroom: lesson displays, timers,
transition screens, digital manipulatives, warm-up screens, and a teacher control panel I drive
from an iPad during class.

I built it independently, on personal time and personal equipment, at personal expense. It costs
the District nothing. It is free, ad-free, and non-commercial.

I want to make sure student information is handled correctly end to end, and I want a second set
of eyes on whether my design actually holds up.

## Technical stack

- **Next.js (App Router) + TypeScript**, hosted on **Vercel**
- **Supabase (Postgres)** for classroom state and performance data
- **Notion** (via a server-side integration token) for lesson content
- **Google Apps Script** for a warm-up generation pipeline
- **Google Sign-In** for student identity, using CCSD Google Workspace accounts

Neither **Vercel** nor **Supabase** nor **Notion** is on CCSD's approved software list (the "SAFE
List"). **Google Workspace for Education Plus** is on that list and is marked *Approved for
Students*.

---

## CURRENT STATE — what is true today

Please do not assume the target design below is already built. Today:

- The `students` table in Supabase still has `full_name` and `email` columns. The email column is
  populated from a Notion roster database by a server route (`/api/roster/sync`), which inserts
  student names and email addresses directly into Supabase.
- Two other server routes (`/api/evidence`, `/api/checkpoints/upload`) match student records **by
  email address**.
- A Notion database holds the class roster — student names, school email addresses, and contact
  information.
- **Production currently contains no real student data.** Verified directly against the database:
  17 rows in `students`, of which 11 use `@example.com` addresses, one is a personal Gmail, one is
  blank, and **zero** use the district domain. The tables for diagnostic scores, exit-ticket
  responses, and general responses are all **empty**.
- Row-level security is enabled. Sensitive tables (diagnostic scores, mastery, mastery history,
  student signals, audit events) have RLS enabled with **no policies at all**, which is
  deny-by-default. Other tables carry scoped per-record policies.
- Roughly 19 tables grant access to the anonymous Postgres role, by design, to support an
  anonymous session-code join flow for classroom activities.

So: the architecture currently *would* store student PII if real data were loaded, but no real
student PII has ever been loaded.

## TARGET STATE — what I am building toward

**Principle: identifiable student data lives only in CCSD-contracted systems. My site holds
non-identifying codes and acts as a display layer.**

1. **Identity.** A student signs in with their CCSD Google account. They never type a name, email,
   or student number anywhere on the site.
2. **Domain check.** My server verifies the Google `hd` (hosted domain) claim matches the district
   domain, so only CCSD accounts can authenticate. The claim is checked but not stored.
3. **The boundary.** My server takes the Google `sub` claim — an opaque Google account identifier
   that is not an email and contains nothing personal — and computes an HMAC of it using a
   server-side secret. It stores only that digest, plus a randomly generated opaque student code
   (format `P3-K7QX`). **The email address is discarded and never written to storage.**
4. **Code generation.** Codes are cryptographically random. They are not derived from initials,
   birthdate, or student ID number, per the coding conditions in 34 CFR 99.31(b)(2). The period
   number prefix describes a class, not a person. Codes are stable within a school year and rotated
   at year rollover.
5. **Storage.** Supabase stores only the opaque code, the HMAC digest, a period reference, and
   performance data (answers, mastery, misconception flags) keyed to the code. It never receives a
   name or an email address.
6. **Lesson content.** Notion holds lessons, warm-up content, and misconception libraries. Any
   student-linked instructional signals are keyed to the opaque code. Notion never receives a name
   or an email address. The roster database moves out of Notion entirely.
7. **The key.** The single authoritative mapping of code → name → email lives in a Google Sheet in
   my CCSD Google Drive — contracted, district-controlled infrastructure. It is shared with
   specific people only and is **never** published to the web.
8. **Teacher display.** My control panel fetches that key **client-side, in my browser**, holds it
   in memory, and renders real names on my iPad. The key is never fetched by my server, never
   passes through Vercel, and is never written to Supabase. The name exists only as pixels.
9. **Student-facing display.** Projector and student-visible screens show **aggregate data only** —
   counts and distributions. No names, no individual answers, no leaderboards. Enforced in code.

## Security controls

- **Encryption.** TLS in transit; encryption at rest by the database provider.
- **Access control.** RLS deny-by-default. Teacher surfaces behind authentication.
- **Secrets.** The HMAC secret and all database service keys are server-side environment variables
  only — never in the client bundle, never in the repository.
- **Data minimization.** Only a code, a period, and instructional performance signals are stored.
- **Retention.** Performance data scoped to the school year. Session records purge after 30 days.
- **Deletion.** Any record deleted within 30 days of a District or parent request.
- **No secondary use.** No advertising, no targeted advertising, no sale of data, no profiling
  outside instruction, no third-party analytics.
- **Logging discipline.** Student names must never enter a code path that could serialize them into
  server logs or error monitoring.
- **Breach response.** Any suspected incident reported to the CCSD Help Desk immediately.

## Legal framework I am designing against

- **NRS 388.281–388.296** (Nevada, Privacy of Data Concerning Pupils). NRS 388.283(1)(a) defines a
  "school service" as an internet site that *collects or maintains* personally identifiable
  information about a pupil. My reasoning is that if no PII is collected or maintained, the site
  falls outside that definition and the provider obligations in 388.291–388.293 do not attach.
- **NRS 388.283(2)(c)** — an alternate exclusion for a provider designated a FERPA school official
  with a district contract.
- **FERPA**, 34 CFR 99.3 (definitions), 99.30 (consent), 99.31(a)(1) (school official exception),
  99.31(b)(2) (de-identified records with a code).
- **COPPA** — my students are under 13; no student-created accounts exist.
- **CIPA**, **PPRA**.
- **CCSD Acceptable Use Policy §K** — PII protection, no unapproved applications, third-party data
  sharing requires prior authorization, encryption requirements.
- **CCSD Regulations R-3990, R-3991** (technology network resources) and **R-6150** (instructional
  materials — supplemental digital materials are approved by the principal and the principal's
  supervisor annually).

## Open questions I am genuinely unsure about

1. Because no PII is collected, is this an **R-6150** instructional-materials approval at the school
   level, or does the district technology division want it through the full **SAFE** software review
   anyway?
2. Does CCSD's AUP §K.3 prohibition on "unauthorized or unapproved applications" apply to any
   unapproved application on the district network, or only to ones handling student PII? I have been
   reading it the second way.
3. Is an HMAC of a Google `sub` claim adequately "de-identified" under 34 CFR 99.31(b)(2), given
   that it is technically derived from an account identifier, even though it is irreversible without
   a secret I control and the underlying claim contains no personal information?
4. Is caching the code→name key in browser local storage on my own teacher device defensible —
   comparable to a roster spreadsheet in my Downloads folder — or should it be memory-only and
   re-loaded each session?
5. I want a Notion-like hub for student information that stays inside CCSD-approved infrastructure.
   Google Apps Script serving a web app backed by Google Sheets seems right, since it introduces no
   third-party processor. Is that reasoning sound?

---

## WHAT I NEED FROM YOU

Review the design above and tell me:

1. Where my legal reasoning is wrong or too optimistic, specifically on the NRS 388.283 "no PII, no
   school service" argument.
2. Any place student information could leak that I have not accounted for — especially logging,
   error handling, caching, browser storage, server-side rendering, or third-party requests.
3. Whether the client-side-only name resolution actually holds up, or whether rendering names in a
   browser from a district-contracted source creates an exposure I am missing.
4. What you would add to the security controls list before I present this to an administrator.

Be direct about weaknesses. I would rather find them now than have an administrator find them.
