-- 2026081605_backfill_member_badges.sql
-- One-time retroactive badge award for all existing members.
--
-- Context: member_badges had a FK → badges(slug) that silently blocked every
-- award() upsert since the badges catalog table was never seeded. Migration
-- 2026081604 dropped that FK. This script does the catch-up pass.
--
-- This script also adds badge_earned_shown_at (from 20260620_badge_earned_shown.sql)
-- if it is missing from the live DB — that migration was never applied. The column
-- is required by profile.tsx to determine which badge celebration modals to show.
-- Using ADD COLUMN IF NOT EXISTS so this is safe whether or not the column exists.
--
-- What this deliberately suppresses:
--   • Push notifications: on_badge_earned_notify trigger disabled in-session.
--   • In-app celebration modals: badge_earned_shown_at = now() on every backfilled
--     row so the app treats each one as already seen. Only badges earned from this
--     point forward will trigger the celebration sheet.
--
-- What this does NOT award:
--   • founding-member: admin-granted only, no automated criterion.
--   • table-setter:    not in checkAndAwardBadges, requires Open Table data.
--
-- Connector-score badges use profiles.connector_score (cached column).
-- Members with stale/0 score get score-gated badges on next scoring event.
--
-- Outcomes source: `outcomes` table — same table queried by compute_connector_score()
-- for "+8 per outcome" (SELECT COUNT(*) FROM outcomes WHERE conversation_id IN ...).
-- Distinct from conversation_outcomes (per-user labels) and smart_match_outcomes
-- (no conversation_id column).
--
-- Safe to re-run: ADD COLUMN uses IF NOT EXISTS; every INSERT uses
-- ON CONFLICT (user_id, badge_slug) DO NOTHING.

BEGIN;

-- ── 0. Add the shown-at column if the 20260620 migration was never applied ────
ALTER TABLE member_badges
  ADD COLUMN IF NOT EXISTS badge_earned_shown_at TIMESTAMPTZ;

-- ── 1. Silence badge notifications for this transaction ───────────────────────
ALTER TABLE member_badges DISABLE TRIGGER on_badge_earned_notify;

-- ── 2. Log awards for the final report ───────────────────────────────────────
CREATE TEMP TABLE _backfill_log (
  badge_slug TEXT NOT NULL,
  user_id    UUID NOT NULL
) ON COMMIT DROP;

-- ── verified ──────────────────────────────────────────────────────────────────
WITH ins AS (
  INSERT INTO member_badges (user_id, badge_slug, badge_earned_shown_at)
  SELECT p.id, 'verified', now()
  FROM   profiles p
  LEFT  JOIN member_badges mb ON mb.user_id = p.id AND mb.badge_slug = 'verified'
  WHERE  p.is_verified = true
    AND  mb.user_id IS NULL
  ON CONFLICT (user_id, badge_slug) DO NOTHING
  RETURNING user_id, badge_slug
)
INSERT INTO _backfill_log SELECT badge_slug, user_id FROM ins;

-- ── first-connection ──────────────────────────────────────────────────────────
WITH all_connected AS (
  SELECT user_a AS uid FROM connections
  UNION
  SELECT user_b AS uid FROM connections
),
ins AS (
  INSERT INTO member_badges (user_id, badge_slug, badge_earned_shown_at)
  SELECT ac.uid, 'first-connection', now()
  FROM   all_connected ac
  LEFT  JOIN member_badges mb ON mb.user_id = ac.uid AND mb.badge_slug = 'first-connection'
  WHERE  mb.user_id IS NULL
  ON CONFLICT (user_id, badge_slug) DO NOTHING
  RETURNING user_id, badge_slug
)
INSERT INTO _backfill_log SELECT badge_slug, user_id FROM ins;

-- ── introducer ────────────────────────────────────────────────────────────────
WITH eligible AS (
  SELECT DISTINCT facilitator_id AS uid
  FROM   intro_requests
  WHERE  status = 'accepted'
    AND  type = 'warm_intro'
    AND  facilitator_id IS NOT NULL
),
ins AS (
  INSERT INTO member_badges (user_id, badge_slug, badge_earned_shown_at)
  SELECT e.uid, 'introducer', now()
  FROM   eligible e
  LEFT  JOIN member_badges mb ON mb.user_id = e.uid AND mb.badge_slug = 'introducer'
  WHERE  mb.user_id IS NULL
  ON CONFLICT (user_id, badge_slug) DO NOTHING
  RETURNING user_id, badge_slug
)
INSERT INTO _backfill_log SELECT badge_slug, user_id FROM ins;

-- ── connector (score ≥ 15) ────────────────────────────────────────────────────
WITH ins AS (
  INSERT INTO member_badges (user_id, badge_slug, badge_earned_shown_at)
  SELECT p.id, 'connector', now()
  FROM   profiles p
  LEFT  JOIN member_badges mb ON mb.user_id = p.id AND mb.badge_slug = 'connector'
  WHERE  p.connector_score >= 15
    AND  mb.user_id IS NULL
  ON CONFLICT (user_id, badge_slug) DO NOTHING
  RETURNING user_id, badge_slug
)
INSERT INTO _backfill_log SELECT badge_slug, user_id FROM ins;

-- ── bridge (score ≥ 40) ───────────────────────────────────────────────────────
WITH ins AS (
  INSERT INTO member_badges (user_id, badge_slug, badge_earned_shown_at)
  SELECT p.id, 'bridge', now()
  FROM   profiles p
  LEFT  JOIN member_badges mb ON mb.user_id = p.id AND mb.badge_slug = 'bridge'
  WHERE  p.connector_score >= 40
    AND  mb.user_id IS NULL
  ON CONFLICT (user_id, badge_slug) DO NOTHING
  RETURNING user_id, badge_slug
)
INSERT INTO _backfill_log SELECT badge_slug, user_id FROM ins;

-- ── catalyst (score ≥ 80) ─────────────────────────────────────────────────────
WITH ins AS (
  INSERT INTO member_badges (user_id, badge_slug, badge_earned_shown_at)
  SELECT p.id, 'catalyst', now()
  FROM   profiles p
  LEFT  JOIN member_badges mb ON mb.user_id = p.id AND mb.badge_slug = 'catalyst'
  WHERE  p.connector_score >= 80
    AND  mb.user_id IS NULL
  ON CONFLICT (user_id, badge_slug) DO NOTHING
  RETURNING user_id, badge_slug
)
INSERT INTO _backfill_log SELECT badge_slug, user_id FROM ins;

-- ── architect (score ≥ 150) ───────────────────────────────────────────────────
WITH ins AS (
  INSERT INTO member_badges (user_id, badge_slug, badge_earned_shown_at)
  SELECT p.id, 'architect', now()
  FROM   profiles p
  LEFT  JOIN member_badges mb ON mb.user_id = p.id AND mb.badge_slug = 'architect'
  WHERE  p.connector_score >= 150
    AND  mb.user_id IS NULL
  ON CONFLICT (user_id, badge_slug) DO NOTHING
  RETURNING user_id, badge_slug
)
INSERT INTO _backfill_log SELECT badge_slug, user_id FROM ins;

-- ── spark (1+ outcome) ────────────────────────────────────────────────────────
WITH user_convs AS (
  SELECT id AS conv_id, user_a AS uid FROM conversations
  UNION ALL
  SELECT id AS conv_id, user_b AS uid FROM conversations
),
outcome_counts AS (
  SELECT uc.uid, COUNT(o.id) AS cnt
  FROM   user_convs uc
  JOIN   outcomes o ON o.conversation_id = uc.conv_id
  GROUP  BY uc.uid
),
ins AS (
  INSERT INTO member_badges (user_id, badge_slug, badge_earned_shown_at)
  SELECT oc.uid, 'spark', now()
  FROM   outcome_counts oc
  LEFT  JOIN member_badges mb ON mb.user_id = oc.uid AND mb.badge_slug = 'spark'
  WHERE  oc.cnt >= 1
    AND  mb.user_id IS NULL
  ON CONFLICT (user_id, badge_slug) DO NOTHING
  RETURNING user_id, badge_slug
)
INSERT INTO _backfill_log SELECT badge_slug, user_id FROM ins;

-- ── five-outcomes (5+ outcomes) ───────────────────────────────────────────────
WITH user_convs AS (
  SELECT id AS conv_id, user_a AS uid FROM conversations
  UNION ALL
  SELECT id AS conv_id, user_b AS uid FROM conversations
),
outcome_counts AS (
  SELECT uc.uid, COUNT(o.id) AS cnt
  FROM   user_convs uc
  JOIN   outcomes o ON o.conversation_id = uc.conv_id
  GROUP  BY uc.uid
),
ins AS (
  INSERT INTO member_badges (user_id, badge_slug, badge_earned_shown_at)
  SELECT oc.uid, 'five-outcomes', now()
  FROM   outcome_counts oc
  LEFT  JOIN member_badges mb ON mb.user_id = oc.uid AND mb.badge_slug = 'five-outcomes'
  WHERE  oc.cnt >= 5
    AND  mb.user_id IS NULL
  ON CONFLICT (user_id, badge_slug) DO NOTHING
  RETURNING user_id, badge_slug
)
INSERT INTO _backfill_log SELECT badge_slug, user_id FROM ins;

-- ── signal-strength (streak ≥ 4 weeks) ───────────────────────────────────────
WITH ins AS (
  INSERT INTO member_badges (user_id, badge_slug, badge_earned_shown_at)
  SELECT p.id, 'signal-strength', now()
  FROM   profiles p
  LEFT  JOIN member_badges mb ON mb.user_id = p.id AND mb.badge_slug = 'signal-strength'
  WHERE  p.signal_streak >= 4
    AND  mb.user_id IS NULL
  ON CONFLICT (user_id, badge_slug) DO NOTHING
  RETURNING user_id, badge_slug
)
INSERT INTO _backfill_log SELECT badge_slug, user_id FROM ins;

-- ── thanked (3+ thank-yous as facilitator) ────────────────────────────────────
WITH ty_counts AS (
  SELECT facilitator_id AS uid, COUNT(*) AS cnt
  FROM   intro_requests
  WHERE  thank_you_at IS NOT NULL
    AND  facilitator_id IS NOT NULL
  GROUP  BY facilitator_id
),
ins AS (
  INSERT INTO member_badges (user_id, badge_slug, badge_earned_shown_at)
  SELECT ty.uid, 'thanked', now()
  FROM   ty_counts ty
  LEFT  JOIN member_badges mb ON mb.user_id = ty.uid AND mb.badge_slug = 'thanked'
  WHERE  ty.cnt >= 3
    AND  mb.user_id IS NULL
  ON CONFLICT (user_id, badge_slug) DO NOTHING
  RETURNING user_id, badge_slug
)
INSERT INTO _backfill_log SELECT badge_slug, user_id FROM ins;

-- ── all-in (5+ total badges) — evaluated last ────────────────────────────────
WITH badge_totals AS (
  SELECT user_id AS uid, COUNT(*) AS cnt
  FROM   member_badges
  GROUP  BY user_id
),
ins AS (
  INSERT INTO member_badges (user_id, badge_slug, badge_earned_shown_at)
  SELECT bt.uid, 'all-in', now()
  FROM   badge_totals bt
  LEFT  JOIN member_badges mb ON mb.user_id = bt.uid AND mb.badge_slug = 'all-in'
  WHERE  bt.cnt >= 5
    AND  mb.user_id IS NULL
  ON CONFLICT (user_id, badge_slug) DO NOTHING
  RETURNING user_id, badge_slug
)
INSERT INTO _backfill_log SELECT badge_slug, user_id FROM ins;

-- ── 3. Re-enable notifications for all future awards ─────────────────────────
ALTER TABLE member_badges ENABLE TRIGGER on_badge_earned_notify;

-- ── 4. Report ─────────────────────────────────────────────────────────────────
SELECT
  badge_slug,
  COUNT(*)   AS members_awarded
FROM  _backfill_log
GROUP BY badge_slug
ORDER BY members_awarded DESC, badge_slug;

SELECT
  COUNT(*)                AS total_badges_awarded,
  COUNT(DISTINCT user_id) AS total_members_affected
FROM _backfill_log;

COMMIT;
