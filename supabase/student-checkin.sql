-- Mini check-in rounds: the teacher can now trigger "let me know where
-- you're at" instead of only ever waiting for students to tap on their own.
-- Builds on student-signals.sql and student-signal-controls.sql (both
-- already run).
--
-- NOT YET RUN - Steele runs this in the Supabase SQL Editor when ready.
-- Ships dark until then: /api/live/signals, /api/student/signal and
-- /api/student/session-state all probe for these columns before using them
-- and fall back to their pre-checkin shape (see the graceful-degrade reads
-- in each route) - the "Ask the class" button, the check-in tally, and the
-- new "I'm kind of there" chip all stay hidden, and the site behaves exactly
-- as it does today. The chip that IS live today, "Say that again", keeps
-- working unchanged until this runs.
--
-- What changed (Steele, 2026-08-07): "Say that again" is retired as a signal
-- and replaced by "I'm kind of there" - a middle confidence rung between
-- stuck and got it, so the three chips now double as a mini fist-to-five a
-- student can tap any time, on their own, with no prompt from the teacher.
--
-- This is ADDITIVE ONLY - it widens the signal check constraint to ALSO
-- allow 'kind-of-there' rather than replacing 'again'. No existing row is
-- touched: `student_signals` holds one LATEST row per student per session,
-- so a leftover 'again' row simply gets overwritten the next time that
-- student taps any chip, and the app never writes 'again' again once this
-- has run. Widening rather than migrating means there is no ordering hazard
-- between a backfill UPDATE and the constraint change on a table that may
-- already hold live rows.
--
-- checkin_round on both `sessions` and `student_signals` is what makes an
-- explicit "ask the class" round possible without disturbing the ambient,
-- self-initiated taps that already existed: every signal write is stamped
-- with whatever round is current on the session at write time. Starting a
-- round bumps `sessions.checkin_round`, so the teacher's tally for the new
-- round starts empty even though old rows are still sitting in the table -
-- nothing is deleted. A tap sent between rounds is simply tagged with the
-- round in play, and counts toward the NEXT round the teacher opens rather
-- than being lost.
--
-- Idempotent.

alter table student_signals drop constraint if exists student_signals_signal_check;
alter table student_signals add constraint student_signals_signal_check
  check (signal in ('stuck', 'again', 'kind-of-there', 'got-it'));

alter table student_signals add column if not exists checkin_round int not null default 0;
alter table sessions add column if not exists checkin_round int not null default 0;
alter table sessions add column if not exists checkin_active boolean not null default false;
alter table sessions add column if not exists checkin_started_at timestamptz;

notify pgrst, 'reload schema';
