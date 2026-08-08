-- Track per-party acceptance for facilitator-initiated intros.
-- member_a = requester_id party, member_b = target_id party.
ALTER TABLE intro_requests
  ADD COLUMN IF NOT EXISTS member_a_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS member_b_accepted_at timestamptz;
