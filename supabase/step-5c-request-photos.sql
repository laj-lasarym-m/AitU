-- Step 5C.2: REVIEW, then apply manually ONCE as postgres after Step 5C.1.
-- Never executed by the app. Do not rerun either previously applied schema.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('request-photos', 'request-photos', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']);

create table public.request_photos (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  kind text not null default 'citizen' check (kind in ('citizen', 'before', 'after')),
  created_at timestamptz not null default now(),
  constraint request_photos_owned_path check (
    split_part(storage_path, '/', 1) = user_id::text
    and split_part(storage_path, '/', 2) = request_id::text
    and storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
  )
);
create index request_photos_request_created_idx on public.request_photos (request_id, created_at, id);
alter table public.request_photos enable row level security;
revoke all on public.request_photos from public, anon, authenticated;
grant select on public.request_photos to authenticated;
grant insert (request_id, storage_path) on public.request_photos to authenticated;

create policy request_photos_citizen_insert on public.request_photos for insert to authenticated
  with check (
    user_id = (select auth.uid()) and kind = 'citizen'
    and exists (select 1 from public.requests r where r.id = request_id and r.user_id = (select auth.uid()))
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'citizen')
  );
create policy request_photos_citizen_read on public.request_photos for select to authenticated
  using (
    user_id = (select auth.uid())
    and exists (select 1 from public.requests r where r.id = request_id and r.user_id = (select auth.uid()))
  );
create policy request_photos_authority_read on public.request_photos for select to authenticated
  using (
    (select public.is_verified_authority())
    and exists (select 1 from public.requests r where r.id = request_id)
  );

-- Serialize metadata inserts per request so concurrent uploads cannot exceed 5.
-- Definer rights are ONLY for the lock/count/object check, not an exposed RPC.
create function public.aitu_check_request_photo()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.user_id is distinct from auth.uid() or new.kind <> 'citizen'
    or not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'citizen') then
    raise exception 'Photo owner not allowed' using errcode = '42501';
  end if;
  perform 1 from public.requests r where r.id = new.request_id and r.user_id = auth.uid() for update;
  if not found then raise exception 'Request not allowed' using errcode = '42501'; end if;
  if (select count(*) from public.request_photos p where p.request_id = new.request_id) >= 5 then
    raise exception 'Photo limit reached' using errcode = '23514';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'request-photos' and o.name = new.storage_path) then
    raise exception 'Upload is missing' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.aitu_check_request_photo() from public, anon, authenticated;
create trigger aitu_request_photo_check before insert on public.request_photos
  for each row execute function public.aitu_check_request_photo();

-- Existing request RLS applies to these subqueries; no request policies change.
create policy request_photos_storage_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'request-photos'
    and split_part(name, '/', 1) = (select auth.uid())::text
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
    and exists (select 1 from public.requests r where r.id::text = split_part(name, '/', 2) and r.user_id = (select auth.uid()))
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'citizen')
  );
create policy request_photos_storage_owner_read on storage.objects for select to authenticated
  using (
    bucket_id = 'request-photos'
    and split_part(name, '/', 1) = (select auth.uid())::text
    and exists (select 1 from public.requests r where r.id::text = split_part(name, '/', 2) and r.user_id = (select auth.uid()))
  );
create policy request_photos_storage_authority_read on storage.objects for select to authenticated
  using (
    bucket_id = 'request-photos' and (select public.is_verified_authority())
    and exists (select 1 from public.request_photos p where p.storage_path = name)
  );
-- Cleanup is limited to the owner's unlinked uploads. Linked evidence is immutable.
create policy request_photos_storage_orphan_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'request-photos'
    and split_part(name, '/', 1) = (select auth.uid())::text
    and exists (select 1 from public.requests r where r.id::text = split_part(name, '/', 2) and r.user_id = (select auth.uid()))
    and not exists (select 1 from public.request_photos p where p.storage_path = name)
  );
-- No Storage UPDATE/upsert, authority uploads, or metadata UPDATE/DELETE rights.
-- Review existing broad storage.objects policies: permissive policies are ORed.
commit;
