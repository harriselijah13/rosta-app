-- IP-based rate limiting for the signup endpoint.
-- Separate from ai_call_log (which is user-scoped) since no user exists at signup time.
-- check_signup_rate_limit is called via service role from the Next.js signup route
-- and can be called from the Netlify landing site function the same way.

CREATE TABLE IF NOT EXISTS signup_attempt_log (
  id           bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip_address   text        NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS signup_attempt_log_ip_time
  ON signup_attempt_log(ip_address, attempted_at DESC);

ALTER TABLE signup_attempt_log ENABLE ROW LEVEL SECURITY;

-- Returns true (allowed) and logs the attempt if under the limit.
-- Returns false (blocked) if the IP has hit _max_attempts in the window.
-- Unknown/empty IPs are allowed through to avoid blocking legitimate traffic
-- where the header is absent.
CREATE OR REPLACE FUNCTION check_signup_rate_limit(
  _ip             text,
  _max_attempts   int  DEFAULT 5,
  _window_minutes int  DEFAULT 60
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _normalized text;
  _count      int;
BEGIN
  IF _ip IS NULL OR trim(_ip) = '' OR trim(_ip) = 'unknown' THEN
    RETURN true;
  END IF;

  -- x-forwarded-for may be a comma-separated chain; take the first (originating) address
  _normalized := trim(split_part(trim(_ip), ',', 1));

  SELECT COUNT(*) INTO _count
  FROM signup_attempt_log
  WHERE ip_address   = _normalized
    AND attempted_at > now() - (_window_minutes || ' minutes')::interval;

  IF _count >= _max_attempts THEN
    RETURN false;
  END IF;

  INSERT INTO signup_attempt_log(ip_address) VALUES (_normalized);
  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION check_signup_rate_limit(text, int, int) FROM public;
REVOKE EXECUTE ON FUNCTION check_signup_rate_limit(text, int, int) FROM authenticated;
