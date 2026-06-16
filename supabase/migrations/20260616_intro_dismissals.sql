-- Per-user dismiss timestamps for intro_requests cards.
-- NULL = visible, non-NULL = dismissed. Each party dismisses independently.
ALTER TABLE intro_requests
  ADD COLUMN IF NOT EXISTS dismissed_by_requester_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dismissed_by_recipient_at  TIMESTAMPTZ;
