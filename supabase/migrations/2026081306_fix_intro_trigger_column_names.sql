-- 2026081306_fix_intro_trigger_column_names.sql
-- HOTFIX: trigger and RPC from 2026081303 referenced NEW.message and matched_pair_id,
-- neither of which exist on intro_requests. The real columns are:
--   message       → requester_note
--   matched_pair_id → does not exist; omit from INSERT
-- Every warm_intro INSERT with a facilitator was failing with
-- "record new has no field message" since 2026081303 was applied.

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

  -- INSERT: new warm_intro pending → notify facilitator
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
        'message',          NEW.requester_note,  -- was NEW.message (wrong)
        'intro_request_id', NEW.id
      )
    );
    RETURN NEW;
  END IF;

  -- UPDATE: warm_intro status transitions
  IF TG_OP = 'UPDATE' AND NEW.type = 'warm_intro' THEN

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
            'message',     NEW.requester_note  -- was NEW.message (wrong)
          )
        );
    END IF;

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

-- Trigger already exists from 2026081303 — replace function is enough.

-- Fix create_matchmaker_intro: wrong column names (message → requester_note,
-- matched_pair_id removed — that column doesn't exist on intro_requests).
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

  -- Insert the two intro_request rows.
  -- Columns: no matched_pair_id (doesn't exist), requester_note not message.
  INSERT INTO intro_requests
    (type, requester_id, target_id, facilitator_id, requester_note, status)
  VALUES
    ('matchmaker', _uid, p1_id, _uid, msg, 'pending'),
    ('matchmaker', _uid, p2_id, _uid, msg, 'pending');

  -- Notifications for both parties
  INSERT INTO notifications (user_id, type, data)
  VALUES
    (p1_id, 'intro_incoming', jsonb_build_object('from_name', _fac, 'target_name', _p2, 'message', msg)),
    (p2_id, 'intro_incoming', jsonb_build_object('from_name', _fac, 'target_name', _p1, 'message', msg));

  RETURN jsonb_build_object('ok', true);
END;
$$;
