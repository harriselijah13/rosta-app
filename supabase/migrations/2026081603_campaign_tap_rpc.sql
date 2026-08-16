-- 2026081603_campaign_tap_rpc.sql
--
-- SECURITY DEFINER RPC called from the native app when a user taps
-- the CTA on a promo screen. Updates campaign_deliveries.tapped_at
-- for the most recent unseen delivery for this user + campaign.
--
-- campaign_deliveries has no member-facing RLS policies, so this must
-- be SECURITY DEFINER to bypass RLS. auth.uid() pins the update to the
-- calling user — no other user's record can be touched.
-- If no matching row exists the UPDATE is a no-op (safe to call twice).

CREATE OR REPLACE FUNCTION public.record_campaign_tap(p_campaign_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE campaign_deliveries
  SET    tapped_at = now()
  WHERE  id = (
    SELECT id
    FROM   campaign_deliveries
    WHERE  campaign_id = p_campaign_id
      AND  user_id     = auth.uid()
      AND  tapped_at   IS NULL
    ORDER  BY sent_at DESC
    LIMIT  1
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_campaign_tap(uuid) FROM public;
GRANT  EXECUTE ON FUNCTION public.record_campaign_tap(uuid) TO authenticated;
