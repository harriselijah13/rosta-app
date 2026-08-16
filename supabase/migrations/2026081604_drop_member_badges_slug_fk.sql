-- 2026081604_drop_member_badges_slug_fk.sql
--
-- member_badges.badge_slug was created with a FK → badges(slug).
-- The 'badges' catalog table was never seeded with any slug rows, so every
-- call to award() in lib/badges.ts silently fails the FK constraint.
-- member_badges has been empty for all users since the badge system launched,
-- causing all badges to appear locked in the app.
--
-- The 'badges' table is unused application code — badge definitions live in
-- BADGE_CATALOG (native) and lib/badge-catalog.ts (web). Removing the FK
-- lets the award() upsert succeed so member_badges can actually accumulate rows.

ALTER TABLE member_badges DROP CONSTRAINT IF EXISTS member_badges_badge_slug_fkey;
