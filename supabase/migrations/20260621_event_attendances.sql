CREATE TABLE IF NOT EXISTS event_attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tapped_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  prompt_shown_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_attendances_user
  ON event_attendances (user_id);

-- Partial index used by the cron and dashboard queries
CREATE INDEX IF NOT EXISTS idx_event_attendances_pending
  ON event_attendances (user_id)
  WHERE completed_at IS NULL AND dismissed_at IS NULL;
