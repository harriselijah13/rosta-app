-- Allow admin users to insert or update any member's signals row.
-- Needed for the admin panel's Open Door toggle, which upserts signals on behalf
-- of another user. The existing user-level policies only permit auth.uid() = user_id.

CREATE POLICY "admins_insert_any_signals"
  ON signals FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND is_admin = true
    )
  );

CREATE POLICY "admins_update_any_signals"
  ON signals FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND is_admin = true
    )
  );
