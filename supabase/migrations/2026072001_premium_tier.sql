-- Premium tier: adds is_premium and premium_since to profiles, creates
-- profile_views table with one-per-UTC-day dedup index, and RLS policies.

-- ── Profiles ──────────────────────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_premium    BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS premium_since TIMESTAMPTZ;

-- ── Profile views ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profile_views (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewed_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prevents count inflation from repeat visits within the same UTC day.
-- The native app upserts with ignoreDuplicates and catches error code 23505.
CREATE UNIQUE INDEX IF NOT EXISTS profile_views_once_per_day
  ON profile_views (viewer_id, viewed_id, DATE(created_at AT TIME ZONE 'UTC'));

ALTER TABLE profile_views ENABLE ROW LEVEL SECURITY;

-- viewed_id can read their own rows (powers "Who has viewed your profile").
-- viewer_id is returned in those rows to the viewed user — this is intentional.
-- No SELECT policy exists for viewer_id, so viewers cannot query what they have viewed.
CREATE POLICY "profile_views_select_own" ON profile_views
  FOR SELECT
  USING (viewed_id = auth.uid());

-- Any authenticated user can insert a view; viewer_id must match their own uid.
CREATE POLICY "profile_views_insert" ON profile_views
  FOR INSERT
  WITH CHECK (viewer_id = auth.uid());
