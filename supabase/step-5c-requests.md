# Step 5C.1 — citizen requests

Implementation is ready for manual database setup. **No SQL was executed.**
Authentication, routing, profiles, authority applications, their existing RLS,
and `supabase/schema.sql` were not changed. No demo records were seeded.

## Apply once, manually

Review **[step-5c-requests.sql](step-5c-requests.sql)**, then execute that file
once in the existing project's Supabase SQL Editor as `postgres`. Step 5A's
schema must already be installed. Do **not** rerun `schema.sql`.

The migration is transactional and deliberately fails if its objects already
exist. It does not replace policies, alter existing tables, or change auth
settings. Until applied, the real-data views show a friendly unavailable message;
the explicitly selected **Демонстрация** view still works.

Objects created:

- `public.requests`: UUID ID, friendly number, owner, problem/idea type, title,
  description, optional category/address, workflow status/priority/assignee,
  and creation/update timestamps. Text lengths and machine values are constrained.
- `public.request_number_seq`, starting at 101 and owned by the request-number
  column; the primary key and friendly-number uniqueness each create an index.
- `requests_owner_created_idx` and `requests_status_created_idx`.
- `public.aitu_number_request()` and the `aitu_requests_number` BEFORE INSERT
  trigger. It always assigns `A-` plus an atomic sequence value. Concurrent
  inserts cannot choose the same number. Rollbacks can leave gaps; numbers are
  identifiers, not a consecutive accounting ledger. It uses an empty search path
  and qualified object names; browser roles cannot call it or access the sequence.
- `aitu_requests_updated_at`, reusing existing `public.aitu_set_updated_at()`.
- Four RLS policies listed below, plus restricted column grants.

No storage buckets, employees, AI, map, audit-history, or comment tables are added.

## Permissions

| Caller | Allowed operation | Database enforcement |
| --- | --- | --- |
| Anonymous | None | All table and sequence privileges revoked |
| Authenticated citizen | Insert own request | `requests_citizen_insert`; `user_id` defaults to `auth.uid()`; own profile must be citizen; initial status must be `new`, priority/assignee null |
| Authenticated citizen | Read own rows | `requests_citizen_read_own`; UID ownership and citizen profile |
| Verified authority | Read requests | `requests_authority_read`; existing `public.is_verified_authority()` |
| Verified authority | Update workflow only | `requests_authority_update_workflow`; same predicate in USING and WITH CHECK |

Authenticated INSERT grants cover **only** `type, title, description, category,
address`. UPDATE grants cover **only** `status, priority, assigned_to`; RLS allows
these updates only for verified authority. Neither browser role can set owner,
number, ID or timestamps, edit the original citizen content, or delete rows.
Citizen updates remain forbidden even though citizen and authority share the
Supabase `authenticated` database role. New request RLS does not modify profile
or authority-application permissions. The new function is a trigger, not an RPC
endpoint for assigning numbers or privileges.

The API also whitelists fields and checks the current authenticated user, but
database grants/RLS are the security boundary. List reads use explicit columns,
stable ordering and pages of 100. Citizen reads additionally filter by the
authenticated user's ID. UUIDs identify updates; friendly numbers are for display.

References: [Supabase column privileges](https://supabase.com/docs/guides/database/postgres/column-level-security),
[Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[PostgreSQL sequences](https://www.postgresql.org/docs/16/functions-sequence.html).

## Implemented flow

1. On the existing landing form choose **Проблема / Идея**, enter text, and select
   **Продолжить**. An authenticated citizen sees a small review dialog with an
   editable title, the original description, and optional address/category.
2. **Отправить обращение** inserts the content. The server supplies owner, number,
   default workflow and timestamps. Success opens `/dashboard`; failure leaves
   the form available with a friendly error. Duplicate clicks are disabled while
   the save is in progress.
3. Guests are sent through the unchanged login/registration flow. Only the type,
   text and draft timestamp are saved in this tab's sessionStorage. The citizen
   dashboard shows **Продолжить** to recover that draft. Draft reads discard data
   older than 30 minutes; success or **Удалить черновик** clears it. Closing the
   tab clears sessionStorage. Files, account IDs and credentials are not added.
   If storage is blocked, text remains in the form and the visitor is told to copy
   it before logging in. No text is placed in the URL.
4. Both dashboards default to real database rows and retain the approved list and
   detail layouts. Selection, filters and search use the existing components.
   Source controls label real versus demo data; failures never silently switch
   to demos.
5. Verified authority uses **Изменить статус** to save one of the six supported
   statuses. **Назначить ответственного** saves a simple name/service string;
   an empty string clears assignment. No employee database or deadline write is
   implied. The API and SQL permit priority updates, but no new priority editor
   has been added in this step.
6. Successful updates use the returned row immediately. Failures keep the modal
   open without claiming success. Citizen **Обновить** or a page reload reads the
   persisted status/assignment. No realtime subscription is used. Stale list
   responses are discarded on source/account change or after a successful update.

Status values preserve the dashboard's existing Russian labels:

| Database | UI |
| --- | --- |
| `new` | Новая |
| `reviewing` | На рассмотрении |
| `in_progress` | В работе |
| `needs_info` | Нужны уточнения |
| `resolved` | Завершена |
| `rejected` | Отклонено |

## Demo and deferred features

Original `src/data/requests.js` and `src/data/authorityRequests.js` are unchanged.
**Демонстрация** retains the existing sample records, citizen confirmations and
local updates/photo previews, and authority status/assignment/history previews.
These reset on leaving/reloading the page and are never sent to Supabase. Real
rows carry a separate database UUID and `source: 'database'`; demo IDs cannot be
passed to the real-update API. Matching friendly numbers across sources do not
mix their state.

For real rows, maps, AI, photos, comments, votes, related requests, deadlines and
full change history are explicitly deferred. History shows creation and the
current state/timestamp only, not an invented audit trail. The landing photo
button preserves its appearance and explains that upload is not yet available.
Request text should avoid unnecessary sensitive personal information.

## Verification

Run `npm.cmd test`, `npm.cmd run lint`, and `npm.cmd run build`.

Tests include existing auth/route/session regressions, real React component
server rendering, allowed payloads, owner exclusion, status mapping, guest draft
recovery/expiry, explicit empty/loading/error states, and the installed Supabase
SDK against mocked HTTP for citizen create → authority update → citizen refresh.
SQL checks are static only. Tests do not apply SQL, create remote accounts, or
change real verification states.

After applying the migration manually, verify in a browser with existing accounts:

1. Citizen A: submit a request, record its server number, reload `/dashboard` and
   verify original fields/status. Submit an idea too; check filters and selection.
2. Citizen B: verify A's request is absent. Anonymous reads/inserts must fail.
3. Verified authority: open A's request, change each workflow status and assign a
   name. Reload, then refresh Citizen A's dashboard and verify persistence.
4. Use publishable-key authenticated clients for access checks (SQL Editor as
   postgres bypasses RLS): citizen cannot choose `user_id`, workflow fields,
   number or timestamps on insert; citizen workflow update must affect no rows;
   authority cannot modify title, description, type, owner or timestamps. Delete
   must fail. Pending/rejected applicants cannot use authority read/update rights.
5. Check a failed save/offline read: friendly errors, retained draft/modal, retry.
   Switch to demo and confirm no request inserts/updates are sent.
6. Check both themes and a narrow viewport, guest login draft recovery, and
   refresh of authenticated protected routes.

The available browser automation surface was empty during this implementation.
Dev-server route HTTP checks and React server rendering are not a substitute for
the post-migration browser/RLS checks above. Live persistence cannot be verified
before the migration is applied.

## Files

Created:

- `supabase/step-5c-requests.sql`, `supabase/step-5c-requests.md`
- `src/requests/api.js`, `model.js`, `draft.js`, `useRequests.js`
- `src/components/requests/CreateRequestDialog.jsx`, `RequestDataControls.jsx`
- `src/styles/requests.css`
- `tests/requests.test.js`, `request-pages.test.js`, `request-schema.test.js`

Modified:

- `src/App.jsx` (form-help text)
- `src/components/LandingForm.jsx`
- `src/pages/DashboardPage.jsx`, `src/pages/AuthorityPage.jsx`
- `src/components/dashboard/RequestDetails.jsx`
- `src/components/authority/AuthorityRequestDetails.jsx`, `AuthorityRequestList.jsx`,
  `AuthorityModals.jsx`
- `README.md`

Existing authentication, route definitions, theme handling, demo data, existing
styles and the applied Step 5A schema are unchanged. Step 5C.2 was not started.
