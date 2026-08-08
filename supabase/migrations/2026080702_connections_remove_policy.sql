-- Allow either party in a connection to soft-delete it by setting removed_at.
-- The existing SELECT and INSERT policies handle read/create; this adds
-- UPDATE so native-app users can end a connection from the member profile.
-- All queries that read active connections already filter on removed_at IS NULL,
-- so soft-deleted rows are automatically excluded everywhere without schema changes.

CREATE POLICY "participants can remove connection"
  ON connections FOR UPDATE
  USING  (auth.uid() = user_a OR auth.uid() = user_b)
  WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);
