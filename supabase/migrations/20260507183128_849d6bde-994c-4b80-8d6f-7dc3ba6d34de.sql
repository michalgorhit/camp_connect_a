ALTER TABLE public.share_invites ADD COLUMN IF NOT EXISTS kid_id uuid;
ALTER TABLE public.share_invites ALTER COLUMN registration_id DROP NOT NULL;