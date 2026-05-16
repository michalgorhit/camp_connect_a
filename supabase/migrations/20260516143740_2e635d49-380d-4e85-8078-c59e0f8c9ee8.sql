create or replace function public.protect_share_invite_acceptance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and auth.uid() <> old.inviter_id then
    if new.id <> old.id
      or new.inviter_id <> old.inviter_id
      or new.kid_id <> old.kid_id
      or lower(new.invitee_email) <> lower(old.invitee_email)
      or new.token <> old.token then
      raise exception 'Invite details cannot be changed by the invitee';
    end if;

    if new.accepted_by is distinct from auth.uid() then
      raise exception 'Invite can only be accepted by the invited parent';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.protect_share_invite_acceptance() from public;
revoke execute on function public.protect_share_invite_acceptance() from anon;
revoke execute on function public.protect_share_invite_acceptance() from authenticated;

drop trigger if exists protect_share_invite_acceptance on public.share_invites;
create trigger protect_share_invite_acceptance
before update on public.share_invites
for each row
execute function public.protect_share_invite_acceptance();