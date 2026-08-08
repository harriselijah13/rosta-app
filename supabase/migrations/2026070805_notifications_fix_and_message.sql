-- Fix notifications table for native app and add new_message type
--
-- Context: the original notifications table was created for web app post-reactions.
-- The native app uses different types and a 'data' column (not 'payload').
-- All native notification inserts were silently failing. Table had 0 rows.

-- 1. Rename payload → data (table was empty, no data loss)
ALTER TABLE notifications RENAME COLUMN payload TO data;

-- 2. Replace type CHECK with all native app types
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'connection_request',
    'connection_accepted',
    'intro_request',
    'intro_incoming',
    'new_message'
  ));

-- 3. INSERT policy for authenticated users
--    Native app creates connection/intro notifications client-side with anon key
CREATE POLICY "authenticated users can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- 4. Trigger: insert a new_message notification for the recipient on every message insert.
--    SECURITY DEFINER bypasses RLS — same pattern as update_conversation_last_message_at.
CREATE OR REPLACE FUNCTION notify_on_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient_id uuid;
  v_sender_name  text;
BEGIN
  SELECT CASE WHEN c.user_a = NEW.sender_id THEN c.user_b ELSE c.user_a END
  INTO v_recipient_id
  FROM conversations c WHERE c.id = NEW.conversation_id;

  IF v_recipient_id IS NULL THEN RETURN NEW; END IF;

  SELECT first_name INTO v_sender_name
  FROM profiles WHERE id = NEW.sender_id;

  INSERT INTO notifications (user_id, type, data)
  VALUES (
    v_recipient_id,
    'new_message',
    jsonb_build_object(
      'from_user_id',    NEW.sender_id,
      'from_name',       COALESCE(v_sender_name, 'Someone'),
      'conversation_id', NEW.conversation_id
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_message_notify ON messages;
CREATE TRIGGER on_message_notify
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION notify_on_new_message();
