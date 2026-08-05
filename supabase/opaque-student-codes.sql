-- Opaque student codes — removes personally identifiable information from Supabase.
--
-- WHY: NRS 388.283 defines a "school service" as a site that collects or maintains
-- PII about a pupil. Remove the PII and the site falls outside that definition and
-- outside the school-service-provider obligations in NRS 388.281-388.296.
-- See docs/ccsd-compliance-brief.md.
--
-- RUN ORDER MATTERS. Do not skip step 2 or the code-to-name key is lost forever.
--
--   1. PHASE 1 below  — additive, safe, non-breaking. Existing app keeps working.
--   2. EXPORT THE KEY — run the SELECT in step 2 and paste into the CCSD Google
--                       Sheet. This is the only copy of code -> name.
--   3. Deploy the app changes (identity.ts, roster sync, matchers).
--   4. PHASE 2 below  — destructive. Only after step 3 is live and verified.

-- ===========================================================================
-- PHASE 1 — additive
-- ===========================================================================

create extension if not exists pgcrypto;

-- Cryptographically random, NOT derived from any student information.
-- 34 CFR 99.31(b)(2) disqualifies codes based on student info (initials, DOB,
-- student ID). Period prefix is fine: it describes a class, not a person.
-- Alphabet omits 0/O/1/I/L so codes are unambiguous when read aloud.
create or replace function gen_student_code(p_period_id uuid)
returns text
language plpgsql
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  prefix    text;
  suffix    text;
  candidate text;
begin
  select coalesce(substring(name from '\d+'), '0')
    into prefix
    from periods
   where id = p_period_id;

  loop
    suffix := '';
    for i in 1..4 loop
      suffix := suffix || substr(
        alphabet,
        1 + (get_byte(gen_random_bytes(1), 0) % length(alphabet)),
        1
      );
    end loop;

    candidate := 'P' || coalesce(prefix, '0') || '-' || suffix;
    exit when not exists (select 1 from students where student_code = candidate);
  end loop;

  return candidate;
end;
$$;

alter table students add column if not exists student_code text;

-- Stable, non-identifying handle for Google sign-in.
-- HMAC of the Google `sub` claim (an opaque Google account id, not an email and
-- not derived from the student's name). Secret lives server-side only, never in
-- the client bundle. Lets the server map a sign-in to a code without ever
-- storing an email address.
alter table students add column if not exists auth_hash text;

update students
   set student_code = gen_student_code(period_id)
 where student_code is null;

alter table students alter column student_code set not null;

create unique index if not exists students_student_code_idx on students(student_code);
create unique index if not exists students_auth_hash_idx    on students(auth_hash);

-- ===========================================================================
-- STEP 2 — EXPORT THE KEY BEFORE RUNNING PHASE 2
-- ===========================================================================
-- Run this, export the result, and paste it into a Google Sheet in your CCSD
-- Drive (not personal Gmail, not Notion, not this repo). That sheet becomes the
-- single authoritative code-to-name key.
--
--   select s.student_code, s.full_name, s.email, p.name as period
--     from students s
--     join periods p on p.id = s.period_id
--    order by p.sort_order, s.full_name;
--
-- Confirm the sheet is populated and readable before continuing.

-- ===========================================================================
-- PHASE 2 — destructive. Run only after the app no longer reads these columns.
-- ===========================================================================
-- Uncomment and run as a separate migration.
--
-- drop index if exists students_email_idx;
-- alter table students drop column if exists full_name;
-- alter table students drop column if exists email;
--
-- Verify afterwards:
--   select column_name from information_schema.columns
--    where table_name = 'students' order by ordinal_position;
--   -- expect: id, period_id, student_code, auth_hash, created_at
