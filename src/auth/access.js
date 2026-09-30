// Navigation guidance only. Database RLS is the actual security boundary.
// Never pass a role selected in the UI, localStorage, or user_metadata here.
export function canAccessRole(user, profile, role) {
  if (!user?.id || profile?.id !== user.id) return false
  if (role === 'citizen') return profile.role === 'citizen'
  if (role === 'authority') return profile.role === 'authority' && profile.authority_status === 'verified'
  return false
}

export function getAccountDestination({ status, user, profile, application }) {
  if (status === 'anonymous') return 'login'
  if (status !== 'authenticated' || !user?.id || profile?.id !== user.id) return 'unavailable'
  if (canAccessRole(user, profile, 'authority')) return 'authority'
  if (application && application.user_id !== user.id) return 'unavailable'
  if (application?.status === 'pending') return 'verification-pending'
  if (application?.status === 'rejected') return 'verification-status'
  // A review/profile mismatch never grants a dashboard or invents a status.
  if (application || profile.role === 'authority') return 'unavailable'
  return canAccessRole(user, profile, 'citizen') ? 'dashboard' : 'unavailable'
}

export function getAccountPath(account) {
  const destination = getAccountDestination(account)
  return destination === 'unavailable' ? null : `/${destination}`
}

export function canEnterRoute(account, path) {
  const destination = getAccountPath(account)
  return destination === path || (path === '/authority-application' && destination === '/dashboard')
}
