-- SECURITY DEFINER RPC functions for native admin panel operations.
--
-- The native admin panel uses the same anon-key Supabase client as regular users.
-- Direct .update()/.upsert() calls on other users' rows are blocked by RLS:
--   - UPDATE returns 0 rows silently (no error thrown)
--   - INSERT throws an explicit RLS violation error
-- These SECURITY DEFINER functions bypass RLS while still validating the caller
-- is an admin via auth.uid(). Called from the native app via supabase.rpc().

-- ── 1. admin_verify_member ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION admin_verify_member(target_user_id uuid, verified boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE profiles
  SET
    is_verified         = verified,
    verification_status = CASE WHEN verified THEN 'approved' ELSE NULL END
  WHERE id = target_user_id;
END;
$$;

-- ── 2. admin_set_admin_status ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION admin_set_admin_status(target_user_id uuid, make_admin boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF target_user_id = auth.uid() AND NOT make_admin THEN
    RAISE EXCEPTION 'Cannot remove your own admin status';
  END IF;
  UPDATE profiles SET is_admin = make_admin WHERE id = target_user_id;
END;
$$;

-- ── 3. admin_grant_premium ─────────────────────────────────────────────────────
-- duration: '30_days' | 'permanent' | 'revoke'
-- 'revoke' only clears admin_granted premium; never touches paid subscriptions.

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
    SET is_premium = false, premium_source = null, premium_expires_at = null
    WHERE id = target_user_id AND premium_source = 'admin_granted';
  ELSIF duration = '30_days' THEN
    UPDATE profiles
    SET is_premium = true, premium_source = 'admin_granted',
        premium_expires_at = NOW() + INTERVAL '30 days'
    WHERE id = target_user_id;
  ELSE
    UPDATE profiles
    SET is_premium = true, premium_source = 'admin_granted', premium_expires_at = null
    WHERE id = target_user_id;
  END IF;
END;
$$;

-- ── 4. admin_set_open_door ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION admin_set_open_door(target_user_id uuid, enable boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF enable THEN
    INSERT INTO signals (user_id, open_to, updated_at)
    VALUES (target_user_id, ARRAY['open_door'], NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET open_to    = array(SELECT DISTINCT unnest(signals.open_to || ARRAY['open_door']::text[])),
        updated_at = NOW();
  ELSE
    INSERT INTO signals (user_id, open_to, updated_at)
    VALUES (target_user_id, ARRAY[]::text[], NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET open_to    = array_remove(signals.open_to, 'open_door'),
        updated_at = NOW();
  END IF;
END;
$$;
