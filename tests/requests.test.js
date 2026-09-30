import test from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { createRequest, createRequestPayload, fetchRequests, updateRequestWorkflow, workflowPayload } from '../src/requests/api.js'
import { mapRequest, requestStatuses, statusCodeFromLabel, requestErrorMessage } from '../src/requests/model.js'
import { saveRequestDraft, readRequestDraft, clearRequestDraft } from '../src/requests/draft.js'
import { demoRequests } from '../src/data/requests.js'

const input = { type: 'problem', title: ' Освещение ', description: ' Не работает фонарь ', address: ' ул. Абая ', category: '' }
const row = { id: '10000000-0000-4000-8000-000000000010', request_number: 'A-101', user_id: 'citizen', ...input, status: 'new', priority: null, assigned_to: null, created_at: '2026-09-30T10:00:00Z', updated_at: '2026-09-30T10:00:00Z' }

test('creation accepts only citizen content; ownership, number and workflow stay on the server', () => {
  assert.deepEqual(createRequestPayload({ ...input, user_id: 'another-user', request_number: 'A-999', status: 'resolved', priority: 'high', assigned_to: 'Fake staff', created_at: 'yesterday' }), {
    type: 'problem', title: 'Освещение', description: 'Не работает фонарь', address: 'ул. Абая', category: null,
  })
  for (const invalid of [{ type: 'other' }, { title: ' ' }, { description: ' ' }, { title: 'a'.repeat(161) }, { description: 'a'.repeat(10001) }, { address: 'a'.repeat(301) }]) {
    assert.throws(() => createRequestPayload({ ...input, ...invalid }), { code: 'VALIDATION' })
  }
})

test('all six statuses round-trip into Russian views without demo content', () => {
  for (const code of ['new', 'reviewing', 'in_progress', 'needs_info', 'resolved', 'rejected']) {
    const request = mapRequest({ ...row, status: code })
    assert.equal(statusCodeFromLabel(request.status), code)
    assert.equal(request.status, requestStatuses[code])
    assert.equal(request.databaseId, row.id)
    assert.equal(request.id, 'A-101')
    assert.equal(request.source, 'database')
    assert.deepEqual(request.photos, [])
    assert.equal(request.history.length, 1)
    assert.equal(request.assignedTo, '')
  }
  assert.equal(mapRequest({ ...row, status: 'rejected' }).step, -1)
  const saved = mapRequest({ ...row, assigned_to: 'Служба света', updated_at: '2026-10-01T10:00:00Z' })
  assert.equal(saved.service, 'Служба света')
  assert.equal(saved.history.length, 2)
})

test('workflow payload contains only allowed fields and rejects invalid updates', () => {
  assert.deepEqual(workflowPayload({ status: 'reviewing', priority: 'high', assigned_to: ' Служба ', title: 'Overwrite', user_id: 'other', type: 'idea', description: 'Changed', created_at: 'now', updated_at: 'now', comment: 'Not supported', photo: 'Not supported' }), { status: 'reviewing', priority: 'high', assigned_to: 'Служба' })
  assert.deepEqual(workflowPayload({ assigned_to: ' ', priority: null }), { assigned_to: null, priority: null })
  for (const invalid of [{ status: 'В работе' }, { status: '__proto__' }, { priority: 'urgent' }, { title: 'Overwrite' }, { assigned_to: 'a'.repeat(201) }]) {
    assert.throws(() => workflowPayload(invalid), { code: 'VALIDATION' })
  }
})

test('signed-out calls and demo updates cannot reach a request table write', async () => {
  let writes = 0
  const client = { auth: { getUser: async () => ({ data: { user: null }, error: null }) }, from: () => { writes++; throw new Error('Unexpected write') } }
  await assert.rejects(createRequest(input, client), { code: 'AUTH_REQUIRED' })
  await assert.rejects(updateRequestWorkflow(mapRequest(row), { status: 'resolved' }, client), { code: 'AUTH_REQUIRED' })
  for (const demo of demoRequests) await assert.rejects(updateRequestWorkflow(demo, { status: 'resolved' }, client), { code: 'VALIDATION' })
  assert.equal(writes, 0)
})

test('draft survives the auth redirect, stores only text/type, and expires safely', () => {
  const previous = globalThis.window
  const saved = new Map()
  globalThis.window = { sessionStorage: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) } }
  try {
    assert.equal(saveRequestDraft({ type: 'idea', description: 'Текст идеи', user_id: 'ignored', password: 'ignored', iin: 'ignored' }), true)
    assert.deepEqual(Object.keys(JSON.parse(saved.get('aitu-request-draft'))).sort(), ['description', 'savedAt', 'type'])
    assert.deepEqual(readRequestDraft(), { type: 'idea', description: 'Текст идеи' })
    saved.set('aitu-request-draft', JSON.stringify({ type: 'idea', description: 'Old', savedAt: Date.now() - 31 * 60000 }))
    assert.equal(readRequestDraft(), null)
    assert.equal(saved.size, 0)
    saved.set('aitu-request-draft', '{broken')
    assert.equal(readRequestDraft(), null)
    saveRequestDraft({ description: 'Draft' }); clearRequestDraft()
    assert.equal(readRequestDraft(), null)
    globalThis.window = { sessionStorage: { setItem() { throw new Error('Blocked') } } }
    assert.equal(saveRequestDraft({ description: 'Keep in form' }), false)
    assert.equal(readRequestDraft(), null)
  } finally { globalThis.window = previous }
})

// Actual installed Supabase SDK with an in-memory HTTP fixture, NOT a live
// database/RLS test. Never applies SQL or sends sample records to Supabase.
test('SDK citizen create → authority read/update → citizen refresh persists the returned data', async () => {
  const rows = []
  const calls = []
  let failure = null
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
  async function clientFor(id) {
    const user = { id, email: `${id}@example.invalid`, aud: 'authenticated', role: 'authenticated' }
    const token = `${btoa('{}')}.${btoa(JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600 }))}.fixture`
    const client = createClient('https://request-tests.invalid', 'sb_publishable_fixture', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: async (urlString, options = {}) => {
        const url = new URL(urlString)
        if (url.pathname.endsWith('/token')) return json({ access_token: token, refresh_token: 'fixture', expires_in: 3600, token_type: 'bearer', user })
        if (url.pathname.endsWith('/user')) return json(user)
        assert.equal(url.pathname, '/rest/v1/requests')
        const method = options.method || 'GET'
        calls.push({ id, method })
        assert.equal(new Headers(options.headers).get('authorization'), `Bearer ${token}`)
        if (failure) return json(failure, 403)
        if (method === 'POST') {
          const payload = JSON.parse(options.body)
          assert.deepEqual(Object.keys(payload).sort(), ['address', 'category', 'description', 'title', 'type'])
          // Fixture emulates server defaults; frontend supplies neither owner nor number.
          const created = { ...row, ...payload, user_id: user.id }
          rows.push(created)
          return json(created, 201)
        }
        if (method === 'PATCH') {
          assert.equal(url.searchParams.get('id'), `eq.${row.id}`)
          const payload = JSON.parse(options.body)
          assert(Object.keys(payload).every(key => ['status', 'priority', 'assigned_to'].includes(key)))
          rows[0] = { ...rows[0], ...payload, updated_at: '2026-10-01T12:00:00Z' }
          return json(rows[0])
        }
        if (id === 'citizen') assert.equal(url.searchParams.get('user_id'), 'eq.citizen')
        if (id === 'authority') assert.equal(url.searchParams.has('user_id'), false)
        return json(rows)
      } },
    })
    const result = await client.auth.signInWithPassword({ email: user.email, password: 'fixture' })
    assert.equal(result.error, null)
    return client
  }
  const citizen = await clientFor('citizen'), authority = await clientFor('authority')
  try {
    assert.equal(calls.length, 0) // No demo seeding on SDK/client setup.
    assert.deepEqual(await fetchRequests('citizen', 'citizen', citizen), [])
    assert(calls.every(call => call.method === 'GET'))
    const created = await createRequest({ ...input, user_id: 'attacker', status: 'resolved' }, citizen)
    assert.equal(created.userId, 'citizen')
    assert.equal(created.id, 'A-101')
    assert.equal(created.statusCode, 'new')
    const authorityRows = await fetchRequests('authority', 'authority', authority)
    assert.equal(authorityRows[0].databaseId, created.databaseId)
    const saved = await updateRequestWorkflow(authorityRows[0], { status: 'in_progress', assigned_to: 'Служба света', title: 'Not allowed' }, authority)
    assert.equal(saved.status, 'В работе')
    assert.equal(saved.title, 'Освещение')
    const refreshed = await fetchRequests('citizen', 'citizen', citizen)
    assert.equal(refreshed[0].statusCode, 'in_progress')
    assert.equal(refreshed[0].assignedTo, 'Служба света')
    assert.notEqual(refreshed[0].updatedAt, refreshed[0].createdAt)
    const count = calls.length
    await assert.rejects(fetchRequests('citizen', 'different-account', citizen), { code: 'AUTH_REQUIRED' })
    await assert.rejects(updateRequestWorkflow(demoRequests[0], { status: 'resolved' }, authority), { code: 'VALIDATION' })
    assert.equal(calls.length, count)
    failure = { code: '42501', message: 'Internal database details' }
    await assert.rejects(updateRequestWorkflow(saved, { status: 'resolved' }, authority), { code: '42501' })
    assert.doesNotMatch(requestErrorMessage(failure), /Internal/)
    assert.equal(rows[0].status, 'in_progress')
  } finally { await citizen.auth.stopAutoRefresh(); await authority.auth.stopAutoRefresh() }
})

test('schema-not-applied, permissions and connection errors have friendly messages', () => {
  assert.match(requestErrorMessage({ code: 'PGRST205' }), /пока не подключено/)
  assert.match(requestErrorMessage({ code: '42501' }), /Нет доступа/)
  assert.match(requestErrorMessage({ code: 'timeout', message: 'secret raw details' }), /Проверьте соединение/)
  assert.doesNotMatch(requestErrorMessage(new Error('raw details')), /raw details/)
})
