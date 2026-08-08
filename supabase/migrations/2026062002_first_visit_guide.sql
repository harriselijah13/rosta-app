-- First-visit guide: track members page visit and guide dismissal
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS first_visit_members_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_visit_guide_dismissed_at TIMESTAMPTZ;

-- Dismiss the guide for all members who completed onboarding before this migration,
-- so they don't unexpectedly see a "new member" guide on next login.
UPDATE profiles
  SET first_visit_guide_dismissed_at = now()
  WHERE onboarding_completed = true
    AND first_visit_guide_dismissed_at IS NULL;
