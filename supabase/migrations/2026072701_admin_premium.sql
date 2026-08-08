-- Admin-controlled premium grants.
-- is_premium remains the single gating column (unchanged).
-- premium_source distinguishes paid (RevenueCat) from admin_granted.
-- premium_expires_at is null for permanent grants and paid subs (RevenueCat owns that lifecycle).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS premium_source      TEXT        CHECK (premium_source IN ('paid', 'admin_granted')),
  ADD COLUMN IF NOT EXISTS premium_expires_at  TIMESTAMPTZ;

-- Daily cron: expire admin-granted premium where the expiry has passed.
-- Runs at 00:05 UTC so it's after midnight in all timezones.
SELECT cron.schedule(
  'expire-admin-premium',
  '5 0 * * *',
  $$
    UPDATE profiles
    SET
      is_premium          = false,
      premium_source      = null,
      premium_expires_at  = null
    WHERE premium_source      = 'admin_granted'
      AND premium_expires_at  IS NOT NULL
      AND premium_expires_at  < NOW()
      AND is_premium          = true;
  $$
);
