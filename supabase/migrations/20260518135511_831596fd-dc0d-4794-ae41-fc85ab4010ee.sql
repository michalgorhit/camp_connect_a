
-- Schema additions for camp_sessions
ALTER TABLE public.camp_sessions
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'vendor',
  ADD COLUMN IF NOT EXISTS day_type text NOT NULL DEFAULT 'full_day',
  ADD COLUMN IF NOT EXISTS capacity_known boolean NOT NULL DEFAULT true;

ALTER TABLE public.camp_sessions
  DROP CONSTRAINT IF EXISTS camp_sessions_source_check;
ALTER TABLE public.camp_sessions
  ADD CONSTRAINT camp_sessions_source_check CHECK (source IN ('vendor','admin','community'));

ALTER TABLE public.camp_sessions
  DROP CONSTRAINT IF EXISTS camp_sessions_day_type_check;
ALTER TABLE public.camp_sessions
  ADD CONSTRAINT camp_sessions_day_type_check CHECK (day_type IN ('half_day','full_day','multi_week'));

-- Backfill created_by for existing rows from vendor_id
UPDATE public.camp_sessions SET created_by = vendor_id WHERE created_by IS NULL;

-- Allow community camps: any authenticated user can insert.
-- vendor_id may equal their own id (the "owner" of the listing until claimed).
DROP POLICY IF EXISTS "sessions vendor insert" ON public.camp_sessions;
DROP POLICY IF EXISTS "sessions authed insert" ON public.camp_sessions;
CREATE POLICY "sessions authed insert"
  ON public.camp_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND (
      -- Vendor adding their own camp with capacity
      (source = 'vendor' AND vendor_id = auth.uid() AND public.has_role(auth.uid(), 'vendor'))
      -- Admin adding any camp
      OR (source = 'admin' AND public.has_role(auth.uid(), 'admin'))
      -- Community member adding a camp they discovered. Capacity must be unknown.
      OR (source = 'community' AND vendor_id = auth.uid() AND capacity_known = false AND capacity IS NULL AND available_spots IS NULL)
    )
  );

-- Admin can do anything on sessions
DROP POLICY IF EXISTS "sessions admin all" ON public.camp_sessions;
CREATE POLICY "sessions admin all"
  ON public.camp_sessions
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Enforce: only vendor-of-record or admin can set capacity_known=true / non-null capacity
CREATE OR REPLACE FUNCTION public.protect_camp_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  -- Non-admin: only vendor_id may set capacity/available_spots/capacity_known=true
  IF (NEW.capacity IS NOT NULL OR NEW.available_spots IS NOT NULL OR NEW.capacity_known = true) THEN
    IF NEW.vendor_id <> auth.uid() OR NOT public.has_role(auth.uid(), 'vendor') THEN
      RAISE EXCEPTION 'Only the camp vendor or an admin can set capacity/availability';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_camp_capacity_ins ON public.camp_sessions;
CREATE TRIGGER protect_camp_capacity_ins
  BEFORE INSERT ON public.camp_sessions
  FOR EACH ROW EXECUTE FUNCTION public.protect_camp_capacity();

DROP TRIGGER IF EXISTS protect_camp_capacity_upd ON public.camp_sessions;
CREATE TRIGGER protect_camp_capacity_upd
  BEFORE UPDATE ON public.camp_sessions
  FOR EACH ROW EXECUTE FUNCTION public.protect_camp_capacity();

-- Admins can view all registrations
DROP POLICY IF EXISTS "regs admin view" ON public.registrations;
CREATE POLICY "regs admin view"
  ON public.registrations
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can view all kids (read-only)
DROP POLICY IF EXISTS "kids admin view" ON public.kids;
CREATE POLICY "kids admin view"
  ON public.kids
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger: auto-grant admin role to the seeded admin email on signup
CREATE OR REPLACE FUNCTION public.handle_admin_seed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(NEW.email) = 'michalgorhit@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'parent')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_admin_seed ON auth.users;
CREATE TRIGGER on_auth_user_admin_seed
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_admin_seed();

-- Backfill: if admin email already exists, grant the role now
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users
WHERE lower(email) = 'michalgorhit@gmail.com'
ON CONFLICT DO NOTHING;
