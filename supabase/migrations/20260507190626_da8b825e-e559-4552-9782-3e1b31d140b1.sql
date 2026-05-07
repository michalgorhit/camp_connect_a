ALTER TABLE public.camp_sessions
  ADD COLUMN IF NOT EXISTS available_spots integer,
  ADD COLUMN IF NOT EXISTS registration_deadline date,
  ADD COLUMN IF NOT EXISTS source_url text;