
CREATE TABLE public.learning_roadmaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  interview_id uuid NOT NULL UNIQUE REFERENCES public.interviews(id) ON DELETE CASCADE,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_roadmaps TO authenticated;
GRANT ALL ON public.learning_roadmaps TO service_role;

ALTER TABLE public.learning_roadmaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY own_roadmap_all ON public.learning_roadmaps
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_learning_roadmaps_updated_at
  BEFORE UPDATE ON public.learning_roadmaps
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_learning_roadmaps_user ON public.learning_roadmaps(user_id, created_at DESC);
