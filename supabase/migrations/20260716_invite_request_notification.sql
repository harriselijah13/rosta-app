-- 1. Ensure invite_requests.status defaults to 'pending'
--    Safe to run if already set — SET DEFAULT is idempotent.
ALTER TABLE invite_requests ALTER COLUMN status SET DEFAULT 'pending';

-- 2. Widen notifications type CHECK to include 'invite_request'
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
    'post_forwarded',
    'invite_request'
  ));

-- 3. Trigger function: insert a notification for every admin user on new invite request.
--    SECURITY DEFINER + fixed search_path — same pattern as notify_on_new_message.
CREATE OR REPLACE FUNCTION notify_on_new_invite_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO notifications (user_id, type, data)
  SELECT
    id,
    'invite_request',
    jsonb_build_object(
      'full_name',  NEW.full_name,
      'email',      NEW.email,
      'request_id', NEW.id
    )
  FROM profiles
  WHERE is_admin = true;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_invite_request_insert ON invite_requests;
CREATE TRIGGER on_invite_request_insert
  AFTER INSERT ON invite_requests
  FOR EACH ROW EXECUTE FUNCTION notify_on_new_invite_request();
