import { loadAccount } from './loadAccount.js'
import { withTimeout } from './actions.js'

const empty = { user: null, profile: null, application: null }

// One listener per provider. Generation checks discard work from old sessions.
export function createAccountStore(client, { loader = loadAccount, timeout = 15000 } = {}) {
  let snapshot = { ...empty, status: client ? 'loading' : 'unavailable' }
  let generation = 0, active = false, scheduled, subscription, currentToken
  const listeners = new Set()
  function publish(account) { snapshot = account; listeners.forEach(listener => listener()) }
  function clearScheduled() { clearTimeout(scheduled); scheduled = null }
  async function refresh(background = false) {
    clearScheduled()
    const version = ++generation
    if (!background) publish({ ...empty, status: 'loading' })
    let account
    try { account = await withTimeout(loader(client), timeout) } catch { account = { ...empty, status: 'unavailable' } }
    if (!active || version !== generation) return null
    if (account.status === 'unconfigured') account = { ...empty, status: 'unavailable' }
    publish(account)
    return account
  }
  function start() {
    active = true
    if (!client) { publish({ ...empty, status: 'unavailable' }); return () => { active = false } }
    subscription = client.auth.onAuthStateChange((event, session) => {
      if (!active) return
      if (event === 'SIGNED_OUT') {
        clearScheduled(); generation++; currentToken = null
        publish({ ...empty, status: 'anonymous' })
        return
      }
      if (session?.access_token === currentToken && snapshot.status === 'authenticated' && event === 'SIGNED_IN') return
      const sameUser = session?.user?.id && session.user.id === snapshot.user?.id
      currentToken = session?.access_token
      clearScheduled()
      generation++
      if (!sameUser) publish({ ...empty, status: 'loading' })
      // Never call/await another Supabase operation while its auth lock is held.
      scheduled = setTimeout(() => { void refresh(Boolean(sameUser)) }, 0)
    }).data.subscription
    void refresh()
    return () => { active = false; generation++; clearScheduled(); subscription.unsubscribe() }
  }
  return { start, refresh, getSnapshot: () => snapshot, subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) } }
}
