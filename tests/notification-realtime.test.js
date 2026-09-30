import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { readFile } from 'node:fs/promises'
import { createNotificationStore } from '../src/requests/notificationStore.js'

const now = Date.parse('2026-10-01T12:00:00Z')
const row = (id, age = 0, other = {}) => ({ id, user_id: 'owner', request_id: 'request', request_number: 'A-104', type: 'request_status_changed', title: 'Статус', message: 'Начата работа', created_at: new Date(now - age).toISOString(), is_read: false, ...other })
function fixture(history = []) {
  let receive, status, timer, removed = 0, marks = [], loads = 0
  let loader = async () => history
  const channel = { on(event, filter, callback) { assert.equal(event, 'postgres_changes'); assert.equal(filter.event, 'INSERT'); assert.equal(filter.filter, 'user_id=eq.owner'); receive = callback; return channel }, subscribe(callback) { status = callback; return channel } }
  const store = createNotificationStore('owner', { client: { channel: () => channel, removeChannel() { removed++ } },
    now: () => now, load: async () => { loads++; return loader() }, mark: async (...args) => { marks.push(args) },
    schedule: fn => { timer = fn; return 1 }, cancel: () => { timer = null } })
  return { store, emit: value => receive({ new: value }), status: value => status(value), expire: () => timer?.(),
    setLoader: fn => { loader = fn }, get removed() { return removed }, get marks() { return marks }, get loads() { return loads } }
}
const tick = () => new Promise(resolve => setImmediate(resolve))

test('historical fetch stays quiet; INSERT freshness, deduplication, owner/demo filtering and unread count', async () => {
  const f = fixture([row('history')]); const stop = f.store.start(); await tick()
  assert.equal(f.store.getSnapshot().toast, null); assert.equal(f.store.getSnapshot().unreadCount, 1)
  f.emit(row('history')); assert.equal(f.store.getSnapshot().toast, null)
  f.emit(row('old', 10001)); assert.equal(f.store.getSnapshot().toast, null)
  f.emit(row('fresh', 10000)); assert.equal(f.store.getSnapshot().toast.id, 'fresh')
  f.store.dismissToast(); f.emit(row('fresh')); assert.equal(f.store.getSnapshot().toast, null)
  f.emit(row('other', 0, { user_id: 'other' })); f.emit(row('demo', 0, { source: 'demo' }))
  assert.equal(f.store.getSnapshot().unreadCount, 3)
  f.emit(row('future', -100)); assert.equal(f.store.getSnapshot().toast, null)
  f.emit(row('recent', 1)); f.expire()
  assert.equal(f.store.getSnapshot().toast, null); assert.equal(f.marks.length, 0)
  f.emit(row('next')); f.store.dismissToast(); assert.equal(f.marks.length, 0)
  stop(); assert.equal(f.removed, 1)
  f.emit(row('after-cleanup')); assert.ok(!f.store.getSnapshot().rows.some(r => r.id === 'after-cleanup'))
})
test('overlapping fetch/event merge retains new rows and reads; cleanup ignores pending fetch', async () => {
  const f = fixture(); let resolve
  f.setLoader(() => new Promise(done => { resolve = done }))
  const stop = f.store.start()
  f.emit(row('same')); await f.store.markRead(row('same'))
  resolve([row('same'), row('older', 20000)]); await tick()
  assert.equal(f.store.getSnapshot().rows.length, 2); assert.equal(f.store.getSnapshot().unreadCount, 1)
  assert.equal(f.store.getSnapshot().toast, null)
  assert.equal(f.marks[0][1], 'same')
  await f.store.markAllRead(); assert.equal(f.store.getSnapshot().unreadCount, 0)
  assert.equal(f.marks[1][1], null)
  const pending = f.store.refresh(); stop(); resolve([row('late')]); await pending
  assert.ok(!f.store.getSnapshot().rows.some(r => r.id === 'late'))
})
test('reconnection fetches history without toast; lost realtime is visible', async () => {
  const f = fixture(); const stop = f.store.start(); await tick()
  f.status('CHANNEL_ERROR'); assert.ok(f.store.getSnapshot().connectionError)
  f.setLoader(async () => [row('missed')]); f.status('SUBSCRIBED'); await tick()
  assert.equal(f.store.getSnapshot().connectionError, ''); assert.equal(f.store.getSnapshot().toast, null)
  assert.equal(f.store.getSnapshot().unreadCount, 1); stop()
})
test('shared surfaces show badges, cap 99+, read-only dropdown and bottom-left toast actions', async () => {
  const previousWindow = globalThis.window
  globalThis.window = { matchMedia: () => ({ matches: false }), localStorage: { getItem: () => null } }
  const server = await createServer({ envDir: false, cacheDir: 'node_modules/.vite-notification-test', server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
  try {
    const { UnreadBadge, NotificationDropdown, NotificationToast } = await server.ssrLoadModule('/src/components/dashboard/NotificationSurfaces.jsx')
    const Sidebar = (await server.ssrLoadModule('/src/components/dashboard/Sidebar.jsx')).default
    const Header = (await server.ssrLoadModule('/src/components/dashboard/DashboardHeader.jsx')).default
    const { AuthContext } = await server.ssrLoadModule('/src/auth/context.js')
    const render = (C, props) => renderToStaticMarkup(h(MemoryRouter, {}, h(AuthContext.Provider, { value: { account: { user: { id: 'owner' }, profile: {} } } }, h(C, props))))
    assert.equal(render(UnreadBadge, { count: 0 }), '')
    assert.match(render(UnreadBadge, { count: 100 }), /99\+/)
    const notifications = { rows: [row('1')], unreadCount: 1, toast: row('1') }
    assert.match(render(Header, { notifications }), /Непрочитанных: 1/)
    assert.match(render(Sidebar, { unreadCount: notifications.unreadCount }), /Непрочитанных: 1/)
    assert.doesNotMatch(render(Header, { notifications: { ...notifications, unreadCount: 0 } }), /citizen-unread-badge/)
    let viewed = 0, dismissed = 0
    const tree = NotificationToast({ notifications: { ...notifications, dismissToast: () => dismissed++ }, onView: () => viewed++ })
    tree.props.children[0].props.children[2].props.onClick(); assert.equal(dismissed, 1); assert.equal(viewed, 0)
    tree.props.children[2].props.onClick(); assert.equal(viewed, 1)
    const dropdown = NotificationDropdown({ notifications, onView: () => viewed++, onAll() {} })
    assert.equal(viewed, 1, 'render/open does not mark read')
    assert.ok(dropdown)
    assert.match(render(NotificationToast, { notifications }), /citizen-realtime-toast/)
    const css = await readFile(new URL('../src/styles/insights.css', import.meta.url), 'utf8')
    assert.match(css, /citizen-realtime-toast \{ position: fixed; bottom: 20px; left: 20px/)
  } finally { globalThis.window = previousWindow; await server.close() }
})
