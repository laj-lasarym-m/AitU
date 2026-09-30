import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

// A static regression check, not a claim of executing PostgreSQL or testing RLS.
test('review-only migration keeps owner/content immutable and workflow authority-only', async () => {
  const sql = await readFile(new URL('../supabase/step-5c-requests.sql', import.meta.url), 'utf8')
  assert.match(sql, /alter table public\.requests enable row level security/i)
  assert.match(sql, /revoke all on public\.requests from public, anon, authenticated/i)
  assert.match(sql, /grant insert \(type, title, description, category, address\) on public\.requests to authenticated/i)
  assert.match(sql, /grant update \(status, priority, assigned_to\) on public\.requests to authenticated/i)
  assert.equal((sql.match(/create policy /gi) || []).length, 4)
  assert.match(sql, /requests_citizen_insert[\s\S]*?user_id = \(select auth\.uid\(\)\)[\s\S]*?role = 'citizen'/)
  assert.match(sql, /requests_citizen_read_own[\s\S]*?user_id = \(select auth\.uid\(\)\)/)
  assert.match(sql, /requests_authority_update_workflow[\s\S]*?using \(\(select public\.is_verified_authority\(\)\)\)[\s\S]*?with check \(\(select public\.is_verified_authority\(\)\)\)/)
  assert.match(sql, /pg_catalog\.nextval\('public\.request_number_seq'::regclass\)/)
  assert.match(sql, /revoke all on sequence public\.request_number_seq from public, anon, authenticated/)
  assert.match(sql, /execute function public\.aitu_set_updated_at\(\)/)
  assert.doesNotMatch(sql, /grant (?:all|delete|insert|update) on public\.requests|insert into public\.requests|alter table public\.profiles|create or replace/i)
})
