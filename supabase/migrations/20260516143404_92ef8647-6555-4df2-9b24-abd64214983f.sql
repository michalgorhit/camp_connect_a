drop policy if exists "kids classmates view shared" on public.kids;
create policy "kids classmates view shared"
on public.kids
for select
to authenticated
using (
  share_with_class = true
  and exists (
    select 1
    from public.kids my_kid
    where my_kid.parent_id = auth.uid()
      and my_kid.class_id = kids.class_id
      and my_kid.class_id is not null
  )
);

drop policy if exists "kids direct share view" on public.kids;
create policy "kids direct share view"
on public.kids
for select
to authenticated
using (
  exists (
    select 1
    from public.share_invites si
    where si.kid_id = kids.id
      and lower(si.invitee_email) = lower((auth.jwt() ->> 'email')::text)
  )
);