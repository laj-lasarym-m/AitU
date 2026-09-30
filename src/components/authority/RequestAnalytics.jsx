import { requestAnalytics } from '../../requests/insights.js'
import { requestStatuses, requestPriorities } from '../../requests/model.js'

function Bars({ title, entries, total }) {
  return <section className="db-panel insights-chart"><h2>{title}</h2>{entries.length ? <ul>{entries.map(([label, count]) =>
    <li key={label}><div><span>{label}</span><strong>{count}</strong></div><div className="insights-track" aria-hidden="true"><span style={{ width: `${total ? count / total * 100 : 0}%` }} /></div></li>
  )}</ul> : <p className="insights-note">Нет данных</p>}</section>
}

export default function RequestAnalytics({ rows, loading, error, onRefresh }) {
  const data = requestAnalytics(rows)
  return <section className="insights-section" aria-label="Аналитика обращений">
    <p className="insights-note">Данные реальных обращений, доступных вашему аккаунту. Фильтры списка не влияют на статистику.</p>
    <button className="insights-refresh" onClick={onRefresh} disabled={loading}>Обновить</button>
    {loading ? <p role="status">Загружаем аналитику…</p> : error ? <p role="alert">{error}</p> : <>
      <div className="insights-totals">{[['Всего обращений', data.total], ['Новые', data.statuses.new], ['В работе', data.statuses.in_progress], ['Решённые', data.statuses.resolved]].map(([label, count]) => <div className="db-panel insights-stat" key={label}><span>{label}</span><strong>{count}</strong></div>)}</div>
      {data.total === 0 && <p className="insights-note">Пока нет обращений для анализа.</p>}
      <div className="insights-grid">
        <Bars title="По категориям" entries={data.categories} total={data.total} />
        <Bars title="По статусам" entries={Object.entries(data.statuses).map(([key, count]) => [requestStatuses[key] || 'Неизвестный статус', count])} total={data.total} />
        <Bars title="По приоритету" entries={Object.entries(data.priorities).map(([key, count]) => [requestPriorities[key] || 'Не определён', count])} total={data.total} />
        <Bars title="Проблемы и идеи" entries={[[ 'Проблемы', data.types.problem], ['Идеи', data.types.idea]]} total={data.total} />
      </div>
    </>}
  </section>
}
