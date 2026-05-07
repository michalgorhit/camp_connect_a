ALTER TABLE public.camp_sessions ADD COLUMN IF NOT EXISTS postal_code text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_location text;
CREATE INDEX IF NOT EXISTS idx_camp_sessions_postal_code ON public.camp_sessions(postal_code);