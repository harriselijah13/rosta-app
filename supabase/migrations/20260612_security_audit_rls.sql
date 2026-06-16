-- M1: Gate signals SELECT on own record or mutual connection.
-- Previously USING (true) allowed any authenticated user to read all signals.
DROP POLICY IF EXISTS "Authenticated users can read any signals" ON signals;

CREATE POLICY "own or connected signals"
  ON signals FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM connections
      WHERE (user_a = auth.uid() AND user_b = signals.user_id)
         OR (user_b = auth.uid() AND user_a = signals.user_id)
    )
  );

-- M4: Replace broad conversations UPDATE WITH CHECK (true) with two targeted
-- policies that require each party to set only their own soft-delete flag.
DROP POLICY IF EXISTS "members can soft-delete conversation" ON conversations;

-- user_a may only perform an update that results in deleted_by_user_a = true
CREATE POLICY "user_a can soft-delete"
  ON conversations FOR UPDATE
  USING  (auth.uid() = user_a)
  WITH CHECK (auth.uid() = user_a AND deleted_by_user_a = true);

-- user_b may only perform an update that results in deleted_by_user_b = true
CREATE POLICY "user_b can soft-delete"
  ON conversations FOR UPDATE
  USING  (auth.uid() = user_b)
  WITH CHECK (auth.uid() = user_b AND deleted_by_user_b = true);
