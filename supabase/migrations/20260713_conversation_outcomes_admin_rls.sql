-- Allow admin users to SELECT all conversation_outcomes rows for aggregate reporting.
-- The existing per-user policies (own row upsert + participant read) are unchanged;
-- this policy is additive (Postgres ORs SELECT policies).

CREATE POLICY "admins_read_all_conversation_outcomes"
  ON conversation_outcomes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND is_admin = true
    )
  );
