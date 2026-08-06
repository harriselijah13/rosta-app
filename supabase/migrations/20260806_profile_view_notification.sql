-- 20260806_profile_view_notification.sql
-- Notify premium users (in-app + push) when someone views their profile.

-- 1. Update the notifications type CHECK to include 'profile_viewed'.
--    Drop and recreate with the full set of types currently in use.
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
    'profile_viewed'
  ));

-- 2. Trigger function: insert a notification when a premium user's profile is viewed.
--    SECURITY DEFINER lets us query profiles without RLS interference.
--    The function skips self-views and non-premium viewers.
CREATE OR REPLACE FUNCTION public.notify_on_profile_view()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_premium  boolean;
  v_viewer_name text;
BEGIN
  -- Skip self-views
  IF NEW.viewer_id = NEW.viewed_id THEN RETURN NEW; END IF;

  -- Only notify premium members
  SELECT is_premium INTO v_is_premium FROM profiles WHERE id = NEW.viewed_id;
  IF NOT COALESCE(v_is_premium, false) THEN RETURN NEW; END IF;

  -- Viewer's first name for the push/notification body
  SELECT first_name INTO v_viewer_name FROM profiles WHERE id = NEW.viewer_id;

  INSERT INTO notifications (user_id, type, data)
  VALUES (
    NEW.viewed_id,
    'profile_viewed',
    jsonb_build_object(
      'from_user_id', NEW.viewer_id,
      'from_name',    COALESCE(v_viewer_name, 'Someone')
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_view_notify ON profile_views;
CREATE TRIGGER on_profile_view_notify
  AFTER INSERT ON profile_views
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_profile_view();
