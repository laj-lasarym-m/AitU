# Citizen points and notifications — manual setup

No SQL has been executed. No Edge Function or new secret is needed.

1. In the existing Supabase project SQL Editor, review and run the complete
   `supabase/step-notifications.sql` **once as postgres**, after the existing request
   migrations. Do not rerun previous migrations. This adds only a notifications
   table, its owner-only policies, and an AFTER status-update trigger.
2. Use two citizen accounts and an existing verified authority account for a live check.
   Change citizen A's real request status through the existing authority interface.
   Open A's **Уведомления** section (or press **Обновить**). One new notification should appear
   with the actual request number and new status. B must not see it.
3. Save the same status again or change only the assigned employee: no notification
   should be added. Separate genuine status transitions each produce their own notification.
   There is no historical backfill and no notification for request creation.
4. Click a notification: it becomes read and opens existing request details when the
   request is available. **Отметить все как прочитанные** updates only the signed-in owner's
   unread rows. Deleted requests retain the number/message but no longer open details.
5. In an authenticated SDK test, verify that a citizen cannot SELECT another owner's
   notifications, INSERT/DELETE notifications, or UPDATE title/message/user_id/request_id/
   request_number/type. Only `is_read = true` is permitted. Authority browsers have no
   notification INSERT privilege. Existing requests RLS is unchanged.

Points need no migration: only owned real requests contribute. Problems give 10,
ideas 15; currently resolved problems add 20 and resolved ideas add 30. Reopening
a request removes its resolution bonus until resolved again; repeated transitions
never accumulate bonuses. Totals are not a ledger, money or a rewards system.
Activity shows actual latest submissions and their current contribution, not invented
status events. Navigation/refresh loads current data; no realtime subscriptions.

Local tests validate helpers, SDK boundaries, UI and SQL text contracts. They do not
execute PostgreSQL or prove live RLS/trigger behavior; complete the live checks above
after applying the migration. Before setup, notifications show a configuration error
rather than fake rows. No sidebar badge was added to avoid background polling.
