import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { validateAnalysis, requestContext } from '../supabase/functions/analyze-request/validation.js'
import { generateAnalysis } from '../supabase/functions/analyze-request/provider.js'
import { createHandler } from '../supabase/functions/analyze-request/handler.js'

const id = '12345678-1234-1234-1234-123456789abc'
const result = { category: 'Освещение', priority: 'medium', responsible_service: 'Городское освещение', summary: 'Не работает фонарь.', reason: 'Требуется ремонт.' }
const legacy = { id, type: 'problem', title: 'Фонарь', description: 'Не работает фонарь', category: null, address: null }

function fixture({ role = 'authority', status = 'verified', authenticated = true, cached = null, missing = false, failure = null, generate } = {}) {
  const db = { analysis: cached, lock: null, calls: 0, writes: [], adminCalls: 0, status }
  const client = {
    auth: { getUser: async () => ({ data: { user: authenticated ? { id: 'employee' } : null } }) },
    from(table) {
      let action = 'select', payload
      const filters = {}
      const query = {
        select() { return query }, eq(key, value) { filters[key] = value; return query },
        lt(key, value) { filters.lt = [key, value]; return query }, maybeSingle() { return query },
        insert(value) { action = 'insert'; payload = value; return query }, delete() { action = 'delete'; return query },
        then(resolve, reject) {
          return Promise.resolve().then(() => {
            if (failure === `${table}:${action}`) return { error: { code: 'ERROR', message: 'secret raw error' } }
            if (table === 'profiles') return { data: { id: 'employee', role, authority_status: db.status } }
            if (table === 'requests') return { data: missing ? null : legacy }
            if (table === 'request_ai_analyses') {
              if (action === 'insert') { db.writes.push({ table, payload }); db.analysis = Object.fromEntries(Object.keys(result).map(key => [key, payload[key]])) }
              return { data: db.analysis }
            }
            if (table === 'request_ai_analysis_locks') {
              if (action === 'insert') {
                if (db.lock) return { error: { code: '23505' } }
                db.lock = payload
              }
              if (action === 'delete' && db.lock && (filters.token === db.lock.token || (filters.lt && db.lock.expires_at < filters.lt[1]))) db.lock = null
              return { data: null }
            }
            throw new Error(`Unexpected table ${table}`)
          }).then(resolve, reject)
        },
      }
      return query
    },
  }
  const handler = createHandler({ userClient: () => client, adminClient: () => { db.adminCalls++; return client },
    generate: async row => { db.calls++; assert.deepEqual(row, legacy); return generate ? generate(row) : result } })
  const call = (body = { request_id: id }, headers = {}) => handler(new Request('https://example.invalid/analyze-request', {
    method: 'POST', headers: { authorization: 'Bearer test', ...headers }, body: JSON.stringify(body),
  }))
  return { db, call }
}

test('strict analysis validation accepts all priorities, sanitizes controls, rejects malformed/extra/oversized output', () => {
  for (const priority of ['low', 'medium', 'high']) assert.equal(validateAnalysis({ ...result, priority }).priority, priority)
  assert.equal(validateAnalysis({ ...result, summary: '  Один\nдва\u0000 ' }).summary, 'Один два')
  for (const value of [null, [], {}, { ...result, priority: 'urgent' }, { ...result, category: '' }, { ...result, summary: 'x'.repeat(601) }, { ...result, reason: 1 }, { ...result, status: 'resolved' }]) {
    assert.throws(() => validateAnalysis(value), /invalid_output/)
  }
})
test('provider sends only whitelisted legacy context, strict schema and no stored response', async () => {
  const row = { ...legacy, user_id: 'private', latitude: 50, photos: ['private'] }
  assert.deepEqual(requestContext(row), { type: 'problem', title: 'Фонарь', description: 'Не работает фонарь', category: null, address: null })
  const actual = await generateAnalysis(row, { apiKey: 'test-only', fetcher: async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses')
    const body = JSON.parse(options.body)
    assert.deepEqual(JSON.parse(body.input), requestContext(row))
    assert.equal(body.store, false); assert.equal(body.text.format.strict, true)
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(result) }] }] })
  } })
  assert.deepEqual(actual, result)
})
test('provider missing key, unavailable API, malformed, refusal and incomplete response fail safely', async () => {
  await assert.rejects(generateAnalysis(legacy, {}), /provider_not_configured/)
  for (const response of [new Response('', { status: 503 }), Response.json({ status: 'incomplete' }), Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal' }] }] }), Response.json({ status: 'completed', output: [] })]) {
    await assert.rejects(generateAnalysis(legacy, { apiKey: 'test-only', fetcher: async () => response }), /provider_unavailable|invalid_output/)
  }
})
test('anonymous, citizen, pending and rejected authority are rejected before privileged access or AI', async () => {
  for (const options of [{ authenticated: false }, { role: 'citizen', status: null }, { status: 'pending' }, { status: 'rejected' }]) {
    const { call, db } = fixture(options)
    assert.equal((await call()).status, options.authenticated === false ? 401 : 403)
    assert.equal(db.calls, 0); assert.equal(db.adminCalls, 0)
  }
})
test('verified authority analyzes a legacy request and only writes validated separate analysis', async () => {
  const { call, db } = fixture()
  assert.deepEqual(await (await call()).json(), { analysis: result })
  assert.equal(db.calls, 1); assert.equal(db.writes.length, 1)
  assert.equal(db.writes[0].table, 'request_ai_analyses'); assert.equal(db.lock, null)
  assert.deepEqual(await (await call()).json(), { analysis: result }); assert.equal(db.calls, 1)
})
test('stored analysis is reused without provider or privileged client', async () => {
  const { call, db } = fixture({ cached: result })
  assert.equal((await call()).status, 200); assert.equal(db.calls, 0); assert.equal(db.adminCalls, 0)
})
test('simultaneous calls take one lease; second worker never calls provider', async () => {
  let finish, started
  const ready = new Promise(resolve => { started = resolve })
  const { call, db } = fixture({ generate: () => { started(); return new Promise(resolve => { finish = resolve }) } })
  const first = call(); await ready
  assert.equal((await call()).status, 409); assert.equal(db.calls, 1)
  finish(result); assert.equal((await first).status, 200); assert.equal(db.lock, null)
})
test('failed provider releases lease and explicit retry can succeed; invalid output is never saved', async () => {
  let fail = true
  const { call, db } = fixture({ generate: () => fail ? { invalid: true } : result })
  assert.equal((await call()).status, 502); assert.equal(db.writes.length, 0); assert.equal(db.lock, null)
  fail = false; assert.equal((await call()).status, 200); assert.equal(db.calls, 2)
})
test('authority revoked while AI is running cannot save a recommendation', async () => {
  const { call, db } = fixture({ generate: () => { db.status = 'rejected'; return result } })
  assert.equal((await call()).status, 403)
  assert.equal(db.writes.length, 0); assert.equal(db.lock, null)
})
test('expired lease recovers and allowed preflight requires no provider call', async () => {
  const { call, db } = fixture()
  db.lock = { request_id: id, token: 'abandoned', expires_at: '2000-01-01T00:00:00Z' }
  assert.equal((await call()).status, 200); assert.equal(db.calls, 1)
  const handler = createHandler({ userClient: () => { throw Error('must not authenticate preflight') } })
  const response = await handler(new Request('https://example.invalid', { method: 'OPTIONS', headers: { origin: 'http://localhost:5173' } }))
  assert.equal(response.status, 204)
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'http://localhost:5173')
})
test('missing request, malicious input, forbidden origin and database write failure never fake success', async () => {
  assert.equal((await fixture({ missing: true }).call()).status, 404)
  const normal = fixture()
  assert.equal((await normal.call({ request_id: id, description: 'browser override' })).status, 400)
  assert.equal((await normal.call({ request_id: 'A-101' })).status, 400)
  assert.equal((await normal.call(undefined, { origin: 'https://evil.invalid' })).status, 403)
  assert.equal(normal.db.calls, 0)
  const broken = fixture({ failure: 'request_ai_analyses:insert' })
  const response = await broken.call()
  assert.equal(response.status, 503); assert.deepEqual(await response.json(), { error: 'database_error' })
  assert.equal(broken.db.lock, null)
})
test('migration keeps browser analyses read-only and leases inaccessible; no previous-table mutation', async () => {
  const sql = await readFile(new URL('../supabase/step-5c-ai-analysis.sql', import.meta.url), 'utf8')
  assert.match(sql, /unique references public.requests/)
  assert.match(sql, /revoke all on public.request_ai_analyses from public, anon, authenticated/)
  assert.match(sql, /using \(\(select public.is_verified_authority\(\)\)\)/)
  assert.doesNotMatch(sql, /grant (?:insert|update|delete).*to authenticated/i)
  assert.doesNotMatch(sql, /alter table public.requests|storage\.|create policy.*locks/)
})
