-- 2026081302_badge_earned_notification.sql
-- 1. Add badge_earned to the notifications type CHECK constraint.
-- 2. DB trigger: member_badges INSERT → insert a badge_earned notification row,
--    which the existing pg_net trigger then sends as a push via Expo.
--
-- RLS note: the "authenticated users can insert notifications" policy uses
-- WITH CHECK (true), allowing any auth'd user to insert for any recipient.
-- This is a known gap (noted in 2026070805_notifications_fix_and_message.sql).
-- The badge notification trigger is SECURITY DEFINER, so it correctly bypasses
-- RLS rather than relying on the permissive INSERT policy.
-- Future hardening: convert client-side intro notification inserts to
-- SECURITY DEFINER RPCs, then tighten the INSERT policy.

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'connection_request',
    'connection_accepted',
    'intro_request',
    'intro_incoming',
    'new_message',
    'whatsapp_share',
    'invite_request',
    'reaction_can_help',
    'reaction_know_someone',
    'post_forwarded',
    'profile_viewed',
    'lend_a_hand',
    'badge_earned'
  ));

-- Trigger function: insert a badge_earned notification when a new badge row is created.
-- Skips members who haven't completed onboarding (no push token, no badge reveal needed).
-- SECURITY DEFINER: runs as function owner (service role), bypassing RLS entirely.
CREATE OR REPLACE FUNCTION public.notify_on_badge_earned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = NEW.user_id AND onboarding_completed = true
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (user_id, type, data)
  VALUES (
    NEW.user_id,
    'badge_earned',
    jsonb_build_object('badge_slug', NEW.badge_slug)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_badge_earned_notify ON member_badges;
CREATE TRIGGER on_badge_earned_notify
  AFTER INSERT ON member_badges
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_badge_earned();
