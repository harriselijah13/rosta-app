-- Fix admin_verify_member: verification_status is NOT NULL.
-- When removing verification, set 'none' (the "explicitly removed" value used
-- by the web admin) instead of NULL, which violates the NOT NULL constraint.

CREATE OR REPLACE FUNCTION admin_verify_member(target_user_id uuid, verified boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE profiles
  SET
    is_verified         = verified,
    verification_status = CASE WHEN verified THEN 'approved' ELSE 'none' END
  WHERE id = target_user_id;
END;
$$;
