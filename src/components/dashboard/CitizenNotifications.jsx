import { formatRequestTime } from '../../requests/model.js'

export function NotificationList({ rows, loading, error, busy, onRefresh, onRead, onReadAll }) {
  const unread = rows.filter(row => !row.is_read).length
  return <section className="insights-section" aria-label="Уведомления">
    <p role="status">Непрочитанных: {loading ? '…' : unread}</p>
    <div className="citizen-notification-actions"><button className="insights-refresh" disabled={loading || busy} onClick={onRefresh}>Обновить</button><button className="insights-refresh" disabled={loading || busy || !unread} onClick={onReadAll}>Отметить все как прочитанные</button></div>
    {error && <p role="alert">{error}</p>}
    {loading ? <p role="status">Загружаем уведомления…</p> : rows.length ? <div className="insights-section">{rows.map(row => <button key={row.id} className={`db-panel insights-idea citizen-notification${row.is_read ? '' : ' is-unread'}`} disabled={busy} onClick={() => onRead(row)}>
      <span className="insights-note">{row.is_read ? 'Прочитано' : 'Новое'} · {row.request_number}</span><strong>{row.title}</strong><p>{row.message}</p><time className="insights-note" dateTime={row.created_at}>{formatRequestTime(row.created_at)}</time>
    </button>)}</div> : !error && <div className="db-panel db-empty-detail"><h2>У вас пока нет уведомлений</h2><p>Здесь появятся изменения статуса ваших обращений.</p></div>}
  </section>
}

export default function CitizenNotifications({ notifications, onView }) {
  return <NotificationList rows={notifications.rows} loading={notifications.loading} error={notifications.error || notifications.connectionError} busy={notifications.busy} onRefresh={notifications.refresh} onRead={onView} onReadAll={notifications.markAllRead} />
}
