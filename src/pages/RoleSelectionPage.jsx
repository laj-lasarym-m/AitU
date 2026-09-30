import { useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { UserRound, Landmark, Check, ArrowRight, Info, X } from 'lucide-react'
import AuthLayout, { AuthLogo } from '../components/auth/AuthLayout.jsx'
import { roleOptions } from '../data/roles.js'
import { useAuth } from '../auth/context.js'
import { getAccountPath } from '../auth/access.js'
import { authErrorMessage, registerAccount } from '../auth/actions.js'
import { clearAuthorityIntent, rememberAuthorityIntent, setRememberSession } from '../auth/storage.js'
import { supabase } from '../lib/supabase.js'
import AccountState from '../components/auth/AccountState.jsx'

export default function RoleSelectionPage() {
  const navigate = useNavigate()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const { account, registration, setRegistration, setConfirmation, refresh } = useAuth()

  async function chooseRole(role) {
    if (!registration || submitting.current) return
    submitting.current = true; setBusy(true); setMessage('')
    const authority = role === 'authority'
    try {
      setRememberSession(true)
      if (authority) rememberAuthorityIntent(registration.email)
      else clearAuthorityIntent()
      const data = await registerAccount(supabase, registration, authority, window.location.origin)
      const email = registration.email
      setRegistration(null)
      if (!data.session) {
        setConfirmation({ email, authority })
        navigate('/confirm-email', { replace: true })
      } else {
        const loaded = await refresh()
        const destination = loaded && getAccountPath(loaded)
        navigate(destination === '/dashboard' && authority ? '/authority-application' : destination ?? '/login', { replace: true })
      }
    } catch (error) { setMessage(authErrorMessage(error)) }
    finally { submitting.current = false; setBusy(false) }
  }

  if (!busy && !registration) {
    if (account.status === 'loading') return <AccountState loading />
    if (account.status === 'authenticated' && !getAccountPath(account)) return <AccountState />
    return <Navigate to={getAccountPath(account) ?? '/login'} replace />
  }
  return (
    <AuthLayout wide>
      <section className="auth-role-section" aria-labelledby="role-title">
        <div className="auth-role-heading"><AuthLogo /><h1 id="role-title">Как вы хотите войти?</h1><p>Выберите тип аккаунта для регистрации</p></div>
        <div className="auth-role-grid">
          {roleOptions.map(role => {
            const Icon = role.id === 'citizen' ? UserRound : Landmark
            return (
              <article key={role.id} className={`auth-role-card auth-role-${role.id}`} aria-labelledby={`role-${role.id}`}>
                <div className="auth-role-icon"><Icon size={30} strokeWidth={1.6} /></div>
                <h2 id={`role-${role.id}`}>{role.title}</h2>
                <p className="auth-role-description">{role.description}</p>
                <ul>{role.features.map(feature => <li key={feature}><Check size={17} strokeWidth={1.8} /><span>{feature}</span></li>)}</ul>
                <button className={role.id === 'citizen' ? 'auth-primary auth-role-action' : 'auth-role-action auth-institutional'} type="button" disabled={busy} onClick={() => chooseRole(role.id)}>{busy ? 'Создаём аккаунт…' : role.action}<ArrowRight size={18} /></button>
              </article>
            )
          })}
        </div>
        {message && <div className="auth-role-message" role="status"><Info size={21} /><span>{message}</span><button type="button" aria-label="Закрыть сообщение" onClick={() => setMessage('')}><X size={18} /></button></div>}
        <p className="auth-role-demo">Доступ представителя госоргана откроется только после проверки заявки</p>
        {!busy && <Link className="auth-login-back" to="/login" onClick={() => setRegistration(null)}>Вернуться ко входу</Link>}
      </section>
    </AuthLayout>
  )
}
