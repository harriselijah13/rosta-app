-- Update admin_grant_premium to allow revoking paid subscriptions.
--
-- Changes from original:
--   - Revoke path: removes AND premium_source = 'admin_granted' guard — now works on any row.
--   - Revoke path: sets premium_source = 'admin_revoked' when revoking a paid user
--     (so we can distinguish "never subscribed" from "was paid, admin cut them off"),
--     and null for any other source (admin_granted, etc.).
--   - Grant paths (30_days, permanent): unchanged — no premium_source restriction,
--     so they work from any state including admin_revoked.

CREATE OR REPLACE FUNCTION admin_grant_premium(target_user_id uuid, duration text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF duration NOT IN ('30_days', 'permanent', 'revoke') THEN
    RAISE EXCEPTION 'duration must be 30_days, permanent, or revoke';
  END IF;

  IF duration = 'revoke' THEN
    UPDATE profiles
    SET
      is_premium          = false,
      premium_source      = CASE WHEN premium_source = 'paid' THEN 'admin_revoked' ELSE null END,
      premium_expires_at  = null
    WHERE id = target_user_id;

  ELSIF duration = '30_days' THEN
    UPDATE profiles
    SET
      is_premium         = true,
      premium_source     = 'admin_granted',
      premium_expires_at = NOW() + INTERVAL '30 days'
    WHERE id = target_user_id;

  ELSE
    UPDATE profiles
    SET
      is_premium         = true,
      premium_source     = 'admin_granted',
      premium_expires_at = null
    WHERE id = target_user_id;
  END IF;
END;
$$;
