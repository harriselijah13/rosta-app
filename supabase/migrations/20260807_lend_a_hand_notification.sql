-- 20260807_lend_a_hand_notification.sql
-- Notify connections (in-app + push) when a member posts a new Lend a Hand ask.
-- Also adds reaction_can_help and reaction_know_someone to the type constraint
-- (the push function already handles these; this migration makes the INSERT
-- policy actually allow them through the CHECK constraint).

-- 1. Rebuild the notifications type CHECK with every type currently in use.
--    (This supersedes the constraint set by 20260806_profile_view_notification.)
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
    'lend_a_hand'
  ));

-- 2. Trigger function: insert a lend_a_hand notification for every connection
--    of the post author when a new 'ask' post is created.
--    Uses a cursor loop — acceptable for beta user counts (< a few hundred connections).
CREATE OR REPLACE FUNCTION public.notify_on_new_ask()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author_name text;
  v_conn_id     uuid;
BEGIN
  -- Only fire for ask posts
  IF NEW.post_type <> 'ask' THEN RETURN NEW; END IF;

  SELECT first_name INTO v_author_name FROM profiles WHERE id = NEW.author_id;

  -- Notify every connected user (both directions)
  FOR v_conn_id IN
    SELECT CASE WHEN user_a = NEW.author_id THEN user_b ELSE user_a END
    FROM connections
    WHERE (user_a = NEW.author_id OR user_b = NEW.author_id)
      AND removed_at IS NULL
  LOOP
    INSERT INTO notifications (user_id, type, data)
    VALUES (
      v_conn_id,
      'lend_a_hand',
      jsonb_build_object(
        'from_user_id', NEW.author_id,
        'from_name',    COALESCE(v_author_name, 'Someone'),
        'post_id',      NEW.id
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_ask_notify ON network_posts;
CREATE TRIGGER on_new_ask_notify
  AFTER INSERT ON network_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_new_ask();
