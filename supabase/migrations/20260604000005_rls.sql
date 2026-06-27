-- ============================================================
-- Row-Level Security
-- ============================================================

-- ── profiles ─────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read all profiles"
  ON profiles FOR SELECT TO authenticated
  USING (true);

-- Owner may update their own row.
-- WITH CHECK prevents self-escalation of is_admin:
--   non-admins cannot set is_admin = true;
--   admins keep is_admin = true.
-- Service-role bypasses RLS entirely and sets is_admin directly.
CREATE POLICY "owner update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND (
      NOT is_admin
      OR (SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid() LIMIT 1)
    )
  );

-- ── seasons ───────────────────────────────────────────────────
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read seasons"
  ON seasons FOR SELECT USING (true);

-- ── games ─────────────────────────────────────────────────────
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read games"
  ON games FOR SELECT USING (true);

-- ── voting_sessions ───────────────────────────────────────────
ALTER TABLE voting_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read voting_sessions"
  ON voting_sessions FOR SELECT USING (true);

-- ── picks ─────────────────────────────────────────────────────
ALTER TABLE picks ENABLE ROW LEVEL SECURITY;

-- Clients only read their own picks (to show current selection).
-- Writes go through submit_pick RPC (SECURITY DEFINER).
CREATE POLICY "owner read own picks"
  ON picks FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ── point_events ─────────────────────────────────────────────
ALTER TABLE point_events ENABLE ROW LEVEL SECURITY;

-- All authenticated users can SELECT (leaderboard is public).
-- The intended path is via the season/weekly_leaderboard views,
-- but direct queries are harmless—points are public information.
-- Writes are service-role only (settle-session Edge Function).
CREATE POLICY "authenticated read point_events"
  ON point_events FOR SELECT TO authenticated
  USING (true);

-- ── bracket_matchups ──────────────────────────────────────────
ALTER TABLE bracket_matchups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read bracket_matchups"
  ON bracket_matchups FOR SELECT USING (true);

-- ── prizes ────────────────────────────────────────────────────
ALTER TABLE prizes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read prizes"
  ON prizes FOR SELECT USING (true);

-- ── app_config ────────────────────────────────────────────────
-- No SELECT policy = no client access.
-- Only service-role (bypasses RLS) can read/write.
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- ── standings_cache ───────────────────────────────────────────
ALTER TABLE standings_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read standings_cache"
  ON standings_cache FOR SELECT USING (true);
