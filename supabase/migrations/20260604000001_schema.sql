-- ============================================================
-- Rough & Tumble Pick'em — Initial Schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── profiles ─────────────────────────────────────────────────
CREATE TABLE profiles (
  id             uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone          text UNIQUE NOT NULL,
  display_name   text NOT NULL DEFAULT '',
  is_admin       boolean NOT NULL DEFAULT false,
  total_points   int NOT NULL DEFAULT 0,
  current_streak int NOT NULL DEFAULT 0,
  best_streak    int NOT NULL DEFAULT 0,
  total_wins     int NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ── seasons ───────────────────────────────────────────────────
CREATE TABLE seasons (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league           text NOT NULL,
  name             text NOT NULL,
  watch_party_goal int NOT NULL DEFAULT 8,
  starts_at        timestamptz,
  ends_at          timestamptz,
  is_active        boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ── games ─────────────────────────────────────────────────────
CREATE TABLE games (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  espn_event_id  text UNIQUE NOT NULL,
  season_id      uuid NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  league         text NOT NULL,
  is_playoff     boolean NOT NULL DEFAULT false,
  state          text NOT NULL DEFAULT 'pre'
                   CHECK (state IN ('pre', 'in', 'post')),
  status_detail  text,
  period         int,
  clock          text,
  start_time     timestamptz,
  home_team_id   text NOT NULL,
  away_team_id   text NOT NULL,
  home_name      text,
  away_name      text,
  home_abbr      text,
  away_abbr      text,
  home_logo      text,
  away_logo      text,
  home_color     text,
  away_color     text,
  home_score     int NOT NULL DEFAULT 0,
  away_score     int NOT NULL DEFAULT 0,
  winner_team_id text,
  stats          jsonb NOT NULL DEFAULT '{}',
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ── voting_sessions ───────────────────────────────────────────
CREATE TABLE voting_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id          uuid NOT NULL REFERENCES games(id) ON DELETE RESTRICT,
  code             text NOT NULL,
  duration_seconds int NOT NULL,
  opens_at         timestamptz NOT NULL,
  closes_at        timestamptz NOT NULL,
  status           text NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open', 'closed', 'settled', 'cancelled')),
  home_votes       int NOT NULL DEFAULT 0,
  away_votes       int NOT NULL DEFAULT 0,
  total_votes      int NOT NULL DEFAULT 0,
  created_by       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  settled_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ── picks ─────────────────────────────────────────────────────
CREATE TABLE picks (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     uuid NOT NULL REFERENCES voting_sessions(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  game_id        uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  picked_team_id text NOT NULL,
  is_correct     boolean,
  points_awarded int,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id)
);

-- ── point_events (ledger) ─────────────────────────────────────
-- session_id is always set (= the settling session).
-- UNIQUE(user_id, session_id, type) is the idempotency guard per correction #3.
-- Day-level participation deduplication is enforced in settle-session logic.
CREATE TABLE point_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES voting_sessions(id) ON DELETE CASCADE,
  season_id  uuid NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  type       text NOT NULL CHECK (type IN ('win', 'streak_bonus', 'participation')),
  points     int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, session_id, type)
);

-- ── bracket_matchups ──────────────────────────────────────────
CREATE TABLE bracket_matchups (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id       uuid NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  round           int NOT NULL,
  round_label     text NOT NULL,
  position        int NOT NULL,
  team_a_id       text,
  team_b_id       text,
  team_a_name     text,
  team_a_logo     text,
  team_b_name     text,
  team_b_logo     text,
  winner_team_id  text,
  next_matchup_id uuid REFERENCES bracket_matchups(id) ON DELETE SET NULL,
  espn_event_id   text,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── prizes ────────────────────────────────────────────────────
CREATE TABLE prizes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id   uuid NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  category    text NOT NULL CHECK (category IN ('season', 'watch_party', 'weekly')),
  rank        int,
  title       text NOT NULL,
  value_label text NOT NULL,
  description text NOT NULL DEFAULT '',
  sort_order  int NOT NULL DEFAULT 0
);

-- ── app_config ────────────────────────────────────────────────
-- Single-row table holds bcrypt admin password hash (set via one-time SQL).
CREATE TABLE app_config (
  key   text PRIMARY KEY,
  value text NOT NULL
);

-- ── standings_cache ───────────────────────────────────────────
CREATE TABLE standings_cache (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league     text NOT NULL,
  team_id    text NOT NULL,
  team_name  text NOT NULL,
  team_abbr  text NOT NULL,
  team_logo  text NOT NULL DEFAULT '',
  team_color text NOT NULL DEFAULT '',
  wins       int NOT NULL DEFAULT 0,
  losses     int NOT NULL DEFAULT 0,
  win_pct    float NOT NULL DEFAULT 0,
  seed       int,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (league, team_id)
);

-- ── indexes ───────────────────────────────────────────────────
CREATE INDEX ON games (state);
CREATE INDEX ON games (season_id);
CREATE INDEX ON voting_sessions (status);
CREATE INDEX ON voting_sessions (code, status);
CREATE INDEX ON point_events (user_id, season_id);
CREATE INDEX ON point_events (season_id, created_at);
CREATE INDEX ON picks (user_id);

-- ── auto-create profile on auth.users insert ─────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, phone, display_name)
  VALUES (NEW.id, COALESCE(NEW.phone, ''), '')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();
