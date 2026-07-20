-- Adds lend_a_hand factor to compute_connector_score().
-- +2 per can_help reaction where the reactor also sent at least one message
-- to the post author after reacting — confirming genuine follow-through.
-- A reaction with no follow-up message does not score.

CREATE OR REPLACE FUNCTION compute_connector_score()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid            uuid := auth.uid();
  _invites        int  := 0;
  _intro_reqs     int  := 0;
  _qr             int  := 0;
  _thank_yous     int  := 0;
  _open_tables    int  := 0;
  _signal_bonus   int  := 0;
  _deep_convos    int  := 0;
  _outcomes       int  := 0;
  _lend_a_hand    int  := 0;
  _signal_awarded timestamptz;
  _total          int;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- +5 per redeemed invite code owned by this user
  SELECT COUNT(*) INTO _invites
  FROM invite_codes
  WHERE owner_id = _uid AND used_at IS NOT NULL;

  -- +1 per accepted warm intro request made as requester
  SELECT COUNT(*) INTO _intro_reqs
  FROM intro_requests
  WHERE requester_id = _uid
    AND status = 'accepted'
    AND type   = 'warm_intro';

  -- +5 per QR connection (in-person scan)
  SELECT COUNT(*) INTO _qr
  FROM connections
  WHERE origin IN ('qr_member', 'qr_scan')
    AND (user_a = _uid OR user_b = _uid)
    AND removed_at IS NULL;

  -- +2 per thank-you received as facilitator
  SELECT COUNT(*) INTO _thank_yous
  FROM intro_requests
  WHERE facilitator_id = _uid
    AND thank_you_at IS NOT NULL;

  -- +1 per completed Open Table (proper JOIN replaces broken PostgREST embedded filter)
  SELECT COUNT(*) INTO _open_tables
  FROM open_table_members om
  JOIN open_table_rooms r ON r.id = om.room_id
  WHERE om.user_id = _uid
    AND r.expires_at < NOW();

  -- +2 signal bonus if signals updated within last 7 days
  SELECT signal_score_last_awarded INTO _signal_awarded
  FROM profiles WHERE id = _uid;

  IF _signal_awarded IS NOT NULL AND _signal_awarded >= NOW() - INTERVAL '7 days' THEN
    _signal_bonus := 2;
  END IF;

  -- Deep convos (+3) and outcomes (+8) from facilitated warm intros.
  -- Collapses the JS fanout (37+ round-trips) into a single set-based query.
  -- LEAST/GREATEST sorts requester/target into canonical user_a/user_b order.
  WITH facilitated AS (
    SELECT
      LEAST(requester_id, target_id)    AS ua,
      GREATEST(requester_id, target_id) AS ub,
      requester_id,
      target_id
    FROM intro_requests
    WHERE facilitator_id = _uid
      AND status = 'accepted'
      AND type   = 'warm_intro'
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

  -- +2 per can_help reaction followed by a message to the post author.
  -- LEAST/GREATEST for canonical conversations ordering (user_a < user_b constraint).
  -- COUNT(DISTINCT) ensures each post scores at most once.
  SELECT COUNT(DISTINCT r.post_id) INTO _lend_a_hand
  FROM network_post_reactions r
  JOIN network_posts p ON p.id = r.post_id
  JOIN conversations c ON (
    c.user_a = LEAST(_uid, p.author_id) AND
    c.user_b = GREATEST(_uid, p.author_id)
  )
  WHERE r.reactor_id    = _uid
    AND r.reaction_type = 'can_help'
    AND p.author_id     <> _uid
    AND EXISTS (
      SELECT 1 FROM messages m
      WHERE m.conversation_id = c.id
        AND m.sender_id       = _uid
        AND m.created_at      > r.created_at
    );

  _total :=
    _invites     * 5 +
    _intro_reqs  * 1 +
    _deep_convos * 3 +
    _qr          * 5 +
    _outcomes    * 8 +
    _thank_yous  * 2 +
    _open_tables * 1 +
    _signal_bonus +
    _lend_a_hand * 2;

  RETURN jsonb_build_object(
    'total',            _total,
    'invites_redeemed', _invites,
    'intro_requests',   _intro_reqs,
    'deep_convos',      _deep_convos,
    'qr_connections',   _qr,
    'outcomes',         _outcomes,
    'thank_yous',       _thank_yous,
    'open_tables',      _open_tables,
    'signal_bonus',     _signal_bonus,
    'lend_a_hand',      _lend_a_hand
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION compute_connector_score() FROM public;
GRANT  EXECUTE ON FUNCTION compute_connector_score() TO authenticated;
