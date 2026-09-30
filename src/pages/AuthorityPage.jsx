import { useCallback, useEffect, useRef, useState } from 'react'
import { Files, X, ArrowLeft } from 'lucide-react'
import DashboardHeader from '../components/dashboard/DashboardHeader.jsx'
import AuthoritySidebar from '../components/authority/AuthoritySidebar.jsx'
import AuthorityRequestList from '../components/authority/AuthorityRequestList.jsx'
import AuthorityRequestDetails from '../components/authority/AuthorityRequestDetails.jsx'
import { AssignResponsibleModal, ChangeStatusModal } from '../components/authority/AuthorityModals.jsx'
import { authorityRequests, filterAuthorityRequests, updateAuthorityRequest } from '../data/authorityRequests.js'
import RequestDataControls from '../components/requests/RequestDataControls.jsx'
import useRequests from '../requests/useRequests.js'
import { updateRequestWorkflow } from '../requests/api.js'
import { requestErrorMessage, statusCodeFromLabel } from '../requests/model.js'
import CityRequestMap from '../components/map/CityRequestMap.jsx'
import RequestAnalytics from '../components/authority/RequestAnalytics.jsx'
import '../styles/insights.css'
import '../styles/dashboard.css'
import '../styles/authority.css'

const emptyFilters = { query: '', status: 'all', category: '', area: '', priority: '' }
const requestSections = ['Все обращения', 'Новые', 'В работе']

export default function AuthorityPage() {
  const [demoRequests, setDemoRequests] = useState(authorityRequests)
  const [mode, setMode] = useState('real')
  const real = useRequests('authority', mode === 'real')
  const requests = mode === 'real' ? real.rows : demoRequests
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const savingRef = useRef(false)
  const [filters, setFilters] = useState(emptyFilters)
  const [selectedId, setSelectedId] = useState('A-104')
  const [section, setSection] = useState('Все обращения')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [modal, setModal] = useState(null)
  const [notice, setNotice] = useState('')
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])
  const visibleRequests = filterAuthorityRequests(requests, filters)
  const selected = visibleRequests.find(request => request.id === selectedId) ?? visibleRequests[0]
  const modalRequest = modal ? requests.find(request => request.id === modal.id) : null
  const showRequests = requestSections.includes(section)

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 6000)
    return () => clearTimeout(timer)
  }, [notice])

  function navigateSection(label) {
    setSection(label)
    setDrawerOpen(false)
    if (label === 'Карта обращений' || label === 'Аналитика') setMode('real')
    if (requestSections.includes(label)) setFilters({ ...emptyFilters, status: label === 'Новые' ? 'Новая' : label === 'В работе' ? 'В работе' : 'all' })
  }

  function changeFilter(field, value) {
    setFilters(current => field === 'reset' ? emptyFilters : { ...current, [field]: value })
    if (field === 'status' || field === 'reset') setSection('Все обращения')
  }

  function changeMode(value) {
    if (savingRef.current) return
    setMode(value)
    setModal(null)
    setSaveError('')
    setSelectedId(null)
    setFilters(emptyFilters)
    setSection('Все обращения')
  }

  function openModal(kind) {
    setSaveError('')
    setModal({ kind, id: selected.id })
  }

  function closeModal() {
    if (!savingRef.current) setModal(null)
  }

  async function saveChange(change) {
    if (savingRef.current || !modalRequest) return
    if (mode === 'demo') {
      setDemoRequests(current => updateAuthorityRequest(current, modal.id, change))
      setModal(null)
      setNotice('Демо: изменения сохранены только на этой странице')
      return
    }
    savingRef.current = true
    setSaving(true)
    setSaveError('')
    try {
      const payload = change.kind === 'assignment' ? { assigned_to: change.employee } : { status: statusCodeFromLabel(change.status) }
      const saved = await updateRequestWorkflow(modalRequest, payload)
      real.replaceSaved(saved)
      setModal(null)
      setNotice(change.kind === 'assignment' ? 'Ответственный сохранён в базе' : 'Статус сохранён в базе')
    } catch (error) {
      setSaveError(requestErrorMessage(error))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <div className="dashboard authority">
      <AuthoritySidebar active={section} open={drawerOpen} onClose={closeDrawer} onNavigate={navigateSection} requests={requests} onNotice={setNotice} />
      <div className="db-main">
        <DashboardHeader onMenu={() => setDrawerOpen(true)} workspace="Панель госоргана" section={section} />
        <main className="db-content">
          <div className="db-page-heading"><div><h1>{section}</h1><p>{showRequests ? 'Управляйте обращениями жителей и следите за их статусом' : 'Панель госоргана · Семей'}</p></div></div>
          {showRequests && <RequestDataControls mode={mode} onMode={changeMode} loading={real.loading} error={real.error} count={real.rows.length} onRefresh={real.reload} />}
          {showRequests ? <div className="authority-workspace">
            <AuthorityRequestList requests={visibleRequests} allRequests={requests} selectedId={selected?.id} filters={filters} onFilter={changeFilter} onSelect={setSelectedId} mode={mode} />
            {selected ? <AuthorityRequestDetails key={`${mode}-${selected.id}`} request={selected} onAssign={() => openModal('assignment')} onStatus={() => openModal('status')} /> : <section className="db-panel db-empty-detail"><Files size={42} strokeWidth={1.3} /><h2>{mode === 'real' && real.loading ? 'Загружаем обращения…' : 'Нет обращений для просмотра'}</h2><p>{mode === 'real' && real.error ? real.error : 'Новые обращения жителей появятся здесь. Проверьте фильтры или обновите список.'}</p><button onClick={() => { changeFilter('reset'); if (mode === 'real') real.reload() }}>Обновить список</button></section>}
          </div> : section === 'Аналитика' ? <RequestAnalytics rows={real.rows} loading={real.loading} error={real.error} onRefresh={real.reload} /> : section === 'Карта обращений' ? <CityRequestMap authority rows={real.rows} loading={real.loading} error={real.error} onRefresh={real.reload} onOpen={request => { setMode('real'); setFilters(emptyFilters); setSelectedId(request.id); setSection('Все обращения') }} /> : <section className="db-panel authority-placeholder"><Files size={39} strokeWidth={1.4} /><h2>{section}</h2><p>Раздел будет подключён на следующем этапе.</p><button className="authority-secondary" onClick={() => navigateSection('Все обращения')}><ArrowLeft size={18} />Все обращения</button></section>}
        </main>
      </div>
      {modalRequest && (modal.kind === 'assignment' ? <AssignResponsibleModal key={modalRequest.id} request={modalRequest} onClose={closeModal} onSave={saveChange} busy={saving} saveError={saveError} /> : <ChangeStatusModal key={modalRequest.id} request={modalRequest} onClose={closeModal} onSave={saveChange} busy={saving} saveError={saveError} />)}
      {notice && <div className="db-toast" role="status"><span>{notice}</span><button type="button" aria-label="Закрыть уведомление" onClick={() => setNotice('')}><X size={18} /></button></div>}
    </div>
  )
}
