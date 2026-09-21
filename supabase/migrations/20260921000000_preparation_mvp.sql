-- PrepPilot preparation MVP: study materials, grounded practice, coding,
-- job-description analysis, feedback, analytics, and readiness inputs.

CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename text NOT NULL,
  storage_path text NOT NULL,
  file_type text NOT NULL DEFAULT 'application/pdf',
  file_size bigint NOT NULL CHECK (file_size > 0 AND file_size <= 20971520),
  content_hash text,
  document_type text NOT NULL DEFAULT 'notes',
  visibility text NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'group', 'review', 'college')),
  subject text,
  processing_status text NOT NULL DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'processing', 'ready', 'failed')),
  processing_error text,
  page_count integer CHECK (page_count IS NULL OR page_count > 0),
  extracted_text text,
  analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, storage_path)
);
CREATE UNIQUE INDEX documents_user_hash_unique
  ON public.documents(user_id, content_hash) WHERE content_hash IS NOT NULL;
CREATE INDEX documents_user_created_idx ON public.documents(user_id, created_at DESC);

CREATE TABLE public.document_concepts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  difficulty text NOT NULL DEFAULT 'intermediate'
    CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  prerequisites jsonb NOT NULL DEFAULT '[]'::jsonb,
  related_coding_topics jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_page integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX document_concepts_document_idx ON public.document_concepts(document_id);

CREATE TABLE public.technical_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
  job_description_id uuid,
  question_text text NOT NULL,
  topic text NOT NULL,
  difficulty integer NOT NULL DEFAULT 2 CHECK (difficulty BETWEEN 1 AND 5),
  expected_answer text NOT NULL DEFAULT '',
  evaluation_criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_reference jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX technical_questions_user_idx ON public.technical_questions(user_id, created_at DESC);

CREATE TABLE public.practice_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('document', 'job_description', 'mixed')),
  source_id uuid,
  session_type text NOT NULL DEFAULT 'technical'
    CHECK (session_type IN ('technical', 'coding', 'behavioral')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  score numeric CHECK (score IS NULL OR score BETWEEN 0 AND 100),
  weak_areas jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE public.practice_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.practice_sessions(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.technical_questions(id) ON DELETE CASCADE,
  answer_text text NOT NULL,
  score numeric NOT NULL CHECK (score BETWEEN 0 AND 10),
  dimension_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  feedback jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX practice_attempts_user_idx ON public.practice_attempts(user_id, created_at DESC);

CREATE TABLE public.job_descriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  company text,
  raw_text text NOT NULL,
  analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX job_descriptions_user_idx ON public.job_descriptions(user_id, created_at DESC);
ALTER TABLE public.technical_questions
  ADD CONSTRAINT technical_questions_job_description_id_fkey
  FOREIGN KEY (job_description_id) REFERENCES public.job_descriptions(id) ON DELETE CASCADE;

CREATE TABLE public.coding_problems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  statement text NOT NULL,
  difficulty text NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  topics text[] NOT NULL DEFAULT '{}',
  constraints text[] NOT NULL DEFAULT '{}',
  examples jsonb NOT NULL DEFAULT '[]'::jsonb,
  starter_code jsonb NOT NULL DEFAULT '{}'::jsonb,
  hidden_tests jsonb NOT NULL DEFAULT '[]'::jsonb,
  explanation text NOT NULL DEFAULT '',
  review_status text NOT NULL DEFAULT 'approved'
    CHECK (review_status IN ('draft', 'approved', 'retired')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.coding_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  problem_id uuid NOT NULL REFERENCES public.coding_problems(id) ON DELETE CASCADE,
  language text NOT NULL,
  source_code text NOT NULL,
  status text NOT NULL CHECK (status IN ('queued', 'accepted', 'wrong_answer', 'compile_error', 'runtime_error', 'timeout', 'runner_error')),
  passed_tests integer NOT NULL DEFAULT 0,
  total_tests integer NOT NULL DEFAULT 0,
  runtime_ms integer,
  memory_kb integer,
  score numeric NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX coding_submissions_user_idx ON public.coding_submissions(user_id, created_at DESC);

CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('summary', 'question', 'evaluation', 'coding_problem', 'readiness')),
  target_id uuid NOT NULL,
  rating text NOT NULL CHECK (rating IN ('helpful', 'partly_helpful', 'incorrect', 'not_relevant')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.usage_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX usage_events_user_idx ON public.usage_events(user_id, created_at DESC);
GRANT USAGE, SELECT ON SEQUENCE public.usage_events_id_seq TO service_role;

CREATE TRIGGER trg_documents_updated BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_job_descriptions_updated BEFORE UPDATE ON public.job_descriptions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Browser users read their own records. All mutations go through authenticated
-- server functions using the service role, except owner-scoped storage uploads.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'documents', 'document_concepts', 'technical_questions', 'practice_sessions',
    'practice_attempts', 'job_descriptions', 'coding_submissions', 'feedback', 'usage_events'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', table_name);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', table_name);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (auth.uid() = user_id)',
      'own_' || table_name || '_select', table_name
    );
  END LOOP;
END $$;

ALTER TABLE public.coding_problems ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.coding_problems FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.coding_problems TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('study-materials', 'study-materials', false, 20971520, ARRAY['application/pdf']::text[])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY study_materials_owner_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'study-materials' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY study_materials_owner_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'study-materials' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY study_materials_owner_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'study-materials' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Replace the server-only limiter with preparation actions included.
CREATE OR REPLACE FUNCTION public.consume_rate_limit(p_action text, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_limit integer;
  v_window_seconds integer;
  v_window_start timestamptz;
  v_count integer;
BEGIN
  IF p_user_id IS NULL THEN RETURN false; END IF;
  CASE p_action
    WHEN 'transcribe' THEN v_limit := 12; v_window_seconds := 60;
    WHEN 'parse_resume' THEN v_limit := 5; v_window_seconds := 3600;
    WHEN 'start_interview' THEN v_limit := 10; v_window_seconds := 3600;
    WHEN 'submit_answer' THEN v_limit := 60; v_window_seconds := 600;
    WHEN 'roadmap' THEN v_limit := 3; v_window_seconds := 3600;
    WHEN 'process_document' THEN v_limit := 8; v_window_seconds := 3600;
    WHEN 'analyze_job' THEN v_limit := 12; v_window_seconds := 3600;
    WHEN 'technical_answer' THEN v_limit := 60; v_window_seconds := 3600;
    WHEN 'coding_submission' THEN v_limit := 30; v_window_seconds := 3600;
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
    WHERE user_id = p_user_id AND window_started_at < clock_timestamp() - interval '2 days';
  RETURN v_count <= v_limit;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_rate_limit(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, uuid) TO service_role;

-- Reviewed DSA pilot library. Hidden tests are only returned to the server-side runner.
INSERT INTO public.coding_problems
  (slug, title, statement, difficulty, topics, constraints, examples, starter_code, hidden_tests, explanation)
VALUES
(
  'two-sum', 'Two Sum',
  'Given an array of integers and a target, return the indices of two distinct values whose sum equals the target. Exactly one valid answer exists.',
  'easy', ARRAY['Arrays', 'Hash Map'], ARRAY['2 <= n <= 100000', 'Return zero-based indices'],
  '[{"input":"[2,7,11,15], 9","output":"[0,1]"}]',
  '{"javascript":"function twoSum(nums, target) {\n  // return [i, j]\n}","python":"def two_sum(nums, target):\n    # return [i, j]\n    pass"}',
  '[{"input":{"nums":[2,7,11,15],"target":9},"expected":[0,1]},{"input":{"nums":[3,2,4],"target":6},"expected":[1,2]},{"input":{"nums":[3,3],"target":6},"expected":[0,1]}]',
  'Track each value already seen in a hash map. For the current value, check whether its complement has appeared. This runs in O(n) time and O(n) space.'
),
(
  'valid-parentheses', 'Valid Parentheses',
  'Given a string containing only parentheses, square brackets, and braces, determine whether every opener is closed by the correct type in the correct order.',
  'easy', ARRAY['Stack', 'Strings'], ARRAY['1 <= length <= 100000'],
  '[{"input":"()[]{}","output":"true"},{"input":"([)]","output":"false"}]',
  '{"javascript":"function isValid(s) {\n  // return boolean\n}","python":"def is_valid(s):\n    # return bool\n    pass"}',
  '[{"input":{"s":"()[]{}"},"expected":true},{"input":{"s":"([)]"},"expected":false},{"input":{"s":"{[]}"},"expected":true},{"input":{"s":"("},"expected":false}]',
  'Push opening symbols onto a stack. A closing symbol must match the latest opener. The stack must be empty at the end.'
),
(
  'binary-search', 'Binary Search',
  'Given a sorted array of distinct integers and a target, return its index or -1 when it is absent.',
  'easy', ARRAY['Binary Search', 'Arrays'], ARRAY['1 <= n <= 100000', 'Input is sorted ascending'],
  '[{"input":"[-1,0,3,5,9,12], 9","output":"4"}]',
  '{"javascript":"function search(nums, target) {\n  // return index\n}","python":"def search(nums, target):\n    # return index\n    pass"}',
  '[{"input":{"nums":[-1,0,3,5,9,12],"target":9},"expected":4},{"input":{"nums":[-1,0,3,5,9,12],"target":2},"expected":-1},{"input":{"nums":[5],"target":5},"expected":0}]',
  'Maintain inclusive low and high boundaries, compare the midpoint, and discard half of the remaining range each iteration. Time is O(log n).'
)
ON CONFLICT (slug) DO NOTHING;
