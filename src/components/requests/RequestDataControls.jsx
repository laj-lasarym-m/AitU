import { useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { clearRequestDraft, readRequestDraft } from '../../requests/draft.js'
import '../../styles/requests.css'

export default function RequestDataControls({ mode, onMode, loading, error, count, onRefresh, citizen = false }) {
  const [draft, setDraft] = useState(readRequestDraft)
  return <div className="request-data-controls">
    <div className="request-source-row"><div className="db-filters" role="group" aria-label="Источник обращений"><button className={mode === 'real' ? 'is-active' : ''} aria-pressed={mode === 'real'} onClick={() => onMode('real')}>{citizen ? 'Мои обращения' : 'Обращения жителей'}</button><button className={mode === 'demo' ? 'is-active' : ''} aria-pressed={mode === 'demo'} onClick={() => onMode('demo')}>Демонстрация</button></div>{mode === 'real' && <button className="request-refresh" onClick={onRefresh} disabled={loading}><RefreshCw size={16} />Обновить</button>}</div>
    {mode === 'demo' ? <p className="request-state-note">Демонстрационные данные · изменения только на этой странице</p> : <p className="request-state-note" role={error ? 'alert' : 'status'}>{loading ? 'Загружаем обращения…' : error || (count ? 'Обращения из базы данных' : citizen ? 'Реальных обращений пока нет. Создайте первое обращение.' : 'Новые обращения жителей появятся здесь.')}</p>}
    {citizen && draft && <div className="request-draft-note"><span>У вас есть неотправленное обращение.</span><Link to="/#appeal-form">Продолжить</Link><button onClick={() => { clearRequestDraft(); setDraft(null) }}>Удалить черновик</button></div>}
  </div>
}
