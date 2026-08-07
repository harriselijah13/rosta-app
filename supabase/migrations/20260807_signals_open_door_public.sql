-- Open Door signals must be readable by any authenticated user.
--
-- Problem: the existing "own or connected signals" policy blocks non-connected
-- users from reading signals, so the Open Door flag is never visible to the
-- people it's explicitly meant to reach. The native app's member profile view
-- fetches signals with the anon/auth key (not service role), so it hits RLS and
-- gets null → hasOpenDoor = false → the Connect button never appears.
--
-- Fix: additive SELECT policy that allows any authenticated user to read signals
-- rows where 'open_door' is present in open_to. This is the minimal permissive
-- change — it only applies to members who have explicitly opted in to Open Door.
-- All other signal rows remain gated by the existing "own or connected" policy.

CREATE POLICY "open door signals readable by all authenticated"
  ON signals FOR SELECT
  USING ('open_door' = ANY(open_to));
