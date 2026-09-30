# AitU

Public landing page and citizen/authority dashboards built with React, Vite, JavaScript, CSS,
React Router, and lucide-react.

## Development

Use `npm.cmd` in PowerShell on this Windows PC.

```powershell
npm.cmd install
npm.cmd run dev
```

Open the local URL printed by Vite.

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run preview
```

## Structure

```text
src/
  assets/                 Original Semey bridge background photograph
  components/
    LandingHeader.jsx     Wordmark, navigation, and language dropdown
    LandingHero.jsx       Headline and call-to-action buttons
    LandingForm.jsx       Appeal text and authenticated submission entry
    KazakhOrnament.jsx     Decorative SVG edge ornaments
  styles/
    global.css            Base styles
    landing.css           Landing layout, photo treatment, and responsive styles
  App.jsx                 Page composition and local notices
  main.jsx                React bootstrap
```

The background uses `src/assets/semey-bridge-hq.png`, the bridge photo
provided for this project. The approved design screenshot is a visual reference
only; it is not embedded in the page.

## Local interactions

- Switch between problem and idea.
- Enter text and continue to the authenticated request review dialog.
- Focus the form using the write button.
- Open and close the language dropdown (Russian only for now).
- Receive explanatory notices for future map, voice, and photo features.

Authentication uses Supabase. Step 5C.1 connects real requests after its separate
SQL migration is manually applied; see the setup link below. Step 5C.2 adds
private photo attachments after its separate manual migration. Guest text is
preserved in this tab during login; photos must be reselected afterward.

## Dashboard

An authenticated citizen can open `/dashboard`; `/` remains the public landing page.
Dashboard components live in `src/components/dashboard`, demo requests in
`src/data/requests.js`, and scoped styles in `src/styles/dashboard.css`.

The dashboards support request selection, search, filters and detail tabs. Real
and demo requests are explicitly separated. Demo mode retains local confirmations,
text/photo previews and authority workflow demonstrations; these reset on reload.
Real request status and simple assignee changes persist in Supabase after setup.
The shared theme preference persists in localStorage. The new-request button
returns to the landing form. Maps and other future features remain placeholders.

## Supabase authentication (Step 5B)

Authentication, security rules, and verification details are in
[`supabase/README.md`](supabase/README.md). The schema is already applied to the
existing project; do not rerun `schema.sql`. Current Supabase configuration and
approved layouts are preserved. Authentication and authority applications already
use Supabase; requests use the separate Step 5C.1 setup below.

`/login` supports email/password login and registration. Registration uses
`/select-role`, and normal login routes directly from database account state.
Pending/rejected applicants use `/verification-pending` or `/verification-status`.
Only verified authority profiles can open `/authority`. Open the existing
profile button in either dashboard to sign out. Theme preferences are preserved.

Run `npm.cmd test` for routing, session races, SDK integration with mocked HTTP,
safe request payloads, and actual page/guard server rendering. These tests do
not create remote accounts or change real verification states.

## Citizen requests (Step 5C.1)

Step 5C.1 has been applied and live-tested by the project owner. Do not rerun
`schema.sql` or `supabase/step-5c-requests.sql`. The separate demo view remains
available alongside real request data.

See [`supabase/step-5c-requests.md`](supabase/step-5c-requests.md) for database
objects, RLS and column privileges, request numbering, citizen/authority flows,
deferred features, file changes and the post-migration verification checklist.

## Request photos (Step 5C.2)

Review and manually apply only
[`supabase/step-5c-request-photos.sql`](supabase/step-5c-request-photos.sql).
**This migration has not been executed.** It creates the private `request-photos`
bucket, photo metadata and ownership/read/cleanup policies. No new secrets or
environment variables are needed. Existing text-only requests still work.

See [`supabase/step-5c-request-photos.md`](supabase/step-5c-request-photos.md) for
exact setup, security, partial failures, file inventory and live verification.

## Request location (Step 5C.3)

Steps 5C.1 and 5C.2 are applied and live-tested by the project owner. For location,
review and manually execute only
[`supabase/step-5c-request-location.sql`](supabase/step-5c-request-location.sql)
before using the new frontend against Supabase. **This new migration has not been
executed.** It adds nullable coordinates and INSERT grants without changing RLS.

The existing creation dialog offers an optional Semey map picker. Citizen
**Карта города** shows only the citizen's authorized requests; verified authority
**Карта обращений** shows its authorized requests with filters. Legacy rows keep
empty locations. Photos and normal request/status flows are unchanged.

See [`supabase/step-5c-request-location.md`](supabase/step-5c-request-location.md)
for setup, file inventory, map behavior, tile-provider details and live checks.
