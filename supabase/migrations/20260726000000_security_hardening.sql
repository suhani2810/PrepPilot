-- Security hardening: server-owned interview data, abuse controls and integrity constraints.

-- Authenticated candidates may read their own application data, but all writes to
-- server-generated records must go through authenticated server functions using the
-- server-only service-role client.
REVOKE ALL ON public.profiles FROM authenticated;
REVOKE ALL ON public.candidate_profiles FROM authenticated;
REVOKE ALL ON public.interviews FROM authenticated;
REVOKE ALL ON public.interview_messages FROM authenticated;
REVOKE ALL ON public.evaluations FROM authenticated;
REVOKE ALL ON public.learning_roadmaps FROM authenticated;

GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.candidate_profiles TO authenticated;
GRANT SELECT ON public.interviews TO authenticated;
GRANT SELECT ON public.interview_messages TO authenticated;
GRANT SELECT ON public.evaluations TO authenticated;
GRANT SELECT ON public.learning_roadmaps TO authenticated;

DROP POLICY IF EXISTS own_profile_all ON public.profiles;
CREATE POLICY own_profile_select ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS own_cp_all ON public.candidate_profiles;
CREATE POLICY own_cp_select ON public.candidate_profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS own_interviews_all ON public.interviews;
CREATE POLICY own_interviews_select ON public.interviews FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS own_msgs_all ON public.interview_messages;
CREATE POLICY own_msgs_select ON public.interview_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.interviews i
      WHERE i.id = interview_id AND i.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS own_eval_all ON public.evaluations;
CREATE POLICY own_eval_select_completed ON public.evaluations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.interviews i
      WHERE i.id = interview_id
        AND i.user_id = auth.uid()
        AND i.status = 'completed'
    )
  );

DROP POLICY IF EXISTS own_roadmap_all ON public.learning_roadmaps;
CREATE POLICY own_roadmap_select ON public.learning_roadmaps FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Prevent malformed or forged scoring data even for trusted server writes.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_readiness_range
  CHECK (readiness_score IS NULL OR readiness_score BETWEEN 0 AND 100) NOT VALID;

ALTER TABLE public.interviews
  ADD CONSTRAINT interviews_duration_range CHECK (duration_minutes BETWEEN 5 AND 180) NOT VALID,
  ADD CONSTRAINT interviews_status_allowed CHECK (status IN ('active', 'completed')) NOT VALID,
  ADD CONSTRAINT interviews_overall_score_range
    CHECK (overall_score IS NULL OR overall_score BETWEEN 0 AND 10) NOT VALID,
  ADD CONSTRAINT interviews_readiness_range
    CHECK (readiness_score IS NULL OR readiness_score BETWEEN 0 AND 100) NOT VALID;

ALTER TABLE public.interview_messages
  ADD CONSTRAINT interview_messages_role_allowed CHECK (role IN ('ai', 'user')) NOT VALID,
  ADD CONSTRAINT interview_messages_difficulty_range
    CHECK (difficulty IS NULL OR difficulty BETWEEN 1 AND 5) NOT VALID,
  ADD CONSTRAINT interview_messages_order_nonnegative CHECK (order_index >= 0) NOT VALID;

-- Repair legacy duplicate order indexes without deleting interview content.
WITH ordered AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY interview_id
           ORDER BY order_index, created_at, id
         ) - 1 AS corrected_order
  FROM public.interview_messages
)
UPDATE public.interview_messages AS message
SET order_index = ordered.corrected_order
FROM ordered
WHERE message.id = ordered.id
  AND message.order_index <> ordered.corrected_order;

CREATE UNIQUE INDEX IF NOT EXISTS interview_messages_unique_order
  ON public.interview_messages(interview_id, order_index);

ALTER TABLE public.evaluations
  ADD CONSTRAINT evaluations_technical_accuracy_range
    CHECK (technical_accuracy IS NULL OR technical_accuracy BETWEEN 0 AND 10) NOT VALID,
  ADD CONSTRAINT evaluations_clarity_range
    CHECK (clarity IS NULL OR clarity BETWEEN 0 AND 10) NOT VALID,
  ADD CONSTRAINT evaluations_relevance_range
    CHECK (relevance IS NULL OR relevance BETWEEN 0 AND 10) NOT VALID,
  ADD CONSTRAINT evaluations_problem_solving_range
    CHECK (problem_solving IS NULL OR problem_solving BETWEEN 0 AND 10) NOT VALID,
  ADD CONSTRAINT evaluations_communication_range
    CHECK (communication IS NULL OR communication BETWEEN 0 AND 10) NOT VALID,
  ADD CONSTRAINT evaluations_overall_score_range
    CHECK (overall_score IS NULL OR overall_score BETWEEN 0 AND 10) NOT VALID;

-- Enforce upload restrictions in storage itself; browser accept= is not a security boundary.
UPDATE storage.buckets
SET public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['application/pdf']::text[]
WHERE id = 'resumes';

-- Persistent, atomic rate limiting that works across serverless instances.
CREATE TABLE public.request_rate_limits (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 1 CHECK (request_count > 0),
  PRIMARY KEY (user_id, action, window_started_at)
);

ALTER TABLE public.request_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.request_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.request_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_rate_limit(p_action text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_limit integer;
  v_window_seconds integer;
  v_window_start timestamptz;
  v_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  CASE p_action
    WHEN 'transcribe' THEN v_limit := 12; v_window_seconds := 60;
    WHEN 'parse_resume' THEN v_limit := 5; v_window_seconds := 3600;
    WHEN 'start_interview' THEN v_limit := 10; v_window_seconds := 3600;
    WHEN 'submit_answer' THEN v_limit := 60; v_window_seconds := 600;
    WHEN 'roadmap' THEN v_limit := 3; v_window_seconds := 3600;
    ELSE
      RAISE EXCEPTION 'Unsupported rate-limit action';
  END CASE;

  v_window_start := to_timestamp(
    floor(extract(epoch FROM clock_timestamp()) / v_window_seconds) * v_window_seconds
  );

  INSERT INTO public.request_rate_limits(user_id, action, window_started_at, request_count)
  VALUES (v_user_id, p_action, v_window_start, 1)
  ON CONFLICT (user_id, action, window_started_at)
  DO UPDATE SET request_count = public.request_rate_limits.request_count + 1
  RETURNING request_count INTO v_count;

  DELETE FROM public.request_rate_limits
  WHERE user_id = v_user_id
    AND window_started_at < clock_timestamp() - interval '2 days';

  RETURN v_count <= v_limit;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_rate_limit(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text) TO authenticated, service_role;
