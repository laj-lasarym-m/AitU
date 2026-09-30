import test from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { getAccountPath, canEnterRoute } from '../src/auth/access.js'
import { createAccountStore } from '../src/auth/accountStore.js'
import { registerAccount, submitAuthorityApplication, validateCredentials, validateAuthorityApplication, authErrorMessage } from '../src/auth/actions.js'
import { authStorage, setRememberSession, rememberAuthorityIntent, hasAuthorityIntent, clearAuthorityIntent } from '../src/auth/storage.js'

const user = { id: 'user-one', email: 'unit-test@example.invalid' }
const citizen = { status: 'authenticated', user, profile: { id: user.id, role: 'citizen', authority_status: null }, application: null }
const applicant = status => ({ ...citizen, application: { user_id: user.id, status, organization: 'Test organization' } })
const authority = { ...citizen, profile: { ...citizen.profile, role: 'authority', authority_status: 'verified' } }
const anonymous = { status: 'anonymous', user: null, profile: null, application: null }
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }

function authEvents() {
  const listeners = new Set()
  return {
    auth: { onAuthStateChange: listener => { listeners.add(listener); return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } } } },
    emit: (event, session) => listeners.forEach(listener => listener(event, session)),
    listenerCount: () => listeners.size,
  }
}

test('all route decisions come from the authenticated database account', () => {
  for (const [account, path] of [[anonymous, '/login'], [citizen, '/dashboard'], [applicant('pending'), '/verification-pending'], [applicant('rejected'), '/verification-status'], [authority, '/authority']]) {
    assert.equal(getAccountPath(account), path)
    for (const protectedPath of ['/dashboard', '/authority', '/verification-pending', '/verification-status']) {
      assert.equal(canEnterRoute(account, protectedPath), protectedPath === path)
    }
  }
  assert.equal(canEnterRoute(citizen, '/authority-application'), true)
  assert.equal(canEnterRoute(applicant('pending'), '/authority-application'), false)
  assert.equal(canEnterRoute(anonymous, '/authority-application'), false)
  assert.equal(getAccountPath({ ...citizen, application: { user_id: 'different-user', status: 'pending' } }), null)
  assert.equal(getAccountPath({ ...authority, profile: { ...authority.profile, authority_status: 'rejected' } }), null)
})

test('refresh holds loading until the session AND database profile resolve', async () => {
  const result = deferred(), client = authEvents()
  const store = createAccountStore(client, { loader: () => result.promise })
  const stop = store.start()
  try {
    assert.equal(store.getSnapshot().status, 'loading')
    assert.equal(getAccountPath(store.getSnapshot()), null) // Must NOT prematurely return /login.
    result.resolve(authority)
    await delay(0)
    assert.equal(getAccountPath(store.getSnapshot()), '/authority')
  } finally { stop() }
})

test('sign-out invalidates an in-flight profile response', async () => {
  const result = deferred(), client = authEvents()
  const store = createAccountStore(client, { loader: () => result.promise })
  const stop = store.start()
  client.emit('SIGNED_OUT', null)
  result.resolve(authority)
  await delay(0)
  assert.equal(getAccountPath(store.getSnapshot()), '/login')
  stop()
})

test('session changes never run Supabase requests inside the auth callback', async () => {
  const client = authEvents()
  let calls = 0
  const store = createAccountStore(client, { loader: async () => { calls++; return citizen } })
  const stop = store.start()
  await delay(0)
  const before = calls
  client.emit('SIGNED_IN', { access_token: 'different-token', user })
  assert.equal(calls, before)
  await delay(5)
  assert(calls > before)
  assert.equal(getAccountPath(store.getSnapshot()), '/dashboard')
  stop()
  assert.equal(client.listenerCount(), 0)
})

test('StrictMode cleanup and remount keep one listener and ignore stale results', async () => {
  const first = deferred(), second = deferred(), client = authEvents()
  let calls = 0
  const store = createAccountStore(client, { loader: () => (++calls === 1 ? first : second).promise })
  const stopFirst = store.start()
  stopFirst()
  const stopSecond = store.start()
  assert.equal(client.listenerCount(), 1)
  first.resolve(authority)
  await delay(0)
  assert.equal(store.getSnapshot().status, 'loading')
  second.resolve(citizen)
  await delay(0)
  assert.equal(getAccountPath(store.getSnapshot()), '/dashboard')
  stopSecond()
  assert.equal(client.listenerCount(), 0)
})

test('unavailable or hanging Supabase requests end in a recoverable error', async () => {
  const pending = deferred(), client = authEvents()
  let fail = true
  const store = createAccountStore(client, { timeout: 10, loader: () => fail ? pending.promise : Promise.resolve(citizen) })
  const stop = store.start()
  await delay(25)
  assert.equal(store.getSnapshot().status, 'unavailable')
  assert.equal(getAccountPath(store.getSnapshot()), null)
  fail = false
  await store.refresh()
  assert.equal(getAccountPath(store.getSnapshot()), '/dashboard')
  pending.resolve(authority)
  await delay(0)
  assert.equal(getAccountPath(store.getSnapshot()), '/dashboard')
  stop()
})

test('citizen and authority signup send only safe metadata and handle both confirmation modes', async () => {
  for (const authorityChoice of [false, true]) {
    for (const session of [null, { access_token: 'test-session' }]) {
      let payload
      const client = { auth: { signUp: async input => { payload = input; return { data: { user: { ...user, identities: [{}] }, session }, error: null } } } }
      const data = await registerAccount(client, { name: ' Test User ', email: ' unit-test@example.invalid ', password: 'unit-test-password', role: 'authority', authority_status: 'verified' }, authorityChoice, 'http://localhost:5173')
      assert.deepEqual(payload.options.data, { full_name: 'Test User' })
      assert.equal(payload.options.emailRedirectTo, 'http://localhost:5173/login' + (authorityChoice ? '?apply=authority' : ''))
      assert.equal(data.session, session)
      assert.equal(payload.email, user.email)
    }
  }
})

test('signup rejects duplicate accounts and shows a friendly error', async () => {
  const client = { auth: { signUp: async () => ({ data: { user: { identities: [] }, session: null } }) } }
  await assert.rejects(registerAccount(client, { name: 'Test', email: user.email, password: 'unit-test-password' }, false, 'http://localhost:5173'), error => error.code === 'user_already_exists')
  assert(!authErrorMessage({ message: 'sensitive raw input' }).includes('sensitive'))
})

test('application insert cannot promote users, set review fields, or return IIN', async () => {
  let payload, selection
  const client = { from: table => {
    assert.equal(table, 'authority_applications')
    return { insert: fields => { payload = fields; return { select: columns => { selection = columns; return { single: async () => ({ data: { user_id: user.id, status: 'pending' }, error: null }) } } } } }
  } }
  const fields = { iin: '000000000000', organization: ' Test ', position: ' Employee ', status: 'verified', reviewed_at: 'spoofed', user_id: 'other-user', role: 'authority' }
  const result = await submitAuthorityApplication(client, fields)
  assert.deepEqual(Object.keys(payload).sort(), ['iin', 'organization', 'position'])
  assert.equal(payload.organization, 'Test')
  assert(!selection.includes('iin'))
  assert.equal(result.status, 'pending')
})

test('registration and IIN validation reject missing or malformed fields', () => {
  const valid = { name: 'Test', email: user.email, password: 'unit-test-password', confirmation: 'unit-test-password' }
  assert.equal(validateCredentials(valid, true), '')
  for (const changes of [{ email: 'invalid' }, { name: '' }, { password: 'short' }, { confirmation: 'different' }]) assert(validateCredentials({ ...valid, ...changes }, true))
  for (const iin of ['', '123', 'abcdefgh1234', '0000000000000']) assert(validateAuthorityApplication({ iin, organization: 'Test', position: 'Test' }))
  assert.equal(validateAuthorityApplication({ iin: '000000000000', organization: 'Test', position: 'Test' }), '')
})

function memoryStorage() {
  const data = new Map()
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }
}

test('remember-me storage restores sessions but never resurrects removed tokens or clears theme', () => {
  const previous = globalThis.window
  globalThis.window = { localStorage: memoryStorage(), sessionStorage: memoryStorage() }
  try {
    window.localStorage.setItem('aitu-theme', 'dark')
    setRememberSession(false); authStorage.setItem('test-auth-token', 'session-token')
    assert.equal(window.localStorage.getItem('test-auth-token'), null)
    assert.equal(authStorage.getItem('test-auth-token'), 'session-token')
    window.sessionStorage.removeItem('test-auth-token')
    assert.equal(authStorage.getItem('test-auth-token'), null)
    setRememberSession(true); authStorage.setItem('test-auth-token', 'persistent-token')
    assert.equal(window.localStorage.getItem('test-auth-token'), 'persistent-token')
    authStorage.removeItem('test-auth-token')
    assert.equal(authStorage.getItem('test-auth-token'), null)
    assert.equal(window.localStorage.getItem('aitu-theme'), 'dark')
    rememberAuthorityIntent(user.email)
    assert.equal(hasAuthorityIntent(user.email), true)
    assert.equal(hasAuthorityIntent('another@example.invalid'), false)
    clearAuthorityIntent()
    assert.equal(hasAuthorityIntent(user.email), false)
  } finally { globalThis.window = previous }
})
