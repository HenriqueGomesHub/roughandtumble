-- ============================================================
-- Views
-- Owned by postgres (superuser) so they bypass RLS on
-- point_events and return all users' data for leaderboards.
-- ============================================================

-- ── season_leaderboard ────────────────────────────────────────
CREATE VIEW season_leaderboard AS
WITH agg AS (
  SELECT
    p.id,
    p.display_name,
    p.current_streak,
    p.best_streak,
    p.total_wins,
    COALESCE(SUM(pe.points), 0)::int           AS total_points,
    COUNT(pe.id) FILTER (WHERE pe.type = 'win')::int AS wins,
    MAX(pe.created_at)                          AS last_event_at
  FROM profiles p
  LEFT JOIN point_events pe
    ON pe.user_id  = p.id
   AND pe.season_id = (SELECT id FROM seasons WHERE is_active LIMIT 1)
  GROUP BY p.id, p.display_name, p.current_streak, p.best_streak, p.total_wins
)
SELECT
  *,
  RANK() OVER (
    ORDER BY total_points DESC, wins DESC, last_event_at ASC NULLS LAST
  )::int AS rank
FROM agg;

-- ── weekly_leaderboard ────────────────────────────────────────
CREATE VIEW weekly_leaderboard AS
WITH agg AS (
  SELECT
    p.id,
    p.display_name,
    p.current_streak,
    p.best_streak,
    p.total_wins,
    COALESCE(SUM(pe.points), 0)::int           AS total_points,
    COUNT(pe.id) FILTER (WHERE pe.type = 'win')::int AS wins,
    MAX(pe.created_at)                          AS last_event_at
  FROM profiles p
  LEFT JOIN point_events pe
    ON pe.user_id   = p.id
   AND pe.season_id = (SELECT id FROM seasons WHERE is_active LIMIT 1)
   AND pe.created_at >= now() - INTERVAL '7 days'
  GROUP BY p.id, p.display_name, p.current_streak, p.best_streak, p.total_wins
)
SELECT
  *,
  RANK() OVER (
    ORDER BY total_points DESC, wins DESC, last_event_at ASC NULLS LAST
  )::int AS rank
FROM agg;

-- ── attendance ────────────────────────────────────────────────
-- Counts distinct LA-timezone calendar days on which the user
-- made ≥1 pick (the "participation day" signal from §3).
CREATE VIEW attendance AS
SELECT
  pk.user_id,
  g.season_id,
  COUNT(
    DISTINCT date(pk.created_at AT TIME ZONE 'America/Los_Angeles')
  ) AS parties_attended
FROM picks pk
JOIN games g ON g.id = pk.game_id
GROUP BY pk.user_id, g.season_id;
