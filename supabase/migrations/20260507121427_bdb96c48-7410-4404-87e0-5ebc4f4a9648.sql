
-- Roles
create type public.app_role as enum ('vendor', 'parent');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "users view own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);
create policy "users insert own roles" on public.user_roles for insert to authenticated with check (auth.uid() = user_id);

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  phone text,
  business_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "profiles select all authed" on public.profiles for select to authenticated using (true);
create policy "profiles update own" on public.profiles for update to authenticated using (auth.uid() = id);
create policy "profiles insert own" on public.profiles for insert to authenticated with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

-- Schools / classes
create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.schools enable row level security;
create policy "schools select authed" on public.schools for select to authenticated using (true);
create policy "schools insert authed" on public.schools for insert to authenticated with check (auth.uid() = created_by);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  grade text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (school_id, name)
);
alter table public.classes enable row level security;
create policy "classes select authed" on public.classes for select to authenticated using (true);
create policy "classes insert authed" on public.classes for insert to authenticated with check (auth.uid() = created_by);

-- Kids
create table public.kids (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  birth_date date,
  school_id uuid references public.schools(id),
  class_id uuid references public.classes(id),
  share_with_class boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.kids enable row level security;
create trigger kids_updated_at before update on public.kids for each row execute function public.set_updated_at();

create policy "kids parent all" on public.kids for all to authenticated
  using (auth.uid() = parent_id) with check (auth.uid() = parent_id);

-- Camp sessions
create table public.camp_sessions (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  location text,
  start_date date not null,
  end_date date not null,
  price_cents integer,
  age_min integer,
  age_max integer,
  capacity integer,
  registration_url text,
  image_url text,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.camp_sessions enable row level security;
create trigger camp_sessions_updated_at before update on public.camp_sessions for each row execute function public.set_updated_at();

create policy "sessions select authed" on public.camp_sessions for select to authenticated using (is_published or vendor_id = auth.uid());
create policy "sessions vendor insert" on public.camp_sessions for insert to authenticated
  with check (auth.uid() = vendor_id and public.has_role(auth.uid(), 'vendor'));
create policy "sessions vendor update" on public.camp_sessions for update to authenticated
  using (auth.uid() = vendor_id);
create policy "sessions vendor delete" on public.camp_sessions for delete to authenticated
  using (auth.uid() = vendor_id);

-- Registrations (kid signed up / interested in a session)
create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  kid_id uuid not null references public.kids(id) on delete cascade,
  session_id uuid not null references public.camp_sessions(id) on delete cascade,
  parent_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'interested',
  shared_with_class boolean not null default false,
  created_at timestamptz not null default now(),
  unique (kid_id, session_id)
);
alter table public.registrations enable row level security;

create policy "regs parent all" on public.registrations for all to authenticated
  using (auth.uid() = parent_id) with check (auth.uid() = parent_id);

create policy "regs vendor view own session" on public.registrations for select to authenticated
  using (exists (select 1 from public.camp_sessions s where s.id = session_id and s.vendor_id = auth.uid()));

-- Classmates can view shared registrations of kids in same class
create policy "regs classmates view shared" on public.registrations for select to authenticated
  using (
    shared_with_class = true and exists (
      select 1
      from public.kids my_kid
      join public.kids their_kid on their_kid.class_id = my_kid.class_id
      where my_kid.parent_id = auth.uid()
        and their_kid.id = registrations.kid_id
        and my_kid.class_id is not null
    )
  );

-- Share invites for friends outside class
create table public.share_invites (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  inviter_id uuid not null references auth.users(id) on delete cascade,
  invitee_email text not null,
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.share_invites enable row level security;

create policy "invites inviter all" on public.share_invites for all to authenticated
  using (auth.uid() = inviter_id) with check (auth.uid() = inviter_id);

-- Indexes
create index on public.kids (parent_id);
create index on public.kids (class_id);
create index on public.camp_sessions (vendor_id);
create index on public.registrations (session_id);
create index on public.registrations (kid_id);
