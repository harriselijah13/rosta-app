-- Persistent Matchmaker dismissals: records pairs a user has said "not this time" to.
-- member_a_id/member_b_id are always stored in ascending UUID order so A↔B and B↔A
-- resolve to the same row.

CREATE TABLE IF NOT EXISTS matchmaker_dismissals (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_a_id uuid        NOT NULL,
  member_b_id uuid        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT matchmaker_dismissals_canonical CHECK (member_a_id < member_b_id),
  CONSTRAINT matchmaker_dismissals_unique    UNIQUE (user_id, member_a_id, member_b_id)
);

CREATE INDEX IF NOT EXISTS matchmaker_dismissals_user_idx
  ON matchmaker_dismissals (user_id);

ALTER TABLE matchmaker_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own dismissals"
  ON matchmaker_dismissals FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
