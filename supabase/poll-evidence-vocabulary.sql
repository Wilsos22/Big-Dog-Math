-- Two misconception tags for factor-pair builds, so poll evidence can cluster.
--
-- RUN THIS BEFORE THE FIRST GRADED FACTOR-PAIR STEP. Until it lands, the two
-- tags below are written into `responses.misconception` and match no seeded
-- row - which does NOT error anywhere. It silently loses the domain, so the
-- i-Ready corroboration in /api/live/groups goes to zero and any teacher move
-- authored against the tag renders blank. The cluster still appears on
-- /teacher/rightnow, just uncorroborated and unplanned. That is the exact
-- failure mode `src/lib/misconceptions.ts` was written to prevent, so the
-- vocabulary and this seed have to move together.
--
-- These same two rows are also in `supabase/proficiency.sql` (the canonical
-- seed that `npm run test:misconceptions` reads). This file exists only so you
-- can run four lines instead of re-running that whole file. Running BOTH is
-- harmless - `on conflict (label) do nothing`.
--
-- Why two tags and not one: a student who INVENTS a pair (4x4 for 18) is
-- generating by pattern without checking the product; a student who merely
-- STOPS EARLY is checking correctly but not searching exhaustively. Same wrong
-- answer count, different next move, so they must never collapse.

insert into misconceptions (label, standard_id, description) values
  ('lists a non-factor pair',          '6.NS.B.4', 'Builds a pair that does not multiply to the target, e.g. 4x4 for 18. The student is generating pairs by pattern rather than checking the product, so the count may even be complete while the list is wrong.'),
  ('stops before all pairs are found', '6.NS.B.4', 'Every pair listed is valid, but the list is short - usually stopping at the pairs recalled from a times table rather than testing upward to the square root. Different move from an invented pair: the checking is sound, the search was not exhaustive.')
on conflict (label) do nothing;

notify pgrst, 'reload schema';
