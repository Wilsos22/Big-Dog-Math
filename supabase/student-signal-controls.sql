-- Student-signal teacher controls: per-student mute + session on/off switch.
--
-- NOT YET RUN - Steele runs this in the Supabase SQL Editor when ready.
-- Run AFTER student-signals.sql (already run 2026-07-26). Ships dark until
-- then: the mute buttons and the on/off toggle hide themselves while these
-- columns are missing, and the signal chips keep working exactly as today.
--
-- muted: hides that student's signals from the teacher surfaces for this
--   session WITHOUT any feedback to the student - a spammer gets silence,
--   not a reaction. Student upserts leave the flag alone (upsert only
--   touches the columns the student route sends).
-- sessions.signals_off: hides the signal chips for every student in the
--   session. The student surface re-probes on each lesson-step change, so
--   flipping it takes effect at the next advance.
--
-- Idempotent.

alter table student_signals add column if not exists muted boolean not null default false;
alter table sessions add column if not exists signals_off boolean not null default false;

notify pgrst, 'reload schema';
