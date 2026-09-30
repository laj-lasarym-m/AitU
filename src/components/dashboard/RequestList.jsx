import { Search, ChevronRight, Sparkles, ArrowRight, Clock3 } from 'lucide-react'

export function StatusBadge({ request }) {
  return <span className={`db-badge db-status ${request.type === 'idea' ? 'is-purple' : 'is-amber'}`}><Clock3 size={16} /><span>{request.status}</span></span>
}

export default function RequestList({ requests, selectedId, onSelect, query, onQuery, filter, onFilter, onAssistant }) {
  return (
    <section className="db-list-panel db-panel" aria-label="Список обращений">
      <label className="db-search"><Search size={22} strokeWidth={1.7} /><input type="search" aria-label="Поиск обращения" placeholder="Поиск обращения" value={query} onChange={event => onQuery(event.target.value)} /></label>
      <div className="db-filters" role="group" aria-label="Фильтр обращений">
        {[['all', 'Все'], ['problem', 'Проблемы'], ['idea', 'Идеи']].map(([value, label]) => <button key={value} className={filter === value ? 'is-active' : ''} aria-pressed={filter === value} onClick={() => onFilter(value)}>{label}</button>)}
      </div>
      <div className="db-request-list">
        {requests.map(request => (
          <button key={request.id} className={`db-request-card${request.id === selectedId ? ' is-selected' : ''}`} aria-pressed={request.id === selectedId} onClick={() => onSelect(request.id)}>
            <strong>{request.title}</strong>
            {request.status === 'Нужны уточнения' && <span className="db-unread-dot" aria-label="Есть обновление" />}
            <div className="db-request-badges"><span className={`db-badge ${request.type === 'problem' ? 'is-red' : 'is-purple'}`}>{request.type === 'problem' ? 'Проблема' : 'Идея'}</span><StatusBadge request={request} /></div>
            <span className="db-request-meta">№ {request.id}<span>·</span>{request.date}</span>
            <ChevronRight className="db-request-chevron" size={23} strokeWidth={1.5} />
          </button>
        ))}
        {requests.length === 0 && <div className="db-empty-list"><Search size={28} /><strong>Обращения не найдены</strong><p>Попробуйте другой запрос или фильтр.</p></div>}
      </div>
      <div className="db-idea-promo"><Sparkles size={37} fill="currentColor" strokeWidth={1.2} /><div><strong>Есть новая идея?</strong><p>Расскажите — AitU поможет её оформить</p><button onClick={onAssistant}>Открыть AI-помощника <ArrowRight size={21} /></button></div></div>
    </section>
  )
}
