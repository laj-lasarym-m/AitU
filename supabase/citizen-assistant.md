# Citizen AI assistant

Separate Edge Function `citizen-assistant`; existing authority analysis is unchanged.
No SQL, schema, RLS or database writes. No automatic deployment was performed.

Reuses existing server secret `OPENAI_API_KEY`, optional `OPENAI_MODEL` (default
`gpt-4.1-mini-2025-04-14`) and `AI_ALLOWED_ORIGINS` (default `http://localhost:5173`).
For a hosted frontend, ensure its exact origin is included in the existing comma-separated
origin setting. No new API key or frontend secret is needed.

From the AitU directory run this ONE deployment command:

```powershell
npm.cmd exec --yes --package=supabase -- supabase functions deploy citizen-assistant --project-ref amtobepbotkxbtsgqksc
```

Keep JWT verification enabled. The handler also verifies `auth.getUser()` and the caller's
database profile role `citizen`, using a user-scoped client. It never uses service_role.
Only the profile is read; the model has no request/database/web/agent tools.

Context: at most eight recent messages; user messages up to 2,000 characters;
assistant output up to 4,000 characters and 1,000 output tokens. Provider timeout is
30 seconds. `store: false` is sent to OpenAI; this is not a guarantee of zero provider
retention. Conversation is in browser memory only and resets when leaving the section
or refreshing. No text or credentials are logged. No autonomous request submission.

After deployment, sign in as a citizen, open AI-помощник, send a civic question and
verify loading, reply, retry on unavailable API, and the existing submission-form link.
Authority and unauthenticated direct calls must be rejected. Local tests mock network
boundaries; live Edge/OpenAI validation remains manual.
