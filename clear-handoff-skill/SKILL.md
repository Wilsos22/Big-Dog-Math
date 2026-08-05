---
name: clear-handoff
description: Wrap a working session so nothing durable is stranded in the transcript, then hand Steele a short carry-over brief and tell him to clear context. Offer this PROACTIVELY the moment the session reaches a seam - a verified deploy, a finished task list, a topic change from code to lesson design to Notion, or the end of a long multi-file sweep - because Steele does not track context weight himself and does not want to discover it through degraded output. Also trigger whenever he says "clear", "/clear", "clear context", "wrap up", "wrap this up", "let's start fresh", "new session", "hand off", "what should carry over", or asks whether he should clear. Do not trigger mid-debug, mid-build, or while a verification is still pending.
---

# Clear handoff

A transcript is not storage. The moment Steele clears, every finding still living
only in this conversation is gone - and the expensive ones are the quiet kind: a
constraint discovered while debugging, a branch pushed but not merged, a migration
file written but never run. Those do not announce themselves on the way out.

This skill is the seam ritual. It gets durable knowledge into the places that
survive, names what is genuinely half-finished, hands Steele a short brief to
carry forward, and only then tells him to clear.

The whole point is that clearing should cost nothing. If it costs something, the
handoff was incomplete.

## When to offer

Steele's standing instruction is that Claude tells him when to clear, because he
will not track it and does not want to find out through degraded output. So the
offer is your job, not his.

A seam is a natural stopping point where the working set changes:

- A deploy verified live - pushed, built, and the live route confirmed changed.
- A task list finished, with nothing pending on it.
- A topic change. Repo code, lesson design in Notion, and classroom hardware are
  three different working sets; carrying one into the next is dead weight.
- A long multi-file sweep just concluded and its conclusion is captured.
- He says "what's next" or "ok what else" after something landed.

These are NOT seams, and offering at one is worse than staying quiet:

- Mid-debug, or mid-build, or waiting on a verification.
- Iterating on one file with him.
- Right after a failure, before the cause is understood. Clearing there throws
  away the only copy of what has already been ruled out.

Offer once per seam, in one line, and stop. Something like: "This is a clean seam
- deploy is verified and the list is empty. Want me to wrap up so you can clear?"
If he says no, do not raise it again until a new seam arrives. A nag is how a
useful prompt turns into noise he learns to skip.

If he asks for it directly - by name, or "clear", or "wrap this up" - skip the
offer and run it.

## Running the handoff

### 1. Land the durable knowledge

The repo already has `/sync` (`.claude/commands/sync.md`) and it owns this step.
Read it and follow it rather than reinventing the sort: it establishes what
actually changed from the git diff, sorts each finding into CLAUDE.md,
ROADMAP.md, auto-memory, or nothing, and lands the CLAUDE.md edit on its own
path to `main`.

Two things matter more here than in a normal `/sync` run:

- **Work from the diff, not from memory of the conversation.** You are about to
  lose the conversation, which makes it the least trustworthy source in the room.
  The files are the record.
- **Bias hard toward CLAUDE.md.** Rule 9 exists because two real July 2026 bugs
  came from stale lines in it, and a correction that only ever existed in a
  transcript is a correction nobody has - Codex and cloud sessions cannot read a
  Claude-only memory note.

If `/sync` is unavailable in this environment, do its job inline: read the diff,
sort the findings, commit the CLAUDE.md change by itself with explicit paths
(never `git add .`), fetch before pushing.

### 2. Find the stranded work

This is the part `/sync` does not cover, and it is where the real loss happens.
Check, and report each one plainly:

- **Uncommitted changes** - `git status`. Anything real still in the working tree.
- **Unpushed branches** - a local-only branch is invisible to Steele's github.com
  flow. If work is sitting on one, push it and name it, or it is lost to him.
- **Unmerged commits** - anything pushed to a branch that still needs to reach
  `main` to deploy.
- **Unrun migrations** - a `supabase/*.sql` file written this session is dark
  until Steele runs it by hand. Say which file and what breaks first without it.
- **Unverified claims** - anything reported as working that was not actually
  typechecked, built, or confirmed on the live route. Say so now. The next
  session will inherit the claim and build on top of it, and the cost of that
  compounds.
- **Anything only Steele can do** - a Notion edit, an Apps Script paste-in, a
  merge, a Script Property, a decision you flagged for him and he has not made.

Nothing here is a blocker. The job is to make each item visible before the only
record of it disappears - not to finish it.

### 3. Write the carry-over brief

Print this in chat, short enough to read at a glance and paste into the next
session. Do not write it to a file unless he asks.

```
CARRY OVER

Working on:   <one line - the actual objective, not a topic label>
Verified:     <what is proven done, and by what check>
Open:         <what is not done, each with the next concrete step>
Read first:   <files or CLAUDE.md sections the next session needs>
Your move:    <anything only Steele can do>
```

Drop any line that is genuinely empty rather than padding it with "nothing" -
a brief with three real lines is read, and a brief with six lines of filler is
skimmed.

**The brief is a pointer, not a backup.** The strong temptation is to summarize
the conversation so nothing feels lost. Resist it: a recap of what was discussed
is precisely the weight that makes the next session start heavy, and it competes
with CLAUDE.md for authority while being less reliable. If something deserves to
persist, it belongs in CLAUDE.md and the brief should point at it there. Name
state and next actions; leave the narrative behind.

**Never let "done" outrun the evidence.** "Built and typechecked, not yet run in
a live session" is a useful line. "Done" for the same work is a trap the next
session walks into.

### 4. Tell him to clear

Say plainly that the handoff is complete and he can clear.

How he clears depends on where he is:

- **Cowork** - there is no `/clear` command. He starts a new chat. Say that
  directly, because typing `/clear` there returns an unknown-skill error and
  reads like something is broken.
- **Claude Code** - `/clear` is a built-in and works.

If you cannot tell which environment you are in, name both in one line rather
than guessing.

## Report

Close with what went where: what landed in CLAUDE.md, what was pushed and where,
what is still stranded, and what needs his hands. If something could not be
verified, say that rather than letting silence imply it is fine.
