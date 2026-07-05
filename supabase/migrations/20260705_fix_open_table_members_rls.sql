-- Fix: infinite recursion in open_table_members RLS
--
-- The policy "Members can read co-members of their rooms" queried
-- open_table_members inside a policy ON open_table_members, causing
-- PostgreSQL to recurse infinitely on every SELECT.
--
-- Fix: SECURITY DEFINER helper that checks membership without triggering RLS,
-- then rewrite the policy to call it.

CREATE OR REPLACE FUNCTION is_open_table_member(_room_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM open_table_members
    WHERE room_id = _room_id
      AND user_id = _user_id
  );
$$;

DROP POLICY IF EXISTS "Members can read co-members of their rooms" ON open_table_members;

CREATE POLICY "Members can read co-members of their rooms"
  ON open_table_members FOR SELECT
  USING (
    is_open_table_member(room_id, auth.uid())
  );
