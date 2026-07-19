-- RLS policies needed for native app to accept/decline open_door connection requests.
-- Web app uses createAdminClient() (service role) so never needed these.
-- Native uses anon/auth key and hits these tables directly for the first time here.

-- 1. Allow either party to insert their own connection row.
CREATE POLICY "participants can insert connection"
  ON connections FOR INSERT
  WITH CHECK (
    auth.uid() = user_a OR auth.uid() = user_b
  );

-- 2. Allow the target of a pending open_door request to update status to accepted/declined.
--    USING restricts which rows can be touched (must be pending open_door targeting current user).
--    WITH CHECK restricts the resulting row (status must land on accepted or declined).
CREATE POLICY "target can respond to open door request"
  ON intro_requests FOR UPDATE
  USING (
    auth.uid() = target_id
    AND type = 'open_door'
    AND status = 'pending'
  )
  WITH CHECK (
    auth.uid() = target_id
    AND type = 'open_door'
    AND status IN ('accepted', 'declined')
  );
