-- Track which badge-earned moments have been shown to the member in-app.
-- NULL = not yet shown; non-NULL = shown and dismissed.
ALTER TABLE member_badges
  ADD COLUMN IF NOT EXISTS badge_earned_shown_at TIMESTAMPTZ;

-- Backfill existing rows so current members don't see retroactive modals.
UPDATE member_badges
  SET badge_earned_shown_at = now()
  WHERE badge_earned_shown_at IS NULL;
