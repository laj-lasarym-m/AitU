-- AitU Step 5A: REVIEW before applying once in Supabase SQL Editor as postgres.
-- Not executed automatically. Targets a new schema; intentionally fails if these
-- objects already exist rather than replacing policies or existing data.
begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 200),
  role text not null default 'citizen' check (role in ('citizen', 'authority')),
  authority_status text check (authority_status in ('pending', 'verified', 'rejected')),
  organization text check (char_length(organization) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_status check (
    (role = 'citizen' and authority_status is null)
    or (role = 'authority' and authority_status is not null)
  )
);

create table public.authority_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references public.profiles(id) on delete cascade,
  iin text not null check (iin ~ '^[0-9]{12}$'),
  organization text not null check (char_length(btrim(organization)) between 1 and 300),
  position text not null check (char_length(btrim(position)) between 1 and 200),
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint authority_applications_review_time check (
    (status = 'pending' and reviewed_at is null)
    or (status in ('verified', 'rejected') and reviewed_at is not null)
  )
);

comment on column public.authority_applications.iin is
  'Sensitive applicant input. Not evidence of employment. No browser SELECT grant; never log or publish.';
comment on column public.profiles.organization is
  'Trusted review-managed organization; applicant claims live in authority_applications.';

alter table public.profiles enable row level security;
alter table public.authority_applications enable row level security;

-- Clear permissive defaults. Row ownership alone does not protect role columns.
revoke all on public.profiles from public, anon, authenticated;
revoke all on public.authority_applications from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;
grant select (id, user_id, organization, position, status, created_at, reviewed_at)
  on public.authority_applications to authenticated;
grant insert (iin, organization, position) on public.authority_applications to authenticated;

create policy profiles_read_own on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy authority_applications_read_own on public.authority_applications for select to authenticated
  using ((select auth.uid()) = user_id);
create policy authority_applications_create_own_pending on public.authority_applications for insert to authenticated
  with check (
    (select auth.uid()) = user_id and status = 'pending' and reviewed_at is null
    and exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'citizen')
  );
-- No browser profile INSERT/DELETE, application UPDATE/DELETE, review, or promotion.

create function public.aitu_set_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;
revoke all on function public.aitu_set_updated_at() from public, anon, authenticated;
create trigger aitu_profiles_updated_at before update on public.profiles
  for each row execute function public.aitu_set_updated_at();

-- Only full_name is taken from editable metadata; roles/status/org are NOT trusted.
create function public.aitu_create_citizen_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, role, authority_status)
  values (new.id, pg_catalog.left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 200), 'citizen', null);
  return new;
end;
$$;
revoke all on function public.aitu_create_citizen_profile() from public, anon, authenticated;
create trigger aitu_auth_user_created after insert on auth.users
  for each row execute function public.aitu_create_citizen_profile();

-- Safe initial backfill for Auth accounts already present in this project.
-- Every account starts as citizen; never infer privilege from signup metadata.
insert into public.profiles (id, full_name, role, authority_status)
select id, left(coalesce(raw_user_meta_data ->> 'full_name', ''), 200), 'citizen', null
from auth.users;

-- Reusable database predicate for FUTURE resource RLS, not an approval endpoint.
-- Own-profile RLS applies; this function cannot read someone else's profile.
create function public.is_verified_authority()
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'authority' and authority_status = 'verified'
  );
$$;
revoke all on function public.is_verified_authority() from public, anon, authenticated;
grant execute on function public.is_verified_authority() to authenticated;

commit;
