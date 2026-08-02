-- Admin RPC to delete a member's profile and associated data.
-- Hard-deletes the profiles row; FK cascades will clean up signals,
-- member_badges, intro_credits, conversation_outcomes, profile_views.
-- Conversations and messages survive (they belong to both parties);
-- the orphaned user_a/user_b reference is acceptable since the profile
-- row is gone and the auth user cannot sign in without onboarding.
-- Connections are soft-retained in case of audit need but become inert.
-- Note: deleting from auth.users requires the service role; this RPC
-- removes all app-visible data, which is sufficient for admin use.

CREATE OR REPLACE FUNCTION admin_delete_member(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Hard-delete profile; downstream cascade handles signals, badges, credits, etc.
  DELETE FROM profiles WHERE id = target_user_id;
END;
$$;
