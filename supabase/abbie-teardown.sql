-- Remove the last of the Abbie AI feature from the database.
--
-- Steele, 2026-07-30: "no abbie questions."
--
-- The code went the same day (the relay, the ElevenLabs voice route, all four
-- chat components, both question endpoints). These two objects outlived it
-- because dropping them is destructive and code deletion is not.
--
-- DESTRUCTIVE AND NOT REVERSIBLE. `abbie_questions` holds student-submitted
-- free text from when the feature was live - that is the reason to drop it
-- rather than leave it, but read the count below before you run the drop if you
-- want to know what you are removing.
--
-- Hand-run in the Supabase SQL Editor, like every migration in this folder.
-- Idempotent: safe to run twice.

-- ---------------------------------------------------------------------------
-- Look first. Run this on its own if you want to see what is there.
-- ---------------------------------------------------------------------------
-- select count(*) as student_questions_stored from public.abbie_questions;

-- ---------------------------------------------------------------------------
-- 1. The student question table.
-- ---------------------------------------------------------------------------
-- Every policy and index goes with the table; naming them is unnecessary.
drop table if exists public.abbie_questions;

-- ---------------------------------------------------------------------------
-- 2. The broadcast column on sessions.
-- ---------------------------------------------------------------------------
-- Held one line of Abbie's speech per session. Nothing has read or written it
-- since the code was deleted, and it is not student data - dropped here because
-- leaving a column no code knows about is how a future audit reports a feature
-- that does not exist. If you would rather keep the column for now, run only
-- section 1; the site does not care either way.
alter table public.sessions drop column if exists abbie;

notify pgrst, 'reload schema';
