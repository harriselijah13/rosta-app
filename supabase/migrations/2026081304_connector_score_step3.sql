-- 2026081304_connector_score_step3.sql
-- Three new Connector Score factors:
--
--   Signal Complete (+5, one-time): awarded the first time a member fills all
--     three signal fields (Open To, Working On, Need Right Now). Tracked via
--     signals.complete_bonus_awarded (set by trigger; never cleared).
--
--   Premium bonus (+10, one-time): awarded when a member's account becomes
--     Premium for the first time. Tracked via profiles.premium_bonus_awarded.
--     Backfilled for current and past premium members.
--
-- Also adds admin_grant_premium update so new admin grants set the bonus flag,
-- and replaces compute_connector_score() with updated totals.
--
-- Facilitator weighting (Step 3.2) is deferred — no automated facilitator
-- selection exists today; building one from scratch needs explicit confirmation.

-- ── 1. Schema additions ───────────────────────────────────────────────────────

ALTER TABLE signals
  ADD COLUMN IF NOT EXISTS complete_bonus_awarded BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS premium_bonus_awarded BOOLEAN NOT NULL DEFAULT false;

-- ── 2. Trigger: set complete_bonus_awarded when all signal fields are filled ──

CREATE OR REPLACE FUNCTION public.check_signal_complete_bonus()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.complete_bonus_awarded = false
     AND NEW.working_on     IS NOT NULL AND NEW.working_on     <> ''
     AND NEW.need_right_now IS NOT NULL AND NEW.need_right_now <> ''
     AND NEW.open_to        IS NOT NULL AND array_length(NEW.open_to, 1) > 0
  THEN
    NEW.complete_bonus_awarded := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_signal_complete_bonus ON signals;
CREATE TRIGGER trg_signal_complete_bonus
  BEFORE INSERT OR UPDATE ON signals
  FOR EACH ROW
  EXECUTE FUNCTION public.check_signal_complete_bonus();

-- ── 3. Backfill existing data ─────────────────────────────────────────────────

-- Members who already have all signal fields filled earn the bonus immediately.
UPDATE signals
SET complete_bonus_awarded = true
WHERE complete_bonus_awarded = false
  AND working_on     IS NOT NULL AND working_on     <> ''
  AND need_right_now IS NOT NULL AND need_right_now <> ''
  AND open_to        IS NOT NULL AND array_length(open_to, 1) > 0;

-- Current and previously-premium members get the one-time premium bonus.
-- premium_source = 'admin_revoked' means "was paid, admin cut them off" —
-- they still earned the bonus at the point they were premium.
UPDATE profiles
SET premium_bonus_awarded = true
WHERE is_premium = true
   OR premium_source = 'admin_revoked';

-- ── 4. Update admin_grant_premium to set the premium bonus flag ───────────────

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
      is_premium         = false,
      premium_source     = CASE WHEN premium_source = 'paid' THEN 'admin_revoked' ELSE null END,
      premium_expires_at = null
      -- premium_bonus_awarded intentionally not cleared — the bonus is one-time
    WHERE id = target_user_id;

  ELSIF duration = '30_days' THEN
    UPDATE profiles
    SET
      is_premium            = true,
      premium_source        = 'admin_granted',
      premium_expires_at    = NOW() + INTERVAL '30 days',
      premium_bonus_awarded = true
    WHERE id = target_user_id;

  ELSE
    UPDATE profiles
    SET
      is_premium            = true,
      premium_source        = 'admin_granted',
      premium_expires_at    = null,
      premium_bonus_awarded = true
    WHERE id = target_user_id;
  END IF;
END;
$$;

-- ── 5. Replace compute_connector_score() with updated factors ─────────────────

CREATE OR REPLACE FUNCTION compute_connector_score()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid              uuid := auth.uid();
  _referrals        int  := 0;
  _intro_reqs       int  := 0;
  _qr               int  := 0;
  _thank_yous       int  := 0;
  _signal_bonus     int  := 0;
  _deep_convos      int  := 0;
  _outcomes         int  := 0;
  _lend_a_hand      int  := 0;
  _blueprint        int  := 0;
  _signal_complete  int  := 0;
  _premium_bonus    int  := 0;
  _signal_awarded   timestamptz;
  _total            int;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COUNT(*) INTO _referrals
  FROM referrals WHERE referrer_id = _uid;

  SELECT COUNT(*) INTO _intro_reqs
  FROM intro_requests
  WHERE requester_id = _uid AND status = 'accepted' AND type = 'warm_intro';

  SELECT COUNT(*) INTO _qr
  FROM connections
  WHERE origin IN ('qr_member', 'qr_scan')
    AND (user_a = _uid OR user_b = _uid)
    AND removed_at IS NULL;

  SELECT COUNT(*) INTO _thank_yous
  FROM intro_requests
  WHERE facilitator_id = _uid AND thank_you_at IS NOT NULL;

  SELECT signal_score_last_awarded INTO _signal_awarded
  FROM profiles WHERE id = _uid;

  IF _signal_awarded IS NOT NULL AND _signal_awarded >= NOW() - INTERVAL '7 days' THEN
    _signal_bonus := 2;
  END IF;

  WITH facilitated AS (
    SELECT
      LEAST(requester_id, target_id)    AS ua,
      GREATEST(requester_id, target_id) AS ub,
      requester_id, target_id
    FROM intro_requests
    WHERE facilitator_id = _uid AND status = 'accepted' AND type = 'warm_intro'
  ),
  matched_convs AS (
    SELECT c.id AS conv_id, f.requester_id, f.target_id
    FROM facilitated f
    JOIN conversations c ON c.user_a = f.ua AND c.user_b = f.ub
  ),
  msg_agg AS (
    SELECT
      mc.conv_id,
      COUNT(*) FILTER (WHERE m.sender_id = mc.requester_id) AS r_count,
      COUNT(*) FILTER (WHERE m.sender_id = mc.target_id)    AS t_count
    FROM matched_convs mc
    LEFT JOIN messages m ON m.conversation_id = mc.conv_id
    GROUP BY mc.conv_id, mc.requester_id, mc.target_id
  )
  SELECT
    COALESCE(COUNT(*) FILTER (WHERE r_count >= 3 AND t_count >= 3), 0),
    COALESCE((SELECT COUNT(*) FROM outcomes WHERE conversation_id IN (SELECT conv_id FROM matched_convs)), 0)
  INTO _deep_convos, _outcomes
  FROM msg_agg;

  SELECT COUNT(DISTINCT r.post_id) INTO _lend_a_hand
  FROM network_post_reactions r
  JOIN network_posts p ON p.id = r.post_id
  JOIN conversations c ON (
    c.user_a = LEAST(_uid, p.author_id) AND
    c.user_b = GREATEST(_uid, p.author_id)
  )
  WHERE r.reactor_id = _uid AND r.reaction_type = 'can_help' AND p.author_id <> _uid
    AND EXISTS (
      SELECT 1 FROM messages m
      WHERE m.conversation_id = c.id AND m.sender_id = _uid AND m.created_at > r.created_at
    );

  SELECT COUNT(*) INTO _blueprint FROM blueprints WHERE user_id = _uid;

  -- +5 one-time: first time all signal fields were filled
  SELECT CASE WHEN complete_bonus_awarded THEN 5 ELSE 0 END
  INTO _signal_complete FROM signals WHERE user_id = _uid;

  -- +10 one-time: member has ever had Premium
  SELECT CASE WHEN premium_bonus_awarded THEN 10 ELSE 0 END
  INTO _premium_bonus FROM profiles WHERE id = _uid;

  _total :=
    _referrals       * 5  +
    _intro_reqs      * 1  +
    _deep_convos     * 3  +
    _qr              * 5  +
    _outcomes        * 8  +
    _thank_yous      * 2  +
    _signal_bonus         +
    _lend_a_hand     * 10 +
    _blueprint       * 15 +
    _signal_complete      +
    _premium_bonus;

  RETURN jsonb_build_object(
    'total',            _total,
    'referrals',        _referrals,
    'intro_requests',   _intro_reqs,
    'deep_convos',      _deep_convos,
    'qr_connections',   _qr,
    'outcomes',         _outcomes,
    'thank_yous',       _thank_yous,
    'signal_bonus',     _signal_bonus,
    'lend_a_hand',      _lend_a_hand,
    'blueprint',        _blueprint,
    'signal_complete',  _signal_complete,
    'premium_bonus',    _premium_bonus
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION compute_connector_score() FROM public;
GRANT  EXECUTE ON FUNCTION compute_connector_score() TO authenticated;
