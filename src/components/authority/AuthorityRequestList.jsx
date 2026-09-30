import { Search, MapPin, UsersRound, ChevronRight, Clock3, Check, CircleDot, MessageCircle, Image } from 'lucide-react'
import { authorityStatusFilters } from '../../data/authorityRequests.js'
import { isRealRequest } from '../../requests/model.js'

export function AuthorityStatusBadge({ status }) {
  const kind = status === 'Завершена' ? 'complete' : ['Новая', 'Отклонено'].includes(status) ? 'new' : status === 'На рассмотрении' ? 'review' : 'working'
  const Icon = status === 'Завершена' ? Check : status === 'Новая' ? CircleDot : status === 'Нужны уточнения' ? MessageCircle : Clock3
  return <span className={`db-badge authority-status authority-status-${kind}`}><Icon size={14} /><span>{status}</span></span>
}

export default function AuthorityRequestList({ requests, allRequests, selectedId, filters, onFilter, onSelect, mode = 'demo' }) {
  return (
    <section className="db-panel authority-list-panel" aria-label="Список обращений жителей">
      <label className="db-search authority-search"><Search size={21} strokeWidth={1.7} /><input type="search" placeholder="Поиск по номеру, названию или адресу..." aria-label="Поиск по номеру, названию или адресу" value={filters.query} onChange={event => onFilter('query', event.target.value)} /></label>
      <div className="db-filters authority-status-filters" role="group" aria-label="Статус обращения">{authorityStatusFilters.map(({ value, label }) => <button key={value} type="button" className={filters.status === value ? 'is-active' : ''} aria-pressed={filters.status === value} onClick={() => onFilter('status', value)}>{label}<span>{value === 'all' ? allRequests.length : allRequests.filter(request => request.status === value).length}</span></button>)}</div>
      <div className="authority-select-filters">
        {[['category', 'Категория'], ['area', 'Район'], ['priority', 'Приоритет']].map(([field, label]) => <select key={field} value={filters[field]} aria-label={label} onChange={event => onFilter(field, event.target.value)}><option value="">{label}</option>{[...new Set(allRequests.map(request => request[field]))].map(value => <option key={value} value={value}>{value}</option>)}</select>)}
      </div>
      <div className="authority-request-cards">{requests.map(request => <button type="button" key={request.id} className={`authority-request-card${selectedId === request.id ? ' is-selected' : ''}`} aria-pressed={selectedId === request.id} onClick={() => onSelect(request.id)}>
        <div className="authority-thumbnail" aria-hidden="true"><Image size={25} strokeWidth={1.4} /><small>{isRealRequest(request) ? 'Фото позже' : 'Демо'}</small></div>
        <div className="authority-request-summary"><div className="authority-card-top"><span className="authority-card-id">{request.id}</span><AuthorityStatusBadge status={request.status} /></div><strong>{request.title}</strong><p><MapPin size={14} />{request.address}</p><div className="authority-card-meta"><span>{request.date}</span><span><UsersRound size={14} />{isRealRequest(request) ? '—' : request.confirmations}</span></div></div><ChevronRight className="authority-card-chevron" size={17} />
      </button>)}</div>
      {!requests.length && <div className="db-empty-list"><Search size={29} /><strong>Обращения не найдены</strong><p>Измените поисковый запрос или фильтры.</p><button className="authority-text-button" onClick={() => onFilter('reset')}>Сбросить фильтры</button></div>}
      <p className="authority-list-note">{mode === 'real' ? 'Данные из базы' : 'Демонстрационные данные'}</p>
    </section>
  )
}
