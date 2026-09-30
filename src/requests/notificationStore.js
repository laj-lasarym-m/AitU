import { supabase } from '../lib/supabase.js'
import { fetchNotifications, markNotificationsRead, notificationError } from './notifications.js'

export function createNotificationStore(userId, { client = supabase, load = fetchNotifications, mark = markNotificationsRead, now = Date.now, schedule = setTimeout, cancel = clearTimeout } = {}) {
  let state = { rows: [], unreadCount: 0, loading: true, busy: false, error: '', connectionError: '', toast: null }
  let active = false, epoch = 0, fetchVersion = 0, channel, timer
  const listeners = new Set(), seen = new Set()
  const own = row => row?.user_id === userId && row?.id && row.type === 'request_status_changed' && row.source !== 'demo'
  function publish(change) {
    state = { ...state, ...change }
    state.unreadCount = state.rows.filter(row => !row.is_read).length
    listeners.forEach(listener => listener())
  }
  function merge(rows) {
    const byId = new Map(state.rows.map(row => [row.id, row]))
    for (const row of rows.filter(own)) {
      seen.add(row.id)
      byId.set(row.id, { ...row, is_read: row.is_read || byId.get(row.id)?.is_read || false })
    }
    return [...byId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id))
  }
  function dismissToast() { cancel(timer); publish({ toast: null }) }
  async function refresh() {
    if (!active || !userId) return
    const run = epoch, version = ++fetchVersion
    publish({ loading: true, error: '' })
    try {
      const rows = await load(userId, client)
      if (active && run === epoch && version === fetchVersion) publish({ rows: merge(rows), loading: false })
    } catch (error) {
      if (active && run === epoch && version === fetchVersion) publish({ loading: false, error: notificationError(error) })
    }
  }
  function receive(row) {
    if (!active || !own(row)) return
    const known = seen.has(row.id)
    publish({ rows: merge([row]) })
    const age = now() - Date.parse(row.created_at)
    if (!known && !row.is_read && age >= 0 && age <= 10000) {
      cancel(timer); publish({ toast: row })
      timer = schedule(dismissToast, 6000)
    }
  }
  async function markRead(row = null) {
    if (!active || state.busy || (row && !own(row))) return false
    const run = epoch
    const ids = new Set(row ? [row.id] : state.rows.map(item => item.id))
    publish({ busy: true, error: '' })
    try {
      if (!row?.is_read) await mark(userId, row?.id || null, client)
      if (!active || epoch !== run) return false
      publish({ rows: state.rows.map(item => ids.has(item.id) ? { ...item, is_read: true } : item) })
      if (state.toast && ids.has(state.toast.id)) dismissToast()
      if (!row) void refresh() // Reconcile inserts that raced the server's mark-all update.
      return true
    } catch (error) {
      if (active && epoch === run) publish({ error: notificationError(error) })
      return false
    } finally { if (active && epoch === run) publish({ busy: false }) }
  }
  function start() {
    active = true; const run = ++epoch
    if (!userId || !client) { publish({ loading: false }); return stop }
    channel = client.channel(`citizen-notifications:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, payload => {
        if (active && epoch === run) receive(payload.new)
      }).subscribe(status => {
        if (!active || epoch !== run) return
        if (status === 'SUBSCRIBED') { publish({ connectionError: '' }); void refresh() }
        else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) publish({ connectionError: 'Обновления в реальном времени недоступны. Используйте «Обновить».' })
      })
    void refresh()
    return stop
  }
  function stop() {
    active = false; epoch++; cancel(timer)
    if (channel) { void client.removeChannel(channel); channel = null }
    state = { ...state, toast: null, busy: false }
  }
  return { getSnapshot: () => state, subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) }, start,
    refresh, markRead, markAllRead: () => markRead(), dismissToast }
}
