
-- Parent vacation/travel periods for the summer calendar
CREATE TABLE public.parent_vacations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id uuid NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  kind text NOT NULL DEFAULT 'travel',
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.parent_vacations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vacations parent all"
ON public.parent_vacations
FOR ALL TO authenticated
USING (auth.uid() = parent_id)
WITH CHECK (auth.uid() = parent_id);

CREATE TRIGGER parent_vacations_set_updated_at
BEFORE UPDATE ON public.parent_vacations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_parent_vacations_parent ON public.parent_vacations(parent_id);
