-- SECURITY DEFINER function for admin invite code generation.
-- invite_codes has no INSERT policy; direct inserts from the native app fail.
-- This function replicates the client-side generateCode() logic (8 chars from
-- ABCDEFGHJKLMNPQRSTUVWXYZ23456789) in SQL, assigns owner_id = auth.uid(),
-- and bypasses RLS as the function owner.

CREATE OR REPLACE FUNCTION admin_generate_invite_codes(count integer DEFAULT 10)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  chars    text    := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i        integer;
  new_code text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF count < 1 OR count > 100 THEN
    RAISE EXCEPTION 'count must be between 1 and 100';
  END IF;
  FOR i IN 1..count LOOP
    new_code := (
      SELECT string_agg(substr(chars, (floor(random() * length(chars)) + 1)::int, 1), '')
      FROM generate_series(1, 8)
    );
    INSERT INTO invite_codes (code, owner_id) VALUES (new_code, auth.uid());
  END LOOP;
END;
$$;
