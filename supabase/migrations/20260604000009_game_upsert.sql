-- Upserts a game row from ESPN data with a state guard that prevents
-- regression (state may only advance pre→in→post, never reverse).
-- SECURITY DEFINER so the Edge Function (service role) can call it
-- without requiring direct INSERT/UPDATE grants on games.
CREATE OR REPLACE FUNCTION upsert_espn_game(game jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO games (
    espn_event_id, season_id, league,
    state, status_detail, period, clock, start_time,
    home_team_id, away_team_id,
    home_name,  away_name,
    home_abbr,  away_abbr,
    home_logo,  away_logo,
    home_color, away_color,
    home_score, away_score,
    winner_team_id, stats, updated_at
  )
  SELECT
    game->>'espn_event_id',
    (game->>'season_id')::uuid,
    game->>'league',
    game->>'state',
    game->>'status_detail',
    (game->>'period')::int,
    game->>'clock',
    (game->>'start_time')::timestamptz,
    game->>'home_team_id',  game->>'away_team_id',
    game->>'home_name',     game->>'away_name',
    game->>'home_abbr',     game->>'away_abbr',
    game->>'home_logo',     game->>'away_logo',
    game->>'home_color',    game->>'away_color',
    (game->>'home_score')::int,
    (game->>'away_score')::int,
    NULLIF(game->>'winner_team_id', ''),
    COALESCE(game->'stats', '{}'::jsonb),
    now()
  ON CONFLICT (espn_event_id) DO UPDATE SET
    -- State only advances; ARRAY_POSITION gives 1/2/3 for pre/in/post.
    state = CASE
      WHEN ARRAY_POSITION(ARRAY['pre','in','post']::text[], games.state)
           <= ARRAY_POSITION(ARRAY['pre','in','post']::text[], EXCLUDED.state)
      THEN EXCLUDED.state
      ELSE games.state
    END,
    status_detail  = EXCLUDED.status_detail,
    period         = EXCLUDED.period,
    clock          = EXCLUDED.clock,
    home_score     = EXCLUDED.home_score,
    away_score     = EXCLUDED.away_score,
    -- Once winner_team_id is set, keep it even if ESPN briefly omits it.
    winner_team_id = COALESCE(EXCLUDED.winner_team_id, games.winner_team_id),
    -- Preserve rich stats; only overwrite with non-empty payload.
    stats          = CASE
                       WHEN EXCLUDED.stats = '{}'::jsonb THEN games.stats
                       ELSE EXCLUDED.stats
                     END,
    updated_at     = EXCLUDED.updated_at;
$$;
