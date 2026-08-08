-- Enable pg_net extension for non-blocking HTTP calls from database triggers.
-- Required by trigger_push_on_notification() which calls net.http_post().
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
