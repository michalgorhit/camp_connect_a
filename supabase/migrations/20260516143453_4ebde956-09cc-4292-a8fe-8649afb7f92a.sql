create schema if not exists private;

create or replace function private.can_view_shared_kid(_viewer_id uuid, _kid_id uuid, _viewer_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.kids target
    where target.id = _kid_id
      and target.parent_id = _viewer_id
  )
  or exists (
    select 1
    from public.kids target
    join public.kids mine on mine.class_id = target.class_id
    where target.id = _kid_id
      and mine.parent_id = _viewer_id
      and target.class_id is not null
      and target.share_with_class = true
  )
  or exists (
    select 1
    from public.share_invites si
    where si.kid_id = _kid_id
      and lower(si.invitee_email) = lower(coalesce(_viewer_email, ''))
  );
$$;

revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;
revoke execute on function private.can_view_shared_kid(uuid, uuid, text) from public;
revoke execute on function private.can_view_shared_kid(uuid, uuid, text) from anon;
revoke execute on function private.can_view_shared_kid(uuid, uuid, text) from authenticated;

drop policy if exists "kids shared view" on public.kids;
create policy "kids shared view"
on public.kids
for select
to authenticated
using (
  private.can_view_shared_kid(auth.uid(), id, auth.jwt() ->> 'email')
);

drop function if exists public.can_view_shared_kid(uuid, uuid, text);