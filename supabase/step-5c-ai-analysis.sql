-- Step 5C.4: REVIEW and apply manually ONCE after Steps 5C.1-5C.3.
-- Never executed by the app. Do not rerun previous migrations.
begin;

create table public.request_ai_analyses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.requests(id) on delete cascade,
  category text not null check (char_length(btrim(category)) between 1 and 100),
  priority text not null check (priority in ('low', 'medium', 'high')),
  responsible_service text not null check (char_length(btrim(responsible_service)) between 1 and 200),
  summary text not null check (char_length(btrim(summary)) between 1 and 600),
  reason text not null check (char_length(btrim(reason)) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.request_ai_analyses enable row level security;
revoke all on public.request_ai_analyses from public, anon, authenticated;
grant select on public.request_ai_analyses to authenticated;
grant select, insert on public.request_ai_analyses to service_role;
create policy request_ai_analyses_authority_read
  on public.request_ai_analyses for select to authenticated
  using ((select public.is_verified_authority()));
create trigger aitu_request_ai_analyses_updated_at
  before update on public.request_ai_analyses
  for each row execute function public.aitu_set_updated_at();

-- Short server-only leases prevent simultaneous calls across Edge instances.
-- Expired leases are reclaimed on the next explicit attempt, without a cron job.
create table public.request_ai_analysis_locks (
  request_id uuid primary key references public.requests(id) on delete cascade,
  token uuid not null,
  expires_at timestamptz not null
);
alter table public.request_ai_analysis_locks enable row level security;
revoke all on public.request_ai_analysis_locks from public, anon, authenticated;
grant select, insert, delete on public.request_ai_analysis_locks to service_role;
-- No browser policies or grants on locks; no browser analysis writes.
-- No changes to requests, profiles, Storage, or their policies.

commit;
