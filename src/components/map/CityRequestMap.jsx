import { useState } from 'react'
import RequestMap from './RequestMap.jsx'
import { locatedRequests } from '../../requests/location.js'
import { requestStatuses } from '../../requests/model.js'

export default function CityRequestMap({ rows, loading, error, onRefresh, onOpen, authority = false }) {
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')
  const located = locatedRequests(rows)
  const visible = locatedRequests(rows, { status, category })
  return <section className="db-panel request-city-map"><div className="request-map-toolbar"><p>{authority ? 'Реальные обращения с указанным местоположением' : 'Показаны только ваши обращения, доступные вашему аккаунту.'}</p><button type="button" className="request-refresh" disabled={loading} onClick={onRefresh}>Обновить</button></div>{authority && <div className="authority-select-filters"><select aria-label="Статус на карте" value={status} onChange={event => setStatus(event.target.value)}><option value="">Все статусы</option>{Object.entries(requestStatuses).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select><select aria-label="Категория на карте" value={category} onChange={event => setCategory(event.target.value)}><option value="">Все категории</option>{[...new Set(located.map(row => row.category))].sort().map(label => <option key={label}>{label}</option>)}</select></div>}{loading ? <p role="status">Загружаем обращения…</p> : error ? <p role="alert">{error}</p> : <>{!visible.length && <p>Нет обращений с указанным местоположением{status || category ? ' для выбранных фильтров' : ''}.</p>}<RequestMap requests={visible} authority={authority} onOpen={onOpen} /></>}</section>
}
