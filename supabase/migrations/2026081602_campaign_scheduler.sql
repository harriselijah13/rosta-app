-- 2026081602_campaign_scheduler.sql
--
-- Scheduling engine for notification campaigns.
--
-- process_campaign_sends() is called by pg_cron every 10 minutes.
-- For each due campaign it:
--   1. Resolves the recipient list (all onboarded members, or a specific id array)
--   2. Inserts one notifications row per recipient — the existing
--      on_notification_insert_push trigger fires per row, pushing via
--      the send-push-notification edge function. No new delivery path.
--   3. Inserts one campaign_deliveries row per send for future analytics.
--   4. Marks one-off campaigns completed; advances recurring next_send_at.
--
-- SKIP LOCKED on the outer cursor prevents double-processing if two
-- cron ticks overlap (unlikely at 10-minute cadence, but safe).

CREATE OR REPLACE FUNCTION public.process_campaign_sends()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  camp notification_campaigns%ROWTYPE;
  uid  uuid;
  nid  uuid;
BEGIN

  -- Pre-pass: auto-complete recurring campaigns whose end date has passed.
  -- Keeps the dashboard accurate without waiting for the next due tick.
  UPDATE notification_campaigns
  SET    status     = 'completed',
         updated_at = now()
  WHERE  send_mode      = 'recurring'
    AND  status     NOT IN ('draft', 'paused', 'completed')
    AND  recurrence_end IS NOT NULL
    AND  recurrence_end <= now();

  -- Main loop: process every campaign whose next_send_at is now or overdue.
  FOR camp IN
    SELECT *
    FROM   notification_campaigns
    WHERE  status IN ('scheduled', 'active')
      AND  next_send_at IS NOT NULL
      AND  next_send_at <= now()
    ORDER  BY next_send_at          -- oldest-first so nothing starves
    FOR UPDATE SKIP LOCKED
  LOOP

    -- ── Resolve recipients and insert notifications ──────────────────────────
    IF camp.recipient_mode = 'all' THEN

      FOR uid IN
        SELECT id
        FROM   profiles
        WHERE  push_token           IS NOT NULL
          AND  onboarding_completed  = true
      LOOP
        INSERT INTO notifications (user_id, type, data)
        VALUES (
          uid,
          'campaign',
          jsonb_build_object(
            'campaign_id',       camp.id,
            'push_title',        camp.title,
            'push_body',         camp.message,
            'promo_screen_id',   camp.promo_screen_id,
            'destination_route', camp.destination_route
          )
        )
        RETURNING id INTO nid;

        INSERT INTO campaign_deliveries (campaign_id, user_id, notification_id)
        VALUES (camp.id, uid, nid);
      END LOOP;

    ELSE

      -- specific: filter the stored uuid[] down to members with push tokens
      FOR uid IN
        SELECT p.id
        FROM   profiles p
        WHERE  p.id         = ANY(camp.recipient_ids)
          AND  p.push_token IS NOT NULL
      LOOP
        INSERT INTO notifications (user_id, type, data)
        VALUES (
          uid,
          'campaign',
          jsonb_build_object(
            'campaign_id',       camp.id,
            'push_title',        camp.title,
            'push_body',         camp.message,
            'promo_screen_id',   camp.promo_screen_id,
            'destination_route', camp.destination_route
          )
        )
        RETURNING id INTO nid;

        INSERT INTO campaign_deliveries (campaign_id, user_id, notification_id)
        VALUES (camp.id, uid, nid);
      END LOOP;

    END IF;

    -- ── Advance or complete the campaign ─────────────────────────────────────
    IF camp.send_mode IN ('immediate', 'scheduled') THEN

      UPDATE notification_campaigns
      SET  status       = 'completed',
           last_sent_at = now(),
           next_send_at = NULL,
           updated_at   = now()
      WHERE id = camp.id;

    ELSIF camp.send_mode = 'recurring' THEN

      UPDATE notification_campaigns
      SET  last_sent_at = now(),
           updated_at   = now(),
           next_send_at = now() + CASE camp.recurrence_rule
                                    WHEN 'daily'   THEN interval '1 day'
                                    WHEN 'weekly'  THEN interval '1 week'
                                    WHEN 'monthly' THEN interval '1 month'
                                    ELSE                interval '1 week'
                                  END
      WHERE id = camp.id;

    END IF;

  END LOOP;
END;
$$;

-- ── Cron job: every 10 minutes ────────────────────────────────────────────────
-- 10 minutes gives a worst-case delivery lag of 9m 59s for "send now" campaigns,
-- which is acceptable. Going tighter (e.g. 5 min) offers little real benefit
-- and doubles the DB wakeup frequency for what is low-volume work.
SELECT cron.schedule(
  'campaign-scheduler',
  '*/10 * * * *',
  $$ SELECT public.process_campaign_sends() $$
);
