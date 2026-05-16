-- Backfill child-based invites from older registration-based invites
update public.share_invites si
set kid_id = r.kid_id
from public.registrations r
where si.kid_id is null
  and si.registration_id = r.id;

-- Remove any legacy invite rows that still cannot be tied to a child
-- before enforcing child-based sharing.
delete from public.share_invites
where kid_id is null;

-- Collapse duplicate child invites before adding uniqueness.
delete from public.share_invites a
using public.share_invites b
where a.id > b.id
  and a.inviter_id = b.inviter_id
  and a.kid_id = b.kid_id
  and lower(a.invitee_email) = lower(b.invitee_email);

-- Sharing is now per child, not per registration.
alter table public.share_invites
  alter column kid_id set not null;

alter table public.share_invites
  add column if not exists accepted_by uuid;

-- Older schema already has accepted_at; keep it and use it with accepted_by.
create index if not exists idx_share_invites_invitee_email_lower
  on public.share_invites (lower(invitee_email));

create index if not exists idx_share_invites_kid_id
  on public.share_invites (kid_id);

create unique index if not exists share_invites_unique_child_email
  on public.share_invites (inviter_id, kid_id, lower(invitee_email));

alter table public.share_invites
  drop column if exists registration_id;

alter table public.registrations
  drop column if exists shared_with_class;

-- Invite visibility and acceptance policies.
drop policy if exists "invites invitee view" on public.share_invites;
create policy "invites invitee view"
on public.share_invites
for select
to authenticated
using (
  lower(invitee_email) = lower((auth.jwt() ->> 'email')::text)
);

drop policy if exists "invites invitee accept" on public.share_invites;
create policy "invites invitee accept"
on public.share_invites
for update
to authenticated
using (
  lower(invitee_email) = lower((auth.jwt() ->> 'email')::text)
)
with check (
  lower(invitee_email) = lower((auth.jwt() ->> 'email')::text)
  and accepted_by = auth.uid()
);

-- Refresh registration visibility policies for child-level sharing.
drop policy if exists "regs direct share view" on public.registrations;
create policy "regs direct share view"
on public.registrations
for select
to authenticated
using (
  exists (
    select 1
    from public.share_invites si
    where si.kid_id = registrations.kid_id
      and lower(si.invitee_email) = lower((auth.jwt() ->> 'email')::text)
  )
);

drop policy if exists "regs classmates view all" on public.registrations;
create policy "regs classmates view all"
on public.registrations
for select
to authenticated
using (
  exists (
    select 1
    from public.kids my_kid
    join public.kids their_kid on their_kid.class_id = my_kid.class_id
    where my_kid.parent_id = auth.uid()
      and their_kid.id = registrations.kid_id
      and my_kid.class_id is not null
      and their_kid.share_with_class = true
  )
);