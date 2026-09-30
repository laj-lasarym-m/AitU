import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { citizenPoints } from '../src/requests/points.js'
import { fetchNotifications, markNotificationsRead } from '../src/requests/notifications.js'

const request = (type, statusCode, id = type + statusCode) => ({ source: 'database', databaseId: id, id, userId: 'owner', type, statusCode, createdAt: '2026-10-01T00:00:00Z' })
test('deterministic points, stats, current resolved bonuses and demo/foreign exclusion', () => {
  const rows = [request('problem', 'new'), request('idea', 'new'), request('problem', 'resolved'), request('idea', 'resolved')]
  rows.forEach((row, i) => assert.equal(citizenPoints([row], 'owner').total, [10, 15, 30, 45][i]))
  const data = citizenPoints([...rows, { ...rows[0], source: 'demo' }, { ...rows[0], userId: 'other' }], 'owner')
  assert.equal(data.total, 100)
  assert.deepEqual(data.stats, { submitted: 4, ideas: 2, resolvedProblems: 1, resolvedIdeas: 1 })
  assert.equal(data.activity.length, 4)
  assert.equal(citizenPoints(rows, null).total, 0)
  assert.equal(citizenPoints([{ ...rows[2], statusCode: 'reviewing' }], 'owner').total, 10)
})

test('notifications API checks session, filters owner and updates only is_read (one or all)', async () => {
  const calls = []
  const client = { auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) }, from(table) {
    assert.equal(table, 'notifications')
    const call = { filters: [] }; calls.push(call)
    const q = { select() { return q }, order() { return q }, eq(k, v) { call.filters.push([k, v]); return q },
      update(payload) { call.payload = payload; return q }, range() { return q }, then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve) } }
    return q
  } }
  await fetchNotifications('owner', client)
  await markNotificationsRead('owner', 'notification-id', client)
  await markNotificationsRead('owner', null, client)
  for (const call of calls) assert.ok(call.filters.some(([k, v]) => k === 'user_id' && v === 'owner'))
  assert.deepEqual(calls[1].payload, { is_read: true })
  assert.ok(calls[1].filters.some(([k, v]) => k === 'id' && v === 'notification-id'))
  assert.deepEqual(calls[2].payload, { is_read: true })
  await assert.rejects(fetchNotifications('other', client), /Session changed/)
  await assert.rejects(markNotificationsRead('other', null, client), /Session changed/)
  assert.equal(calls.length, 3)
})

test('review-only trigger and RLS contract guards status changes and owner-only immutable content', async () => {
  const sql = await readFile(new URL('../supabase/step-notifications.sql', import.meta.url), 'utf8')
  assert.match(sql, /after update of status on public.requests/)
  assert.match(sql, /when \(old.status is distinct from new.status\)/)
  assert.match(sql, /if old.status is not distinct from new.status then return new/)
  assert.match(sql, /values \(new.user_id, new.id, new.request_number/)
  for (const status of ['new', 'reviewing', 'in_progress', 'needs_info', 'resolved', 'rejected']) assert.ok(sql.includes(`when '${status}' then`))
  assert.match(sql, /'Обращение ' \|\| new.request_number \|\| ' решено'/)
  assert.match(sql, /security definer set search_path = ''/)
  assert.match(sql, /grant update \(is_read\) on public.notifications/)
  assert.match(sql, /with check \(\(select auth.uid\(\)\) = user_id and is_read = true\)/)
  assert.doesNotMatch(sql, /grant insert|grant delete|alter table public.requests/i)
})

test('points and notifications render empty, read/unread and safe error states', async () => {
  const server = await createServer({ envDir: false, cacheDir: 'node_modules/.vite-engagement-test', server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
  try {
    const Points = (await server.ssrLoadModule('/src/components/dashboard/CitizenPoints.jsx')).default
    const { NotificationList } = await server.ssrLoadModule('/src/components/dashboard/CitizenNotifications.jsx')
    const render = (C, props) => renderToStaticMarkup(h(C, props))
    assert.match(render(Points, { rows: [request('idea', 'resolved')], userId: 'owner' }), /45 баллов/)
    assert.match(render(Points, { rows: [], userId: 'owner' }), /0 баллов/)
    assert.match(render(NotificationList, { rows: [] }), /У вас пока нет уведомлений/)
    const notifications = [false, true].map((is_read, id) => ({ id, is_read, title: 'Статус', message: 'Решено', request_number: 'A-104', created_at: '2026-10-01T00:00:00Z' }))
    const html = render(NotificationList, { rows: notifications })
    assert.match(html, /Непрочитанных: 1/); assert.match(html, /is-unread/)
    assert.match(html, /Прочитано/); assert.match(html, /Новое/); assert.match(html, /A-104/)
    assert.match(render(NotificationList, { rows: [], error: 'Ошибка' }), /role="alert"/)
    assert.doesNotMatch(render(NotificationList, { rows: [], error: 'Ошибка' }), /У вас пока нет уведомлений/)
  } finally { await server.close() }
})
