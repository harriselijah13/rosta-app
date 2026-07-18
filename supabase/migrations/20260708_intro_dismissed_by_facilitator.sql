-- Allows facilitators to hide handled intro rows from their facilitating list
-- without deleting the record. Follows same pattern as dismissed_by_requester_at
-- and dismissed_by_recipient_at already on the table.
ALTER TABLE intro_requests
  ADD COLUMN IF NOT EXISTS dismissed_by_facilitator_at TIMESTAMPTZ;
