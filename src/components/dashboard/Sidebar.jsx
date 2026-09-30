import { Link } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { House, Sparkles, FileText, Map, Lightbulb, Award, Bell, CircleHelp, ChevronRight, X } from 'lucide-react'
import AccountMenu from '../auth/AccountMenu.jsx'
import { UnreadBadge } from './NotificationSurfaces.jsx'

const items = [
  { label: 'Обзор', Icon: House },
  { label: 'AI-помощник', Icon: Sparkles },
  { label: 'Мои обращения', Icon: FileText },
  { label: 'Карта города', Icon: Map },
  { label: 'Идеи жителей', Icon: Lightbulb },
  { label: 'Мои баллы', Icon: Award },
  { label: 'Уведомления', Icon: Bell },
]

export default function Sidebar({ open, onClose, active, onNavigate, onNotice, unreadCount = 0 }) {
  const sidebarRef = useRef(null)
  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement
    const focusable = Array.from(sidebarRef.current.querySelectorAll('a, button'))
    focusable[0]?.focus()
    function trapFocus(event) {
      if (event.key !== 'Tab') return
      const currentFocusable = Array.from(sidebarRef.current.querySelectorAll('a, button:not(:disabled)'))
      const first = currentFocusable[0]
      const last = currentFocusable.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', trapFocus)
    return () => { document.removeEventListener('keydown', trapFocus); previousFocus?.focus() }
  }, [open])
  return (
    <>
      {open && <button className="db-drawer-backdrop" aria-label="Закрыть меню" onClick={onClose} />}
      <aside ref={sidebarRef} className={`db-sidebar${open ? ' is-open' : ''}`} role={open ? 'dialog' : undefined} aria-modal={open ? true : undefined} aria-label="Навигация кабинета">
        <div className="db-sidebar-brand-row">
          <Link to="/" className="db-logo" aria-label="AitU — на главную">
            <span>Ait<span>U</span></span>
            <svg viewBox="0 0 36 42" fill="none" aria-hidden="true">
              {[12, 24, 36, 24, 12].map((height, index) => <path key={index} d={`M${4 + index * 7} ${(42 - height) / 2}v${height}`} stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />)}
            </svg>
          </Link>
          <button className="db-icon-button db-drawer-close" aria-label="Закрыть меню" onClick={onClose}><X size={22} /></button>
        </div>
        <nav className="db-nav">
          {items.map(({ label, Icon }) => (
            <button key={label} aria-label={label} title={label} className={`db-nav-item${active === label ? ' is-active' : ''}`} aria-current={active === label ? 'page' : undefined} onClick={() => onNavigate(label)}>
              <Icon size={25} strokeWidth={1.6} /><span>{label}</span>{label === 'Уведомления' && <UnreadBadge count={unreadCount} />}
            </button>
          ))}
        </nav>
        <div className="db-sidebar-bottom">
          <button className="db-nav-item db-help" aria-label="Помощь" onClick={() => onNotice('Выберите обращение, чтобы посмотреть его статус, историю и добавить информацию.')}><CircleHelp size={27} strokeWidth={1.6} /><span>Помощь</span></button>
          <AccountMenu label="Личный кабинет" onError={onNotice}><span className="db-avatar">A</span><span>Личный кабинет</span><ChevronRight size={20} /></AccountMenu>
        </div>
      </aside>
    </>
  )
}
