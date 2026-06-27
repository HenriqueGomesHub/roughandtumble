-- ============================================================
-- settle_session()
-- ============================================================
-- Awards points for every pick in a closed session.
-- Idempotency: session is locked with FOR UPDATE; if status is
-- already 'settled' the function returns early.  point_events
-- INSERT uses ON CONFLICT DO NOTHING as a last-resort guard.
--
-- Point schedule (hardcoded; move to app_config if needed):
--   participation:  5 pts  — once per calendar day (Pacific time)
--   win:           10 pts  — picked the winning team
--   streak_bonus:   5 pts  — 3+ consecutive wins
-- ============================================================

CREATE OR REPLACE FUNCTION settle_session(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session    voting_sessions%ROWTYPE;
  v_game       games%ROWTYPE;
  v_season_id  uuid;
  v_pick       picks%ROWTYPE;
  v_cur_streak int;
  v_new_streak int;
  v_is_correct boolean;
  v_has_part   boolean;
  v_pts        int;
  v_settled    int := 0;

  WIN_PTS    CONSTANT int := 10;
  PART_PTS   CONSTANT int := 5;
  STREAK_PTS CONSTANT int := 5;
BEGIN
  -- Lock row to prevent concurrent settlements.
  SELECT * INTO v_session
  FROM voting_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'session_not_found');
  END IF;

  IF v_session.status = 'settled' THEN
    RETURN jsonb_build_object('error', 'already_settled');
  END IF;

  IF v_session.status = 'cancelled' THEN
    RETURN jsonb_build_object('error', 'session_cancelled');
  END IF;

  -- Game must have a declared winner before we can settle.
  SELECT * INTO v_game FROM games WHERE id = v_session.game_id;

  IF v_game.winner_team_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_winner_set');
  END IF;

  v_season_id := v_game.season_id;

  -- ── Per-pick processing ──────────────────────────────────────
  FOR v_pick IN
    SELECT * FROM picks WHERE session_id = p_session_id
  LOOP
    v_is_correct := (v_pick.picked_team_id = v_game.winner_team_id);

    SELECT current_streak INTO v_cur_streak FROM profiles WHERE id = v_pick.user_id;
    v_new_streak := CASE WHEN v_is_correct THEN v_cur_streak + 1 ELSE 0 END;

    v_pts := 0;

    -- Participation: once per calendar day in Pacific time.
    SELECT EXISTS (
      SELECT 1 FROM point_events
      WHERE user_id    = v_pick.user_id
        AND season_id  = v_season_id
        AND type       = 'participation'
        AND session_id <> p_session_id
        AND (created_at AT TIME ZONE 'America/Los_Angeles')::date
            = (now() AT TIME ZONE 'America/Los_Angeles')::date
    ) INTO v_has_part;

    IF NOT v_has_part THEN
      v_pts := v_pts + PART_PTS;
      INSERT INTO point_events (user_id, session_id, season_id, type, points)
      VALUES (v_pick.user_id, p_session_id, v_season_id, 'participation', PART_PTS)
      ON CONFLICT (user_id, session_id, type) DO NOTHING;
    END IF;

    -- Win.
    IF v_is_correct THEN
      v_pts := v_pts + WIN_PTS;
      INSERT INTO point_events (user_id, session_id, season_id, type, points)
      VALUES (v_pick.user_id, p_session_id, v_season_id, 'win', WIN_PTS)
      ON CONFLICT (user_id, session_id, type) DO NOTHING;

      -- Streak bonus at 3 or more consecutive wins.
      IF v_new_streak >= 3 THEN
        v_pts := v_pts + STREAK_PTS;
        INSERT INTO point_events (user_id, session_id, season_id, type, points)
        VALUES (v_pick.user_id, p_session_id, v_season_id, 'streak_bonus', STREAK_PTS)
        ON CONFLICT (user_id, session_id, type) DO NOTHING;
      END IF;
    END IF;

    -- Stamp pick row.
    UPDATE picks
    SET is_correct     = v_is_correct,
        points_awarded = v_pts,
        updated_at     = now()
    WHERE id = v_pick.id;

    -- Update profile aggregates.
    UPDATE profiles
    SET total_points   = total_points + v_pts,
        total_wins     = total_wins   + v_is_correct::int,
        current_streak = v_new_streak,
        best_streak    = GREATEST(best_streak, v_new_streak)
    WHERE id = v_pick.user_id;

    v_settled := v_settled + 1;
  END LOOP;

  -- Mark session settled inside the same transaction.
  UPDATE voting_sessions
  SET status     = 'settled',
      settled_at = now()
  WHERE id = p_session_id;

  RETURN jsonb_build_object('ok', true, 'picks_settled', v_settled);
END;
$$;

-- No public or authenticated grant — only the service-role
-- Edge Function may call this.
REVOKE ALL ON FUNCTION settle_session FROM public;
