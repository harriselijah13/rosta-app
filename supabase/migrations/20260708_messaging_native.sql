-- Native messaging engine
-- Adds template_key to messages, INSERT policy for conversations,
-- and trigger to auto-stamp last_message_at

-- 1. template_key — nullable, backward-compatible with existing web app messages
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS template_key TEXT;

-- 2. Allow authenticated participants to create conversations,
--    gated by an active connection. Client must sort (user_a < user_b)
--    to satisfy the conversations_canonical CHECK constraint.
CREATE POLICY "participants can create conversation"
  ON conversations FOR INSERT
  WITH CHECK (
    (auth.uid() = user_a OR auth.uid() = user_b)
    AND EXISTS (
      SELECT 1 FROM connections
      WHERE (
        (connections.user_a = conversations.user_a AND connections.user_b = conversations.user_b)
        OR (connections.user_a = conversations.user_b AND connections.user_b = conversations.user_a)
      )
      AND connections.removed_at IS NULL
    )
  );

-- 3. Auto-stamp last_message_at via trigger so the client does not need
--    a separate UPDATE call. SECURITY DEFINER bypasses RLS on conversations.
CREATE OR REPLACE FUNCTION update_conversation_last_message_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_message_inserted ON messages;
CREATE TRIGGER on_message_inserted
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_last_message_at();
