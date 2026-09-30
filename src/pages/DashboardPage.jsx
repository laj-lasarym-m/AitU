import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, X, FileSearch } from 'lucide-react'
import Sidebar from '../components/dashboard/Sidebar.jsx'
import DashboardHeader from '../components/dashboard/DashboardHeader.jsx'
import RequestList from '../components/dashboard/RequestList.jsx'
import RequestDetails from '../components/dashboard/RequestDetails.jsx'
import { demoRequests, filterRequests, confirmRequest } from '../data/requests.js'
import useRequests from '../requests/useRequests.js'
import RequestDataControls from '../components/requests/RequestDataControls.jsx'
import CityRequestMap from '../components/map/CityRequestMap.jsx'
import ResidentIdeas from '../components/dashboard/ResidentIdeas.jsx'
import CitizenPoints from '../components/dashboard/CitizenPoints.jsx'
import CitizenAssistant from '../components/dashboard/CitizenAssistant.jsx'
import CitizenNotifications from '../components/dashboard/CitizenNotifications.jsx'
import useCitizenNotifications from '../requests/useCitizenNotifications.js'
import { NotificationToast } from '../components/dashboard/NotificationSurfaces.jsx'
import { ideaSubmissionUrl } from '../requests/insights.js'
import { useAuth } from '../auth/context.js'
import '../styles/dashboard.css'
import '../styles/insights.css'

export default function DashboardPage() {
  const { account } = useAuth()
  const notifications = useCitizenNotifications(account.user?.id)
  const [mode, setMode] = useState('real')
  const real = useRequests('citizen', mode === 'real')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [selectedId, setSelectedId] = useState('A-104')
  const [confirmed, setConfirmed] = useState({})
  const [updates, setUpdates] = useState({})
  const [activeNav, setActiveNav] = useState('Мои обращения')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [notificationRequest, setNotificationRequest] = useState(null)
  const requests = mode === 'real' ? real.rows : demoRequests
  const visibleRequests = filterRequests(requests, query, filter)
  const selected = visibleRequests.find(request => request.id === selectedId) ?? visibleRequests[0]

  useEffect(() => {
    if (!notificationRequest || real.loading || real.rows === notificationRequest.previousRows) return
    let active = true
    queueMicrotask(() => {
      if (!active) return
      const request = real.rows.find(row => row.databaseId === notificationRequest.id)
      setNotificationRequest(null)
      if (!request || real.error) { setNotice('Обращение недоступно. Попробуйте обновить список.'); return }
      setQuery(''); setFilter('all'); setSelectedId(request.id); setActiveNav('Мои обращения')
    })
    return () => { active = false }
  }, [notificationRequest, real.loading, real.rows, real.error])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 6000)
    return () => clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (!drawerOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onEscape(event) { if (event.key === 'Escape') setDrawerOpen(false) }
    document.addEventListener('keydown', onEscape)
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onEscape) }
  }, [drawerOpen])

  function navigateSidebar(label) {
    setActiveNav(label)
    setDrawerOpen(false)
    if (label === 'Уведомления') void notifications.refresh()
    if (['Карта города', 'Идеи жителей', 'Мои баллы', 'Уведомления'].includes(label)) { setMode('real'); if (mode === 'real' && ['Мои баллы', 'Уведомления'].includes(label)) void real.reload() }
    else if (!['Мои обращения', 'AI-помощник'].includes(label)) setNotice(`Раздел «${label}» появится позже. Сейчас доступен список обращений.`)
  }

  async function viewNotification(row) {
    if (!await notifications.markRead(row)) return false
    notifications.dismissToast()
    setMode('real')
    if (row.request_id) { if (mode === 'real') void real.reload(); setNotificationRequest({ id: row.request_id, previousRows: real.rows }) }
    else setActiveNav('Уведомления')
    return true
  }

  return (
    <div className="dashboard">
      <Sidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} active={activeNav} onNavigate={navigateSidebar} onNotice={setNotice} unreadCount={notifications.unreadCount} />
      <div className="db-main">
        <DashboardHeader notifications={notifications} onNotificationView={viewNotification} onNotifications={() => navigateSidebar('Уведомления')} onMenu={() => setDrawerOpen(true)} section={['Карта города', 'Идеи жителей', 'Мои баллы', 'Уведомления', 'AI-помощник'].includes(activeNav) ? activeNav : 'Мои обращения'} />
        <main className="db-content">
          <div className="db-page-heading"><div><h1>{['Карта города', 'Идеи жителей', 'Мои баллы', 'Уведомления', 'AI-помощник'].includes(activeNav) ? activeNav : 'Мои обращения'}</h1><p>{activeNav === 'Идеи жителей' ? 'Ваши предложения по улучшению города' : 'Следите за решениями и дополняйте свои заявки'}</p></div><Link to={activeNav === 'Идеи жителей' ? ideaSubmissionUrl : '/#appeal-form'} className="db-new-request"><Plus size={24} strokeWidth={1.7} />{activeNav === 'Идеи жителей' ? 'Предложить идею' : 'Новое обращение'}</Link></div>
          {activeNav === 'AI-помощник' ? <CitizenAssistant key={account.user?.id} /> : activeNav === 'Мои баллы' ? <CitizenPoints rows={real.rows} userId={account.user?.id} loading={real.loading} error={real.error} onRefresh={real.reload} /> : activeNav === 'Уведомления' ? <CitizenNotifications notifications={notifications} onView={viewNotification} /> : activeNav === 'Идеи жителей' ? <ResidentIdeas rows={real.rows} userId={account.user?.id} loading={real.loading} error={real.error} onRefresh={real.reload} onOpen={request => { setMode('real'); setQuery(''); setFilter('all'); setSelectedId(request.id); setActiveNav('Мои обращения') }} /> : activeNav === 'Карта города' ? <CityRequestMap rows={real.rows} loading={real.loading} error={real.error} onRefresh={real.reload} onOpen={request => { setMode('real'); setQuery(''); setFilter('all'); setSelectedId(request.id); setActiveNav('Мои обращения') }} /> : <>
          <RequestDataControls citizen mode={mode} onMode={value => { setMode(value); setSelectedId(''); setQuery(''); setFilter('all') }} loading={real.loading} error={real.error} count={real.rows.length} onRefresh={real.reload} />
          <div className="db-workspace">
            <RequestList requests={visibleRequests} selectedId={selected?.id} onSelect={setSelectedId} query={query} onQuery={setQuery} filter={filter} onFilter={setFilter} onAssistant={() => navigateSidebar('AI-помощник')} />
            {selected ? <RequestDetails key={`${mode}-${selected.id}`} request={selected} confirmed={mode === 'demo' && Boolean(confirmed[selected.id])} onConfirm={() => { if (mode === 'demo') setConfirmed(current => confirmRequest(current, selected.id)) }} updates={mode === 'demo' ? updates[selected.id] ?? [] : []} onAddUpdate={update => { if (mode === 'demo') setUpdates(current => ({ ...current, [selected.id]: [...(current[selected.id] ?? []), update] })) }} onNotice={setNotice} /> : <section className="db-panel db-empty-detail"><FileSearch size={44} strokeWidth={1.3} /><h2>{mode === 'real' && real.loading ? 'Загружаем обращения…' : 'Нет обращений для просмотра'}</h2><p>{mode === 'real' && real.error ? real.error : 'Создайте обращение или измените поисковый запрос.'}</p><button onClick={() => { setQuery(''); setFilter('all'); if (mode === 'real') void real.reload() }}>Обновить список</button></section>}
          </div>
          </>}
        </main>
      </div>
      <NotificationToast notifications={notifications} onView={viewNotification} />
      {notice && <div className="db-toast" role="status"><span>{notice}</span><button aria-label="Закрыть уведомление" onClick={() => setNotice('')}><X size={18} /></button></div>}
    </div>
  )
}
