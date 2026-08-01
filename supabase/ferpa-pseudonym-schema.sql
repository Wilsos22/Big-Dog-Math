-- Big Dog Math: FERPA pseudonymization, step 1 of 2 (ADDITIVE).
--
-- Adds the pseudonymous identity columns and re-points every identity RPC at
-- them. Run this in the Supabase SQL Editor FIRST, then deploy the matching
-- code, then push the roster from the Workspace Sheet, and only then run
-- ferpa-pii-scrub.sql. Full order: supabase/FERPA-CUTOVER.md.
--
-- The model (src/lib/pseudonym.ts): the site knows each student as
--   alias       a Workspace-generated pseudonym ("Amber Fox")
--   email_hmac  hex HMAC-SHA256 of the lowercased district email, computed in
--               Apps Script with a key that exists ONLY in Script Properties.
-- Names, emails, and the HMAC key never reach Supabase or Vercel.
--
-- NOTE: this migration renames RPC parameters (p_student_email becomes
-- p_student_email_hmac), so the OLD deployed code cannot call them afterward.
-- Run it together with the code deploy, out of class time.

begin;

alter table public.students
  add column if not exists alias text,
  add column if not exists email_hmac text;

-- full_name is dropped by the scrub; until then alias-only inserts must work.
alter table public.students
  alter column full_name drop not null;

create unique index if not exists students_alias_idx
  on public.students(lower(btrim(alias)))
  where alias is not null and btrim(alias) <> '';

create unique index if not exists students_email_hmac_idx
  on public.students(email_hmac)
  where email_hmac is not null and email_hmac <> '';

-- ---------------------------------------------------------------------------
-- bdm_complete_warmup_identity: the Form-receipt claim, now matched by HMAC.
-- ---------------------------------------------------------------------------

drop function if exists public.bdm_complete_warmup_identity(
  uuid, uuid, text, uuid, text, uuid, uuid
);

create or replace function public.bdm_complete_warmup_identity(
  p_verification_token uuid,
  p_session_id uuid,
  p_warmup_resource_key text,
  p_student_id uuid,
  p_student_email_hmac text,
  p_auth_user_id uuid,
  p_expected_student_auth_user_id uuid
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_receipt public.student_warmup_sessions%rowtype;
  v_live_flow jsonb;
  v_current_warmup_url text;
  v_session_period_id uuid;
  v_student_period_id uuid;
  v_student_email_hmac text;
  v_student_auth_user_id uuid;
begin
  -- Match the teacher-recovery lock order: session before receipt. This avoids
  -- a cycle when a Form submit and explicit teacher recovery arrive together.
  select live_flow, period_id
  into v_live_flow, v_session_period_id
  from public.sessions
  where id = p_session_id and status = 'open'
  for share;

  if not found then
    return 'session_not_open';
  end if;

  select receipt.*
  into v_receipt
  from public.student_warmup_sessions as receipt
  where receipt.verification_token = p_verification_token
    and receipt.session_id = p_session_id
    and receipt.auth_user_id = p_auth_user_id
  for update;

  if not found then return 'receipt_not_found'; end if;
  if v_receipt.completed_at is not null then return 'receipt_already_completed'; end if;
  if v_receipt.warmup_resource_key is null
    or v_receipt.warmup_resource_key <> p_warmup_resource_key then
    return 'warmup_resource_mismatch';
  end if;

  if v_live_flow -> 'state' ->> 'id' = 'warmup'
    and coalesce(v_live_flow -> 'resource' ->> 'url', '') <> '' then
    v_current_warmup_url := v_live_flow -> 'resource' ->> 'url';
  else
    select step ->> 'resourceUrl'
    into v_current_warmup_url
    from jsonb_array_elements(coalesce(v_live_flow -> 'sequence' -> 'steps', '[]'::jsonb)) as step
    where step ->> 'stateId' = 'warmup'
    limit 1;
  end if;

  if public.bdm_canonical_google_form_resource(v_current_warmup_url)
    is distinct from p_warmup_resource_key then
    return 'warmup_resource_mismatch';
  end if;

  if p_student_email_hmac is null or btrim(p_student_email_hmac) = '' then
    return 'roster_mismatch';
  end if;

  select period_id, email_hmac, auth_user_id
  into v_student_period_id, v_student_email_hmac, v_student_auth_user_id
  from public.students
  where id = p_student_id
  for update;

  if not found then
    return 'roster_mismatch';
  end if;
  if v_student_period_id is distinct from v_session_period_id
    or v_student_email_hmac is distinct from lower(btrim(p_student_email_hmac)) then
    return 'roster_mismatch';
  end if;
  if v_student_auth_user_id is distinct from p_expected_student_auth_user_id then
    return 'claim_conflict';
  end if;

  update public.students
  set auth_user_id = p_auth_user_id,
      auth_claimed_at = now()
  where id = p_student_id
    and period_id = v_session_period_id
    and email_hmac = lower(btrim(p_student_email_hmac))
    and auth_user_id is not distinct from p_expected_student_auth_user_id;

  if not found then return 'claim_conflict'; end if;

  update public.student_warmup_sessions
  set completed_at = now()
  where verification_token = p_verification_token;

  return 'completed';
end;
$$;

revoke all on function public.bdm_complete_warmup_identity(
  uuid, uuid, text, uuid, text, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.bdm_complete_warmup_identity(
  uuid, uuid, text, uuid, text, uuid, uuid
) to service_role;

-- ---------------------------------------------------------------------------
-- bdm_admit_student_join_request: teacher recovery, now verified by HMAC.
-- Both-null passes on purpose: a hand-added alias-only student (no district
-- email in the Sheet) can still be admitted by the teacher.
-- ---------------------------------------------------------------------------

drop function if exists public.bdm_admit_student_join_request(
  uuid, text, uuid, text, uuid, uuid, text
);

create or replace function public.bdm_admit_student_join_request(
  p_session_id uuid,
  p_request_code text,
  p_student_id uuid,
  p_student_email_hmac text,
  p_auth_user_id uuid,
  p_expected_student_auth_user_id uuid,
  p_display_name text
)
returns table (
  outcome text,
  join_id uuid,
  resolved_student_id uuid,
  resolved_display_name text,
  resolved_joined_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_session public.sessions%rowtype;
  v_student public.students%rowtype;
  v_join public.session_joins%rowtype;
  v_pending public.session_joins%rowtype;
  v_auth_student_id uuid;
begin
  select s.*
  into v_session
  from public.sessions s
  where s.id = p_session_id
  for update;

  if not found or v_session.status <> 'open' then
    return query select 'session_not_open'::text, null::uuid, null::uuid, null::text, null::timestamptz;
    return;
  end if;

  select s.*
  into v_student
  from public.students s
  where s.id = p_student_id
  for update;

  if not found
    or v_student.period_id <> v_session.period_id
    or v_student.email_hmac is distinct from nullif(lower(btrim(coalesce(p_student_email_hmac, ''))), '') then
    return query select 'roster_mismatch'::text, null::uuid, null::uuid, null::text, null::timestamptz;
    return;
  end if;

  select j.*
  into v_join
  from public.session_joins j
  where j.session_id = p_session_id
    and j.student_id = p_student_id
  for update;

  select j.*
  into v_pending
  from public.session_joins j
  where j.session_id = p_session_id
    and j.request_code = upper(btrim(p_request_code))
    and j.student_id is null
  for update;

  if v_pending.id is null then
    return query select 'request_not_found'::text, null::uuid, null::uuid, null::text, null::timestamptz;
    return;
  end if;

  if v_pending.auth_user_id is distinct from p_auth_user_id then
    return query select 'request_conflict'::text, null::uuid, null::uuid, null::text, null::timestamptz;
    return;
  end if;

  if v_join.id is not null and v_join.id <> v_pending.id then
    return query select 'student_already_joined'::text, null::uuid, null::uuid, null::text, null::timestamptz;
    return;
  end if;

  if v_student.auth_user_id is distinct from p_expected_student_auth_user_id then
    return query select 'identity_conflict'::text, null::uuid, null::uuid, null::text, null::timestamptz;
    return;
  end if;

  select s.id
  into v_auth_student_id
  from public.students s
  where s.auth_user_id = p_auth_user_id
    and s.id <> p_student_id
  for update;

  if v_auth_student_id is not null then
    return query select 'auth_conflict'::text, null::uuid, null::uuid, null::text, null::timestamptz;
    return;
  end if;

  update public.students
  set auth_user_id = p_auth_user_id,
      auth_claimed_at = now()
  where id = p_student_id;

  update public.session_joins
  set student_id = p_student_id,
      display_name = p_display_name,
      request_code = null
  where id = v_pending.id
  returning * into v_join;

  return query
  select
    'admitted'::text,
    v_join.id,
    v_join.student_id,
    v_join.display_name,
    v_join.joined_at;
exception
  when unique_violation then
    return query select 'join_conflict'::text, null::uuid, null::uuid, null::text, null::timestamptz;
end;
$$;

revoke all on function public.bdm_admit_student_join_request(uuid, text, uuid, text, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.bdm_admit_student_join_request(uuid, text, uuid, text, uuid, uuid, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- bdm_admit_student_join_request_with_warmup: wrapper, parameter renamed.
-- ---------------------------------------------------------------------------

drop function if exists public.bdm_admit_student_join_request_with_warmup(
  uuid, text, uuid, text, uuid, uuid, text
);

create or replace function public.bdm_admit_student_join_request_with_warmup(
  p_session_id uuid,
  p_request_code text,
  p_student_id uuid,
  p_student_email_hmac text,
  p_auth_user_id uuid,
  p_expected_student_auth_user_id uuid,
  p_display_name text
)
returns table (
  outcome text,
  join_id uuid,
  resolved_student_id uuid,
  resolved_display_name text,
  resolved_joined_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_outcome text;
  v_join_id uuid;
  v_student_id uuid;
  v_display_name text;
  v_joined_at timestamptz;
begin
  select
    result.outcome,
    result.join_id,
    result.resolved_student_id,
    result.resolved_display_name,
    result.resolved_joined_at
  into
    v_outcome,
    v_join_id,
    v_student_id,
    v_display_name,
    v_joined_at
  from public.bdm_admit_student_join_request(
    p_session_id,
    p_request_code,
    p_student_id,
    p_student_email_hmac,
    p_auth_user_id,
    p_expected_student_auth_user_id,
    p_display_name
  ) as result;

  if v_outcome = 'admitted' then
    update public.student_warmup_sessions
    set completed_at = coalesce(completed_at, now())
    where auth_user_id = p_auth_user_id
      and session_id = p_session_id;

    if not found then
      raise exception 'warm-up receipt missing for teacher admission'
        using errcode = 'P0001';
    end if;
  end if;

  return query
  select v_outcome, v_join_id, v_student_id, v_display_name, v_joined_at;
end;
$$;

revoke all on function public.bdm_admit_student_join_request_with_warmup(
  uuid, text, uuid, text, uuid, uuid, text
) from public, anon, authenticated;
grant execute on function public.bdm_admit_student_join_request_with_warmup(
  uuid, text, uuid, text, uuid, uuid, text
) to service_role;

-- ---------------------------------------------------------------------------
-- bdm_delete_unused_roster_student: the guard name is now the alias.
-- (Same signature, so CREATE OR REPLACE is enough.)
-- ---------------------------------------------------------------------------

create or replace function public.bdm_delete_unused_roster_student(
  p_student_id uuid,
  p_expected_name text
)
returns table (
  outcome text,
  deleted_id uuid,
  deleted_name text,
  dependency_counts jsonb
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_student public.students%rowtype;
  v_dependency record;
  v_count bigint;
  v_dependencies jsonb := '{}'::jsonb;
begin
  select s.*
  into v_student
  from public.students s
  where s.id = p_student_id
  for update;

  if not found then
    return query select 'not_found'::text, null::uuid, null::text, '{}'::jsonb;
    return;
  end if;

  if v_student.alias is distinct from p_expected_name then
    return query select 'name_conflict'::text, v_student.id, v_student.alias, '{}'::jsonb;
    return;
  end if;

  if v_student.auth_user_id is not null then
    v_dependencies := v_dependencies || jsonb_build_object('linked identity', 1);
  end if;

  -- recommendations.student_ids is an attribution array rather than a foreign
  -- key. Locking the table closes the insert/update race while it is checked.
  if to_regclass('public.recommendations') is not null then
    execute 'lock table public.recommendations in share row exclusive mode';
  end if;

  for v_dependency in
    select *
    from (values
      ('responses', 'student_id', 'responses', 'scalar'),
      ('mastery', 'student_id', 'mastery records', 'scalar'),
      ('mastery_history', 'student_id', 'mastery history', 'scalar'),
      ('iready_scores', 'student_id', 'i-Ready records', 'scalar'),
      ('session_joins', 'student_id', 'session joins', 'scalar'),
      ('poll_answers', 'student_id', 'poll answers', 'scalar'),
      ('challenge_attempts', 'student_id', 'challenge attempts', 'scalar'),
      ('checkpoint_results', 'student_id', 'checkpoint results', 'scalar'),
      ('practice_assignment_attempts', 'student_id', 'practice attempts', 'scalar'),
      ('exit_ticket_responses', 'student_id', 'exit-ticket responses', 'scalar'),
      ('abbie_questions', 'student_id', 'Abbie questions', 'scalar'),
      ('recommendations', 'student_ids', 'instructional recommendations', 'array')
    ) as dependencies(table_name, column_name, label, match_kind)
  loop
    if to_regclass(format('public.%I', v_dependency.table_name)) is null then
      continue;
    end if;

    if v_dependency.match_kind = 'array' then
      execute format(
        'select count(*) from public.%I where $1 = any(%I)',
        v_dependency.table_name,
        v_dependency.column_name
      ) into v_count using p_student_id;
    else
      execute format(
        'select count(*) from public.%I where %I = $1',
        v_dependency.table_name,
        v_dependency.column_name
      ) into v_count using p_student_id;
    end if;

    if v_count > 0 then
      v_dependencies := v_dependencies || jsonb_build_object(v_dependency.label, v_count);
    end if;
  end loop;

  if jsonb_object_length(v_dependencies) > 0 then
    return query select 'student_has_attribution'::text, v_student.id, v_student.alias, v_dependencies;
    return;
  end if;

  delete from public.students
  where id = v_student.id;

  return query select 'deleted'::text, v_student.id, v_student.alias, '{}'::jsonb;
exception
  when foreign_key_violation then
    return query select 'dependency_conflict'::text, v_student.id, v_student.alias, v_dependencies;
end;
$$;

revoke all on function public.bdm_delete_unused_roster_student(uuid, text)
  from public, anon, authenticated;
grant execute on function public.bdm_delete_unused_roster_student(uuid, text)
  to service_role;

commit;

notify pgrst, 'reload schema';
