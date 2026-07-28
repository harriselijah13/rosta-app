-- event_attendances had RLS enabled but zero policies, making all operations
-- fail silently for authenticated users. Add basic ownership-scoped policies.

ALTER TABLE event_attendances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own event attendances"
  ON event_attendances FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users insert own event attendances"
  ON event_attendances FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own event attendances"
  ON event_attendances FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "users delete own event attendances"
  ON event_attendances FOR DELETE
  USING (auth.uid() = user_id);
