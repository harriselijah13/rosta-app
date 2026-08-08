-- Allow resending expired intro requests.
-- dismissed_by_requester_at and dismissed_by_recipient_at already exist (20260616).
ALTER TABLE intro_requests
  ADD COLUMN IF NOT EXISTS resent_at TIMESTAMPTZ;
