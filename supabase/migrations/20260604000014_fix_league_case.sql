-- ============================================================
-- Fix league casing mismatch
-- ============================================================
-- The dev seed originally inserted the season with league 'wnba' (lowercase),
-- but the poll-espn Edge Function looks up the active season by 'WNBA' and
-- writes games/standings with 'WNBA'. The mismatch made the poller bail out
-- with "no active season" and never fetch any games.
--
-- Normalize any existing season league to uppercase so the poller matches.
-- Idempotent: safe to run repeatedly.

UPDATE seasons
SET league = upper(league)
WHERE league <> upper(league);
