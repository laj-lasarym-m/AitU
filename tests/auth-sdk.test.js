import test from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { loadAccount } from '../src/auth/loadAccount.js'
import { getAccountPath } from '../src/auth/access.js'
import { submitAuthorityApplication } from '../src/auth/actions.js'

// Exercise the installed SDK and actual account loader against an in-memory
// HTTP fixture. No accounts, applications, or personal data are sent remotely.
test('SDK login, restored session, application, review states and signOut integrate with account routing', async () => {
  const user = { id: '10000000-0000-4000-8000-000000000001', email: 'sdk-test@example.invalid', aud: 'authenticated', role: 'authenticated', identities: [] }
  const exp = Math.floor(Date.now() / 1000) + 3600
  const token = `${btoa(JSON.stringify({ alg: 'HS256' }))}.${btoa(JSON.stringify({ sub: user.id, exp, role: 'authenticated' }))}.test`
  const session = { access_token: token, refresh_token: 'fixture-refresh', expires_in: 3600, expires_at: exp, token_type: 'bearer', user }
  let profile = { id: user.id, full_name: 'SDK test', role: 'citizen', authority_status: null }
  let application = null, logoutCalls = 0, insertKeys
  const saved = new Map([['aitu-theme', 'dark']])
  const storage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) }
  function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }) }
  async function transport(input, init = {}) {
    const url = new URL(input)
    if (url.pathname.endsWith('/token')) return json(session)
    if (url.pathname.endsWith('/user')) return json(user)
    if (url.pathname.endsWith('/logout')) { logoutCalls++; assert.equal(url.searchParams.get('scope'), 'local'); return new Response(null, { status: 204 }) }
    if (url.pathname.endsWith('/profiles')) return json([profile])
    if (url.pathname.endsWith('/authority_applications')) {
      assert(!url.searchParams.get('select')?.split(',').includes('iin'))
      if (init.method === 'POST') {
        const fields = JSON.parse(init.body)
        insertKeys = Object.keys(fields).sort()
        application = { id: 'application-one', user_id: user.id, organization: fields.organization, position: fields.position, status: 'pending', reviewed_at: null }
        return json(application, 201)
      }
      return json(application ? [application] : [])
    }
    throw new Error('Unexpected SDK request')
  }
  const options = { global: { fetch: transport }, auth: { storage, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'sdk-test-auth' } }
  const first = createClient('https://sdk-test.invalid', 'sb_publishable_unit_test', options)
  const login = await first.auth.signInWithPassword({ email: user.email, password: 'unit-test-password' })
  assert.equal(login.error, null)
  assert.equal(getAccountPath(await loadAccount(first)), '/dashboard')

  const restored = createClient('https://sdk-test.invalid', 'sb_publishable_unit_test', options)
  assert.equal((await restored.auth.getSession()).data.session.user.id, user.id)
  assert.equal(getAccountPath(await loadAccount(restored)), '/dashboard')
  await submitAuthorityApplication(restored, { iin: '000000000000', organization: 'Test organization', position: 'Test position' })
  assert.deepEqual(insertKeys, ['iin', 'organization', 'position'])
  assert.equal(getAccountPath(await loadAccount(restored)), '/verification-pending')
  application = { ...application, status: 'rejected' }
  assert.equal(getAccountPath(await loadAccount(restored)), '/verification-status')
  application = { ...application, status: 'verified' }
  assert.equal(getAccountPath(await loadAccount(restored)), null)
  profile = { ...profile, role: 'authority', authority_status: 'verified' }
  assert.equal(getAccountPath(await loadAccount(restored)), '/authority')
  assert.equal((await restored.auth.signOut({ scope: 'local' })).error, null)
  assert.equal(logoutCalls, 1)
  assert.equal((await restored.auth.getSession()).data.session, null)
  assert.equal(getAccountPath(await loadAccount(restored)), '/login')
  assert.equal(saved.get('aitu-theme'), 'dark')
  await first.auth.stopAutoRefresh()
  await restored.auth.stopAutoRefresh()
})
