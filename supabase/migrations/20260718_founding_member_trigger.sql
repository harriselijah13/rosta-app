-- BEFORE INSERT trigger on profiles.
-- Sets founding_member = true for the first 500 members, false thereafter.
-- Fires for all signup paths (web, native, landing site) since all paths
-- ultimately create a profiles row through the auth trigger.
-- Supersedes the application-level founding_member assignments in
-- app/api/invite/redeem/route.ts (removed in the same change set).

CREATE OR REPLACE FUNCTION auto_set_founding_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count bigint;
BEGIN
  SELECT COUNT(*) INTO v_count FROM profiles;
  -- v_count is the number of rows BEFORE this insert
  NEW.founding_member := (v_count < 500);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_founding_member_on_insert ON profiles;
CREATE TRIGGER set_founding_member_on_insert
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION auto_set_founding_member();
