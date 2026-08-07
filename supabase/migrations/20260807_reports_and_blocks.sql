-- reports: captures user-submitted content reports for admin moderation.
-- blocks: records bidirectional block relationships between users.
-- Enforcement policies (messages, connections, intro_requests) are in the
-- companion migration 20260807_block_enforcement_policies.sql.

-- ── Reports ───────────────────────────────────────────────────────────────────

CREATE TABLE reports (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason      text        NOT NULL CHECK (reason IN (
                            'spam',
                            'harassment',
                            'fake_profile',
                            'inappropriate_content',
                            'other'
                          )),
  details     text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT  reports_no_self   CHECK (reporter_id != reported_id),
  CONSTRAINT  reports_once_each UNIQUE (reporter_id, reported_id)
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can submit one report per reported user
CREATE POLICY "reporters can insert own report"
  ON reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- Admins only for reading reports (moderation queue)
CREATE POLICY "admins can read all reports"
  ON reports FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ── Blocks ────────────────────────────────────────────────────────────────────

CREATE TABLE blocks (
  blocker_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT blocks_no_self CHECK (blocker_id != blocked_id)
);

ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;

-- Users manage only their own block entries (insert, delete, select)
CREATE POLICY "users manage own blocks"
  ON blocks FOR ALL
  USING  (auth.uid() = blocker_id)
  WITH CHECK (auth.uid() = blocker_id);
