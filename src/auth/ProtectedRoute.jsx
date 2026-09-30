import { Navigate } from 'react-router-dom'
import { useAuth } from './context.js'
import { canEnterRoute, getAccountPath } from './access.js'
import AccountState from '../components/auth/AccountState.jsx'

export default function ProtectedRoute({ path, children }) {
  const { account } = useAuth()
  if (account.status === 'loading') return <AccountState loading />
  if (account.status === 'anonymous') return <Navigate to="/login" replace />
  const destination = getAccountPath(account)
  if (!destination) return <AccountState />
  if (!canEnterRoute(account, path)) return <Navigate to={destination} replace />
  return children
}
