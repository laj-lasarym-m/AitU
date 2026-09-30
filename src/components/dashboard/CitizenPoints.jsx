import { citizenPoints } from '../../requests/points.js'

export default function CitizenPoints({ rows, userId, loading, error, onRefresh }) {
  const { total, stats, activity } = citizenPoints(rows, userId)
  return <section className="insights-section" aria-label="Мои баллы">
    <button className="insights-refresh" disabled={loading} onClick={onRefresh}>Обновить</button>
    {loading ? <p role="status">Загружаем баллы…</p> : error ? <p role="alert">{error}</p> : <>
      <div className="db-panel insights-stat"><strong>{total} баллов</strong><span>Ваш вклад в развитие города</span><small>Баллы гражданского участия, без денежной стоимости. Рассчитаны по текущему состоянию ваших обращений.</small></div>
      <div className="insights-totals">{[['Отправлено обращений', stats.submitted], ['Предложено идей', stats.ideas], ['Решено проблем', stats.resolvedProblems], ['Реализовано идей', stats.resolvedIdeas]].map(([label, value]) => <div className="db-panel insights-stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
      <section className="db-panel insights-chart"><h2>Как получить баллы</h2><ul><li>+10 — сообщить о проблеме</li><li>+15 — предложить идею</li><li>+20 дополнительно — проблема решена</li><li>+30 дополнительно — идея реализована</li></ul></section>
      <section className="db-panel insights-chart"><h2>Последние обращения</h2><p className="insights-note">Последние 10 отправленных обращений и их текущий вклад в сумму баллов.</p>{activity.length ? <ul>{activity.map(({ request, base, bonus }) => <li key={request.databaseId}><strong>{request.id} · {request.title}</strong><p>{request.date} · {request.status}</p><span>+{base} за отправку{bonus ? ` и +${bonus} дополнительно за решение` : ''}</span></li>)}</ul> : <p>У вас пока нет обращений. Сообщите о проблеме или предложите идею.</p>}</section>
    </>}
  </section>
}
