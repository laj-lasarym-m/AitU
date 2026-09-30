import { useEffect, useRef, useState } from 'react'
import { Bell, MapPin, ChevronDown, Menu, Check } from 'lucide-react'
import ThemeToggle from '../ThemeToggle.jsx'
import { UnreadBadge, NotificationDropdown } from './NotificationSurfaces.jsx'

export default function DashboardHeader({ onMenu, workspace = 'Личный кабинет', section = 'Мои обращения', notifications, onNotificationView, onNotifications }) {
  const [dropdown, setDropdown] = useState(null)
  const controls = useRef(null)

  useEffect(() => {
    if (!dropdown) return
    function dismiss(event) {
      if (event.type === 'keydown' && event.key !== 'Escape') return
      if (event.type === 'pointerdown' && controls.current?.contains(event.target)) return
      setDropdown(null)
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', dismiss)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', dismiss)
    }
  }, [dropdown])

  const toggle = name => setDropdown(value => value === name ? null : name)
  return (
    <header className="db-header">
      <div className="db-header-leading">
        <button className="db-icon-button db-menu-button" aria-label="Открыть меню" onClick={onMenu}><Menu size={23} /></button>
        <div className="db-breadcrumb"><span>{workspace}</span><span aria-hidden="true">/</span><strong>{section}</strong></div>
      </div>
      <div className="db-header-controls" ref={controls}>
        <ThemeToggle showLabel className="db-theme-toggle" />
        <div className="db-dropdown-wrap">
          <button className="db-header-control" aria-expanded={dropdown === 'city'} aria-controls="db-city" onClick={() => toggle('city')}><MapPin size={21} /><span>Семей</span><ChevronDown size={16} /></button>
          {dropdown === 'city' && <div className="db-dropdown" id="db-city"><button onClick={() => setDropdown(null)}>Семей <Check size={16} /></button><p>Другие города появятся позже</p></div>}
        </div>
        <div className="db-dropdown-wrap db-language-control">
          <button className="db-header-control" aria-expanded={dropdown === 'language'} aria-controls="db-language" onClick={() => toggle('language')}>РУС <ChevronDown size={16} /></button>
          {dropdown === 'language' && <div className="db-dropdown" id="db-language"><button onClick={() => setDropdown(null)}>Русский <Check size={16} /></button><button disabled>Қазақша <small>Скоро</small></button><button disabled>English <small>Скоро</small></button></div>}
        </div>
        <div className="db-dropdown-wrap">
          <button className="db-icon-button db-bell" aria-label="Уведомления" aria-expanded={dropdown === 'notifications'} aria-controls="db-notifications" onClick={() => toggle('notifications')}><Bell size={25} strokeWidth={1.7} />{notifications && <UnreadBadge count={notifications.unreadCount} />}</button>
          {dropdown === 'notifications' && (notifications ? <NotificationDropdown notifications={notifications} onView={async row => { if (await onNotificationView(row)) setDropdown(null) }} onAll={() => { setDropdown(null); onNotifications() }} /> : <div className="db-dropdown db-notifications" id="db-notifications"><strong>Уведомления</strong><p>Новых уведомлений пока нет</p></div>)}
        </div>
      </div>
    </header>
  )
}
