-- Big Dog Math: FERPA pseudonymization, step 2 of 2 (DESTRUCTIVE - read first).
--
-- Removes every student name and district email from Supabase. Run this ONLY
-- after: (1) ferpa-pseudonym-schema.sql has been run, (2) the FERPA code
-- deploy is live, and (3) the Workspace roster Sheet has pushed aliases and
-- email HMACs for every current student (check: the query in section 0 below
-- returns 0). Full order: supabase/FERPA-CUTOVER.md.
--
-- What this deletes, permanently:
--   students.full_name, students.email       (and their indexes)
--   every display_name value derived from a real name
--   raw emails embedded in responses.dedupe_key by the old Apps Script
--   the abbie_questions table                 (student free text from the
--                                              deleted Abbie AI feature)
--   the sessions.abbie column                 (no longer read or written)
--
-- Idempotent: safe to re-run.

begin;

-- 0. Legacy rows with a name but no alias get a neutral retired pseudonym so
--    their evidence history keeps an owner. Current students should already
--    have real aliases from the roster push - check before running:
--      select count(*) from students where alias is null or btrim(alias) = '';
--    If that is not 0 for CURRENT students, push the roster first.
update public.students
set alias = 'Alum ' || substr(id::text, 1, 8)
where alias is null or btrim(alias) = '';

-- 1. Rewrite every stored display_name from the student's alias. Rows with no
--    roster link become a neutral label.
update public.session_joins j
set display_name = s.alias
from public.students s
where j.student_id = s.id
  and j.display_name is distinct from s.alias;

update public.session_joins
set display_name = 'Student'
where student_id is null
  and display_name is not null;

update public.poll_answers a
set display_name = s.alias
from public.students s
where a.student_id = s.id
  and a.display_name is distinct from s.alias;

update public.poll_answers
set display_name = 'Student'
where student_id is null
  and display_name is not null;

update public.checkpoint_results r
set display_name = s.alias
from public.students s
where r.student_id = s.id
  and r.display_name is distinct from s.alias;

-- 2. Old warm-up dedupe keys embedded the raw email ("warmup:<form>:agg:<email>").
--    Replace the email segment with the student id - dedupe stays student-scoped.
update public.responses
set dedupe_key = regexp_replace(dedupe_key, '[^:]+@[^:]+', student_id::text, 'g')
where dedupe_key like '%@%';

-- 3. The Abbie AI feature is deleted from the app; its student free text and
--    the dormant sessions column go with it.
drop table if exists public.abbie_questions;
alter table public.sessions drop column if exists abbie;

-- 4. The identity columns themselves. email_normalized is a generated column
--    derived from email in the live database (it never appears in schema.sql)
--    - derived PII goes with its source, and it must drop first or the email
--    drop fails on the dependency.
drop index if exists public.students_email_idx;
drop index if exists public.students_normalized_email_idx;
alter table public.students drop column if exists email_normalized;
alter table public.students drop column if exists full_name;
alter table public.students drop column if exists email;

commit;

notify pgrst, 'reload schema';

-- After this runs, verify from the anon side that nothing identified remains:
--   select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'students';
-- should list no name or email column, and supabase/audit-exposure.sql still
-- passes. Real identities now exist only in the district Google Workspace.
