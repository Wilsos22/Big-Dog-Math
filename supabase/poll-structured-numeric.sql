-- Structured Numeric: the student fills N numeric boxes laid out as an
-- equation, and the teacher gets a diagnosis from the PATTERN across the boxes
-- rather than a single right/wrong.
--
--     6 x 28 = 6 x ( [ ] + [ ] ) = [ ] + [ ] = [ ]
--
-- There is no single correct answer string - any valid split passes - so the
-- boxes cannot live in `answer`.
--
-- WHY A SEPARATE COLUMN, NOT JSON IN `answer`:
-- poll_answers.answer is EXACT-MATCHED by City Routes in recommendRoute and by
-- the readiness tallies. Writing a JSON array into it would silently break both
-- - no error, just a route recommendation quietly built on garbage. So `answer`
-- keeps a canonical summary string (the final box) and every existing consumer
-- works unchanged, while the structured values land beside it here. Same
-- precedent as poll-explanations.sql.
--
-- Hand-run in the Supabase SQL Editor, like every migration in this folder.
-- Idempotent: safe to run more than once.
--
-- RLS group: poll_answers is already in the permissive prototype group;
-- adding a column changes no policies.

alter table poll_answers add column if not exists values jsonb;

notify pgrst, 'reload schema';
