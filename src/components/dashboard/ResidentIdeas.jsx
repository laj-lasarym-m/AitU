import { Link } from 'react-router-dom'
import { Lightbulb } from 'lucide-react'
import { ownIdeas, ideaSubmissionUrl } from '../../requests/insights.js'
import { StatusBadge } from './RequestList.jsx'

export default function ResidentIdeas({ rows, userId, loading, error, onRefresh, onOpen }) {
  const ideas = ownIdeas(rows, userId)
  return <section className="insights-section" aria-label="Идеи жителей">
    <p className="insights-note">Здесь показаны только ваши идеи по улучшению города. Обращения других жителей остаются приватными.</p>
    <button className="insights-refresh" onClick={onRefresh} disabled={loading}>Обновить</button>
    {loading ? <p role="status">Загружаем идеи…</p> : error ? <p role="alert">{error}</p> : ideas.length === 0 ?
      <div className="db-panel db-empty-detail"><Lightbulb size={36} /><h2>У вас пока нет предложенных идей</h2><Link className="db-new-request" to={ideaSubmissionUrl}>Предложить идею</Link></div> :
      <div className="insights-grid">{ideas.map(idea => <button key={idea.databaseId} className="db-panel insights-idea" onClick={() => onOpen(idea)}>
        <strong>{idea.title}</strong><p className="insights-preview">{idea.description}</p>
        <span className="insights-note">{idea.category}</span>
        {idea.address && idea.address !== 'Адрес не указан' && <span className="insights-note">{idea.address}</span>}
        <StatusBadge request={idea} /><span className="insights-note">{idea.date}</span>
      </button>)}</div>}
  </section>
}
