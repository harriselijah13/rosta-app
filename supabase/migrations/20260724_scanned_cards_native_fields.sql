-- Native fields for business card scan: structured meeting context.
-- met_at (freeform text) is unchanged; web reads it as before.
-- Native writes location + date_met + notes and also computes met_at
-- as "{location} · {Month YYYY}" for web backward compat.

ALTER TABLE scanned_cards
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS date_met date,
  ADD COLUMN IF NOT EXISTS notes    text;
