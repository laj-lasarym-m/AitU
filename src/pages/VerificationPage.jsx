import { Link } from 'react-router-dom'
import { Clock3, ShieldX } from 'lucide-react'
import AuthLayout, { AuthLogo } from '../components/auth/AuthLayout.jsx'
import { LogoutButton } from '../components/auth/AccountState.jsx'
import { useAuth } from '../auth/context.js'

export default function VerificationPage({ rejected = false }) {
  const { account, refresh } = useAuth()
  const Icon = rejected ? ShieldX : Clock3
  return <AuthLayout><section className="auth-card"><AuthLogo /><div className="auth-intro"><div className="auth-state-icon"><Icon size={32} /></div><h1>{rejected ? 'Доступ не подтверждён' : 'Заявка отправлена'}</h1><p>{rejected ? 'Заявка на доступ к панели госоргана не была подтверждена.' : 'Данные представителя госоргана проходят проверку. После подтверждения вам станет доступна панель госоргана.'}</p></div><dl className="auth-verification-info"><div><dt>Статус</dt><dd>{rejected ? 'Не подтверждён' : 'На проверке'}</dd></div>{account.application?.organization && <div><dt>Орган</dt><dd>{account.application.organization}</dd></div>}</dl><div className="auth-state-actions"><LogoutButton /><button type="button" className="auth-text-button" onClick={() => refresh()}>Обновить статус</button><Link className="auth-login-back" to="/">Вернуться на главную</Link></div></section></AuthLayout>
}
