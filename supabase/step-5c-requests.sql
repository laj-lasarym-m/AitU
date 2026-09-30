-- Step 5C.1: REVIEW and apply manually once, AFTER Step 5A.
-- This file is never executed by the app. Do not rerun schema.sql.
-- Existing objects intentionally cause failure rather than being replaced.
begin;

create sequence public.request_number_seq as bigint start with 101;
revoke all on sequence public.request_number_seq from public, anon, authenticated;

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null unique,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  type text not null check (type in ('problem', 'idea')),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  description text not null check (char_length(btrim(description)) between 1 and 10000),
  category text check (category is null or char_length(btrim(category)) between 1 and 100),
  address text check (address is null or char_length(btrim(address)) between 1 and 300),
  status text not null default 'new' check (status in ('new', 'reviewing', 'in_progress', 'needs_info', 'resolved', 'rejected')),
  priority text check (priority in ('low', 'medium', 'high')),
  assigned_to text check (assigned_to is null or char_length(btrim(assigned_to)) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter sequence public.request_number_seq owned by public.requests.request_number;
create index requests_owner_created_idx on public.requests (user_id, created_at desc, id);
create index requests_status_created_idx on public.requests (status, created_at desc);

-- nextval is atomic across concurrent inserts. Rollbacks may leave number gaps.
-- Definer rights keep the sequence inaccessible to browser roles.
create function public.aitu_number_request()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.request_number := 'A-' || pg_catalog.nextval('public.request_number_seq'::regclass)::text;
  return new;
end;
$$;
revoke all on function public.aitu_number_request() from public, anon, authenticated;
create trigger aitu_requests_number before insert on public.requests
  for each row execute function public.aitu_number_request();
create trigger aitu_requests_updated_at before update on public.requests
  for each row execute function public.aitu_set_updated_at();

alter table public.requests enable row level security;
revoke all on public.requests from public, anon, authenticated;
grant select on public.requests to authenticated;
-- Owner, number, status, priority, assignment and timestamps use server defaults.
grant insert (type, title, description, category, address) on public.requests to authenticated;
-- A column grant applies to authenticated callers, but RLS limits UPDATE to
-- verified authority. Citizen identity/content/timestamps are never writable.
grant update (status, priority, assigned_to) on public.requests to authenticated;

create policy requests_citizen_insert on public.requests for insert to authenticated
  with check (
    user_id = (select auth.uid()) and status = 'new' and priority is null and assigned_to is null
    and exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'citizen')
  );
create policy requests_citizen_read_own on public.requests for select to authenticated
  using (
    user_id = (select auth.uid())
    and exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'citizen')
  );
create policy requests_authority_read on public.requests for select to authenticated
  using ((select public.is_verified_authority()));
create policy requests_authority_update_workflow on public.requests for update to authenticated
  using ((select public.is_verified_authority()))
  with check ((select public.is_verified_authority()));
-- No DELETE policy/grant, owner changes, content edits, or demo seed inserts.

commit;
