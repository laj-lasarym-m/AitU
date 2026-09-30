import { useEffect, useRef } from 'react'
import { House, Files, Inbox, Clock3, Map, ChartNoAxesCombined, Bell, UsersRound, CircleHelp, ChevronRight, X } from 'lucide-react'
import { AuthLogo } from '../auth/AuthLayout.jsx'
import AccountMenu from '../auth/AccountMenu.jsx'

const navigation = [
  { label: 'Обзор', Icon: House }, { label: 'Все обращения', Icon: Files },
  { label: 'Новые', Icon: Inbox, status: 'Новая' }, { label: 'В работе', Icon: Clock3, status: 'В работе' },
  { label: 'Карта обращений', Icon: Map }, { label: 'Аналитика', Icon: ChartNoAxesCombined },
  { label: 'Уведомления', Icon: Bell }, { label: 'Сотрудники', Icon: UsersRound },
]

export default function AuthoritySidebar({ active, open, onClose, onNavigate, requests, onNotice }) {
  const sidebarRef = useRef(null)
  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusable = Array.from(sidebarRef.current.querySelectorAll('a, button'))
    focusable[0]?.focus()
    function keyboard(event) {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab') return
      const currentFocusable = Array.from(sidebarRef.current.querySelectorAll('a, button:not(:disabled)'))
      if (event.shiftKey && document.activeElement === currentFocusable[0]) { event.preventDefault(); currentFocusable.at(-1).focus() }
      else if (!event.shiftKey && document.activeElement === currentFocusable.at(-1)) { event.preventDefault(); currentFocusable[0].focus() }
    }
    document.addEventListener('keydown', keyboard)
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', keyboard); previousFocus?.focus() }
  }, [open, onClose])

  return (
    <>
      {open && <button className="db-drawer-backdrop" aria-label="Закрыть меню" onClick={onClose} />}
      <aside ref={sidebarRef} className={`db-sidebar${open ? ' is-open' : ''}`} role={open ? 'dialog' : undefined} aria-modal={open ? true : undefined} aria-label="Навигация госоргана">
        <div className="db-sidebar-brand-row"><AuthLogo className="db-logo" /><button className="db-icon-button db-drawer-close" aria-label="Закрыть меню" onClick={onClose}><X size={22} /></button></div>
        <p className="authority-sidebar-caption">Панель госоргана</p>
        <nav className="db-nav">{navigation.map(({ label, Icon, status }) => <button key={label} type="button" className={`db-nav-item${active === label ? ' is-active' : ''}`} aria-label={label} title={label} aria-current={active === label ? 'page' : undefined} onClick={() => onNavigate(label)}><Icon size={25} strokeWidth={1.6} /><span>{label}</span>{status && <span className="authority-nav-count">{requests.filter(request => request.status === status).length}</span>}</button>)}</nav>
        <div className="db-sidebar-bottom">
          <button className="db-nav-item db-help" aria-label="Помощь" onClick={() => onNotice('Выберите обращение, чтобы назначить ответственного или обновить статус. Все изменения сохраняются только в этой демонстрации.')}><CircleHelp size={27} strokeWidth={1.6} /><span>Помощь</span></button>
          <AccountMenu label="Профиль сотрудника" onError={onNotice}><span className="db-avatar">А</span><span className="authority-profile-text"><strong>Алия Н.</strong><small>Городское освещение</small></span><ChevronRight size={19} /></AccountMenu>
        </div>
      </aside>
    </>
  )
}
