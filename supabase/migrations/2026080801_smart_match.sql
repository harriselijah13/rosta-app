-- Smart Match Phase 2 schema.
-- Runs after 20260808_profile_views_delete.sql (same date, suffix 01).

-- ── signals: dedicated timestamp for need_right_now changes ──────────────────
-- signals.updated_at bumps on any field edit, making it an unreliable urgency
-- proxy for need_right_now specifically. This column is set only when that
-- field actually changes (via trigger below).

ALTER TABLE signals
  ADD COLUMN IF NOT EXISTS need_right_now_updated_at TIMESTAMPTZ;

-- Backfill: for rows that already have a value, use updated_at as the best
-- available approximation. Rows with null need_right_now stay null here.
UPDATE signals
SET    need_right_now_updated_at = updated_at
WHERE  need_right_now IS NOT NULL
  AND  need_right_now_updated_at IS NULL;

-- Trigger: set need_right_now_updated_at whenever need_right_now changes.
CREATE OR REPLACE FUNCTION public.set_need_right_now_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.need_right_now IS DISTINCT FROM OLD.need_right_now THEN
    NEW.need_right_now_updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_need_right_now_updated_at ON signals;
CREATE TRIGGER trg_need_right_now_updated_at
  BEFORE UPDATE ON signals
  FOR EACH ROW
  EXECUTE FUNCTION public.set_need_right_now_updated_at();

-- ── blueprints: optional milestone deadline ───────────────────────────────────
ALTER TABLE blueprints
  ADD COLUMN IF NOT EXISTS deadline DATE;

-- ── smart_match_outcomes: private conversion context ─────────────────────────
-- Records whether an intro "went somewhere" for the requesting user only.
-- Used as recent-outcome context injected into the Smart Match prompt —
-- this is not a trained model; it is example context fed to Haiku at
-- inference time so recent patterns can inform the suggestion.
-- RLS ensures only the owner can read or write their own rows.

CREATE TABLE IF NOT EXISTS smart_match_outcomes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  match_id   UUID        REFERENCES intro_requests(id)   ON DELETE SET NULL,
  outcome    TEXT        NOT NULL CHECK (outcome IN ('went_somewhere', 'nothing_came_of_it')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS smart_match_outcomes_user_idx
  ON smart_match_outcomes (user_id, created_at DESC);

ALTER TABLE smart_match_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own outcomes only"
  ON smart_match_outcomes FOR ALL
  USING (user_id = auth.uid());

-- ── smart_match_runs: per-user invocation log ─────────────────────────────────
-- Used server-side for tier-gated rate limiting:
--   Free    → 1 call per 7 days  (10 080 minutes)
--   Premium → 10 calls per hour
-- Also stores the suggestion returned so outcome rows can reference the run.

CREATE TABLE IF NOT EXISTS smart_match_runs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  person1_id UUID,
  person2_id UUID,
  reasoning  TEXT,
  is_warm    BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS smart_match_runs_user_idx
  ON smart_match_runs (user_id, created_at DESC);

ALTER TABLE smart_match_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own runs only"
  ON smart_match_runs FOR ALL
  USING (user_id = auth.uid());
