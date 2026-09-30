import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'

test('actual page components and guards render correctly for each account state in both themes', async () => {
  const server = await createServer({ envDir: false, server: { middlewareMode: true }, appType: 'custom' })
  const previousWindow = globalThis.window
  try {
    const { AuthContext } = await server.ssrLoadModule('/src/auth/context.js')
    const { default: Guard } = await server.ssrLoadModule('/src/auth/ProtectedRoute.jsx')
    const components = {}
    for (const name of ['LandingRoute', 'LoginPage', 'RoleSelectionPage', 'DashboardPage', 'AuthorityPage', 'VerificationPage', 'AuthorityApplicationPage', 'EmailConfirmationPage']) {
      components[name] = (await server.ssrLoadModule('/src/pages/' + name + '.jsx')).default
    }
    const user = { id: 'user-one', email: 'render-test@example.invalid' }
    const citizen = { status: 'authenticated', user, profile: { id: user.id, role: 'citizen', full_name: 'Test' }, application: null }
    const pending = { ...citizen, application: { user_id: user.id, status: 'pending', organization: 'Test organization' } }
    const rejected = { ...pending, application: { ...pending.application, status: 'rejected' } }
    const authority = { ...citizen, profile: { ...citizen.profile, role: 'authority', authority_status: 'verified' } }
    const anonymous = { status: 'anonymous', user: null, profile: null, application: null }
    function render(name, account, route, { protectedRoute = false, props = {}, ...context } = {}) {
      let content = createElement(components[name], props)
      if (protectedRoute) content = createElement(Guard, { path: route }, content)
      return renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [route] },
        createElement(AuthContext.Provider, { value: { account, refresh: async () => account, signOut: async () => {}, registration: null, setRegistration() {}, setConfirmation() {}, ...context } }, content)))
    }
    for (const theme of ['light', 'dark']) {
      globalThis.window = { localStorage: { getItem: key => key === 'aitu-theme' ? theme : null }, sessionStorage: { getItem: () => null }, matchMedia: () => ({ matches: false }) }
      assert.match(render('LandingRoute', anonymous, '/'), /Город меняется/)
      assert.match(render('LoginPage', anonymous, '/login'), /auth-password/)
      assert.match(render('RoleSelectionPage', anonymous, '/select-role', { registration: { email: user.email, name: 'Test', password: 'not-persisted' } }), /auth-role-authority/)
      assert.equal(render('RoleSelectionPage', anonymous, '/select-role'), '') // Redirect, no role bypass.
      assert.match(render('DashboardPage', citizen, '/dashboard', { protectedRoute: true }), /Мои обращения/)
      assert.match(render('AuthorityPage', authority, '/authority', { protectedRoute: true }), /Все обращения/)
      assert.match(render('VerificationPage', pending, '/verification-pending', { protectedRoute: true }), /Заявка отправлена/)
      assert.match(render('VerificationPage', rejected, '/verification-status', { protectedRoute: true, props: { rejected: true } }), /Доступ не подтверждён/)
      assert.match(render('AuthorityApplicationPage', citizen, '/authority-application', { protectedRoute: true }), /type="password"/)
      assert.match(render('EmailConfirmationPage', anonymous, '/confirm-email', { confirmation: { email: user.email, authority: true } }), /render-test@example.invalid/)
      for (const [name, route] of [['DashboardPage', '/dashboard'], ['AuthorityPage', '/authority'], ['VerificationPage', '/verification-pending'], ['VerificationPage', '/verification-status']]) {
        assert.equal(render(name, anonymous, route, { protectedRoute: true }), '')
        const loading = render(name, { status: 'loading' }, route, { protectedRoute: true })
        assert.match(loading, /Загружаем аккаунт/)
        assert.doesNotMatch(loading, /auth-password/)
        assert.match(render(name, { status: 'unavailable' }, route, { protectedRoute: true }), /Попробовать снова/)
      }
      assert.equal(render('AuthorityPage', citizen, '/authority', { protectedRoute: true }), '')
      assert.equal(render('DashboardPage', pending, '/dashboard', { protectedRoute: true }), '')
      assert.equal(render('DashboardPage', rejected, '/dashboard', { protectedRoute: true }), '')
    }
  } finally { globalThis.window = previousWindow; await server.close() }
})
