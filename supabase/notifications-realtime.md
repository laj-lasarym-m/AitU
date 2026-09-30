# Citizen Realtime notifications — manual setup

Existing table, trigger, grants and RLS are unchanged. No SQL was executed.
No local migration enables `public.notifications` in Realtime; the live publication
cannot be determined from repository files. Check the existing project before changing it.

In Supabase Dashboard → Database → Publications → `supabase_realtime`, check whether
**public.notifications** is enabled. If already enabled, no database change is needed.
Otherwise enable only this table. Alternatively, review and run the following in SQL
Editor as postgres. The SELECT inspects configuration; the DO block adds only the
missing table and is safe to skip if the UI toggle is already enabled:

```sql
select pubname, schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public' and tablename = 'notifications';

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
```

Do not recreate the publication, change replica identity, or add other tables.
The existing SELECT RLS still controls delivery. No new permission, secret, Edge
Function, trigger or notification content change is required. Deploy the updated
frontend using your usual process.

## Live checks

1. Log in as citizen A with existing unread notifications. The bell, sidebar and
   notification list should agree; initial fetch must not show a toast, even for a
   record less than ten seconds old. Open the bell: opening alone must not mark read.
2. While A's dashboard stays open, use the existing authority workflow to change
   A's request status. The resulting INSERT should immediately appear in history and
   both badges. A toast appears bottom-left only for an unseen unread INSERT whose
   creation time is between zero and ten seconds ago. Device clocks should be accurate.
3. Dismiss by X or wait six seconds: badges remain unread. Click **Посмотреть**:
   the existing API marks it read, badges update, toast closes and related details open.
4. Test **Все уведомления**, individual history/dropdown actions and **Отметить все
   как прочитанные**. Real records only. More than 99 unread displays `99+`.
5. Citizen B must never receive A's rows. Log out/change account/unmount: old channel
   and toast timer are removed. No old-account data should appear in the next account.
6. Disable network temporarily: the list/dropdown reports lost Realtime connectivity.
   Refresh is available; subscription recovery refreshes history without historical toasts.
   There is no polling. Reads in another tab are reconciled on refresh/reconnect; this
   feature subscribes to INSERT only, not UPDATE or DELETE.

One dashboard-scoped store owns history, unread count, mutation state and one toast.
Fetches and events merge by ID; acknowledged reads are not undone by an older fetch.
Only Realtime inserts can generate a toast. Locally tested using mocked Supabase
boundaries; these live publication/RLS checks remain manual.

Reference: https://supabase.com/docs/guides/realtime/postgres-changes
