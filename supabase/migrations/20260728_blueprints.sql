-- ── Tables ─────────────────────────────────────────────────────────────────────

CREATE TABLE blueprints (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title        text        NOT NULL,
  tagline      text        NOT NULL,
  url          text,
  stage        text        NOT NULL CHECK (stage IN ('idea','building','testing','launched','paused')),
  next_step    text,
  roadmap      jsonb       NOT NULL DEFAULT '[]',
  looking_for  text,
  image_1_url  text,
  image_2_url  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)          -- one blueprint per member
);

CREATE TABLE blueprint_reactions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id  uuid        NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  reactor_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reaction_type text        NOT NULL CHECK (reaction_type IN ('interested','can_help')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blueprint_id, reactor_id, reaction_type)
);

-- ── RLS — blueprints ───────────────────────────────────────────────────────────

ALTER TABLE blueprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can read blueprints"
  ON blueprints FOR SELECT
  USING (auth.role() = 'authenticated');

-- INSERT and UPDATE gated on is_premium in the policy itself
CREATE POLICY "premium users can insert own blueprint"
  ON blueprints FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_premium = true)
  );

CREATE POLICY "premium users can update own blueprint"
  ON blueprints FOR UPDATE
  USING (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_premium = true)
  );

-- DELETE allowed even if premium lapses, so lapsed members can remove stale data
CREATE POLICY "users can delete own blueprint"
  ON blueprints FOR DELETE
  USING (auth.uid() = user_id);

-- ── RLS — blueprint_reactions ─────────────────────────────────────────────────

ALTER TABLE blueprint_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can read blueprint reactions"
  ON blueprint_reactions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "users can insert own blueprint reaction"
  ON blueprint_reactions FOR INSERT
  WITH CHECK (auth.uid() = reactor_id);

CREATE POLICY "users can delete own blueprint reaction"
  ON blueprint_reactions FOR DELETE
  USING (auth.uid() = reactor_id);

-- ── updated_at trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION touch_blueprint_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER blueprints_updated_at
  BEFORE UPDATE ON blueprints
  FOR EACH ROW EXECUTE FUNCTION touch_blueprint_updated_at();
