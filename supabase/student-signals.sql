-- Student self-signals: the "I'm stuck" tap.
--
-- NOT YET RUN - Steele runs this in the Supabase SQL Editor when ready.
-- The site ships dark until then: the student chips probe the API once and
-- stay hidden while this table is missing, so nothing half-works.
--
-- Why (outside critique, July 2026): the classroom culture is "confusion is
-- step one", but the software gave students no way to say it - the only
-- signalling affordance was a tech-support link. This table holds one LATEST
-- signal per student per session ("stuck" / "say that again" / "I've got
-- this"), tagged with the lesson step it was sent during, so the teacher
-- surface can show live counts for the current step and ignore stale ones.
--
-- RLS group: server-only, like the hardened student tables. Students write
-- through /api/student/signal (requireVerifiedStudent); the teacher reads
-- through /api/live/signals (proxy-gated). No anon access at all.
--
-- Idempotent. To remove: drop table student_signals;

create table if not exists student_signals (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references sessions(id) on delete cascade,
  student_id   uuid references students(id) on delete cascade,
  display_name text,
  signal       text not null check (signal in ('stuck', 'again', 'got-it')),
  step_index   int,
  updated_at   timestamptz not null default now(),
  unique (session_id, student_id)
);
create index if not exists student_signals_session_idx on student_signals(session_id, updated_at);

do $$
begin
  execute 'revoke all on table public.student_signals from anon, authenticated';
  execute 'alter table public.student_signals enable row level security';
end $$;

notify pgrst, 'reload schema';
