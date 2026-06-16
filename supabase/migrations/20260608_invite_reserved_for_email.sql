-- Add reserved_for_email to invite_codes
-- Marks a code as "invite sent" before the recipient has signed up.
-- Run in: https://supabase.com/dashboard/project/gukouwplaofdydbetfoz/sql/new

ALTER TABLE invite_codes
  ADD COLUMN IF NOT EXISTS reserved_for_email TEXT;
