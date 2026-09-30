import { Bell, X } from 'lucide-react'
import { formatRequestTime } from '../../requests/model.js'

export function UnreadBadge({ count }) {
  return count > 0 ? <span className="citizen-unread-badge" aria-label={`Непрочитанных: ${count}`}>{count > 99 ? '99+' : count}</span> : null
}
export function NotificationDropdown({ notifications, onView, onAll }) {
  return <div className="db-dropdown db-notifications citizen-notification-dropdown" id="db-notifications">
    <strong>Уведомления</strong>
    {notifications.loading && <p role="status">Загружаем…</p>}
    {(notifications.error || notifications.connectionError) && <p role="alert">{notifications.error || notifications.connectionError}</p>}
    {!notifications.loading && !notifications.rows.length && !notifications.error && <p>У вас пока нет уведомлений</p>}
    {notifications.rows.slice(0, 5).map(row => <button key={row.id} className={row.is_read ? '' : 'is-unread'} disabled={notifications.busy} onClick={() => onView(row)}>
      <strong>{row.title}</strong><span>{row.message}</span><small>{row.is_read ? 'Прочитано' : 'Новое'} · {formatRequestTime(row.created_at)}</small>
    </button>)}
    <button onClick={onAll}>Все уведомления</button>
  </div>
}
export function NotificationToast({ notifications, onView }) {
  const row = notifications.toast
  if (!row) return null
  return <aside className="citizen-realtime-toast" role="status" aria-live="polite">
    <div><Bell size={20} /><strong>{row.title}</strong><button className="db-icon-button" aria-label="Закрыть уведомление" onClick={notifications.dismissToast}><X size={18} /></button></div>
    <p>{row.message}</p><button className="insights-refresh" disabled={notifications.busy} onClick={() => onView(row)}>Посмотреть</button>
  </aside>
}
