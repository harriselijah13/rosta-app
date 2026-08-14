-- 2026081303_notifications_rls_hardening.sql
-- Close the notifications INSERT RLS gap.
--
-- The previous policy "authenticated users can insert notifications" used
-- WITH CHECK (true), allowing any auth'd user to insert a notification for
-- any other user. After this migration, that policy is dropped.
--
-- All legitimate notification paths are SECURITY DEFINER (triggers/RPCs) or use
-- the service-role / admin client — both bypass RLS entirely, so no INSERT policy
-- is needed for them.
--
-- Audit of every client-side notification insert before this migration:
--
--   NATIVE APP (auth key — needed migration):
--     matchmaking.tsx:427-438   intro_incoming  → now covered by trigger below
--     matchmaking.tsx:461-465   intro_declined  → now covered by trigger below
--     intro-request.tsx:190     intro_request   → now covered by trigger below
--     matchmaker.tsx:147-157    intro_incoming  → now covered by create_matchmaker_intro RPC below
--
--   WEB APP (admin client — already safe, no change):
--     lib/notifications.ts              all types      uses createAdminClient()
--     api/connections/request/route.ts  connection_req uses admin.from()
--     api/network/posts/.../react       reaction types uses admin.from()
--
-- Transition note: old native app builds will see a permission-denied error on
-- the now-removed INSERT policy, but the error is not surfaced to users (all four
-- inserts were either fire-and-forget or had no error check). The trigger ensures
-- the notification still reaches the recipient regardless of app version.

-- ── 1. Add intro_declined to type constraint (it was silently failing before) ──

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'connection_request',
    'connection_accepted',
    'intro_request',
    'intro_incoming',
    'intro_declined',
    'new_message',
    'whatsapp_share',
    'invite_request',
    'reaction_can_help',
    'reaction_know_someone',
    'post_forwarded',
    'profile_viewed',
    'lend_a_hand',
    'badge_earned'
  ));

-- ── 2. Trigger: intro_request / intro_incoming / intro_declined notifications ──
-- Fires AFTER INSERT OR UPDATE on intro_requests.
-- INSERT path: new warm_intro in pending state → notify facilitator.
-- UPDATE path: status transitions → notify the relevant parties.
-- Matchmaker intros (type='matchmaker') are handled by the RPC below.

CREATE OR REPLACE FUNCTION public.notify_on_intro_request_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req_name text;
  v_tgt_name text;
  v_fac_name text;
BEGIN
  SELECT TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
  INTO v_req_name FROM profiles WHERE id = NEW.requester_id;
  IF v_req_name IS NULL OR v_req_name = '' THEN v_req_name := 'Someone'; END IF;

  SELECT TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
  INTO v_tgt_name FROM profiles WHERE id = NEW.target_id;
  IF v_tgt_name IS NULL OR v_tgt_name = '' THEN v_tgt_name := 'Someone'; END IF;

  IF NEW.facilitator_id IS NOT NULL THEN
    SELECT TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
    INTO v_fac_name FROM profiles WHERE id = NEW.facilitator_id;
    IF v_fac_name IS NULL OR v_fac_name = '' THEN v_fac_name := 'Someone'; END IF;
  END IF;

  -- INSERT: warm_intro, pending, with a named facilitator → notify facilitator
  IF TG_OP = 'INSERT'
     AND NEW.type       = 'warm_intro'
     AND NEW.status     = 'pending'
     AND NEW.facilitator_id IS NOT NULL
  THEN
    INSERT INTO notifications (user_id, type, data)
    VALUES (
      NEW.facilitator_id,
      'intro_request',
      jsonb_build_object(
        'from_user_id',     NEW.requester_id,
        'from_name',        v_req_name,
        'target_id',        NEW.target_id,
        'target_name',      v_tgt_name,
        'message',          NEW.message,
        'intro_request_id', NEW.id
      )
    );
    RETURN NEW;
  END IF;

  -- UPDATE: warm_intro status transitions
  IF TG_OP = 'UPDATE' AND NEW.type = 'warm_intro' THEN

    -- Accepted: notify both parties
    IF NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted' THEN
      INSERT INTO notifications (user_id, type, data)
      VALUES
        (
          NEW.requester_id,
          'intro_incoming',
          jsonb_build_object(
            'from_name',   COALESCE(v_fac_name, 'Someone'),
            'target_name', v_tgt_name
          )
        ),
        (
          NEW.target_id,
          'intro_incoming',
          jsonb_build_object(
            'from_name',   COALESCE(v_fac_name, 'Someone'),
            'target_name', v_req_name,
            'message',     NEW.message
          )
        );
    END IF;

    -- Declined: notify requester
    IF NEW.status = 'declined' AND OLD.status IS DISTINCT FROM 'declined' THEN
      INSERT INTO notifications (user_id, type, data)
      VALUES (
        NEW.requester_id,
        'intro_declined',
        jsonb_build_object(
          'facilitator_name', COALESCE(v_fac_name, 'Someone'),
          'target_name',      v_tgt_name
        )
      );
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_intro_request_notify ON intro_requests;
CREATE TRIGGER on_intro_request_notify
  AFTER INSERT OR UPDATE ON intro_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_intro_request_change();

-- ── 3. RPC: create a matchmaker intro atomically ──────────────────────────────
-- The trigger above cannot send cross-named intro_incoming notifications for
-- matchmaker intros because each row only knows one target, and when row 1's
-- trigger fires, row 2 may not exist yet (same INSERT statement, AFTER ROW order).
-- This RPC creates both rows and inserts both notifications in one transaction.

CREATE OR REPLACE FUNCTION public.create_matchmaker_intro(
  p1_id   uuid,
  p2_id   uuid,
  msg     text,
  pair_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _fac text;
  _p1  text;
  _p2  text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
  INTO _fac FROM profiles WHERE id = _uid;
  IF _fac IS NULL OR _fac = '' THEN _fac := 'Someone'; END IF;

  SELECT TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
  INTO _p1 FROM profiles WHERE id = p1_id;
  IF _p1 IS NULL OR _p1 = '' THEN _p1 := 'Someone'; END IF;

  SELECT TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
  INTO _p2 FROM profiles WHERE id = p2_id;
  IF _p2 IS NULL OR _p2 = '' THEN _p2 := 'Someone'; END IF;

  -- Create the two intro_request rows. The notify trigger fires here
  -- but type='matchmaker'+status='pending' is a no-op in that trigger.
  INSERT INTO intro_requests
    (type, requester_id, target_id, facilitator_id, message, status, matched_pair_id)
  VALUES
    ('matchmaker', _uid, p1_id, _uid, msg, 'pending', pair_id),
    ('matchmaker', _uid, p2_id, _uid, msg, 'pending', pair_id);

  -- Notifications for both parties with correct cross-names
  INSERT INTO notifications (user_id, type, data)
  VALUES
    (
      p1_id,
      'intro_incoming',
      jsonb_build_object('from_name', _fac, 'target_name', _p2, 'message', msg)
    ),
    (
      p2_id,
      'intro_incoming',
      jsonb_build_object('from_name', _fac, 'target_name', _p1, 'message', msg)
    );

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_matchmaker_intro(uuid, uuid, text, uuid) FROM public;
GRANT  EXECUTE ON FUNCTION public.create_matchmaker_intro(uuid, uuid, text, uuid) TO authenticated;

-- ── 4. Drop the permissive INSERT policy ──────────────────────────────────────
DROP POLICY IF EXISTS "authenticated users can insert notifications" ON notifications;
