import { useEffect, useId, useRef, useState } from 'react'
import { useAuth } from '../../auth/context.js'
import { LogoutButton } from './AccountState.jsx'

// Keep the existing profile button intact; logout appears only when it opens.
export default function AccountMenu({ children, label, onError }) {
  const { account } = useAuth()
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  const id = useId()
  useEffect(() => {
    if (!open) return
    const trigger = root.current.querySelector('.db-account')
    root.current.querySelector('.db-logout')?.focus()
    function outside(event) { if (!root.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', outside)
    return () => { document.removeEventListener('pointerdown', outside); trigger?.focus() }
  }, [open])
  return <div className="db-account-control" ref={root} onKeyDown={event => {
    if (event.key === 'Escape' && open) { event.stopPropagation(); setOpen(false) }
  }}>
    <button className="db-account" aria-label={label} aria-expanded={open} aria-controls={id} onClick={() => setOpen(current => !current)}>{children}</button>
    {open && <div className="db-account-menu" id={id} role="group" aria-label="Аккаунт"><p>{account.profile?.full_name || account.user?.email || 'Аккаунт AitU'}</p><LogoutButton className="db-logout" onError={onError} /></div>}
  </div>
}
