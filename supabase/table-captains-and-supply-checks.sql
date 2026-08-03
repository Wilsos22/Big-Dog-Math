-- Table captains and the closeout supply check.
--
-- Two routines that were previously carried entirely by Steele's memory:
--
-- 1. MONDAY CAPTAINS. Each of the room's tables gets one captain for the week.
--    The captain is spun on Monday and is the single person accountable for
--    that table's supplies at the end of every class that week. One row per
--    (period, week, table). The week is stored as its MONDAY in
--    America/Los_Angeles, so a Tuesday re-spin overwrites Monday's pick rather
--    than creating a second week.
--
-- 2. CLOSEOUT SUPPLY CHECK. At closeout each captain reports whether their
--    table has everything. The teacher taps the table green or red on the iPad.
--    One row per (session, table) - the latest tap wins, because a table that
--    finds the missing marker before the bell should end the day green.
--
-- WHY THE STREAK VIEW EXISTS: the whole point of recording this is the
-- privilege decision, and Steele's rule is CONSECUTIVE misses - two reds in a
-- row flags a table, any green wipes the streak. Computing that in the API
-- route would mean pulling every historical row to the app server; the view
-- answers it in one query and keeps the rule in one place.
--
-- FERPA: table_captains stores the student ALIAS alongside the id, never a
-- name. The projector renders first names through the browser-local name key
-- exactly as the reader spinner does, so no name is ever written here or sent
-- over the wire. supply_checks holds no student reference at all - a table is
-- furniture, not a person.
--
-- Hand-run in the Supabase SQL Editor, like every migration in this folder.
-- Idempotent: safe to run more than once.

-- Physical seating. Populated by the roster push from the Google Sheet once
-- that sheet grows a Table column; null until then, and the captain spinner
-- degrades to spinning distinct students from the whole period.
alter table students add column if not exists table_number smallint;

alter table students drop constraint if exists students_table_number_range;
alter table students add constraint students_table_number_range
  check (table_number is null or (table_number >= 1 and table_number <= 24));

create index if not exists students_period_table_idx
  on students(period_id, table_number);

create table if not exists table_captains (
  id            uuid primary key default gen_random_uuid(),
  period_id     uuid not null references periods(id) on delete cascade,
  -- The Monday of the week this captaincy covers, America/Los_Angeles.
  week_start    date not null,
  table_number  smallint not null check (table_number >= 1 and table_number <= 24),
  student_id    uuid references students(id) on delete set null,
  -- Denormalised so the wall can render a week's captains without a join, and
  -- so a roster edit mid-week does not blank out who was actually responsible.
  alias         text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists table_captains_period_week_table_idx
  on table_captains(period_id, week_start, table_number);

create table if not exists supply_checks (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references sessions(id) on delete cascade,
  period_id     uuid not null references periods(id) on delete cascade,
  -- The teaching day, America/Los_Angeles. Denormalised off the session so the
  -- streak view can order without joining sessions.
  class_date    date not null,
  table_number  smallint not null check (table_number >= 1 and table_number <= 24),
  status        text not null check (status in ('green', 'red')),
  -- Optional: what was missing. Free text, teacher-only, never student-facing.
  missing       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists supply_checks_session_table_idx
  on supply_checks(session_id, table_number);

create index if not exists supply_checks_period_date_idx
  on supply_checks(period_id, class_date desc);

-- Current consecutive-red streak per table, newest day first. A green at any
-- point ends the streak, so red_streak is exactly "how many class days in a row
-- has this table come up short, as of the most recent check".
create or replace view supply_check_streaks as
with ordered as (
  select
    period_id,
    table_number,
    class_date,
    status,
    row_number() over (
      partition by period_id, table_number order by class_date desc
    ) as rn
  from supply_checks
),
latest_green as (
  select period_id, table_number, min(rn) as green_rn
  from ordered
  where status = 'green'
  group by period_id, table_number
)
select
  o.period_id,
  o.table_number,
  count(*) filter (
    where o.status = 'red' and (g.green_rn is null or o.rn < g.green_rn)
  )::int as red_streak,
  count(*) filter (where o.status = 'red')::int as red_total,
  count(*)::int as checks_total,
  max(o.class_date) as last_checked
from ordered o
left join latest_green g
  on g.period_id = o.period_id and g.table_number = o.table_number
group by o.period_id, o.table_number;

-- Teacher-only, both tables. Every read and write goes through the
-- teacher-gated /api/teacher/* routes on the service role key. RLS on with no
-- policies means anon and authenticated get nothing.
alter table public.table_captains enable row level security;
drop policy if exists "prototype_all" on public.table_captains;

alter table public.supply_checks enable row level security;
drop policy if exists "prototype_all" on public.supply_checks;

-- A view does not inherit RLS from its base tables in the way a reader
-- expects, so close it explicitly rather than trusting the base-table grants.
revoke all on supply_check_streaks from anon, authenticated;

notify pgrst, 'reload schema';
