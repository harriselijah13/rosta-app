-- 2026081606_admin_campaign_rpcs.sql
--
-- SECURITY DEFINER RPCs for native admin management of notification campaigns
-- and temporary promo screens.
--
-- Security model:
--   - notification_campaigns and temporary_screens have NO client-facing RLS policies.
--   - All native reads/writes go through these functions.
--   - Every function raises EXCEPTION 'Unauthorized' (not a silent no-op) if
--     auth.uid() is not an admin — matching admin_verify_member / admin_set_admin_status.
--
-- Naming convention follows existing admin RPCs in 2026072702_admin_rpc_functions.sql.

-- ── Campaigns ─────────────────────────────────────────────────────────────────

-- List all campaigns ordered newest-first, including delivery counts.
CREATE OR REPLACE FUNCTION public.admin_list_campaigns()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(t))
    FROM (
      SELECT
        c.id, c.title, c.message, c.status,
        c.recipient_mode, c.recipient_ids,
        c.send_mode, c.scheduled_at, c.recurrence_rule, c.recurrence_end,
        c.next_send_at, c.last_sent_at,
        c.destination_type, c.destination_route, c.promo_screen_id,
        c.created_at, c.updated_at,
        COALESCE(d.cnt, 0)::int AS delivery_count
      FROM notification_campaigns c
      LEFT JOIN (
        SELECT campaign_id, COUNT(*) AS cnt
        FROM campaign_deliveries
        GROUP BY campaign_id
      ) d ON d.campaign_id = c.id
      ORDER BY c.created_at DESC
    ) t
  ), '[]'::jsonb);
END;
$$;

-- Fetch a single campaign by id (for edit form pre-population).
CREATE OR REPLACE FUNCTION public.admin_get_campaign(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN (
    SELECT row_to_json(t)
    FROM (
      SELECT
        c.id, c.title, c.message, c.status,
        c.recipient_mode, c.recipient_ids,
        c.send_mode, c.scheduled_at, c.recurrence_rule, c.recurrence_end,
        c.next_send_at, c.last_sent_at,
        c.destination_type, c.destination_route, c.promo_screen_id,
        c.created_at, c.updated_at,
        COALESCE(d.cnt, 0)::int AS delivery_count
      FROM notification_campaigns c
      LEFT JOIN (
        SELECT campaign_id, COUNT(*) AS cnt
        FROM campaign_deliveries
        GROUP BY campaign_id
      ) d ON d.campaign_id = c.id
      WHERE c.id = p_id
    ) t
  );
END;
$$;

-- Create a campaign. Optionally creates a new temporary_screen first if
-- p_input->'new_promo_screen' is present and non-null.
--
-- p_input shape:
--   title            text          required
--   message          text          required
--   recipient_mode   text          'all' | 'specific'
--   recipient_ids    jsonb array   uuid strings; only read when recipient_mode='specific'
--   send_mode        text          'immediate' | 'scheduled' | 'recurring'
--   scheduled_at     text          ISO string or '' (required for scheduled/recurring)
--   recurrence_rule  text          'daily' | 'weekly' | 'monthly' or ''
--   recurrence_end   text          ISO string or '' (optional, recurring only)
--   destination_type text          'route' | 'promo_screen'
--   destination_route text         app route string or ''
--   promo_screen_id  text          UUID string or '' (when using existing screen)
--   new_promo_screen jsonb | null  inline promo screen creation
--     headline       text
--     body           text
--     mascot_pose    text or ''
--     cta_label      text or ''  (defaults 'Got it')
--     cta_action     text or ''
--     starts_at      text ISO or ''
--     expires_at     text ISO or ''
--
-- Returns the new campaign UUID.
CREATE OR REPLACE FUNCTION public.admin_create_campaign(p_input jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid         uuid := auth.uid();
  _campaign_id uuid;
  _screen_id   uuid;
  _send_mode   text;
  _status      text;
  _next_send   timestamptz;
  _new_promo   jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = _uid AND is_admin = true) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  _send_mode := p_input->>'send_mode';
  _new_promo := p_input->'new_promo_screen';

  -- Optionally create a new promo screen inline
  IF _new_promo IS NOT NULL AND _new_promo != 'null'::jsonb THEN
    INSERT INTO temporary_screens (
      headline, body, mascot_pose, cta_label, cta_action, starts_at, expires_at, status
    ) VALUES (
      _new_promo->>'headline',
      _new_promo->>'body',
      NULLIF(_new_promo->>'mascot_pose', ''),
      COALESCE(NULLIF(_new_promo->>'cta_label', ''), 'Got it'),
      NULLIF(_new_promo->>'cta_action', ''),
      NULLIF(_new_promo->>'starts_at', '')::timestamptz,
      NULLIF(_new_promo->>'expires_at', '')::timestamptz,
      'active'
    )
    RETURNING id INTO _screen_id;
  ELSE
    _screen_id := NULLIF(p_input->>'promo_screen_id', '')::uuid;
  END IF;

  -- Derive initial status and next_send_at from send_mode
  IF _send_mode = 'immediate' THEN
    _status    := 'scheduled';
    _next_send := now();
  ELSIF _send_mode = 'scheduled' THEN
    _status    := 'scheduled';
    _next_send := NULLIF(p_input->>'scheduled_at', '')::timestamptz;
  ELSE -- recurring
    _status    := 'active';
    _next_send := NULLIF(p_input->>'scheduled_at', '')::timestamptz;
  END IF;

  INSERT INTO notification_campaigns (
    created_by,
    title, message,
    recipient_mode, recipient_ids,
    send_mode, scheduled_at, recurrence_rule, recurrence_end,
    destination_type, destination_route, promo_screen_id,
    status, next_send_at
  ) VALUES (
    _uid,
    p_input->>'title',
    p_input->>'message',
    p_input->>'recipient_mode',
    CASE
      WHEN p_input->>'recipient_mode' = 'specific'
       AND p_input->'recipient_ids' IS NOT NULL
       AND p_input->'recipient_ids' != 'null'::jsonb
       AND jsonb_array_length(p_input->'recipient_ids') > 0
      THEN ARRAY(SELECT jsonb_array_elements_text(p_input->'recipient_ids'))::uuid[]
      ELSE NULL
    END,
    _send_mode,
    NULLIF(p_input->>'scheduled_at', '')::timestamptz,
    NULLIF(p_input->>'recurrence_rule', ''),
    NULLIF(p_input->>'recurrence_end', '')::timestamptz,
    p_input->>'destination_type',
    NULLIF(p_input->>'destination_route', ''),
    _screen_id,
    _status,
    _next_send
  )
  RETURNING id INTO _campaign_id;

  RETURN _campaign_id;
END;
$$;

-- Update a campaign. Only allowed when status = 'draft'.
-- Accepts the same p_input shape as admin_create_campaign.
-- new_promo_screen is ignored on update (promo screen must be created separately).
CREATE OR REPLACE FUNCTION public.admin_update_campaign(p_id uuid, p_input jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid       uuid := auth.uid();
  _send_mode text;
  _status    text;
  _next_send timestamptz;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = _uid AND is_admin = true) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM notification_campaigns WHERE id = p_id AND status = 'draft') THEN
    RAISE EXCEPTION 'Campaign is not in draft status';
  END IF;

  _send_mode := p_input->>'send_mode';

  IF _send_mode = 'immediate' THEN
    _status    := 'scheduled';
    _next_send := now();
  ELSIF _send_mode = 'scheduled' THEN
    _status    := 'scheduled';
    _next_send := NULLIF(p_input->>'scheduled_at', '')::timestamptz;
  ELSE
    _status    := 'active';
    _next_send := NULLIF(p_input->>'scheduled_at', '')::timestamptz;
  END IF;

  UPDATE notification_campaigns SET
    title            = p_input->>'title',
    message          = p_input->>'message',
    recipient_mode   = p_input->>'recipient_mode',
    recipient_ids    = CASE
                         WHEN p_input->>'recipient_mode' = 'specific'
                          AND p_input->'recipient_ids' IS NOT NULL
                          AND p_input->'recipient_ids' != 'null'::jsonb
                          AND jsonb_array_length(p_input->'recipient_ids') > 0
                         THEN ARRAY(SELECT jsonb_array_elements_text(p_input->'recipient_ids'))::uuid[]
                         ELSE NULL
                       END,
    send_mode        = _send_mode,
    scheduled_at     = NULLIF(p_input->>'scheduled_at', '')::timestamptz,
    recurrence_rule  = NULLIF(p_input->>'recurrence_rule', ''),
    recurrence_end   = NULLIF(p_input->>'recurrence_end', '')::timestamptz,
    destination_type = p_input->>'destination_type',
    destination_route = NULLIF(p_input->>'destination_route', ''),
    promo_screen_id  = NULLIF(p_input->>'promo_screen_id', '')::uuid,
    status           = _status,
    next_send_at     = _next_send,
    updated_at       = now()
  WHERE id = p_id;
END;
$$;

-- Pause or resume a campaign.
-- p_action: 'pause' | 'resume'
CREATE OR REPLACE FUNCTION public.admin_set_campaign_status(p_id uuid, p_action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid  uuid := auth.uid();
  _camp notification_campaigns%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = _uid AND is_admin = true) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_action NOT IN ('pause', 'resume') THEN
    RAISE EXCEPTION 'p_action must be pause or resume';
  END IF;

  SELECT * INTO _camp FROM notification_campaigns WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  IF p_action = 'pause' THEN
    IF _camp.status NOT IN ('active', 'scheduled') THEN
      RAISE EXCEPTION 'Can only pause active or scheduled campaigns';
    END IF;
    UPDATE notification_campaigns
    SET status = 'paused', updated_at = now()
    WHERE id = p_id;

  ELSE -- resume
    IF _camp.status != 'paused' THEN
      RAISE EXCEPTION 'Campaign is not paused';
    END IF;
    UPDATE notification_campaigns
    SET
      status     = CASE WHEN _camp.send_mode = 'recurring' THEN 'active' ELSE 'scheduled' END,
      updated_at = now()
    WHERE id = p_id;
  END IF;
END;
$$;

-- Delete a campaign. Only allowed for draft or completed campaigns.
CREATE OR REPLACE FUNCTION public.admin_delete_campaign(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM notification_campaigns
    WHERE id = p_id AND status IN ('draft', 'completed')
  ) THEN
    RAISE EXCEPTION 'Can only delete draft or completed campaigns';
  END IF;

  DELETE FROM notification_campaigns WHERE id = p_id;
END;
$$;

-- ── Temporary screens ─────────────────────────────────────────────────────────

-- List all temporary_screens ordered newest-first.
CREATE OR REPLACE FUNCTION public.admin_list_temporary_screens()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(t))
    FROM (
      SELECT id, headline, body, mascot_pose, cta_label, cta_action,
             starts_at, expires_at, status, created_at
      FROM temporary_screens
      ORDER BY created_at DESC
    ) t
  ), '[]'::jsonb);
END;
$$;

-- Create a temporary screen.
-- p_input: headline, body, mascot_pose, cta_label, cta_action, starts_at, expires_at, status
-- Returns the new screen UUID.
CREATE OR REPLACE FUNCTION public.admin_create_temporary_screen(p_input jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO temporary_screens (
    headline, body, mascot_pose, cta_label, cta_action, starts_at, expires_at, status
  ) VALUES (
    p_input->>'headline',
    p_input->>'body',
    NULLIF(p_input->>'mascot_pose', ''),
    COALESCE(NULLIF(p_input->>'cta_label', ''), 'Got it'),
    NULLIF(p_input->>'cta_action', ''),
    NULLIF(p_input->>'starts_at', '')::timestamptz,
    NULLIF(p_input->>'expires_at', '')::timestamptz,
    COALESCE(NULLIF(p_input->>'status', ''), 'active')
  )
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

-- Update a temporary screen.
-- p_input: same shape as admin_create_temporary_screen.
CREATE OR REPLACE FUNCTION public.admin_update_temporary_screen(p_id uuid, p_input jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE temporary_screens SET
    headline    = p_input->>'headline',
    body        = p_input->>'body',
    mascot_pose = NULLIF(p_input->>'mascot_pose', ''),
    cta_label   = COALESCE(NULLIF(p_input->>'cta_label', ''), 'Got it'),
    cta_action  = NULLIF(p_input->>'cta_action', ''),
    starts_at   = NULLIF(p_input->>'starts_at', '')::timestamptz,
    expires_at  = NULLIF(p_input->>'expires_at', '')::timestamptz,
    status      = COALESCE(NULLIF(p_input->>'status', ''), 'active')
  WHERE id = p_id;
END;
$$;
