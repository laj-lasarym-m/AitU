-- REVIEW and apply manually ONCE after the existing requests migrations.
-- No backfill: notifications record future status transitions only.
begin;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid references public.requests(id) on delete set null,
  request_number text not null,
  type text not null check (type = 'request_status_changed'),
  title text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_owner_created_idx
  on public.notifications (user_id, created_at desc, id);
alter table public.notifications enable row level security;
revoke all on public.notifications from public, anon, authenticated;
grant select on public.notifications to authenticated;
grant update (is_read) on public.notifications to authenticated;
create policy notifications_read_own on public.notifications
  for select to authenticated using ((select auth.uid()) = user_id);
create policy notifications_mark_own_read on public.notifications
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and is_read = true);

create function public.aitu_notify_request_status()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  notification_message text;
begin
  if old.status is not distinct from new.status then return new; end if;
  notification_message := case new.status
    when 'reviewing' then 'Ваше обращение ' || new.request_number || ' принято на рассмотрение'
    when 'in_progress' then 'По обращению ' || new.request_number || ' начата работа'
    when 'needs_info' then 'По обращению ' || new.request_number || ' требуется дополнительная информация'
    when 'resolved' then 'Обращение ' || new.request_number || ' решено'
    when 'rejected' then 'По обращению ' || new.request_number || ' принято решение'
    when 'new' then 'Обращение ' || new.request_number || ' переведено в статус «Новая»'
    else null
  end;
  if notification_message is not null then
    insert into public.notifications (user_id, request_id, request_number, type, title, message)
    values (new.user_id, new.id, new.request_number, 'request_status_changed',
      'Обновление статуса обращения', notification_message);
  end if;
  return new;
end;
$$;
revoke all on function public.aitu_notify_request_status() from public, anon, authenticated;
create trigger aitu_request_status_notification
  after update of status on public.requests
  for each row when (old.status is distinct from new.status)
  execute function public.aitu_notify_request_status();

-- No changes to existing requests RLS/grants or previous migrations.
-- No browser notification INSERT/DELETE or content/ownership UPDATE grants.
commit;
