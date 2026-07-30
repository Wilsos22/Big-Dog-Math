-- SELF-AUDIT: what can a student's browser actually reach?
--
-- Run this yourself in the Supabase SQL Editor any time. It answers the only
-- question that matters, with evidence instead of opinion:
--   "If a student opened DevTools, what could they read or write?"
--
-- You do not need to trust anyone's summary of your system. Run it and read it.
-- Each query below tells you what the result MEANS.

-- ===========================================================================
-- 1. WHAT THE ANONYMOUS ROLE CAN TOUCH
-- ===========================================================================
-- `anon` is the role a student's browser uses. Any table NOT in this list is
-- completely unreachable from a browser — permission is denied before row-level
-- security is even consulted.
--
-- HOW TO READ IT:
--   A table appearing here is only a problem if it contains student data.
--   Content tables (standards, misconceptions, lesson data) SHOULD be here —
--   that's how the site renders.
--   A table with "0 policies" AND row level security enabled is fully denied,
--   even if the grants look broad. Grants without policies do nothing.

select g.table_name,
       string_agg(distinct g.privilege_type, ', ' order by g.privilege_type) as anon_can,
       (select count(*) from pg_policies p
         where p.schemaname = 'public' and p.tablename = g.table_name) as policies,
       (select relrowsecurity from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where c.relname = g.table_name and n.nspname = 'public') as rls_on
  from information_schema.role_table_grants g
 where g.grantee = 'anon' and g.table_schema = 'public'
 group by g.table_name
 order by g.table_name;


-- ===========================================================================
-- 2. THE SAME QUESTION FOR SIGNED-IN STUDENTS
-- ===========================================================================
-- If students sign in, their browser uses `authenticated`, not `anon`.
-- This is a SEPARATE and usually wider surface. Check it too.

select g.table_name,
       string_agg(distinct g.privilege_type, ', ' order by g.privilege_type) as authed_can,
       (select count(*) from pg_policies p
         where p.schemaname = 'public' and p.tablename = g.table_name) as policies
  from information_schema.role_table_grants g
 where g.grantee = 'authenticated' and g.table_schema = 'public'
 group by g.table_name
 order by g.table_name;


-- ===========================================================================
-- 3. POLICIES THAT LET ANYONE READ EVERYTHING
-- ===========================================================================
-- HOW TO READ IT:
--   Any row returned here is a table where the policy does not filter by user.
--   That is fine for curriculum content. It is NOT fine for anything tied to
--   an individual student. Check each result against that standard.

select tablename, policyname, cmd, roles::text,
       coalesce(qual, '(none)') as using_clause
  from pg_policies
 where schemaname = 'public'
   and (qual is null or btrim(qual) = 'true')
 order by tablename, policyname;


-- ===========================================================================
-- 4. IS THERE ANY REAL STUDENT PII IN HERE RIGHT NOW?
-- ===========================================================================
-- Finds every text column whose name suggests an identifier, anywhere in the
-- database — including tables you forgot about.
-- HOW TO READ IT: every row is a place a name or email could be hiding.
-- Investigate each one. An empty result is the goal.

select table_name, column_name, data_type
  from information_schema.columns
 where table_schema = 'public'
   and column_name ~* '(name|email|phone|address|guardian|parent|birth|dob|ssn|student_id|initials)'
 order by table_name, column_name;


-- ===========================================================================
-- 5. ROW COUNTS FOR STUDENT-LINKED TABLES
-- ===========================================================================
-- HOW TO READ IT: confirms whether real data exists yet. Low/zero counts mean
-- the blast radius of any change you make right now is small.
-- Adjust the table list as your schema evolves.

select 'students'              as tbl, count(*) from students
union all select 'mastery',              count(*) from mastery
union all select 'mastery_history',      count(*) from mastery_history
union all select 'responses',            count(*) from responses
union all select 'poll_answers',         count(*) from poll_answers
union all select 'exit_ticket_responses',count(*) from exit_ticket_responses
union all select 'checkpoint_results',   count(*) from checkpoint_results
union all select 'iready_scores',        count(*) from iready_scores
union all select 'session_joins',        count(*) from session_joins
 order by 1;
-- (nb_scores was listed here and does not exist in the database - only a policy
--  in student-data-security.sql refers to it. A missing table aborts the whole
--  UNION, so add tables here only after confirming they exist.)


-- ===========================================================================
-- 6. THE DIRECT TEST — TRY TO READ AS A STUDENT WOULD
-- ===========================================================================
-- The most honest check in this file. Impersonates the anonymous role and
-- attempts a read. Wrapped in a transaction that rolls back, so it changes
-- nothing.
--
-- HOW TO READ IT:
--   "permission denied for table students"  -> GOOD. Browsers cannot reach it.
--   A row count                             -> Students CAN read this table.
--                                              Decide if that is acceptable.
--
-- Run one table at a time — the first error aborts the transaction.

begin;
  set local role anon;
  select count(*) as students_visible_to_a_browser from students;
rollback;


-- ===========================================================================
-- 7. NON-DATABASE CHECKS — do these by hand
-- ===========================================================================
-- These cannot be checked with SQL, and they are where real leaks happen:
--
--   [ ] Open the site as a student, open DevTools > Network, and read the
--       actual response payloads. Whatever you can see there, a student can.
--   [ ] Search the codebase for console.log / logger calls that could receive
--       a student object.
--   [ ] Confirm no analytics or error-tracking script is loaded on student pages.
--   [ ] Confirm any component that renders a real name is a Client Component
--       ("use client"), so the name is never assembled on the server.
--   [ ] Confirm the roster key spreadsheet is shared with specific people and
--       has NOT been "published to the web."
--   [ ] Confirm no student name or email appears in any Notion page title.
