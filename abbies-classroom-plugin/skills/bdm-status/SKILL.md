---
name: bdm-status
description: Report where the Big Dog Math site stands and name the single next thing to do, ranked by classroom risk. Also sweeps the conversation it is invoked in for changes named out loud and never written down, and catalogs them onto ROADMAP.md and the Notion Feature Tracker. Trigger on "where am I on the site", "what's next", "what needs to be done", "is everything done", "status", "what's left", "what should I work on", "what's broken", "capture what we said", "add that to the list", "sweep this conversation", "what did we decide", or any request for a to-do list or progress read on bigdogmath.com. Not for deep audits (that is /class-audit) or for building a lesson.
---

# Big Dog Math - status, and what this conversation named

Steele's "what's my state and what's next" button (requested 2026-08-04). ONE
short read of the whole project, ranked by CLASSROOM RISK, ending in a single
named next thing. It is not an audit - `/class-audit` is the deep simulation.
This is the prep-period answer.

Repo: `/Users/steelewilson/Big Dog Math Site`. Live site: https://bigdogmath.com

**Modes.** No argument means the default status pass. `sync` reconciles the
written lists against the code. `sweep` reads THIS conversation - whichever one
this was invoked in - for changes that were named out loud and never written
down, and catalogs them. Anything else is an area name (a surface or feature)
and scopes the status read to that one thing.

## Ground rules

- READ ONLY unless the argument is `sync`, or `sweep` and he has confirmed which
  items to file. Never write to Notion otherwise. ONE
  exception: if this pass discovers something that would have prevented a bug -
  a stale line, a silent failure mode, an undocumented constraint - correct
  CLAUDE.md in the same turn as its own small commit, per rule 9. That
  correction does not wait for `sync`.
- **Do not trust ROADMAP.md, IDEAS.md or CLAUDE.md about what is DONE.** Every
  one of them has carried a line that stopped being true - a "not wired yet"
  note that shipped weeks earlier, open setup items pointing at Abbie and the
  Notion roster after both were deleted. Anything you are about to report as
  built or as outstanding gets ONE confirming check: a grep for the consumer, a
  file:line, a test name, or a live route. Report what you verified, and say
  plainly when you could not.
- **Deployed and pushed are separate claims.** Say which one you have.
- No emoji. No praise padding. If a section is empty, say so in four words.
- Never print a student name, alias, district email, or roster row.
- All git here is read-only and guarded: `git --no-optional-locks <cmd>`. A
  plain `git status` can relock the index, and from a Cowork sandbox a stranded
  `.git/*.lock` blocks Steele's next commit and looks like repo corruption.

## Gather (delegate the reading)

Launch ONE Explore subagent (read-only, medium breadth) and let it do the file
sweep while you run the cheap live checks yourself. Do not read the roadmap
sections into this conversation by hand - they are long and you only need the
conclusions.

Brief for the subagent: "First read `src/lib/notionLessons.ts` for the current
data-source ids and property names. Then read ROADMAP.md sections `Known
broken`, `In progress`, `Planned`, `Parked`, `Steele's open setup items`, and
IDEAS.md `Next up (queued)`. For each item return one line: title, which
section, and - checked against `src/`, `supabase/`, `scripts/` and package.json
- whether it appears BUILT, PARTIAL, NOT STARTED, or STALE (the item describes
work that no longer exists because the feature was deleted or replaced). Give a
file:line or a test script name as evidence for every BUILT and STALE verdict.
Do not summarise the prose; I want the verdicts, plus a short list of any place
ROADMAP.md and the code flatly contradict each other."

Meanwhile, in this session:

1. `git --no-optional-locks log --oneline -1 origin/main`, then
   `git --no-optional-locks branch --no-merged origin/main` (LOCAL branches -
   verified work not merged) and `-r --no-merged origin/main` separately
   (pushed but unmerged). `git --no-optional-locks status --short` for
   uncommitted work in the shared tree; concurrent sessions leave work there,
   never stage it.
2. **The deployed commit is whatever `https://bigdogmath.com/api/build-id`
   returns.** Fetch it - that is the authority, because a READY production build
   in Vercel is not necessarily what serves the alias. Then
   `git --no-optional-locks rev-list --count <build-id>..origin/main` for how
   many commits are stranded, and
   `git --no-optional-locks log -1 --format=%cI <build-id>` for how stale. Use
   Vercel `list_deployments` (project `prj_YY1p31W5veS0gNzft3EkFInjGWAZ`, team
   `team_83rmGiv2FDrY37oqcspUFhyP`) only to say WHY - whether builds are
   failing, queued, or simply never triggered. More than a couple of stranded
   commits, or a build-id hours behind the newest push, is a STALLED PIPELINE
   and leads the report: it means shipped fixes are not in the room, and
   classroom displays reload on a build-id change so nothing anywhere says why.
   When stranded, name the commits that matter (a projector fix, a tool
   rebuild), not just the count.
3. `npm run typecheck`. Run `npm test` only if the build-id has moved or a
   suite-covered file changed since the last known-green sha - it is 38
   `&&`-chained suites, several minutes, and it ABORTS ON FIRST FAILURE, so
   there is no tally to report. Say `passed` or `failed at test:<name>`; never
   invent an n-of-n.
4. Notion, read only. Feature Tracker data source
   `56ee55bb-c067-4613-8f3b-6d5810a82ced`: filter `Priority = "Now"` AND the
   `Done` CHECKBOX = `__NO__`. Do NOT filter on `Status != Done` - `Status` has
   no such value (it runs Live / Planned / Parked / Needs revision / In
   progress), so that filter matches every row and reports finished features as
   outstanding. Then, only if school is in session, check the Math 6 Lessons
   database for a Published lesson dated the next teaching day, carrying steps.
   If it is a weekend, a break, or before the school year starts, write "school
   not in session" on that line and skip it - do not file a missing lesson as a
   tier 1 finding on a Saturday.
5. If the Notion tracker and ROADMAP.md disagree about an item, that
   disagreement IS a finding - name it, do not silently pick one.

## Rank by classroom risk

In this order, always. Effort never promotes an item.

1. **BREAKS A LIVE CLASS** - would fail during a period on the next teaching day:
   a red suite, a stalled deploy carrying a fix, no Published lesson for a day
   school is in session, a surface that renders blank or wrong on a projector, a
   student write path that silently no-ops.
2. **BLOCKS A CLASS CAPABILITY** - something planned for an upcoming lesson is
   not usable yet: a tool with no set authored, a Notion property the runtime
   ignores, a migration in `supabase/` never run.
3. **UNPROVEN** - built and typechecked, never seen by a real class. Be honest
   here; a large part of this system has never met thirty Chromebooks. Say what
   the first real test would be.
4. **STRANDED** - verified work on an unmerged branch or an undeployed commit.
5. **STALE LIST** - items on the written lists describing work that no longer
   exists. Propose the deletion; do not delete unless the argument is `sync`.
6. **EVERYTHING ELSE** - planned, parked, ideas. One line each, no detail.

## Report (this exact shape, nothing extra)

```
WHERE YOU ARE
Live <sha7> <how stale> · <n> commits stranded · pipeline <healthy|stalled>
typecheck <clean|n errors> · suites <passed|failed at test:X|not run>
Next teaching day <date> <lesson code> <Published|NOT PUBLISHED> | school not in session

NEXT
<one thing. one or two sentences. say why it is first, in classroom terms -
what happens in a period if it is not done.>

THEN
1. <tier> - <item> - <the classroom moment it bites> - <one-line fix>
2. ...
(cap at six)

STALE ON THE LIST
<items to delete, with what replaced them. or "nothing stale found.">

WHAT IS ACTUALLY SOLID
<three to five verified things, with evidence. specific, not flattery.>
```

Never answer "everything is complete." This system is never complete; the useful
answer is what is SAFE to teach on tomorrow and what is not. If nothing is
broken and nothing is stranded, say that in one line and spend the report on the
next capability instead.

## Scope: sweep - catalog what this conversation named

Sweep THE CONVERSATION THIS IS INVOKED IN, whatever it is - a debugging session,
a lesson-design thread, a design argument, a Notion pass. Steele names real work
out loud all the time ("the captain supplies check doesn't have clickable
buttons", "the pen writing is still very rudimentary") and it stays in a
transcript nobody reads again. This turns it into list items. Skip the whole
`Gather` pass above; this scope is the sweep and nothing else.

Read the conversation from the top. If it is long enough that the early turns
have fallen out of context, recover them with `mcp__session_info__read_transcript`
on the CURRENT session id (`mcp__session_info__list_sessions` to find it) rather
than sweeping only what you can still see - the earliest turns are usually where
the asks are.

### Five buckets, routed differently

- **BUG** - he reported something not working, or a surface behaving wrong.
  Goes to ROADMAP.md `Known broken` and a Notion Feature Tracker row.
- **ASK** - he asked for something built or changed. Notion Feature Tracker
  (Priority set by classroom risk) plus a ROADMAP `Planned` line.
- **IDEA** - floated, not committed: "we could eventually", "later", "at some
  point". IDEAS.md `Next up (queued)`. NEVER the tracker - a maybe on the
  tracker reads as a commitment and clogs the Now list.
- **DECISION or CONSTRAINT** - he settled a design question, or the session
  discovered a trap, a silent failure mode, or an undocumented constraint. This
  goes to CLAUDE.md and is NOT A TASK. It is usually the most valuable thing a
  long conversation produced and the thing most often lost. Per rule 9, a
  correction that would have prevented a bug lands immediately as its own small
  commit, without waiting for confirmation.
- **SETUP** - something only Steele can do: run a migration, paste an Apps
  Script file, set a Vercel env var, author a Notion property, upload a clip.
  ROADMAP `Steele's open setup items`. Show these in their own group - they
  block everything downstream and nobody else can clear them.

### Never file (check each before showing it)

- **Anything DONE in this same conversation.** This is the top failure mode: he
  reports X broken, it gets fixed in the next twenty minutes, and the sweep
  files "fix X" as outstanding work. Check the conversation's own edits and
  `git --no-optional-locks log --oneline -20 origin/main` before filing any bug.
- **Anything already on a list.** Dedupe against ROADMAP.md, IDEAS.md and the
  Notion tracker. A near-duplicate in different words still counts; say which
  existing item it matches.
- **Anything he declined or closed.** "leave it", "it stays off", "no, keep it
  as is" is a DECISION for CLAUDE.md. Filing it as a task re-opens a question he
  already settled, and he will have to settle it again.
- **Claude's own suggestions he never answered.** A proposal is not an ask.
  Silence is not assent.
- **Student names, aliases, district emails, roster rows** - never transcribe
  one out of a conversation into any file (rule 8).

### Capture rules

- **Carry his verbatim words**, quoted and dated, in every entry. Paraphrase
  destroys the constraint: "its not testing as much as just getting reps
  following the numbers" is a design rule, "improve the division tool" is not.
  Half the useful lines in CLAUDE.md are direct quotes for this reason.
- Carry the WHY when he gave one - the classroom moment, the student behaviour,
  what goes wrong without it.
- Give each item a risk tier from the same ranking above. A bug he hit while
  running a real lesson is tier 1; a nice-to-have is tier 6.
- Keep a decision's REASONING, not just its verdict. "Opaque, not blurred"
  is worth little; "backdrop-filter re-blurs its backdrop every frame and its
  backdrop is the ink canvas" is what stops someone restoring it as polish.

### Show, then file

Print the catalog and STOP. Do not write anything except a rule-9 CLAUDE.md
correction until he answers.

```
SWEPT <n> turns

FILE THESE
1. [BUG · tier 1] <one line> - "<his words>" - to <destination>
2. [ASK · tier 3] ...
(no cap; group by bucket, bugs first)

ONLY YOU CAN DO THESE
<setup items, or "none">

FOR CLAUDE.MD (decisions and traps, not tasks)
<one line each, with the reasoning>

NOT FILED - ALREADY DONE THIS SESSION
<one line each, with the commit or the file>

NOT FILED - ALREADY ON THE LIST
<one line each, naming the existing item it matches>
```

End with: "Numbers to file, or `all`, or `none`." Then write only what he named.
Read the Feature Tracker's property schema before writing a row - it has a
`Priority` select, a `Status` select (Live / Planned / Parked / Needs revision /
In progress) and a SEPARATE `Done` checkbox, and guessing those wrong puts the
item somewhere he will not see it. ROADMAP and IDEAS edits commit on their own
explicit paths, never `git add .`. From a Cowork sandbox, do not run the commit
- write the file, hand the commit to Steele or route it through Desktop
Commander, and report it as written-not-committed.

## Scope: sync

Everything above, then land the corrections:

- Prune STALE items out of ROADMAP.md and IDEAS.md, and move anything the sweep
  found BUILT from `In progress` / `Planned` into `Live` with its date and its
  test script name.
- Update the matching Notion Feature Tracker rows so the two stop drifting.
- Commit the roadmap edit ON ITS OWN, with explicit paths - never `git add .`,
  and never bundled with feature work (rules 2 and 9).
- **From a Cowork sandbox, do not run the commit yourself.** Git writes fail
  EPERM there and strand lock files that only a real terminal can remove; hand
  the commit and push to Steele, or route them through Desktop Commander. Report
  the edit as written-not-committed rather than claiming it shipped.
- Do not touch curriculum content, lesson pages, or anything destructive; those
  are Steele's call.
