-- ============================================================
-- Admin write policies for session management
-- ============================================================

-- Admins may create voting sessions.
CREATE POLICY "admin insert voting_sessions"
  ON voting_sessions FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT is_admin FROM profiles WHERE id = auth.uid())
  );

-- Admins may update sessions (close / cancel; settle goes via Edge Function).
CREATE POLICY "admin update voting_sessions"
  ON voting_sessions FOR UPDATE TO authenticated
  USING (
    (SELECT is_admin FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    (SELECT is_admin FROM profiles WHERE id = auth.uid())
  );

-- Admins may update games (set winner_team_id before settling).
CREATE POLICY "admin update games"
  ON games FOR UPDATE TO authenticated
  USING (
    (SELECT is_admin FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    (SELECT is_admin FROM profiles WHERE id = auth.uid())
  );
