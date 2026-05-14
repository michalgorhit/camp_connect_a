
DROP POLICY IF EXISTS "regs classmates view shared" ON public.registrations;

-- Classmates: see ALL registrations of kids in the same class as one of my kids,
-- as long as that kid has share_with_class = true.
CREATE POLICY "regs classmates view all"
ON public.registrations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.kids my_kid
    JOIN public.kids their_kid ON their_kid.class_id = my_kid.class_id
    WHERE my_kid.parent_id = auth.uid()
      AND their_kid.id = registrations.kid_id
      AND my_kid.class_id IS NOT NULL
      AND their_kid.share_with_class = true
  )
);

-- Direct shares: a parent who received a share invite for a specific kid
-- can see all registrations for that kid.
CREATE POLICY "regs direct share view"
ON public.registrations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.share_invites si
    JOIN auth.users u ON u.id = auth.uid()
    WHERE si.kid_id = registrations.kid_id
      AND lower(si.invitee_email) = lower(u.email)
  )
);
