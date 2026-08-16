-- 2026081601_campaign_schema.sql
--
-- Three new tables for the admin notification campaign system.
--
--   temporary_screens       — reusable promo screen content (headline, body, mascot, CTA)
--   notification_campaigns  — recipient list, schedule, destination, and lifecycle state
--   campaign_deliveries     — one row per actual send; supports open/tap analytics later
--
-- The push delivery path reuses the existing pipeline:
--   INSERT INTO notifications → on_notification_insert_push trigger →
--   send-push-notification edge function → Expo Push API
-- No parallel delivery path is introduced.

-- ── 1. temporary_screens ──────────────────────────────────────────────────────

CREATE TABLE temporary_screens (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  headline     text        NOT NULL,
  body         text        NOT NULL,
  mascot_pose  text,                    -- slug reference ('wave','celebrate','think'…)
                                        -- NULL = no mascot shown; native maps slug → asset
  cta_label    text        NOT NULL DEFAULT 'Got it',
  cta_action   text,                    -- NULL = dismiss; or a native route string
  starts_at    timestamptz,
  expires_at   timestamptz,
  status       text        NOT NULL DEFAULT 'active'
               CHECK (status IN ('active', 'expired', 'archived')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE temporary_screens ENABLE ROW LEVEL SECURITY;

-- Authenticated members need SELECT to render the promo screen after tapping
-- a campaign notification. Admin writes use the service-role client (bypasses RLS).
CREATE POLICY "authenticated can read active temporary_screens"
  ON temporary_screens FOR SELECT
  TO authenticated
  USING (status = 'active');

-- ── 2. notification_campaigns ─────────────────────────────────────────────────

CREATE TABLE notification_campaigns (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by       uuid        NOT NULL REFERENCES profiles(id),

  -- Push content
  title            text        NOT NULL,
  message          text        NOT NULL,

  -- Recipients
  recipient_mode   text        NOT NULL DEFAULT 'all'
                   CHECK (recipient_mode IN ('all', 'specific')),
  recipient_ids    uuid[],              -- NULL when 'all'; user-id array when 'specific'

  -- Scheduling
  send_mode        text        NOT NULL DEFAULT 'immediate'
                   CHECK (send_mode IN ('immediate', 'scheduled', 'recurring')),
  scheduled_at     timestamptz,         -- first (or only) send time for scheduled/recurring
  recurrence_rule  text
                   CHECK (recurrence_rule IS NULL OR
                          recurrence_rule IN ('daily', 'weekly', 'monthly')),
  recurrence_end   timestamptz,         -- optional hard stop for recurring campaigns

  -- Destination
  destination_type text        NOT NULL DEFAULT 'route'
                   CHECK (destination_type IN ('route', 'promo_screen')),
  destination_route text,               -- existing native route, e.g. '/(app)/(tabs)/notifications'
  promo_screen_id  uuid        REFERENCES temporary_screens(id) ON DELETE SET NULL,

  -- Lifecycle
  status           text        NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'scheduled', 'active', 'paused', 'completed')),
  last_sent_at     timestamptz,
  next_send_at     timestamptz,         -- scheduler sets this; cron picks up rows where <= now()
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Partial index: only rows the scheduler actually needs to scan
CREATE INDEX notification_campaigns_due_idx
  ON notification_campaigns(next_send_at)
  WHERE status IN ('scheduled', 'active');

-- GIN index for ANY() lookups on recipient_ids
CREATE INDEX notification_campaigns_recipient_ids_idx
  ON notification_campaigns USING GIN(recipient_ids)
  WHERE recipient_ids IS NOT NULL;

ALTER TABLE notification_campaigns ENABLE ROW LEVEL SECURITY;
-- No policies: admin client (service role) bypasses RLS; members have no access.

-- ── 3. campaign_deliveries ────────────────────────────────────────────────────
-- One row per push sent. notification_id links to the notifications row whose
-- read_at provides open tracking without an extra column here.

CREATE TABLE campaign_deliveries (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     uuid        NOT NULL REFERENCES notification_campaigns(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notification_id uuid        REFERENCES notifications(id) ON DELETE SET NULL,
  sent_at         timestamptz NOT NULL DEFAULT now(),
  tapped_at       timestamptz             -- set from native side when user taps the promo CTA
);

CREATE INDEX campaign_deliveries_campaign_id_idx ON campaign_deliveries(campaign_id);
CREATE INDEX campaign_deliveries_user_id_idx     ON campaign_deliveries(user_id);

ALTER TABLE campaign_deliveries ENABLE ROW LEVEL SECURITY;
-- No policies: admin client only; members have no access.

-- ── 4. Add 'campaign' to the notifications type constraint ────────────────────
-- The notification data field for type='campaign' carries:
--   { campaign_id, push_title, push_body, promo_screen_id, destination_route }
-- push_title and push_body are embedded at send time so the edge function
-- can build push content without a database join.

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'connection_request',
    'connection_accepted',
    'intro_request',
    'intro_incoming',
    'intro_declined',
    'new_message',
    'whatsapp_share',
    'invite_request',
    'reaction_can_help',
    'reaction_know_someone',
    'post_forwarded',
    'profile_viewed',
    'lend_a_hand',
    'badge_earned',
    'campaign'
  ));
