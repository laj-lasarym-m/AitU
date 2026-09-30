# Step 5C.4 — real request AI recommendations

Code is prepared, but **no SQL was executed, no function deployed and no secrets set**.
This feature will not work against the live project until the following manual setup is completed.
Existing authentication, requests, photos, maps and workflow permissions are unchanged.

## Manual setup (once)

1. In the existing Supabase project `amtobepbotkxbtsgqksc`, open SQL Editor.
   Review **`supabase/step-5c-ai-analysis.sql`** and execute its full contents once as postgres,
   after the completed Steps 5C.1–5C.3. Do not rerun any older migration.
   The transaction deliberately fails on existing objects instead of replacing policies/data.
   It creates `request_ai_analyses` and a small server-only `request_ai_analysis_locks` table.
2. In Supabase Dashboard → Edge Functions → Secrets, manually add:
   - `OPENAI_API_KEY`: your server-side OpenAI project API key (with Responses API access).
   - Optional `OPENAI_MODEL`: defaults to `gpt-4.1-mini-2025-04-14`.
     Any replacement must support Responses API strict JSON Schema output.
   - Optional `AI_PROVIDER`: `openai` (the only currently implemented provider).
   - `AI_ALLOWED_ORIGINS`: `http://localhost:5173` for current development.
     When hosted, use comma-separated exact app origins, e.g.
     `http://localhost:5173,https://your-app.example`. Do not include paths or trailing slashes.
   Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY` and
   `SUPABASE_SERVICE_ROLE_KEY` inside Edge Functions. Do not copy these server keys into Vite.
   No frontend environment changes are needed. Do not put the AI key in `.env`, Git or browser code.
3. From the current AitU directory, manually run the following PowerShell commands:

   ```powershell
   npm.cmd exec --yes --package=supabase -- supabase login
   npm.cmd exec --yes --package=supabase -- supabase functions deploy analyze-request --project-ref amtobepbotkxbtsgqksc
   ```

   If the Supabase CLI is already installed, equivalent `supabase login` and
   `supabase functions deploy analyze-request --project-ref amtobepbotkxbtsgqksc` commands work.
   Keep JWT verification enabled as configured in `supabase/config.toml`; do not deploy
   with `--no-verify-jwt`. The handler additionally calls `auth.getUser(jwt)` and reads the
   caller's profile from the database. Do not change Auth Site URL/redirect settings.
4. Ensure the OpenAI project has API billing/quota and access to the configured model.
   Configure an appropriate project spending budget and monitor usage. ChatGPT access alone
   does not configure this application's API integration. No live AI calls were made during implementation.

## Manual verification after setup

- Sign in using an already verified authority account. Open a real request → **AI-анализ**.
  Existing saved analysis loads automatically; an unanalyzed request shows
  **AI-анализ ещё не выполнен** and **Анализировать обращение**.
- Click once. The loading button is disabled. Success shows category, recommended priority,
  responsible service, summary and reason in Russian. Check `request_ai_analyses`: one row
  exists for this request. The original request's priority/status/assignment/text/location
  must be unchanged. Refresh/reopen the tab: the saved result appears without another provider call.
- Try a legacy request with no photos or coordinates. No specific request number is required.
- Open the same unanalyzed request in two authority tabs and click simultaneously.
  Only one worker acquires the database lease; the other shows a retry message.
  Retry reads the saved result first. A crashed worker's lease expires after 90 seconds.
- Test missing/unavailable provider configuration in a development environment: show an error,
  never a fabricated success. Restore configuration, then use **Повторить**.
- To test direct authorization, sign in as a citizen, open browser DevTools on the local Vite
  app and run (uses the existing client; do not copy tokens or keys):

  ```javascript
  const { supabase } = await import('/src/lib/supabase.js')
  const response = await supabase.functions.invoke('analyze-request', {
    body: { request_id: 'REPLACE_WITH_A_REAL_REQUEST_UUID' },
  })
  console.log(response.error?.context?.status) // expected 403
  ```

  This dynamic module import is for the Vite development server only. For a deployed build,
  use your own authenticated SDK test client. Also test a pending/rejected authority applicant:
  expect 403. Signed-out calls must return 401 (gateway or handler). No analysis row/provider
  call should result. Do not change user roles in browser state to test authorization.
- As citizen, a SELECT of `request_ai_analyses` must return no rows. Browser INSERT/UPDATE/DELETE
  must be denied for citizens **and** verified authority. Locks have no browser grants/policies.

## Implementation and security

The browser sends only `request_id` to `analyze-request`. The server validates the session,
requires the database profile `role = authority AND authority_status = verified`, then loads
the request through the caller's existing RLS. It sends only type, title, description and
optional category/address to the provider. No IIN, user identity, coordinates, photo URLs or
image data are included. Text may itself contain citizen-supplied personal data; review your
provider data-handling arrangements before enabling the integration for production.

The OpenAI adapter uses `POST /v1/responses`, strict JSON Schema, `store: false`, a 30-second
provider timeout and a 1,200-token output cap. `store: false` is not a claim of zero provider
retention. The five output fields are independently validated server-side, extra/missing
fields rejected, priority restricted to low/medium/high, control characters normalized and
field lengths bounded. Refusal, incomplete output and invalid JSON fail closed. React renders
strings as text rather than HTML. No raw provider/error bodies, credentials or citizen text
are logged or returned in errors.

The privileged Supabase client is created only after authorization and request access checks.
It acquires a unique 90-second lease, checks the saved result again, calls AI and rechecks
authorization before inserting a validated result. Provider failure releases the lease;
crash/cleanup failure recovers through expiry. Unique `request_id` permits one saved analysis.
An explicit retry checks the database first, including after a lost response. A failed database
save can require a new paid provider call on retry because no valid result was persisted.
There is no automatic regeneration, no autonomous workflow write and no browser analysis write.

The real branch of the existing AI tab uses the new component. The demo branch remains
unchanged. Existing CSS classes support light/dark themes; no layout or stylesheet is changed.

## Local verification and limits

Run `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build`.
Tests exercise the real handler and provider adapter with mocked network/database boundaries,
plus actual JSX rendering and frontend controller behavior. They do not execute this migration,
contact OpenAI, deploy a function or substitute for the manual live RLS/Edge tests above.
The Vite build checks the frontend, not the Deno deployment environment.

References: [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs),
[Supabase function secrets](https://supabase.com/docs/guides/functions/secrets),
[Supabase deployment](https://supabase.com/docs/guides/functions/deploy).
