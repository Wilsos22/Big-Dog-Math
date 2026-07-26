-- Big Dog Math - MOCK CLASSROOM seed (fully fictional, safe to run and re-run).
--
-- Purpose: give you a class to practice-drive on after the end-of-year wipe -
-- a fake roster plus a realistic spread of warm-up submissions so every
-- teacher dashboard has something real-looking to show:
--   /teacher/mastery   - the four EWMA bars per student (click Recompute)
--   /teacher/rightnow  - live misconception clusters + archetypes + i-Ready corroboration
--   /teacher/analytics - period rollups
--
-- EVERY identity here is invented. Names follow the vetted fictional set
-- (first initial = last initial) and sit on the reserved .example domain, which
-- can never resolve to a real inbox. Before trusting it, eyeball the roster in
-- Part A against your real students - the last "mock" dataset secretly carried
-- real names, so verify, do not assume.
--
-- HOW TO RUN: Supabase - SQL Editor - New query - paste this whole file - Run.
--   Then open /teacher/mastery, pick "BDM Mock Class", and click Recompute.
-- Idempotent: re-running replaces the mock evidence and never duplicates rows.
-- It targets ONLY the "BDM Mock Class" period, so real classes are untouched.
--
-- City Routes is NOT seeded here: it reads the CURRENT session's live poll
-- answers, not this warm-up history. To see it, run a live mock session with
-- this roster (the fake students answer the poll questions in the moment).
--
-- TO WIPE later, run the three statements at the very bottom of this file.

begin;

-- Make sure the class_code column exists (added by period-class-codes.sql).
alter table periods add column if not exists class_code text;

-- ── Part A: the mock class + fictional roster ───────────────────────────────
insert into periods (name, sort_order)
select 'BDM Mock Class', 99
where not exists (select 1 from periods where name = 'BDM Mock Class');

-- Give it the MOCK class code, but only if nothing else already owns that code.
update periods
   set class_code = 'MOCK'
 where name = 'BDM Mock Class'
   and coalesce(class_code, '') <> 'MOCK'
   and not exists (
     select 1 from periods
     where name <> 'BDM Mock Class' and upper(class_code) = 'MOCK'
   );

insert into students (period_id, full_name, email)
select p.id, r.full_name, r.email
from periods p
join ( values
  ('Ada Acosta',     'ada.acosta@mock.bigdogmath.example'),
  ('Ben Beckett',    'ben.beckett@mock.bigdogmath.example'),
  ('Cora Calloway',  'cora.calloway@mock.bigdogmath.example'),
  ('Diego Delgado',  'diego.delgado@mock.bigdogmath.example'),
  ('Esme Everhart',  'esme.everhart@mock.bigdogmath.example'),
  ('Finn Fairbanks', 'finn.fairbanks@mock.bigdogmath.example'),
  ('Greta Guzman',   'greta.guzman@mock.bigdogmath.example'),
  ('Hana Holloway',  'hana.holloway@mock.bigdogmath.example'),
  ('Ivan Ishikawa',  'ivan.ishikawa@mock.bigdogmath.example'),
  ('Jade Juniper',   'jade.juniper@mock.bigdogmath.example'),
  ('Kai Kensington', 'kai.kensington@mock.bigdogmath.example')
) as r(full_name, email) on true
where p.name = 'BDM Mock Class'
  and not exists (select 1 from students s where s.email = r.email);

-- ── Part B: i-Ready Fall baselines ──────────────────────────────────────────
-- Initializes each mastery bar and drives the "i-Ready agrees" corroboration on
-- the Right-now clusters. Struggling domains read below grade (scale < ~561),
-- strong domains read above. scaleToMastery = clamp((scale-480)/180*100, 5, 98).
delete from iready_scores
 where student_id in (
   select id from students
   where period_id = (select id from periods where name = 'BDM Mock Class')
 );

insert into iready_scores (student_id, "window", domain, scale_score)
select s.id, 'Fall', ir.domain, ir.scale
from students s
join ( values
  -- email, domain, Fall scale score
  ('ada.acosta@mock.bigdogmath.example',   'Number and Operations',          625),
  ('ada.acosta@mock.bigdogmath.example',   'Algebra and Algebraic Thinking', 620),
  ('ada.acosta@mock.bigdogmath.example',   'Measurement and Data',           600),
  ('ada.acosta@mock.bigdogmath.example',   'Geometry',                       620),

  ('ben.beckett@mock.bigdogmath.example',  'Number and Operations',          515),
  ('ben.beckett@mock.bigdogmath.example',  'Algebra and Algebraic Thinking', 600),
  ('ben.beckett@mock.bigdogmath.example',  'Measurement and Data',           600),
  ('ben.beckett@mock.bigdogmath.example',  'Geometry',                       605),

  ('cora.calloway@mock.bigdogmath.example','Number and Operations',          525),
  ('cora.calloway@mock.bigdogmath.example','Algebra and Algebraic Thinking', 600),
  ('cora.calloway@mock.bigdogmath.example','Measurement and Data',           590),
  ('cora.calloway@mock.bigdogmath.example','Geometry',                       605),

  ('diego.delgado@mock.bigdogmath.example','Number and Operations',          515),
  ('diego.delgado@mock.bigdogmath.example','Algebra and Algebraic Thinking', 590),
  ('diego.delgado@mock.bigdogmath.example','Measurement and Data',           600),
  ('diego.delgado@mock.bigdogmath.example','Geometry',                       590),

  ('esme.everhart@mock.bigdogmath.example','Number and Operations',          600),
  ('esme.everhart@mock.bigdogmath.example','Algebra and Algebraic Thinking', 515),
  ('esme.everhart@mock.bigdogmath.example','Measurement and Data',           600),
  ('esme.everhart@mock.bigdogmath.example','Geometry',                       600),

  ('finn.fairbanks@mock.bigdogmath.example','Number and Operations',          590),
  ('finn.fairbanks@mock.bigdogmath.example','Algebra and Algebraic Thinking', 530),
  ('finn.fairbanks@mock.bigdogmath.example','Measurement and Data',           590),
  ('finn.fairbanks@mock.bigdogmath.example','Geometry',                       605),

  ('greta.guzman@mock.bigdogmath.example', 'Number and Operations',          600),
  ('greta.guzman@mock.bigdogmath.example', 'Algebra and Algebraic Thinking', 515),
  ('greta.guzman@mock.bigdogmath.example', 'Measurement and Data',           600),
  ('greta.guzman@mock.bigdogmath.example', 'Geometry',                       590),

  ('hana.holloway@mock.bigdogmath.example','Number and Operations',          600),
  ('hana.holloway@mock.bigdogmath.example','Algebra and Algebraic Thinking', 590),
  ('hana.holloway@mock.bigdogmath.example','Measurement and Data',           525),
  ('hana.holloway@mock.bigdogmath.example','Geometry',                       515),

  ('ivan.ishikawa@mock.bigdogmath.example','Number and Operations',          590),
  ('ivan.ishikawa@mock.bigdogmath.example','Algebra and Algebraic Thinking', 600),
  ('ivan.ishikawa@mock.bigdogmath.example','Measurement and Data',           515),
  ('ivan.ishikawa@mock.bigdogmath.example','Geometry',                       525)
) as ir(email, domain, scale) on ir.email = s.email
where s.period_id = (select id from periods where name = 'BDM Mock Class');

commit;

-- ── Part C: warm-up submission history ──────────────────────────────────────
-- Six warm-up days spread over ~3 weeks. Each row is a domain-level aggregate
-- (standard_id left null) carrying the day's 0-5 score and, on a low day, the
-- day's misconception tag from the finite vocabulary. That single shape feeds
-- BOTH the mastery bars (recompute) and the Right-now grouping (which counts
-- exactly the null-standard rows). Scores and trends are chosen to produce a
-- realistic mix of archetypes and shared misconception clusters:
--   Number and Operations   - Ben / Cora / Diego cluster on "treats ratio as additive"
--   Algebra                 - Esme / Finn / Greta cluster on "distributes to first term only"
--   Geometry                - Hana / Ivan cluster on "confuses area vs perimeter"
--   Measurement and Data    - Hana / Ivan cluster on "confuses mean and median"
--   Jade / Kai              - never submit (they surface as non-submitters)
do $$
declare
  v_period uuid;
  v_rec    record;
  v_day    int;
  v_at     timestamptz;
  v_score  int;
  v_miss   text;
begin
  select id into v_period from periods where name = 'BDM Mock Class';
  if v_period is null then
    raise notice 'BDM Mock Class not found - run Part A first.';
    return;
  end if;

  -- Idempotent: clear any prior mock evidence for these students, then rebuild.
  delete from responses
   where dedupe_key like 'mock-%'
     and student_id in (select id from students where period_id = v_period);

  for v_rec in
    select s.id as student_id, prof.domain, prof.base, prof.trend, prof.miss_tag
    from students s
    join ( values
      -- email, domain, base score (0-5), trend per day, misconception on a low day
      ('ada.acosta@mock.bigdogmath.example',    'Number and Operations',          5, 0.0, null::text),
      ('ada.acosta@mock.bigdogmath.example',    'Algebra and Algebraic Thinking', 5, 0.0, null),
      ('ada.acosta@mock.bigdogmath.example',    'Measurement and Data',           4, 0.0, null),
      ('ada.acosta@mock.bigdogmath.example',    'Geometry',                       5, 0.0, null),

      ('ben.beckett@mock.bigdogmath.example',   'Number and Operations',          1, 0.0, 'treats ratio as additive'),
      ('ben.beckett@mock.bigdogmath.example',   'Algebra and Algebraic Thinking', 4, 0.0, null),
      ('ben.beckett@mock.bigdogmath.example',   'Measurement and Data',           4, 0.0, null),
      ('ben.beckett@mock.bigdogmath.example',   'Geometry',                       4, 0.0, null),

      ('cora.calloway@mock.bigdogmath.example', 'Number and Operations',          2, 0.0, 'treats ratio as additive'),
      ('cora.calloway@mock.bigdogmath.example', 'Algebra and Algebraic Thinking', 4, 0.0, null),
      ('cora.calloway@mock.bigdogmath.example', 'Measurement and Data',           3, 0.0, null),
      ('cora.calloway@mock.bigdogmath.example', 'Geometry',                       4, 0.0, null),

      ('diego.delgado@mock.bigdogmath.example', 'Number and Operations',          1, 0.4, 'treats ratio as additive'),
      ('diego.delgado@mock.bigdogmath.example', 'Algebra and Algebraic Thinking', 3, 0.0, null),
      ('diego.delgado@mock.bigdogmath.example', 'Measurement and Data',           4, 0.0, null),
      ('diego.delgado@mock.bigdogmath.example', 'Geometry',                       3, 0.0, null),

      ('esme.everhart@mock.bigdogmath.example', 'Number and Operations',          4, 0.0, null),
      ('esme.everhart@mock.bigdogmath.example', 'Algebra and Algebraic Thinking', 1, 0.8, 'distributes to first term only'),
      ('esme.everhart@mock.bigdogmath.example', 'Measurement and Data',           4, 0.0, null),
      ('esme.everhart@mock.bigdogmath.example', 'Geometry',                       4, 0.0, null),

      ('finn.fairbanks@mock.bigdogmath.example','Number and Operations',          3, 0.0, null),
      ('finn.fairbanks@mock.bigdogmath.example','Algebra and Algebraic Thinking', 2, 0.0, 'distributes to first term only'),
      ('finn.fairbanks@mock.bigdogmath.example','Measurement and Data',           3, 0.0, null),
      ('finn.fairbanks@mock.bigdogmath.example','Geometry',                       4, 0.0, null),

      ('greta.guzman@mock.bigdogmath.example',  'Number and Operations',          4, 0.0, null),
      ('greta.guzman@mock.bigdogmath.example',  'Algebra and Algebraic Thinking', 1, 0.0, 'distributes to first term only'),
      ('greta.guzman@mock.bigdogmath.example',  'Measurement and Data',           4, 0.0, null),
      ('greta.guzman@mock.bigdogmath.example',  'Geometry',                       3, 0.0, null),

      ('hana.holloway@mock.bigdogmath.example', 'Number and Operations',          4, 0.0, null),
      ('hana.holloway@mock.bigdogmath.example', 'Algebra and Algebraic Thinking', 3, 0.0, null),
      ('hana.holloway@mock.bigdogmath.example', 'Measurement and Data',           2, 0.0, 'confuses mean and median'),
      ('hana.holloway@mock.bigdogmath.example', 'Geometry',                       1, 0.0, 'confuses area vs perimeter'),

      ('ivan.ishikawa@mock.bigdogmath.example', 'Number and Operations',          3, 0.0, null),
      ('ivan.ishikawa@mock.bigdogmath.example', 'Algebra and Algebraic Thinking', 4, 0.0, null),
      ('ivan.ishikawa@mock.bigdogmath.example', 'Measurement and Data',           1, 0.6, 'confuses mean and median'),
      ('ivan.ishikawa@mock.bigdogmath.example', 'Geometry',                       2, 0.0, 'confuses area vs perimeter')
    ) as prof(email, domain, base, trend, miss_tag) on prof.email = s.email
    where s.period_id = v_period
  loop
    for v_day in 0..5 loop
      v_at := (current_date - (18 - v_day * 3))::timestamptz + interval '9 hours 15 minutes';
      v_score := greatest(0, least(5, round(v_rec.base + v_rec.trend * v_day)))::int;
      v_miss  := case when v_score <= 2 then v_rec.miss_tag else null end;
      insert into responses
        (student_id, source, domain, standard_id, score, is_correct, misconception, submitted_at, dedupe_key)
      values
        (v_rec.student_id, 'warmup', v_rec.domain, null, v_score, (v_score >= 3), v_miss, v_at,
         'mock-' || v_rec.student_id::text || '-' || left(v_rec.domain, 3) || '-' || v_day::text);
    end loop;
  end loop;

  raise notice 'Seeded mock warm-up responses for BDM Mock Class (%).', v_period;
end $$;

notify pgrst, 'reload schema';

-- ── TO WIPE this mock class entirely, run these three statements ─────────────
-- (children cascade from students/periods; iready + responses go first to be safe):
--   delete from responses    where dedupe_key like 'mock-%';
--   delete from iready_scores where student_id in (select id from students where period_id = (select id from periods where name = 'BDM Mock Class'));
--   delete from periods       where name = 'BDM Mock Class';   -- cascades students, sessions, etc.
