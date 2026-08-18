-- 2026081605_backfill_member_badges.sql
-- One-time retroactive badge award for all existing members.
--
-- Context: member_badges had a FK → badges(slug) that silently blocked every
-- award() upsert since the badges catalog table was never seeded. Migration
-- 2026081604 dropped that FK. This script does the catch-up pass.
--
-- What this deliberately suppresses:
--   • Push notifications: on_badge_earned_notify trigger disabled in-session.
--   • In-app celebration modals: badge_earned_shown_at = now() so the app
--     treats each row as already seen.
--
-- What this does NOT award:
--   • founding-member: admin-granted only, no automated criterion.
--   • table-setter:    not in checkAndAwardBadges, requires Open Table data.
--
-- Connector-score badges use profiles.connector_score (cached on each scoring
-- event by checkAndAwardBadges; see 2026081305_profiles_connector_score_cached).
-- Members whose cached score is stale/0 will receive score-gated badges on their
-- next client-triggered checkAndAwardBadges call.
--
-- Outcomes (spark / five-outcomes): uses the `outcomes` table — confirmed as the
-- single source queried by compute_connector_score() for the "+8 per outcome"
-- factor (SELECT COUNT(*) FROM outcomes WHERE conversation_id IN ...).
-- This table has a conversation_id column and is distinct from both
-- conversation_outcomes (per-user labels) and smart_match_outcomes (no
-- conversation_id column). Badge criterion mirrors badges.ts: counts outcome rows
-- from ANY conversation the user participated in (not restricted to facilitated
-- intros, unlike the score factor).
--
-- Safe to re-run: every INSERT uses ON CONFLICT (user_id, badge_slug) DO NOTHING.

BEGIN;

-- ── 1. Silence badge notifications for this transaction ───────────────────────
ALTER TABLE member_badges DISABLE TRIGGER on_badge_earned_notify;

-- ── 2. Log what we award so we can report counts at the end ───────────────────
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
-- Mirrors checkAndAwardBadges: no removed_at filter (matches the TS query).
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

-- ── spark (1+ outcome from any conversation the user was in) ──────────────────
-- Source: `outcomes` table — same table queried by compute_connector_score()
-- for the "+8 per outcome" factor. Has a conversation_id column.
-- Badge criterion (from badges.ts): counts outcomes in ALL conversations the
-- user participated in — broader than the score factor which restricts to
-- facilitated intros only.
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

-- ── signal-strength (streak ≥ 4 consecutive weeks) ───────────────────────────
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

-- ── thanked (3+ thank-yous received as facilitator) ──────────────────────────
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

-- ── all-in (5+ total badges) ──────────────────────────────────────────────────
-- Evaluated LAST so members who crossed 5 in this same transaction qualify now.
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
