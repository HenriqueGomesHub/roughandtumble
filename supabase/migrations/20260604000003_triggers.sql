-- ============================================================
-- Triggers
-- ============================================================

-- ── updated_at helper ────────────────────────────────────────
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER picks_updated_at
  BEFORE UPDATE ON picks
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER games_updated_at
  BEFORE UPDATE ON games
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER bracket_matchups_updated_at
  BEFORE UPDATE ON bracket_matchups
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER standings_cache_updated_at
  BEFORE UPDATE ON standings_cache
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ── vote-count trigger ────────────────────────────────────────
-- Keeps voting_sessions.home_votes / away_votes / total_votes
-- in sync after every picks INSERT / UPDATE / DELETE.
-- Raw picks are never exposed to clients — only the aggregate row.
CREATE OR REPLACE FUNCTION update_vote_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session_id uuid;
BEGIN
  v_session_id := COALESCE(NEW.session_id, OLD.session_id);

  UPDATE voting_sessions SET
    home_votes  = (
      SELECT COUNT(*) FROM picks pk
      JOIN games g ON g.id = pk.game_id
      WHERE pk.session_id = v_session_id
        AND pk.picked_team_id = g.home_team_id
    ),
    away_votes  = (
      SELECT COUNT(*) FROM picks pk
      JOIN games g ON g.id = pk.game_id
      WHERE pk.session_id = v_session_id
        AND pk.picked_team_id = g.away_team_id
    ),
    total_votes = (
      SELECT COUNT(*) FROM picks
      WHERE session_id = v_session_id
    )
  WHERE id = v_session_id;

  RETURN NULL; -- AFTER trigger; return value is ignored
END;
$$;

CREATE TRIGGER picks_vote_counts
  AFTER INSERT OR UPDATE OR DELETE ON picks
  FOR EACH ROW EXECUTE FUNCTION update_vote_counts();
