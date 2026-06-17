-- Pre-flight: verify no orphaned signals before applying FK.
-- Run this first and confirm count = 0:
--
--   SELECT COUNT(*)
--   FROM signals s
--   LEFT JOIN profiles p ON p.id = s.user_id
--   WHERE p.id IS NULL;
--
-- In practice, one orphaned row existed (contact@fynlstudio.com — a test
-- account with no profile). Its signals row and invite_codes.used_by
-- reference were cleared, and the auth user was deleted, before this
-- migration was applied.
--
-- The signals table previously had:
--   signals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
--
-- That FK prevented PostgREST from resolving profiles(signals(...)) embedded
-- joins (PGRST200), because no direct FK existed between signals and profiles.
-- Replaced with a direct reference to profiles(id) so embedded joins work as
-- intended. Cascade behaviour is unchanged end-to-end since profiles.id
-- itself references auth.users(id) ON DELETE CASCADE.

ALTER TABLE signals DROP CONSTRAINT IF EXISTS signals_user_id_fkey;

ALTER TABLE signals
  ADD CONSTRAINT signals_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES profiles(id)
  ON DELETE CASCADE;
