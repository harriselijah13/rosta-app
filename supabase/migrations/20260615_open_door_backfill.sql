-- Backfill open_door into signals.open_to for all members who completed onboarding.
-- New members get open_door by default via the onboarding flow (openTo initialised
-- with ['open_door'] in OnboardingFlow.tsx).
UPDATE signals
SET open_to = array_append(open_to, 'open_door')
WHERE user_id IN (
  SELECT id FROM profiles WHERE onboarding_completed = true
)
AND NOT (open_to @> ARRAY['open_door']::text[]);
