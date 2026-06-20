-- Unified QR + connection removal support.
-- Note: `origin` column already exists and covers connection source.
-- Adding `removed_at` and `removed_by` for soft-delete on disconnect.

ALTER TABLE connections
  ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS removed_by UUID REFERENCES profiles(id);

-- Fast filter for active (non-removed) connections
CREATE INDEX IF NOT EXISTS idx_connections_active
  ON connections (user_a, user_b)
  WHERE removed_at IS NULL;
