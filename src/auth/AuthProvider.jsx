import { useEffect, useState, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { AuthContext } from './context.js'
import { createAccountStore } from './accountStore.js'
import { withTimeout } from './actions.js'
import { clearAuthorityIntent } from './storage.js'

export default function AuthProvider({ children }) {
  const [store] = useState(() => createAccountStore(supabase))
  const account = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const [registration, setRegistration] = useState(null)
  const [confirmation, setConfirmation] = useState(null)
  const { pathname } = useLocation()
  const [previousPath, setPreviousPath] = useState(pathname)
  useEffect(() => store.start(), [store])
  if (pathname !== previousPath) {
    setPreviousPath(pathname)
    // Registration passwords exist only in memory while moving between two steps.
    if (!['/login', '/select-role'].includes(pathname)) setRegistration(null)
    if (pathname !== '/confirm-email') setConfirmation(null)
  }

  async function signOut() {
    if (!supabase) throw new Error('Auth unavailable')
    const { error } = await withTimeout(supabase.auth.signOut({ scope: 'local' }))
    if (error) throw error
    setRegistration(null); setConfirmation(null); clearAuthorityIntent()
    await store.refresh()
  }
  return <AuthContext.Provider value={{ account, refresh: store.refresh, signOut, registration, setRegistration, confirmation, setConfirmation }}>{children}</AuthContext.Provider>
}
