-- Allow admin users to read any member's signals row.
-- Required for the admin panel's Open Door toggle: the SECURITY DEFINER write
-- function (admin_set_open_door) bypasses RLS correctly, but the subsequent
-- SELECT in load() uses the regular client and was blocked by the
-- "own or connected signals" policy when the admin isn't connected to the member.
-- This additive SELECT policy fixes the read path without affecting regular users.

CREATE POLICY "admins_select_any_signals"
  ON signals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND is_admin = true
    )
  );
