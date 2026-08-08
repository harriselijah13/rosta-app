-- Enforce blocks at the interaction layer: messages, connections, and direct
-- open_door intro requests. Replaces three existing INSERT policies.
-- Requires the blocks table from 20260807_reports_and_blocks.sql.

-- ── messages INSERT ───────────────────────────────────────────────────────────
-- Deny if either party has blocked the other.

DROP POLICY IF EXISTS "sender can insert" ON messages;

CREATE POLICY "sender can insert"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    -- Must be a participant in the conversation
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
        AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
    )
    -- Deny if a block exists in either direction between the two parties
    AND NOT EXISTS (
      SELECT 1
      FROM   blocks b
      JOIN   conversations c ON c.id = conversation_id
      WHERE  (
        -- recipient blocked sender
        b.blocker_id = CASE WHEN c.user_a = auth.uid() THEN c.user_b ELSE c.user_a END
        AND b.blocked_id = auth.uid()
      ) OR (
        -- sender blocked recipient
        b.blocker_id = auth.uid()
        AND b.blocked_id = CASE WHEN c.user_a = auth.uid() THEN c.user_b ELSE c.user_a END
      )
    )
  );

-- ── connections INSERT ────────────────────────────────────────────────────────
-- Deny if either party has blocked the other.

DROP POLICY IF EXISTS "participants can insert connection" ON connections;

CREATE POLICY "participants can insert connection"
  ON connections FOR INSERT
  WITH CHECK (
    (auth.uid() = user_a OR auth.uid() = user_b)
    AND NOT EXISTS (
      SELECT 1 FROM blocks b
      WHERE (b.blocker_id = connections.user_a AND b.blocked_id = connections.user_b)
         OR (b.blocker_id = connections.user_b AND b.blocked_id = connections.user_a)
    )
  );

-- ── intro_requests INSERT ─────────────────────────────────────────────────────
-- Only block direct open_door connection requests across a block.
-- Matchmaker-facilitated intros (type != 'open_door') are not affected because
-- the facilitator is the requester, not the blocked party.

DROP POLICY IF EXISTS "requester can insert intro_request" ON intro_requests;

CREATE POLICY "requester can insert intro_request"
  ON intro_requests FOR INSERT
  WITH CHECK (
    auth.uid() = requester_id
    AND (
      type != 'open_door'
      OR NOT EXISTS (
        SELECT 1 FROM blocks b
        WHERE (b.blocker_id = intro_requests.target_id AND b.blocked_id = auth.uid())
           OR (b.blocker_id = auth.uid()              AND b.blocked_id = intro_requests.target_id)
      )
    )
  );
