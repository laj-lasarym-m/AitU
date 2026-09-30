import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LoaderCircle, ShieldAlert, LogOut } from 'lucide-react'
import AuthLayout, { AuthLogo } from './AuthLayout.jsx'
import { useAuth } from '../../auth/context.js'
import { authErrorMessage } from '../../auth/actions.js'

export function LogoutButton({ className = 'auth-primary', onError, children = 'Выйти из аккаунта' }) {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function logout() {
    if (busy) return
    setBusy(true); setError('')
    try { await signOut(); navigate('/login', { replace: true }) }
    catch (failure) { const message = authErrorMessage(failure); setError(message); onError?.(message) }
    finally { setBusy(false) }
  }
  return <><button type="button" className={className} onClick={logout} disabled={busy}><LogOut size={17} /><span>{busy ? 'Выходим…' : children}</span></button>{error && !onError && <p className="auth-inline-message" role="alert">{error}</p>}</>
}

export default function AccountState({ loading = false }) {
  const { refresh } = useAuth()
  return <AuthLayout><section className="auth-card"><AuthLogo /><div className="auth-intro"><div className="auth-state-icon">{loading ? <LoaderCircle size={30} /> : <ShieldAlert size={30} />}</div><h1>{loading ? 'Загружаем аккаунт' : 'Не удалось загрузить аккаунт'}</h1><p role="status">{loading ? 'Проверяем данные и доступ…' : 'Проверьте соединение и попробуйте ещё раз. Доступ откроется после проверки данных аккаунта.'}</p></div>{!loading && <div className="auth-state-actions"><button className="auth-primary" onClick={() => refresh()}>Попробовать снова</button><LogoutButton className="auth-text-button" /><Link className="auth-login-back" to="/">На главную</Link></div>}</section></AuthLayout>
}
