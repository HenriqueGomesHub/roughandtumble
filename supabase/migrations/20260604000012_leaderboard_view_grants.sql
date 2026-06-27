-- season_leaderboard and weekly_leaderboard are postgres-owned views that
-- bypass RLS on the underlying tables.  Both anon and authenticated roles
-- need SELECT so the leaderboard page works without requiring a login.
GRANT SELECT ON season_leaderboard TO anon, authenticated;
GRANT SELECT ON weekly_leaderboard TO anon, authenticated;
