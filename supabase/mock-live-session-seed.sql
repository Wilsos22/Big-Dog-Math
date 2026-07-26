-- Big Dog Math - MOCK LIVE SESSION seed (City Routes / park routes demo).
--
-- Companion to mock-classroom-seed.sql - RUN THAT FIRST (it creates the
-- BDM Mock Class period and the fictional roster this file joins).
--
-- City Routes reads the CURRENT session's live poll answers, not the warm-up
-- history, so it only comes alive inside a live session. This stands one up:
-- an open "live-flow" session for the mock class with a two-question readiness
-- check plus a fist-to-five, the roster joined, and each student's answers set
-- so the class spreads across all three routes:
--   Independent (both correct): Ada, Esme, and Jade (Jade fist 1 -> low-confidence flag)
--   Scaffolded partner (one correct): Cora, Diego, Finn, Ivan
--   Teacher-guided (none correct): Ben, Greta, Hana
--   Needs assignment (joined, never answered): Kai
--
-- HOW TO SEE IT: run this, then open /teacher/remote, pick "BDM Mock Class",
-- and look at the City Routes panel - recommended routes appear immediately.
-- (Broadcast is "live-flow" so the session lists in the Remote; harmless with
-- no real student devices following it.)
--
-- Idempotent: re-running replaces the seeded live session (its polls, joins,
-- and answers cascade away first). Scoped to the mock period only.
--
-- TO WIPE, just delete the session (children cascade):
--   delete from sessions where join_code = 'MOCKLV'
--     and period_id = (select id from periods where name = 'BDM Mock Class');

do $$
declare
  v_period  uuid;
  v_session uuid;
  v_q1      uuid;
  v_q2      uuid;
  v_fist    uuid;
  v_flow    jsonb := $flow${"version":2,"updatedAt":"2026-07-26T03:57:36.618Z","state":{"id":"independent","label":"Work time","description":"Head to your park and start.","color":"#674a40","semantic":"independent"},"phase":null,"timer":null,"poll":null,"resource":null,"presentation":null,"tool":null,"lesson":{"id":null,"code":"MOCK-D1","title":"Ratio Tables and Equivalent Ratios (Mock)","learningIntention":"I can build equivalent ratios using a ratio table.","successCriteria":"I can scale a ratio up and down to find equivalent ratios.","selectedSuccessCriterion":"I can scale a ratio up and down to find equivalent ratios.","classroomMode":"We Do","discussionStems":[],"discussionVocabulary":[],"requiredPaperWork":"Ratio table practice set.","requiredDigitalWork":"","optionalSupport":"","bigDogChallenge":"","dueAndTurnIn":"","helpPath":"","anchorProblem":"","agenda":"Warm-up\nReadiness check\nRatio tables in your park route\nExit ticket","reminders":""},"sequence":{"currentIndex":3,"totalSteps":5,"nextLabel":"Work time","nextDirections":"Head to your park and start.","advanceMode":"manual","steps":[{"stateId":"warmup","label":"Warm-up","description":"Five quick questions to start.","color":"#8a6d3b","semantic":"evergreen","durationSeconds":300,"question":"","pollKind":null,"choices":[],"correctAnswer":"","standard":"6.RP.A.3","resourceUrl":"","paperTask":"","notionStepId":null,"notionLessonId":null,"lessonCode":"MOCK-D1"},{"stateId":"question","label":"Readiness 1","description":"Show what you know.","color":"#35785a","semantic":"learning-check","durationSeconds":300,"question":"A recipe uses 2 cups of flour for every 3 cups of sugar. How much sugar goes with 8 cups of flour?","pollKind":"multiple-choice","choices":["12","10","9","7"],"correctAnswer":"12","standard":"6.RP.A.3","resourceUrl":"","paperTask":"","notionStepId":null,"notionLessonId":null,"lessonCode":"MOCK-D1","responseMode":"Multiple Choice"},{"stateId":"question","label":"Readiness 2","description":"Show what you know.","color":"#35785a","semantic":"learning-check","durationSeconds":300,"question":"Which ratio is equivalent to 4:6?","pollKind":"multiple-choice","choices":["2:3","6:4","8:10","3:4"],"correctAnswer":"2:3","standard":"6.RP.A.3","resourceUrl":"","paperTask":"","notionStepId":null,"notionLessonId":null,"lessonCode":"MOCK-D1","responseMode":"Multiple Choice"},{"stateId":"learning-check","label":"Confidence check","description":"Rate how ready you feel.","color":"#50a3a4","semantic":"learning-check","durationSeconds":300,"question":"Fist to five: how ready do you feel to build ratio tables on your own?","pollKind":"fist-to-five","choices":[],"correctAnswer":"","standard":"6.RP.A.3","resourceUrl":"","paperTask":"","notionStepId":null,"notionLessonId":null,"lessonCode":"MOCK-D1"},{"stateId":"independent","label":"Work time","description":"Head to your park and start.","color":"#674a40","semantic":"independent","durationSeconds":300,"question":"","pollKind":null,"choices":[],"correctAnswer":"","standard":"6.RP.A.3","resourceUrl":"","paperTask":"","notionStepId":null,"notionLessonId":null,"lessonCode":"MOCK-D1"}]}}$flow$::jsonb;
begin
  select id into v_period from periods where name = 'BDM Mock Class';
  if v_period is null then
    raise notice 'BDM Mock Class not found - run mock-classroom-seed.sql first.';
    return;
  end if;

  -- Idempotent: drop any prior seeded live session (cascades polls/joins/answers).
  delete from sessions where period_id = v_period and join_code = 'MOCKLV';

  insert into sessions (period_id, join_code, status, broadcast, live_flow, started_at)
  values (v_period, 'MOCKLV', 'open', 'live-flow', v_flow, now())
  returning id into v_session;

  insert into polls (session_id, question, choices, kind, status)
  values (v_session, 'A recipe uses 2 cups of flour for every 3 cups of sugar. How much sugar goes with 8 cups of flour?', '["12","10","9","7"]'::jsonb, 'multiple-choice', 'closed')
  returning id into v_q1;

  insert into polls (session_id, question, choices, kind, status)
  values (v_session, 'Which ratio is equivalent to 4:6?', '["2:3","6:4","8:10","3:4"]'::jsonb, 'multiple-choice', 'closed')
  returning id into v_q2;

  insert into polls (session_id, question, choices, kind, status)
  values (v_session, 'Fist to five: how ready do you feel to build ratio tables on your own?', null, 'fist-to-five', 'closed')
  returning id into v_fist;

  -- Everyone in the room (Kai joins but never answers).
  insert into session_joins (session_id, student_id, display_name)
  select v_session, s.id, s.full_name
  from students s
  where s.period_id = v_period
    and s.email in (
    'ada.acosta@mock.bigdogmath.example',
    'esme.everhart@mock.bigdogmath.example',
    'jade.juniper@mock.bigdogmath.example',
    'cora.calloway@mock.bigdogmath.example',
    'diego.delgado@mock.bigdogmath.example',
    'finn.fairbanks@mock.bigdogmath.example',
    'ivan.ishikawa@mock.bigdogmath.example',
    'ben.beckett@mock.bigdogmath.example',
    'greta.guzman@mock.bigdogmath.example',
    'hana.holloway@mock.bigdogmath.example',
    'kai.kensington@mock.bigdogmath.example'
    );

  -- Each student's readiness answers.
  insert into poll_answers (poll_id, student_id, display_name, answer)
  select case ans.q when 'q1' then v_q1 when 'q2' then v_q2 else v_fist end,
         s.id, s.full_name, ans.answer
  from students s
  join ( values
    ('ada.acosta@mock.bigdogmath.example', 'q1', '12'),
    ('ada.acosta@mock.bigdogmath.example', 'q2', '2:3'),
    ('ada.acosta@mock.bigdogmath.example', 'fist', '5'),
    ('esme.everhart@mock.bigdogmath.example', 'q1', '12'),
    ('esme.everhart@mock.bigdogmath.example', 'q2', '2:3'),
    ('esme.everhart@mock.bigdogmath.example', 'fist', '4'),
    ('jade.juniper@mock.bigdogmath.example', 'q1', '12'),
    ('jade.juniper@mock.bigdogmath.example', 'q2', '2:3'),
    ('jade.juniper@mock.bigdogmath.example', 'fist', '1'),
    ('cora.calloway@mock.bigdogmath.example', 'q1', '12'),
    ('cora.calloway@mock.bigdogmath.example', 'q2', '6:4'),
    ('cora.calloway@mock.bigdogmath.example', 'fist', '3'),
    ('diego.delgado@mock.bigdogmath.example', 'q1', '10'),
    ('diego.delgado@mock.bigdogmath.example', 'q2', '2:3'),
    ('diego.delgado@mock.bigdogmath.example', 'fist', '3'),
    ('finn.fairbanks@mock.bigdogmath.example', 'q1', '12'),
    ('finn.fairbanks@mock.bigdogmath.example', 'q2', '3:4'),
    ('finn.fairbanks@mock.bigdogmath.example', 'fist', '4'),
    ('ivan.ishikawa@mock.bigdogmath.example', 'q1', '9'),
    ('ivan.ishikawa@mock.bigdogmath.example', 'q2', '2:3'),
    ('ivan.ishikawa@mock.bigdogmath.example', 'fist', '2'),
    ('ben.beckett@mock.bigdogmath.example', 'q1', '10'),
    ('ben.beckett@mock.bigdogmath.example', 'q2', '6:4'),
    ('ben.beckett@mock.bigdogmath.example', 'fist', '2'),
    ('greta.guzman@mock.bigdogmath.example', 'q1', '7'),
    ('greta.guzman@mock.bigdogmath.example', 'q2', '8:10'),
    ('greta.guzman@mock.bigdogmath.example', 'fist', '3'),
    ('hana.holloway@mock.bigdogmath.example', 'q1', '9'),
    ('hana.holloway@mock.bigdogmath.example', 'q2', '3:4'),
    ('hana.holloway@mock.bigdogmath.example', 'fist', '1')
  ) as ans(email, q, answer) on ans.email = s.email
  where s.period_id = v_period;

  raise notice 'Seeded mock live session % (join code MOCKLV) for City Routes.', v_session;
end $$;

notify pgrst, 'reload schema';
