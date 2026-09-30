import test from 'node:test'
import assert from 'node:assert/strict'
import { canAccessRole, getAccountDestination } from '../src/auth/access.js'
import { loadAccount, APPLICATION_COLUMNS } from '../src/auth/loadAccount.js'
import { createSupabaseConfiguration, supabase } from '../src/lib/supabase.js'

const user = { id: 'user-a', user_metadata: { role: 'authority', authority_status: 'verified' } }
const citizen = { id: user.id, role: 'citizen', authority_status: null }
const verified = { id: user.id, role: 'authority', authority_status: 'verified' }

test('only the matching authenticated verified authority profile can enter authority', () => {
  for (const role of ['citizen', 'authority', 'admin', undefined]) {
    for (const authority_status of [null, 'pending', 'rejected', 'verified']) {
      assert.equal(canAccessRole(user, { id: user.id, role, authority_status }, 'authority'), role === 'authority' && authority_status === 'verified')
    }
  }
  assert.equal(canAccessRole(null, verified, 'authority'), false)
  assert.equal(canAccessRole({ id: 'user-b' }, verified, 'authority'), false)
  assert.equal(canAccessRole(user, null, 'authority'), false)
  assert.equal(canAccessRole(user, citizen, 'authority'), false) // Ignore spoofed signup metadata.
  assert.equal(canAccessRole(user, citizen, 'citizen'), true)
  assert.equal(canAccessRole(user, verified, 'citizen'), false)
  assert.equal(canAccessRole(user, verified, 'unknown-role'), false)
})

test('applications lead to database-driven verification states, never authority by themselves', () => {
  for (const status of ['pending', 'rejected', 'verified']) {
    const account = { status: 'authenticated', user, profile: citizen, application: { user_id: user.id, status } }
    assert.equal(getAccountDestination(account), status === 'pending' ? 'verification-pending' : status === 'rejected' ? 'verification-status' : 'unavailable')
    assert.equal(canAccessRole(account.user, account.profile, 'authority'), false)
  }
  assert.equal(getAccountDestination({ status: 'authenticated', user, profile: verified }), 'authority')
  assert.equal(getAccountDestination({ status: 'authenticated', user, profile: citizen }), 'dashboard')
  assert.equal(getAccountDestination({ status: 'authenticated', user, profile: { ...verified, authority_status: 'pending' } }), 'unavailable')
})

test('missing configuration is explicit; failures never turn into demo authorization', () => {
  assert.equal(getAccountDestination({ status: 'unconfigured' }), 'unavailable')
  assert.equal(getAccountDestination({ status: 'anonymous' }), 'login')
  for (const status of ['loading', 'unavailable', undefined]) {
    assert.equal(getAccountDestination({ status, user, profile: verified }), 'unavailable')
  }
  assert.equal(getAccountDestination({ status: 'authenticated', user, profile: { ...verified, id: 'other-user' } }), 'unavailable')
})

test('client is optional without environment and rejects invalid/server configuration', async () => {
  assert.equal(supabase, null) // This test deliberately runs without Vite env injection.
  assert.deepEqual(createSupabaseConfiguration(), { client: null, status: 'unconfigured' })
  for (const env of [
    { VITE_SUPABASE_URL: 'https://example.invalid' },
    { VITE_SUPABASE_ANON_KEY: 'sb_publishable_example' },
    { VITE_SUPABASE_URL: 'invalid', VITE_SUPABASE_ANON_KEY: 'sb_publishable_example' },
    { VITE_SUPABASE_URL: 'https://example.invalid', VITE_SUPABASE_ANON_KEY: 'sb_secret_example' },
    { VITE_SUPABASE_URL: 'https://example.invalid', VITE_SUPABASE_ANON_KEY: `header.${btoa(JSON.stringify({ role: 'service_role' }))}.signature` },
  ]) assert.deepEqual(createSupabaseConfiguration(env), { client: null, status: 'invalid' })
  assert.equal((await loadAccount()).status, 'unconfigured')
})

function mockClient({ profile = citizen, application = null, profileError = null, applicationError = null, authError = null, currentUser = user } = {}) {
  const queries = []
  return {
    queries,
    auth: { getUser: async () => ({ data: { user: currentUser }, error: authError }) },
    from(table) {
      return { select(columns) {
        return { eq(column, value) {
          queries.push({ table, columns, column, value })
          return { maybeSingle: async () => table === 'profiles' ? { data: profile, error: profileError } : { data: application, error: applicationError } }
        } }
      } }
    },
  }
}

test('account loader reads only the current user and never fetches IIN', async () => {
  const client = mockClient({ profile: verified })
  const account = await loadAccount(client)
  assert.equal(account.status, 'authenticated')
  assert.equal(getAccountDestination(account), 'authority')
  assert.equal(client.queries.length, 2)
  for (const query of client.queries) {
    assert.equal(query.value, user.id)
    assert(!query.columns.includes('*'))
    assert(!query.columns.split(',').includes('iin'))
  }
  assert(!APPLICATION_COLUMNS.split(',').includes('iin'))
})

test('no session is anonymous; schema, network and profile failures fail closed', async () => {
  assert.equal((await loadAccount(mockClient({ currentUser: null }))).status, 'anonymous')
  assert.equal((await loadAccount(mockClient({ authError: { name: 'AuthSessionMissingError' } }))).status, 'anonymous')
  for (const options of [
    { authError: { name: 'NetworkError', message: 'do not expose this' } },
    { profile: null },
    { profile: { ...verified, id: 'other-user' } },
    { profileError: { message: 'missing table' } },
    { applicationError: { message: 'missing table' } },
  ]) {
    const account = await loadAccount(mockClient(options))
    assert.deepEqual(account, { status: 'unavailable', user: null, profile: null, application: null })
    assert.equal(getAccountDestination(account), 'unavailable')
  }
  assert.equal((await loadAccount({ auth: { getUser: async () => { throw new Error('offline') } } })).status, 'unavailable')
})
