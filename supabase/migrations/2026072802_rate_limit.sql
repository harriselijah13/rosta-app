-- Rate limiting for AI endpoints.
-- ai_call_log records every call to an AI function per user.
-- check_ai_rate_limit is a SECURITY DEFINER function called by edge functions
-- (via service role) and web routes (via admin client) before invoking Anthropic.
-- No user-level RLS policies: table is only accessible through the function.

CREATE TABLE IF NOT EXISTS ai_call_log (
  id          bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fn_name     text        NOT NULL,
  called_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_call_log_user_fn_time
  ON ai_call_log(user_id, fn_name, called_at DESC);

ALTER TABLE ai_call_log ENABLE ROW LEVEL SECURITY;

-- Atomic rate-limit check + log. Returns true if the call is within the limit
-- and records it; returns false if the user has exceeded _max_calls in the window.
-- Called with service role credentials so auth.uid() is not used — _uid is explicit.
CREATE OR REPLACE FUNCTION check_ai_rate_limit(
  _uid            uuid,
  _fn_name        text,
  _max_calls      int  DEFAULT 10,
  _window_minutes int  DEFAULT 60
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _count int;
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;

  SELECT COUNT(*) INTO _count
  FROM ai_call_log
  WHERE user_id   = _uid
    AND fn_name   = _fn_name
    AND called_at > now() - (_window_minutes || ' minutes')::interval;

  IF _count >= _max_calls THEN
    RETURN false;
  END IF;

  INSERT INTO ai_call_log(user_id, fn_name) VALUES (_uid, _fn_name);
  RETURN true;
END;
$$;

-- Only service role (edge functions, admin client) may call this.
REVOKE EXECUTE ON FUNCTION check_ai_rate_limit(uuid, text, int, int) FROM public;
REVOKE EXECUTE ON FUNCTION check_ai_rate_limit(uuid, text, int, int) FROM authenticated;
