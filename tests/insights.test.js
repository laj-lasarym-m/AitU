import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { ownIdeas, requestAnalytics } from '../src/requests/insights.js'
import { mapRequest } from '../src/requests/model.js'

const row = (id, overrides = {}) => mapRequest({ id, user_id: 'owner', request_number: id, type: 'problem', status: 'new', category: 'Дороги', priority: null, title: id, description: 'Описание', ...overrides })
const rows = [row('1', { type: 'idea' }), row('2', { status: 'in_progress', priority: 'high' }), row('3', { status: 'resolved', category: null, priority: 'low' }), { ...row('demo'), source: 'demo' }]

test('Ideas include only authenticated owner real ideas, excluding problems, foreign owners and demo', () => {
  assert.deepEqual(ownIdeas([...rows, row('other', { type: 'idea', user_id: 'other' })], 'owner').map(r => r.id), ['1'])
  assert.deepEqual(ownIdeas(rows, undefined), [])
})
test('Analytics count real records by status/category/priority/type, including unset priority', () => {
  const data = requestAnalytics(rows)
  assert.equal(data.total, 3)
  assert.equal(data.statuses.new, 1); assert.equal(data.statuses.in_progress, 1); assert.equal(data.statuses.resolved, 1)
  assert.deepEqual(data.categories, [['Дороги', 2], ['Не указана', 1]])
  assert.deepEqual(data.priorities, { low: 1, medium: 0, high: 1, unknown: 1 })
  assert.deepEqual(data.types, { problem: 2, idea: 1 })
  assert.equal(requestAnalytics([]).total, 0)
})

test('Ideas and Analytics render real values, empty/loading/error states and existing submission link', async () => {
  const server = await createServer({ envDir: false, cacheDir: 'node_modules/.vite-insights-test', server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
  try {
    const Ideas = (await server.ssrLoadModule('/src/components/dashboard/ResidentIdeas.jsx')).default
    const Analytics = (await server.ssrLoadModule('/src/components/authority/RequestAnalytics.jsx')).default
    const render = (C, props) => renderToStaticMarkup(h(MemoryRouter, {}, h(C, props)))
    const empty = render(Ideas, { rows: [], userId: 'owner' })
    assert.match(empty, /У вас пока нет предложенных идей/)
    assert.match(empty, /href="\/\?type=idea#appeal-form"/)
    assert.match(render(Ideas, { rows, userId: 'owner' }), /Описание/)
    assert.match(render(Ideas, { rows, userId: 'owner', loading: true }), /Загружаем идеи/)
    assert.match(render(Analytics, { rows, error: 'Ошибка загрузки' }), /role="alert"/)
    const analytics = render(Analytics, { rows })
    assert.match(analytics, /Всего обращений/); assert.match(analytics, /Не определён/)
    assert.match(analytics, /66.66666666666666%/)
  } finally { await server.close() }
})

test('existing page navigation opens Ideas/Analytics, sets real mode and reuses idea details', async () => {
  const runtime = `
    let cells = [], index = 0;
    export const state = { enabled: null };
    export function reset() { cells = []; }
    export function render(C) { index = 0; return C(); }
    export function useState(initial) { const i = index++; if (!(i in cells)) cells[i] = initial; return [cells[i], value => { cells[i] = typeof value === 'function' ? value(cells[i]) : value; }]; }
    export function useRef(initial) { return useState({ current: initial })[0]; }
    export function useEffect() {}
    export function useCallback(callback) { return callback; }
    export function useAuth() { return { account: { user: { id: 'owner' } } }; }
    export function useCitizenNotifications() { return { rows: [], unreadCount: 0, refresh() {} }; }
    export default function useRequests(scope, enabled) { state.enabled = enabled; return { rows: [], loading: false, error: '', reload() {} }; }
  `
  const server = await createServer({ envDir: false, cacheDir: 'node_modules/.vite-insights-nav-test', server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', plugins: [{
    name: 'insights-navigation', enforce: 'pre',
    resolveId(id) { if (id === 'virtual:insights') return '\0insights' },
    load(id) { if (id === '\0insights') return runtime },
    transform(code, id) {
      if (/\/pages\/(DashboardPage|AuthorityPage)\.jsx$/.test(id.replaceAll('\\', '/'))) return code
        .replace("import useCitizenNotifications from '../requests/useCitizenNotifications.js'", "import { useCitizenNotifications } from 'virtual:insights'")
        .replace("from 'react'", "from 'virtual:insights'")
        .replace("from '../requests/useRequests.js'", "from 'virtual:insights'")
        .replace("from '../auth/context.js'", "from 'virtual:insights'")
    },
  }] })
  function find(node, name) {
    if (!node || typeof node !== 'object') return null
    if (Array.isArray(node)) return node.map(child => find(child, name)).find(Boolean)
    return node.type?.name === name ? node : find(node.props?.children, name)
  }
  try {
    const fixture = await server.ssrLoadModule('virtual:insights')
    for (const [page, sidebar, label, component] of [['DashboardPage', 'Sidebar', 'Идеи жителей', 'ResidentIdeas'], ['AuthorityPage', 'AuthoritySidebar', 'Аналитика', 'RequestAnalytics'], ['DashboardPage', 'Sidebar', 'Мои баллы', 'CitizenPoints'], ['DashboardPage', 'Sidebar', 'Уведомления', 'CitizenNotifications'], ['DashboardPage', 'Sidebar', 'AI-помощник', 'CitizenAssistant']]) {
      fixture.reset()
      const C = (await server.ssrLoadModule(`/src/pages/${page}.jsx`)).default
      let tree = fixture.render(C)
      find(tree, 'RequestDataControls').props.onMode('demo')
      tree = fixture.render(C)
      find(tree, sidebar).props.onNavigate(label)
      tree = fixture.render(C)
      assert.equal(fixture.state.enabled, component !== 'CitizenAssistant')
      assert.equal(find(tree, sidebar).props.active, label)
      const section = find(tree, component)
      assert.ok(section)
      if (!['CitizenNotifications', 'CitizenAssistant'].includes(component)) assert.deepEqual(section.props.rows, [])
      if (component === 'CitizenNotifications') assert.equal(section.props.notifications.unreadCount, 0)
      if (component === 'ResidentIdeas') {
        section.props.onOpen(rows[0])
        assert.equal(find(fixture.render(C), sidebar).props.active, 'Мои обращения')
      }
    }
  } finally { await server.close() }
})
