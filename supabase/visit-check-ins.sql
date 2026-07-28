-- Check-in taps on the ranked visit list.
--
-- During the release block the teacher walks a ranked list on the iPad and
-- taps Got it / Partly / Still stuck on each student. The tap clears the row,
-- so what stays on screen is always who has NOT been reached yet, and at
-- minute 46 the teacher knows who they never got to.
--
-- WHY THIS TABLE MATTERS MORE THAN IT LOOKS: the paper assignment can go home
-- unfinished, so it is never exit evidence. These taps are the ONLY path by
-- which the teacher's read of a student's paper work enters the system at all.
-- Nothing a student writes on the assignment is otherwise visible anywhere.
--
-- One row per (session, student) - the latest tap wins, because a student
-- visited twice should show their current state, not a history the teacher has
-- to read. student_key is text, not a students FK: a student who joined
-- without a roster match is keyed by display name, exactly as City Routes
-- keys them (studentKeyOf), and the list must still be able to clear them.
--
-- Hand-run in the Supabase SQL Editor, like every migration in this folder.
-- Idempotent: safe to run more than once.

create table if not exists visit_check_ins (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references sessions(id) on delete cascade,
  student_key  text not null,
  display_name text,
  status       text not null check (status in ('got-it', 'partly', 'still-stuck')),
  -- What the teacher released on a Got it, when they released anything.
  promoted     text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index if not exists visit_check_ins_session_student_idx
  on visit_check_ins(session_id, student_key);

-- Teacher-only. This table is a record of a teacher's private read of a
-- student, so it gets NO anon policy: every read and write goes through the
-- teacher-gated /api/live/* routes using the service role key. RLS on with no
-- policies means anon and authenticated get nothing.
alter table public.visit_check_ins enable row level security;
drop policy if exists "prototype_all" on public.visit_check_ins;

notify pgrst, 'reload schema';
