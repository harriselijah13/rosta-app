-- Fix missing RLS policies discovered during native app audit.
-- Tables with RLS enabled but no INSERT policy fail loudly on insert;
-- tables with no policies at all fail for all operations.

-- matchmaker_dismissals: "Not this time" in the home tab matchmaker card.
-- The call site swallows errors silently so failures were invisible.
CREATE POLICY "users can insert own matchmaker_dismissals"
  ON matchmaker_dismissals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- scanned_cards: "Save for later" in the business card scan flow.
-- Also needs UPDATE (re-save after connect/invite attempt) and SELECT (own cards).
CREATE POLICY "users can insert own scanned_cards"
  ON scanned_cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can update own scanned_cards"
  ON scanned_cards FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "users can select own scanned_cards"
  ON scanned_cards FOR SELECT
  USING (auth.uid() = user_id);
