# AitU Supabase authentication (Step 5B)

The existing project is connected, and the user has already applied the schema.
Step 5B does not execute or modify `schema.sql`, RLS, or Supabase settings.
Authentication and authority applications are live; dashboard requests remain
local demo data. Signup and email confirmation were tested successfully by the
user on the computer before the interrupted work resumed.

## Existing configuration (do not reapply the schema)

The local configuration is already present in ignored `.env`. For a new checkout,
use the existing project's public values rather than changing the database:

1. In the project's **Connect** dialog obtain the **Project URL**. Under
   **Settings → API Keys**, obtain the public **publishable** key.
2. Copy `.env.example` to `.env.local` and fill in:

   ```dotenv
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
   ```

   The existing client also accepts `VITE_SUPABASE_ANON_KEY` as a legacy fallback.
   The publishable variable takes precedence. Existing `.env` values are read
   directly; `.env.local`, if present, overrides matching `.env` values.

3. Restart Vite with `npm.cmd run dev`. Do not put a secret or service-role key
   in any `VITE_*` variable. Those values are bundled into the browser. Never
   commit `.env`/`.env.local`; only the blank `.env.example` is tracked.

The user has set Site URL to `http://localhost:5173` and allowed redirects to
`http://localhost:5173/**`. Keep these settings. No additional Supabase setting
is required for this local step, and email confirmation remains enabled according
to the project's actual behavior. A future deployment will need its own exact
site/redirect URL configured manually. No schema is applied by starting/building.

## Database security model

| Resource | Authenticated browser access |
| --- | --- |
| Own profile | Read; update `full_name` only |
| Other profiles | No access |
| Own authority application | Insert `iin`, `organization`, `position`; read safe columns |
| IIN (including one's own) | No SELECT grant to browser roles |
| Other applications | No access, including for verified authority employees |
| Role, verification, organization on profile | No browser writes |
| Application review/status/timestamps | No browser writes |
| Anonymous users | No table access |

RLS enforces ownership. Column grants prevent privilege escalation inside an
otherwise permitted own-row update. The signup trigger hardcodes `citizen` and
null authority status, regardless of role values in user-editable metadata.
Organization on a profile is review-managed; organization on an application is
an unverified applicant claim. One application per account is allowed for now.
Editing/reapplying after rejection needs a deliberate future policy/workflow.

An applicant remains a citizen with an application in `pending`. A trusted
future reviewer must verify identity **and employment**, then update the
application review status/time and profile role/status/organization together in
a privileged transaction. That workflow, admin panel, and promotion endpoint
are intentionally not implemented. IIN alone never establishes employment.
Do not log IIN, application payloads, or raw database errors containing input.

`public.is_verified_authority()` checks the authenticated user's database
profile: `role = 'authority' AND authority_status = 'verified'`. Future protected
resource policies must use a database check such as this. UI guards are not a
replacement for RLS. Merely setting an application's status to verified never
grants authority privileges by itself.

## Active frontend architecture

- `src/lib/supabase.js`: reusable client; missing environment yields `null` and
  `unconfigured`, incomplete/invalid configuration yields `invalid`. No secret
  values or SDK errors are logged. Checking key type is only a configuration
  safeguard, not credential verification.
- `src/auth/loadAccount.js`: read-only loader used by the session provider.
  Validates the Auth user with `getUser()`, then reads its profile/application
  using RLS and explicit safe columns. Missing profile/schema, network errors,
  and permission errors return `unavailable`, never verified or demo access.
- `src/auth/access.js`: `canAccessRole` and `getAccountDestination` provide the
  active route decisions. They take a loaded database profile, never a role
  selection value, localStorage role, or editable Auth metadata.

- `AuthProvider`, `accountStore`, and `ProtectedRoute`: one auth subscription,
  session restoration, finite loading/error states, stale-response cancellation,
  and protected pages. Auth callbacks schedule Supabase requests after the SDK
  releases its auth lock. Missing configuration never bypasses protection.
- `actions.js`: safe signup metadata (`full_name` only), friendly Russian errors,
  and an application insert containing only `iin`, `organization`, and `position`.
- `storage.js`: Supabase-managed session persistence. The remember checkbox
  chooses persistent or session storage. Logout clears auth keys, not the theme.

| Database account state | Destination |
| --- | --- |
| No authenticated session | `/login` |
| Citizen without an authority application | `/dashboard` |
| Pending application | `/verification-pending` |
| Rejected application | `/verification-status` |
| Authority profile AND verified authority status | `/authority` |
| Missing/inconsistent profile or unavailable backend | Retry/logout state; no protected data |

Registration keeps basic credentials in React memory while `/select-role` is
shown. Refreshing that unfinished step safely returns to login. Role selection
creates an ordinary Auth account and never sends privileged metadata. If signup
returns no session, `/confirm-email` explains the confirmation requirement.
An authenticated citizen choosing authority continues to `/authority-application`.
A non-sensitive email resume hint in sessionStorage and the confirmation redirect's
`apply=authority` flag can reopen that FORM only; neither grants authority access.

IIN exists only in the masked form's memory and the intended Supabase application
insert. It is cleared after submission/errors and is never logged, persisted in
browser storage, placed in URLs, or read back. Status screens show organization
and status only. Pending/rejected users cannot bypass verification via a dashboard
URL. An application marked verified without a verified authority profile does
not grant access. Real review/admin tooling is still outside this step.

Normal login skips role selection. Both dashboards retain the approved request
demo data and layout, with logout behind the existing profile button. Password
recovery, Google/phone auth, and database-backed requests remain out of scope.

## Verification

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

The tests cover role decisions, spoofed metadata, user/profile mismatch, missing
credentials, network timeout/retry, StrictMode listener cleanup, sign-out races,
session storage, and safe payloads. The installed Supabase SDK is also exercised
against mocked HTTP through login, restoration, application, review states and
logout. Actual React pages/guards render in both themes under server rendering.
These tests do not execute Postgres or prove the deployed database's policies.
No fake production accounts or applications were created during verification.
Browser automation was unavailable; a fresh live-account click-through was not
performed by the agent. The user's successful signup/email-confirmation test
remains the live evidence for that part of the flow.

For a separate database audit, `supabase/security-checks.sql` is read-only and
checks RLS/grants. No SQL was run as part of Step 5B. Additional RLS validation with
two disposable signed-in users: own-name update succeeds; other-user reads and
updates fail; role/status updates fail; own pending application creation works;
another account's application and IIN reads fail; client-supplied verified status
or user_id on insert fails. Never use a privileged key for these browser-role
checks. Validate the signup trigger on a test account with forged role metadata:
its profile must still be citizen. This requires a configured Supabase database.

Official references: [API keys](https://supabase.com/docs/guides/getting-started/api-keys),
[column privileges](https://supabase.com/docs/guides/database/postgres/column-level-security),
[Auth profiles and triggers](https://supabase.com/docs/guides/auth/managing-user-data),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
