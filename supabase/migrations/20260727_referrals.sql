-- referrals table + RLS + trigger for auto-insert on profile creation.
-- The referral row is created by a trigger (not by the user directly)
-- so no INSERT policy is needed. The ref is stored in
-- auth.users.raw_user_meta_data->>'ref' at signup time.

CREATE TABLE IF NOT EXISTS referrals (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_id  uuid        NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referrer can view own referrals" ON referrals
  FOR SELECT USING (referrer_id = auth.uid());

-- Fires after a new profile row is inserted.
-- Reads auth.users.raw_user_meta_data->>'ref' and inserts the referral
-- if the ref resolves to an existing profile.
CREATE OR REPLACE FUNCTION handle_new_profile_referral()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ref_id uuid;
BEGIN
  BEGIN
    _ref_id := (
      SELECT (raw_user_meta_data->>'ref')::uuid
      FROM auth.users WHERE id = NEW.id
    );
  EXCEPTION WHEN OTHERS THEN
    _ref_id := NULL;
  END;

  IF _ref_id IS NOT NULL AND _ref_id <> NEW.id
    AND EXISTS (SELECT 1 FROM profiles WHERE id = _ref_id)
  THEN
    INSERT INTO referrals (referrer_id, referred_id)
    VALUES (_ref_id, NEW.id)
    ON CONFLICT (referred_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created_add_referral
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_new_profile_referral();
