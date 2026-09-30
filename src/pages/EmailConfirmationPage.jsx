import { Link, Navigate } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import AuthLayout, { AuthLogo } from '../components/auth/AuthLayout.jsx'
import { useAuth } from '../auth/context.js'
import { getAccountPath } from '../auth/access.js'

export default function EmailConfirmationPage() {
  const { confirmation, account } = useAuth()
  if (account.status === 'authenticated') return <Navigate to="/login" replace />
  if (!confirmation && getAccountPath(account) === null && account.status !== 'loading' && account.status !== 'anonymous') return <Navigate to="/login" replace />
  return <AuthLayout><section className="auth-card"><AuthLogo /><div className="auth-intro"><div className="auth-state-icon"><MailCheck size={32} /></div><h1>Проверьте почту</h1><p>Мы отправили письмо для подтверждения аккаунта{confirmation?.email ? ' на:' : ' на указанный email.'}</p>{confirmation?.email && <p className="auth-confirm-email">{confirmation.email}</p>}<p>После подтверждения вы сможете войти в AitU.{confirmation?.authority && ' Затем заполните заявку представителя госоргана.'}</p></div><Link className="auth-primary" to={confirmation?.authority ? '/login?apply=authority' : '/login'}>Вернуться ко входу</Link></section></AuthLayout>
}
