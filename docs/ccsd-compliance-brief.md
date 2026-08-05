# CCSD + Nevada Compliance Brief — Big Dog Math Site

**Version 2** · 2026-07-29 · supersedes v1 (same path)
**District assumed:** Clark County School District, Las Vegas NV (their AUP cites NRS Ch. 388)
**Not legal advice.** Research summary to support an informed conversation with school admin and
CCSD's Technology & Information Systems Services (TISS) Division.

---

## 0. Risk calibration — read this first

**Current risk level: LOW. No live exposure. No violation in progress.**

v1 of this brief led with statute numbers and a dollar figure and read like a threat inventory.
That was a framing error. Here are the actual proportions:

| Worry | Reality |
|---|---|
| "Someone reports me and I get fined $5,000" | The NRS 388.292(7) penalty is a **civil penalty recoverable only by the Nevada Attorney General**, in an action brought in the name of the State. There is no complaint hotline that triggers it. It attaches to selling PII, targeted advertising, non-instructional profiling, over-retention, or refusing deletion — **none of which this project does.** The statute targets ed-tech vendors. |
| "I could get fired" | CCSD's AUP specifies **progressive** discipline. The realistic first step for a teacher who self-discloses with the issue already fixed is a documented conversation. What actually escalates: a real breach, continuing after being told to stop, or concealment until someone else finds it. |
| "Self-built sites are banned" | Not prohibited by name anywhere in the AUP, R-3990, or R-3991. The prohibition (AUP §K.3) is on *unapproved applications* handling student PII. |
| "I can't collect data unless I'm on the approved list" | **False.** Coded/de-identified data needs no approval at all. And approval is *prospective* — you build to spec, document it, submit, and only then turn on real data. |

**Verified 2026-07-29 against the live `Website-Prototype` Supabase project:**

- `students`: 17 rows — 11 `@example.com`, 1 gmail, 1 blank, **0 `@nv.ccsd.net`**. Seed data.
- `iready_scores`: **0 rows.** `exit_ticket_responses`: **0 rows.** `responses`: **0 rows.**
- `mastery`: 44 rows, keyed to the seed students only.
- Sensitive tables (`iready_scores`, `mastery`, `mastery_history`, `student_signals`,
  `security_audit_events`, `student_warmup_sessions`) have **RLS enabled with no policies** —
  deny-by-default, the safest possible state.
- Other tables carry **scoped** policies (`student_select_own_profile`, `student_select_own_response`…).

**Correction to v1:** v1 reported 12 wide-open `prototype_all` policies. Those exist in stale
`.sql` files in the repo; **production has already been hardened past them.** v1 read the repo and
reported it as production. The stale files should be deleted so this misreading doesn't recur.

**Genuine open items, all minor:** ~19 tables grant the anonymous role access by design for the
session-code model (worth a deliberate pass, not urgent); Supabase leaked-password protection is
off; `26-27 roster emails.pdf` sits in the project root and must never be committed or deployed.

---

## 1. What CCSD requires

### The SAFE process
CCSD reviews software centrally at **[safe.ccsd.net](https://safe.ccsd.net/)**. Reviews happen at
the **District** level, benchmarked against Dept. of Education and FTC practice plus CCSD's own
environment and support standards. Output is the **SAFE List**:

- Listed apps carry a **CCSD contract with a FERPA "school official" exception** — *unless*
  asterisked.
- Asterisked apps have **no contract**, so **parental consent is required**.
- Rows are tagged `Approved for Students` or `Parent / Guardian Permission Required`.

### AUP clauses that apply
From the [CCSD Acceptable Use Policy](https://www.ccsd.net/legal/acceptable-use-policy), §K:

- **K.1** — protect all PII; unauthorized disclosure/access/transfer prohibited.
- **K.3** — no use of **unauthorized or unapproved applications** that could introduce
  vulnerabilities. *(The clause that would be cited. Applies once real PII is involved.)*
- **K.6 / K.7** — third-party data sharing requires prior authorization, documented agreements,
  and security review.
- **K.9** — sensitive data encrypted in transit and at rest. *(Supabase/Vercel satisfy this.)*
- **§E** — no hosting/distributing copyrighted material without the owner's written permission.
- **§L** — don't feed PII or sensitive info into external AI tools. *(Relevant to the Apps Script
  warm-up generator.)*
- **§J** — incidental personal use is permitted; **§VII(I) of R-3991** prohibits commercial use.
  Keep the site free and ad-free.

Incorporated regs: **[R-3990](https://ccsd.net/district/policies-regulations/pdf/3990_R.pdf)**
(Technology Network Resources) and **[R-3991](https://ccsd.net/district/policies-regulations/pdf/3991_R.pdf)**
(Use of Instructional Technology Networks). R-3991 §I requires electronic resources be reviewed
and evaluated and aligned to approved District curriculum.

---

## 2. What Nevada law requires

**NRS 388.281–388.296, "Privacy of Data Concerning Pupils."**

### The definition that decides everything — NRS 388.283
A "school service" is a website/online service/app that **(a)** collects or maintains PII about a
pupil, **and (b)** is used primarily for educational purposes, **and (c)** is designed and marketed
for public schools, used at teacher direction.

**All three prongs must be met. Prong (a) is the load-bearing one — no PII, no school service.**

Two exclusions matter:
- **388.283(2)(b)** — a system **operated by the school district** is excluded.
- **388.283(2)(c)** — excluded if the provider is **designated a FERPA school official**, **has a
  district contract**, **and** has agreed to comply with FERPA. ← the SAFE-approval exit.

### Obligations if you *are* a school service provider
- **388.291** — written disclosure of what PII is collected, how used and shared.
- **388.292** — PII only for purposes inherent to classroom use or Board-authorized; **no targeted
  advertising, no selling, no non-instructional profiling**; **delete within 30 days** of a district
  or parent request. Civil penalty up to $5,000/violation, **AG-enforced only**.
- **388.293** — a **written data security plan** with administrative, technological, and physical
  safeguards.
- **388.296** — cannot be waived by agreement.

Federal layer: **FERPA**, **COPPA** (under-13 — 6th graders can't self-register; teacher creates
accounts), **CIPA** (filtering), **PPRA** (surveys).

---

## 3. Three viable architectures

| | PII stored | District approval needed | Teaching data retained |
|---|---|---|---|
| **A. Opaque codes** | None | **None** | Yes — full proficiency spine |
| **B. SAFE-approved** | Names/emails | SAFE + FERPA school-official designation | Yes, fully identified |
| **C. District-operated** | Names/emails | CCSD adopts and operates it | Yes — 388.283(2)(b) excludes it entirely |

### Why A works — the part that isn't obvious
**Coded data is still teaching data.** `P3-14 → 6.RP.A.3 → developing → misconception: additive
reasoning` gives you the entire proficiency spine, misconception tracking, warm-up evidence, and
longitudinal history. You lose nothing pedagogically. You only lose the name in the database —
and you already have the name, because you're their teacher.

**FERPA 34 CFR 99.31(b)(2)** expressly permits coded de-identified records, provided:
1. the code is **not derived from student information** (no initials, no birthdate, no student ID),
2. the **key is not disclosed** to the recipient system, and
3. the key is retained only by the educational agency.

Here the "recipient system" is Supabase/Vercel. The key lives with you, in CCSD-approved tools.

**Approval is prospective.** Nothing stops you from pursuing B in parallel and flipping the switch
the day it lands.

---

## 4. Plan of record — Option A, SSO-ready

Decision: **opaque codes now, identity built as an abstraction** so a later upgrade to district SSO
is a config change rather than a rewrite.

### Schema
```
students
  id            uuid   primary key        -- internal join key, unchanged
  period_id     uuid   references periods
  student_code  text   unique not null    -- e.g. "P3-K7QX"; random suffix, NOT derived from PII
  created_at    timestamptz
  -- DROP full_name
  -- DROP email
  -- DROP students_email_idx
```

`student_code` = period prefix (not student info, safe) + a random base32 suffix. Never initials,
never birthdate, never student ID number.

### Roster mapping — the key architectural move
The code→name map **never touches Supabase.** It lives in a CCSD-approved store (a Google Sheet in
your CCSD Drive, or an Infinite Campus export) and is loaded into the **control panel only**, at
runtime, in memory. You see "Marcus" on your iPad; the database only ever saw `P3-K7QX`.

### Identity abstraction
Single module — `src/lib/identity.ts` — exposing a provider interface:

```ts
interface IdentityProvider {
  resolve(ref: string): Promise<StudentRef>
  label(ref: StudentRef): string
}
```

`CodeProvider` today. `DistrictSsoProvider` later. Everything downstream consumes `StudentRef`,
never a name. That's what makes B a flag flip instead of a migration.

### Retention
Define it now, even for coded data — it pre-builds the SAFE packet:
- Coded performance data: retained through the school year, purged at year rollover.
- Session/join records: purged after 30 days.
- Documented deletion procedure meeting the NRS 388.292(3) 30-day requirement.

### Honest description after this lands
*"A public teaching-materials website plus anonymous classroom display tools. No personally
identifiable student information is collected or stored."*

That sentence is the whole point. It's true, it's verifiable, and it ends the conversation.

---

## 4b. Who owns the site — and does submitting it give it away?

**Short answer: submitting for approval does not transfer ownership. Vetting is not acquisition.**

Vendors submit to SAFE constantly and retain every right they had going in. What approval grants is
*permission for you to use the tool with students*. It does not grant CCSD a license to operate it,
deploy it district-wide, or modify it. Those would be a separate, negotiated agreement — opt-in,
not an automatic consequence of asking.

### What the controlling documents actually say

- **CCEA Negotiated Agreement — silent.** Searched the full agreement for *copyright, intellectual
  property, ownership, proprietary, patent, invention, royalty*: **zero matches.** No CBA provision
  transfers employee-created works to the District.
- **No CCSD board policy claiming employee-created works surfaced.** AUP §E and R-3991 §VII(E)
  address respecting *others'* copyright — not District ownership of *yours*. (Absence of a found
  policy isn't proof none exists; worth confirming with HR.)

So the default is federal law: **17 U.S.C. §101 work-made-for-hire**.

### The honest analysis
A work is the employer's only if prepared **within the scope of employment**, which turns on three
factors (*CCNV v. Reid*):

| Factor | Your facts |
|---|---|
| Is it the kind of work you're employed to perform? | Building a Next.js/Supabase application: **almost certainly not** a 6th grade math teacher's job duties. Writing lesson content: **arguably yes.** |
| Was it substantially within authorized time and space? | **No** — personal time, personal hardware, personal Vercel/Supabase/domain accounts, personal money. This is your strongest factor. |
| Was it actuated at least in part to serve the employer? | **Partly yes** — it serves CCSD students. |

**Be clear-eyed:** "I built it on my own time and tech" is a strong argument, not a dispositive one,
because factor three cuts against you no matter whose laptop it is. The **software** stands on much
firmer ground than the **lesson content**, which is closer to your actual job duties. Courts split
on teacher-created materials, and the academic "teacher exception" is better established for
university faculty than for K-12.

### Protective steps — cheap, do them now
1. **Document the record.** A dated note stating it was built on personal time and personal
   infrastructure. Personal GitHub commit history and Vercel/Supabase billing receipts corroborate it.
2. **Keep the wall clean.** No development on district hardware, district time, or district-purchased
   tooling. Don't let that line blur.
3. **Assert it.** `© 2026 Steele Wilson. All rights reserved.` in the site footer and a `LICENSE`
   file in the repo.
4. **Say it in writing when you submit.** *"This tool was individually developed and is individually
   owned. I am requesting approval to use it with my students. This submission is not an offer to
   assign rights."* If they want paperwork, offer a **limited, revocable, non-exclusive license** for
   your classroom use — not an assignment.
5. **Call your CCEA rep first**, before admin. Confidential, free, and exactly what representation is
   for. Better than walking into the principal's office cold.
6. **If it ever goes commercial or district-wide**, stop and get an actual attorney. That's when this
   stops being theoretical.

**Note the tension with Option C:** district-operated deployment is the cleanest privacy answer
(388.283(2)(b) excludes it entirely) but it's the one path that *does* involve handing over control.
You can't have both maximum privacy cover and maximum ownership. Option A avoids the trade entirely —
which is another reason it's the plan of record.

---

## 4c. The other approval track — R-6150, and it's lighter than SAFE

**There are two separate tracks, and people conflate them.**

| Track | Governs | Who approves |
|---|---|---|
| **SAFE** | Software handling **student data** | District — TISS |
| **R-6150** | **Instructional materials / content** | **Your principal + the principal's supervisor, annually** |

[R-6150](https://ccsd.net/district/policies-regulations/pdf/6150_R.pdf) defines a **"supplemental
textbook"** as *"any medium or material including, without limitation, digital instructional
materials used to reinforce or extend a basic program of instruction."* Your lesson pages, warm-ups,
and manipulatives fit that squarely.

The approval path (§III.B) is refreshingly ordinary:
- selected through a **systematic review process by professional staff at each school**,
- **approved by the principal and the principal's supervisor, annually**,
- **previewed prior to use**,
- documented, using reputable unbiased selection guidelines,
- consistent with NAC, Nevada Academic Content Standards, and District curriculum standards.

**Why this matters:** with Option A (no PII), the SAFE track may not apply at all — you'd be a
website that collects nothing. R-6150 becomes your actual approval path, and it lives at your
school with your principal. That is a dramatically smaller conversation than a district vendor review.

**If someone objects:** the challenge mechanism is form **CCF-400**, reviewed by the school-based
library-media center committee. Note §V.B.1 — the material **stays available for instruction
throughout the review** unless the principal and committee agree to pull it. Appeals go to the
assistant superintendent of Curriculum and Instruction. That is a deliberative process, not a
switch anyone can flip on you.

---

## 5. Carnegie Learning — calibrated

**What you can do freely:**
- **Lesson structure and layout.** 17 U.S.C. §102(b) — copyright doesn't protect ideas, methods,
  or systems. Your CRA spine and phase flow are methods of organizing instruction. Use your own
  names for the phases.
- **Bare exercises.** "Find 3/4 ÷ 1/2" belongs to no one.
- **Naming alignment.** "Today maps to Carnegie Module 2, Topic 1" is nominative use. Fine.
- **Teaching from the licensed materials exactly as intended.** Untouched.

**What you can't do:**
- Republish their **word problems, scenarios, contexts, artwork, or specific problem sets** on a
  public URL. That's protected expression. The district's purchase is a license to *teach with*
  the materials, not to *publish* them —
  [Carnegie's copyright page](https://www.carnegielearning.com/copyright-information/) states no
  part may be reused or repurposed without prior consent. Fair use is weak here because the fourth
  factor (market effect) is exactly what Carnegie sells.

**The fix is access control, not abstinence.** Public internet = publishing. Behind a class code,
shown during class, only your students = indistinguishable from normal licensed classroom use.
A shared class password collects zero PII, so it doesn't reopen §2.

**The unlock:** Illustrative Mathematics / Open Up Resources 6–8 Math is **CC BY 4.0**. You may host
those problems publicly, forever, free — just retain *"Download at openupresources.org"* on every
page view. Two caveats: the IM **name and logo are not** CC-licensed, and the **OUR unit assessments
are not** CC-licensed.

**Best long-term:** write your own problems — same standard, same misconception, Abbie contexts.
Cleanest legally and better for the thing you're actually building.

**Realistic worst case from Carnegie:** a takedown email. Not litigation against a teacher.

---

## 6. Action list

**This week — low effort, high signal**
1. Delete the stale `prototype_all` `.sql` files so production and repo agree.
2. Confirm `26-27 roster emails.pdf` is git-ignored and not deployed.
3. Enable Supabase leaked-password protection.
4. Deliberate pass over the ~19 anon-role policies; keep what the session-code model needs.

**Next — the migration**
5. Add `student_code`; backfill; drop `full_name`, `email`, `students_email_idx`.
6. Build `src/lib/identity.ts` with the provider interface.
7. Move roster mapping to CCSD Drive, control-panel-only, in memory.
8. Publish a plain-language privacy page.

**Then — content and paperwork**
9. Audit public surfaces for verbatim Carnegie content; swap to IM (CC BY) or original problems.
10. Assemble the SAFE packet (security plan, disclosure notice, data inventory, subprocessor list,
    deletion procedure) — see `ccsd-principal-onepager.md` for the conversation opener.
11. Talk to your principal, then open a TISS/SAFE inquiry, from a clean and documented position.

---

## Sources

- [CCSD Student Data Privacy — Review and Approval Process](https://safe.ccsd.net/)
- [CCSD SAFE Approved Software and Applications List](https://safe.ccsd.net/approved-list/)
- [CCSD Acceptable Use Policy](https://www.ccsd.net/legal/acceptable-use-policy)
- [CCSD Regulation R-3990 — Technology Network Resources](https://ccsd.net/district/policies-regulations/pdf/3990_R.pdf)
- [CCSD Regulation R-3991 — Use of Instructional Technology Networks](https://ccsd.net/district/policies-regulations/pdf/3991_R.pdf)
- [NRS 388.283 — "School service" defined](https://nevada.public.law/statutes/nrs_388.283)
- [NRS 388.291 — Written disclosure](https://nevada.public.law/statutes/nrs_388.291)
- [NRS 388.292 — Collection and use of PII; penalties](https://nevada.public.law/statutes/nrs_388.292)
- [NRS 388.293 — Plan for security of data concerning pupils](https://nevada.public.law/statutes/nrs_388.293)
- [NRS 388.296 — Waiver prohibited](https://nevada.public.law/statutes/nrs_388.296)
- [FERPA — U.S. Dept. of Education](https://studentprivacy.ed.gov/ferpa)
- [COPPA — Federal Trade Commission](https://www.ftc.gov/enforcement/rules/rulemaking-regulatory-reform-proceedings/childrens-online-privacy-protection-rule)
- [Carnegie Learning — Copyright Information](https://www.carnegielearning.com/copyright-information/)
- [Open Up Resources 6–8 Math licensing](https://openupresources.org/open-up-resources-6-8-math-license/)
