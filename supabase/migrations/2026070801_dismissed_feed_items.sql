-- Per-user dismissals for Around ROSTA feed items.
-- Follows the same pattern as matchmaker_dismissals (RLS, unique constraint, index).
-- item_id is the member's profile UUID — covers both signal and join item types.

CREATE TABLE IF NOT EXISTS dismissed_feed_items (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type    text        NOT NULL CHECK (item_type IN ('signal', 'join')),
  item_id      uuid        NOT NULL,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dismissed_feed_items_unique UNIQUE (user_id, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS dismissed_feed_items_user_idx
  ON dismissed_feed_items (user_id);

ALTER TABLE dismissed_feed_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own dismissed feed items"
  ON dismissed_feed_items FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
