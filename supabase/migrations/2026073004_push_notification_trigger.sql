-- push_notification_trigger
--
-- After every INSERT on the notifications table, call the send-push-notification
-- edge function via pg_net. This covers every notification type regardless of
-- whether the row was created by a DB trigger (new_message, invite_request) or
-- by client-side code (connection_request, connection_accepted, etc.).
--
-- The anon key is inlined as a literal — it is a public JWT already shipped
-- in the app binary as EXPO_PUBLIC_SUPABASE_ANON_KEY, so embedding it here
-- carries no additional security risk.

-- Trigger function: fire a non-blocking HTTP POST to the edge function for every new notification row.
CREATE OR REPLACE FUNCTION public.trigger_push_on_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url     := 'https://gukouwplaofdydbetfoz.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1a291d3BsYW9mZHlkYmV0Zm96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMzg5MDUsImV4cCI6MjA5NTkxNDkwNX0.fd-tDl1Nd-5KjV_3DpZjTU17FTSBorLo17OqgNX-wFI'
    ),
    body    := to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$;

-- Attach trigger — fires after every INSERT, does not block the inserting transaction.
DROP TRIGGER IF EXISTS on_notification_insert_push ON notifications;
CREATE TRIGGER on_notification_insert_push
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_on_notification();
