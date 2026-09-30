import { useRef, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Info } from 'lucide-react'
import AuthLayout, { AuthLogo } from '../components/auth/AuthLayout.jsx'
import PasswordField from '../components/auth/PasswordField.jsx'
import AccountState from '../components/auth/AccountState.jsx'
import { useAuth } from '../auth/context.js'
import { getAccountPath } from '../auth/access.js'
import { authErrorMessage, validateCredentials, withTimeout } from '../auth/actions.js'
import { hasAuthorityIntent, setRememberSession } from '../auth/storage.js'
import { supabase } from '../lib/supabase.js'

export default function LoginPage() {
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const { account, refresh, setRegistration } = useAuth()
  const submitting = useRef(false)
  const headingRef = useRef(null)
  const [registering, setRegistering] = useState(false)
  const [name, setName] = useState('')
  const [identity, setIdentity] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [remember, setRemember] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  function changeMode() {
    setRegistering(current => !current)
    setPassword('')
    setConfirmation('')
    setMessage('')
    setRegistration(null)
    headingRef.current?.focus()
  }

  async function submit(event) {
    event.preventDefault()
    if (submitting.current) return
    const invalid = validateCredentials({ name, email: identity, password, confirmation }, registering)
    if (invalid) { setMessage(invalid); return }
    if (registering) {
      setRegistration({ name: name.trim(), email: identity.trim(), password })
      setPassword(''); setConfirmation('')
      navigate('/select-role')
      return
    }
    submitting.current = true; setBusy(true); setMessage('')
    try {
      if (!supabase) throw new Error('Auth unavailable')
      setRememberSession(remember)
      const { error } = await withTimeout(supabase.auth.signInWithPassword({ email: identity.trim(), password }))
      if (error) throw error
      setPassword('')
      await refresh()
    } catch (error) { setMessage(authErrorMessage(error)) }
    finally { submitting.current = false; setBusy(false) }
  }

  if (!busy && account.status === 'authenticated') {
    const destination = getAccountPath(account)
    if (!destination) return <AccountState />
    const applying = hasAuthorityIntent(account.user.email) || search.get('apply') === 'authority'
    return <Navigate to={destination === '/dashboard' && applying ? '/authority-application' : destination} replace />
  }
  if (!busy && account.status === 'loading') return <AccountState loading />

  return (
    <AuthLayout>
      <section className="auth-card" aria-labelledby="auth-title">
        <AuthLogo />
        <div className="auth-intro">
          <h1 id="auth-title" ref={headingRef} tabIndex={-1}>{registering ? 'Создайте аккаунт AitU' : 'Добро пожаловать в AitU'}</h1>
          <p>{registering ? 'Присоединяйтесь, чтобы делать город лучше' : 'Войдите, чтобы создавать обращения и следить за их статусом'}</p>
        </div>
        <form className="auth-form" onSubmit={submit} noValidate aria-busy={busy}>
          {registering && <div className="auth-field"><label htmlFor="auth-name">Имя</label><input id="auth-name" name="name" autoComplete="name" placeholder="Как вас зовут?" value={name} onChange={event => setName(event.target.value)} /></div>}
          <div className="auth-field"><label htmlFor="auth-identity">Email</label><input id="auth-identity" name="username" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="Введите email" value={identity} onChange={event => setIdentity(event.target.value)} /></div>
          <PasswordField key={registering ? 'register-password' : 'login-password'} id="auth-password" label="Пароль" value={password} onChange={event => setPassword(event.target.value)} autoComplete={registering ? 'new-password' : 'current-password'} />
          {registering && <PasswordField id="auth-confirm-password" label="Повторите пароль" value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="new-password" />}
          {!registering && <div className="auth-form-options"><label className="auth-remember"><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} /><span>Запомнить меня</span></label><button type="button" className="auth-text-button" onClick={() => setMessage('Восстановление пароля пока недоступно. Если вы забыли пароль, обратитесь в поддержку.')}>Забыли пароль?</button></div>}
          {message && <p className="auth-inline-message" role="alert"><Info size={18} /><span>{message}</span></p>}
          {account.status === 'unavailable' && !message && <p className="auth-inline-message" role="status">Не удалось проверить аккаунт. Попробуйте войти ещё раз.</p>}
          <button type="submit" className="auth-primary" disabled={busy}>{busy ? 'Входим…' : registering ? 'Продолжить' : 'Войти'}</button>
          <p className="auth-demo-note">{registering ? 'Пароль — не менее 8 символов. Тип аккаунта выберете на следующем шаге.' : 'Вход по email и паролю.'}</p>
        </form>
        <div className="auth-switch"><span>{registering ? 'Уже есть аккаунт?' : 'Нет аккаунта?'}</span><button type="button" className="auth-text-button" onClick={changeMode} disabled={busy}>{registering ? 'Войти' : 'Зарегистрироваться'}</button></div>
      </section>
    </AuthLayout>
  )
}
