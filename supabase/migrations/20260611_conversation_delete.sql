-- Conversation delete: ON DELETE CASCADE + per-user soft-delete

-- 1. Replace bare FK constraints with ON DELETE CASCADE so deleted auth.users
--    automatically clean up their conversations (and cascade to messages).
ALTER TABLE conversations
  DROP CONSTRAINT conversations_user_a_fkey,
  DROP CONSTRAINT conversations_user_b_fkey;

ALTER TABLE conversations
  ADD CONSTRAINT conversations_user_a_fkey
    FOREIGN KEY (user_a) REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT conversations_user_b_fkey
    FOREIGN KEY (user_b) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Per-user soft-delete: hides a conversation for one party without destroying
--    the other party's message history.
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS deleted_by_user_a BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_by_user_b BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Update read policy to exclude soft-deleted conversations.
DROP POLICY IF EXISTS "conversation members can read" ON conversations;

CREATE POLICY "conversation members can read"
  ON conversations FOR SELECT
  USING (
    (auth.uid() = user_a AND NOT deleted_by_user_a)
    OR (auth.uid() = user_b AND NOT deleted_by_user_b)
  );

-- 4. Allow members to flip their own soft-delete flag.
DROP POLICY IF EXISTS "members can soft-delete conversation" ON conversations;

CREATE POLICY "members can soft-delete conversation"
  ON conversations FOR UPDATE
  USING (auth.uid() = user_a OR auth.uid() = user_b)
  WITH CHECK (true);
