-- 2026081307_intro_requests_matchmaker_constraints.sql
-- Fix three intro_requests CHECK constraints discovered during trigger verification:
--
-- 1. intro_requests_type_check only allowed 'warm_intro' and 'open_door'.
--    The matchmaker feature (matchmaker.tsx / create_matchmaker_intro RPC) uses
--    type='matchmaker', which was silently failing this constraint since the
--    matchmaker screen launched. Adding 'matchmaker' to the allowed set.
--
-- 2. intro_facilitator_distinct blocked facilitator_id == requester_id.
--    For matchmaker intros the facilitator IS the running user (requester).
--    Relaxed so matchmaker only requires facilitator_id != target_id.
--
-- 3. intro_facilitator_required required facilitator IS NOT NULL for warm_intro.
--    Extended to also require it for matchmaker (consistent with the feature).
--
-- Constraints already applied live (during verification session 2026-08-13).

ALTER TABLE intro_requests DROP CONSTRAINT IF EXISTS intro_requests_type_check;
ALTER TABLE intro_requests ADD CONSTRAINT intro_requests_type_check
  CHECK (type = ANY (ARRAY['warm_intro','open_door','matchmaker']));

ALTER TABLE intro_requests DROP CONSTRAINT IF EXISTS intro_facilitator_distinct;
ALTER TABLE intro_requests ADD CONSTRAINT intro_facilitator_distinct
  CHECK (
    facilitator_id IS NULL
    OR (type = 'matchmaker' AND facilitator_id <> target_id)
    OR (type <> 'matchmaker' AND facilitator_id <> requester_id AND facilitator_id <> target_id)
  );

ALTER TABLE intro_requests DROP CONSTRAINT IF EXISTS intro_facilitator_required;
ALTER TABLE intro_requests ADD CONSTRAINT intro_facilitator_required
  CHECK (
    (type IN ('warm_intro','matchmaker') AND facilitator_id IS NOT NULL)
    OR type = 'open_door'
  );
