-- Network posts feature: posts, reactions, forwards, signal_updates
-- Extend notifications CHECK for reaction/forward types
-- Run this in the Supabase SQL editor

-- ── 1. network_posts ──────────────────────────────────────────────────────────

CREATE TABLE network_posts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_type   TEXT        NOT NULL CHECK (post_type IN ('ask', 'offer')),
  field_1     TEXT        NOT NULL,
  field_2     TEXT        NOT NULL,
  field_3     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  archived_at TIMESTAMPTZ,
  deleted_at  TIMESTAMPTZ
);

ALTER TABLE network_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_members_read_posts"
  ON network_posts FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "author_insert_post"
  ON network_posts FOR INSERT
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "author_update_own_post"
  ON network_posts FOR UPDATE
  USING (auth.uid() = author_id);

CREATE POLICY "author_delete_own_post"
  ON network_posts FOR DELETE
  USING (auth.uid() = author_id);

-- ── 2. network_post_forwards ──────────────────────────────────────────────────

CREATE TABLE network_post_forwards (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      UUID        NOT NULL REFERENCES network_posts(id) ON DELETE CASCADE,
  forwarder_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, forwarder_id, recipient_id)
);

ALTER TABLE network_post_forwards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "party_read_own_forwards"
  ON network_post_forwards FOR SELECT
  USING (auth.uid() IN (forwarder_id, recipient_id));

CREATE POLICY "forwarder_insert_forward"
  ON network_post_forwards FOR INSERT
  WITH CHECK (auth.uid() = forwarder_id);

-- ── 3. network_post_reactions ─────────────────────────────────────────────────

CREATE TABLE network_post_reactions (
  post_id       UUID        NOT NULL REFERENCES network_posts(id) ON DELETE CASCADE,
  reactor_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reaction_type TEXT        NOT NULL CHECK (reaction_type IN ('can_help', 'know_someone', 'noted')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  note          TEXT,
  PRIMARY KEY (post_id, reactor_id, reaction_type)
);

ALTER TABLE network_post_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_members_read_reactions"
  ON network_post_reactions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "reactor_insert_reaction"
  ON network_post_reactions FOR INSERT
  WITH CHECK (auth.uid() = reactor_id);

CREATE POLICY "reactor_delete_reaction"
  ON network_post_reactions FOR DELETE
  USING (auth.uid() = reactor_id);

CREATE POLICY "reactor_update_note"
  ON network_post_reactions FOR UPDATE
  USING (auth.uid() = reactor_id);

-- ── 4. signal_updates ─────────────────────────────────────────────────────────

CREATE TABLE signal_updates (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  signal_type TEXT        NOT NULL CHECK (signal_type IN ('open_to', 'working_on', 'need_right_now')),
  new_value   TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE signal_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_members_read_signal_updates"
  ON signal_updates FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "member_insert_own_signal_update"
  ON signal_updates FOR INSERT
  WITH CHECK (auth.uid() = member_id);

-- ── 5. Extend notifications type CHECK ───────────────────────────────────────
-- Adds reaction_can_help, reaction_know_someone, post_forwarded
-- Current set (from 20260708_notifications_fix_and_message): connection_request,
-- connection_accepted, intro_request, intro_incoming, new_message
-- Added by 20260708_messaging_native: whatsapp_share

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'connection_request',
    'connection_accepted',
    'intro_request',
    'intro_incoming',
    'new_message',
    'whatsapp_share',
    'reaction_can_help',
    'reaction_know_someone',
    'post_forwarded'
  ));
