import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Info, ShieldCheck } from 'lucide-react'
import AuthLayout, { AuthLogo } from '../components/auth/AuthLayout.jsx'
import { LogoutButton } from '../components/auth/AccountState.jsx'
import { useAuth } from '../auth/context.js'
import { authErrorMessage, submitAuthorityApplication, validateAuthorityApplication } from '../auth/actions.js'
import { clearAuthorityIntent } from '../auth/storage.js'
import { supabase } from '../lib/supabase.js'

export default function AuthorityApplicationPage() {
  const { refresh } = useAuth()
  const navigate = useNavigate()
  const [iin, setIin] = useState('')
  const [organization, setOrganization] = useState('')
  const [position, setPosition] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  async function submit(event) {
    event.preventDefault()
    if (submitting.current) return
    const invalid = validateAuthorityApplication({ iin, organization, position })
    if (invalid) { setError(invalid); return }
    submitting.current = true; setBusy(true); setError('')
    try {
      await submitAuthorityApplication(supabase, { iin, organization, position })
      setIin(''); clearAuthorityIntent()
      await refresh()
      navigate('/verification-pending', { replace: true })
    } catch (failure) {
      // Clear sensitive input even on errors, and never expose database payloads.
      setIin(''); setError(authErrorMessage(failure))
      if (failure?.code === '23505') await refresh()
    } finally { submitting.current = false; setBusy(false) }
  }
  return <AuthLayout><section className="auth-card"><AuthLogo /><div className="auth-intro"><div className="auth-state-icon"><ShieldCheck size={30} /></div><h1>Подтверждение представителя госоргана</h1><p>Заполните заявку для проверки доступа к панели госоргана.</p></div><form className="auth-form" onSubmit={submit} noValidate aria-busy={busy}>
    <div className="auth-field"><label htmlFor="application-iin">ИИН</label><input id="application-iin" type="password" inputMode="numeric" autoComplete="off" maxLength={12} placeholder="12 цифр" value={iin} onChange={event => setIin(event.target.value)} aria-describedby="iin-note" disabled={busy} /></div>
    <p className="auth-inline-message" id="iin-note"><Info size={18} /><span>ИИН используется только в заявке на подтверждение доступа. Сам по себе ИИН не подтверждает статус сотрудника.</span></p>
    <div className="auth-field"><label htmlFor="application-organization">Орган / служба</label><input id="application-organization" autoComplete="organization" maxLength={300} value={organization} onChange={event => setOrganization(event.target.value)} placeholder="Название органа или службы" disabled={busy} /></div>
    <div className="auth-field"><label htmlFor="application-position">Должность</label><input id="application-position" autoComplete="organization-title" maxLength={200} value={position} onChange={event => setPosition(event.target.value)} placeholder="Ваша должность" disabled={busy} /></div>
    {error && <p className="auth-inline-message" role="alert">{error}</p>}
    <button className="auth-primary" type="submit" disabled={busy}>{busy ? 'Отправляем…' : 'Отправить заявку'}</button>
  </form><div className="auth-switch"><LogoutButton className="auth-text-button" /></div></section></AuthLayout>
}
