-- ============================================================
-- Deduplicate active seasons
-- ============================================================
-- The dev seed ran more than once, leaving multiple is_active seasons for the
-- same league. The poller selects the active season as a single row, so more
-- than one match made it fail with "no active season" and fetch nothing.
--
-- Keep the earliest-created active season per league (the one prizes are tied
-- to) and deactivate the rest. Idempotent: safe to run repeatedly.

WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY league ORDER BY created_at) AS rn
  FROM seasons
  WHERE is_active
)
UPDATE seasons s
SET is_active = false
FROM ranked r
WHERE s.id = r.id
  AND r.rn > 1;
