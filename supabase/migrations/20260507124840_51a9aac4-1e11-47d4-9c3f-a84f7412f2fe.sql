ALTER TABLE public.kids DROP COLUMN IF EXISTS birth_date;
ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS grade text;