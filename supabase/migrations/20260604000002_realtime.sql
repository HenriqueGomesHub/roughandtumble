-- ============================================================
-- Realtime publication
-- voting_sessions and games must be in supabase_realtime for
-- client subscriptions to fire (correction #5).
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE voting_sessions, games;
