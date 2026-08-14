-- 2026081305_profiles_connector_score_cached.sql
-- Add a cached connector_score INT to profiles.
-- Updated by checkAndAwardBadges() every time it runs for a user, so the value
-- is always at most one scoring-event stale.
-- Used as the sort key in the intro facilitator picker (connector_score DESC,
-- first_name ASC for tie-breaking).
-- Default 0: scores populate on the user's next score-triggering event.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS connector_score INT NOT NULL DEFAULT 0;
