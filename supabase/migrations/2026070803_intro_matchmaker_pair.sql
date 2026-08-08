-- Link the two intro_requests rows produced by a matchmaker suggestion.
-- Nullable so all existing rows are unaffected.
ALTER TABLE intro_requests
  ADD COLUMN IF NOT EXISTS matched_pair_id UUID;
