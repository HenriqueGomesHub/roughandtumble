-- ============================================================
-- RPCs
-- ============================================================

-- ── server_time ───────────────────────────────────────────────
-- Returns the server's current Unix epoch (seconds).
-- lib/time.ts fetches this once on mount to compute the
-- client-server offset for server-authoritative countdown sync
-- (correction #6).
CREATE OR REPLACE FUNCTION server_time()
RETURNS float
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT extract(epoch FROM now());
$$;

GRANT EXECUTE ON FUNCTION server_time TO anon, authenticated;

-- ── submit_pick ───────────────────────────────────────────────
-- Presence + integrity gate (spec §6.2 / §13).
-- Validates: open session, code matches, now < closes_at,
-- team belongs to game. Upserts one pick per (session, user).
CREATE OR REPLACE FUNCTION submit_pick(p_code text, p_team_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  uuid;
  v_session  voting_sessions%ROWTYPE;
  v_game     games%ROWTYPE;
  v_pick_id  uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT * INTO v_session
  FROM voting_sessions
  WHERE code = p_code
    AND status = 'open'
    AND now() < closes_at
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Invalid or expired code');
  END IF;

  SELECT * INTO v_game FROM games WHERE id = v_session.game_id;

  IF p_team_id <> v_game.home_team_id AND p_team_id <> v_game.away_team_id THEN
    RETURN jsonb_build_object('error', 'Invalid team');
  END IF;

  INSERT INTO picks (session_id, user_id, game_id, picked_team_id)
  VALUES (v_session.id, v_user_id, v_game.id, p_team_id)
  ON CONFLICT (session_id, user_id)
  DO UPDATE SET picked_team_id = EXCLUDED.picked_team_id,
                updated_at     = now()
  RETURNING id INTO v_pick_id;

  RETURN jsonb_build_object('ok', true, 'pick_id', v_pick_id);
END;
$$;

REVOKE ALL ON FUNCTION submit_pick FROM public;
GRANT EXECUTE ON FUNCTION submit_pick TO authenticated;

-- ── verify_admin_password ─────────────────────────────────────
-- Compares the supplied password against the bcrypt hash stored
-- in app_config (correction #1). Never returns the hash.
-- Only resolves true for users with is_admin = true.
CREATE OR REPLACE FUNCTION verify_admin_password(p_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash     text;
  v_is_admin boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT is_admin INTO v_is_admin FROM profiles WHERE id = auth.uid();
  IF NOT COALESCE(v_is_admin, false) THEN
    RETURN false;
  END IF;

  SELECT value INTO v_hash FROM app_config WHERE key = 'admin_password_hash';
  IF v_hash IS NULL THEN
    RETURN false;
  END IF;

  RETURN crypt(p_password, v_hash) = v_hash;
END;
$$;

REVOKE ALL ON FUNCTION verify_admin_password FROM public;
GRANT EXECUTE ON FUNCTION verify_admin_password TO authenticated;
