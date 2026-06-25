-- Audit trail for admin-removed verification badges.
-- Apply in Supabase SQL editor before deploying the admin members redesign.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS verification_removed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_removed_by UUID REFERENCES profiles(id);
