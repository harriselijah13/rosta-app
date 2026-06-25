-- Switch verification payments from PaymentIntents to Checkout Sessions.
-- Adds columns needed for the new checkout flow; existing rows are unaffected.

ALTER TABLE verification_requests
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_currency            TEXT,
  ADD COLUMN IF NOT EXISTS payment_amount              NUMERIC,
  ADD COLUMN IF NOT EXISTS paid_at                     TIMESTAMPTZ;
