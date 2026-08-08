-- Allow authenticated users to insert intro_requests where they are the requester.
-- Covers open_door connection requests (member/[id].tsx) and facilitated intro
-- requests (intro-request.tsx). No INSERT policy existed before this migration;
-- all inserts were blocked by RLS (loudly for INSERT, unlike UPDATE which fails silently).

CREATE POLICY "requester can insert intro_request"
  ON intro_requests FOR INSERT
  WITH CHECK (auth.uid() = requester_id);
