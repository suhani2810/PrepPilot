-- 1) Make consume_rate_limit server-only, taking an explicit user id
DROP FUNCTION IF EXISTS public.consume_rate_limit(text);

CREATE OR REPLACE FUNCTION public.consume_rate_limit(p_action text, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_limit integer;
  v_window_seconds integer;
  v_window_start timestamptz;
  v_count integer;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  CASE p_action
    WHEN 'transcribe' THEN v_limit := 12; v_window_seconds := 60;
    WHEN 'parse_resume' THEN v_limit := 5; v_window_seconds := 3600;
    WHEN 'start_interview' THEN v_limit := 10; v_window_seconds := 3600;
    WHEN 'submit_answer' THEN v_limit := 60; v_window_seconds := 600;
    WHEN 'roadmap' THEN v_limit := 3; v_window_seconds := 3600;
    ELSE RAISE EXCEPTION 'Unsupported rate-limit action';
  END CASE;

  v_window_start := to_timestamp(
    floor(extract(epoch FROM clock_timestamp()) / v_window_seconds) * v_window_seconds
  );

  INSERT INTO public.request_rate_limits(user_id, action, window_started_at, request_count)
  VALUES (p_user_id, p_action, v_window_start, 1)
  ON CONFLICT (user_id, action, window_started_at)
  DO UPDATE SET request_count = public.request_rate_limits.request_count + 1
  RETURNING request_count INTO v_count;

  DELETE FROM public.request_rate_limits
  WHERE user_id = p_user_id
    AND window_started_at < clock_timestamp() - interval '2 days';

  RETURN v_count <= v_limit;
END;
$function$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, uuid) TO service_role;

-- 2) Internal trigger functions should not be callable by app users
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;

-- 3) Explicit policies for request_rate_limits: owner read-only, writes server-only
GRANT SELECT ON public.request_rate_limits TO authenticated;
GRANT ALL ON public.request_rate_limits TO service_role;

ALTER TABLE public.request_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS own_rate_limits_select ON public.request_rate_limits;
CREATE POLICY own_rate_limits_select
  ON public.request_rate_limits
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);