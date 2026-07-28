-- Per-attempt detail for manipulative-tool evidence.
--
-- WHY: right now a student who places one split line and stops is
-- indistinguishable from one who tried three different splits and confirmed
-- all three give the same total. They are not the same student, and the second
-- one is the one who got the idea.
--
-- The field that nothing else in the system can see is DISTINCT SPLITS TRIED
-- for the same problem. It is what makes the exit ticket readable: a student
-- who only ever cuts at the ten in the tool and then cuts at the ten on the
-- exit has shown a habit, not flexibility - and no single response reveals
-- that.
--
-- Nullable and additive: every existing consumer of `responses` ignores it,
-- and evidence written before this migration simply has no detail.
--
-- Hand-run in the Supabase SQL Editor, like every migration in this folder.
-- Idempotent: safe to run more than once.

alter table responses add column if not exists detail jsonb;

notify pgrst, 'reload schema';
