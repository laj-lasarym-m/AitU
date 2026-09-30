import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

// Execute the actual JSX event handlers with deterministic hook state and a
// mocked Supabase boundary. DOM effects are excluded; no live rows/files are made.
const runtime = `
export const state = { account: null, destination: null, client: null };
export const supabase = { auth: { getUser: (...a) => state.client.auth.getUser(...a) }, from: (...a) => state.client.from(...a), storage: { from: (...a) => state.client.storage.from(...a) } };
const scopes = new Map(); let cells, index;
export function render(Component, props, scope) { if (!scopes.has(scope)) scopes.set(scope, []); cells = scopes.get(scope); index = 0; return Component(props); }
export function useState(initial) { const target = cells, i = index++; if (!(i in target)) target[i] = typeof initial === 'function' ? initial() : initial; return [target[i], value => { target[i] = typeof value === 'function' ? value(target[i]) : value; }]; }
export function useRef(value) { return useState(() => ({ current: value }))[0]; }
export function useEffect() {}
export function useId() { return 'test-dialog'; }
export function useAuth() { return { account: state.account }; }
export function useNavigate() { return path => { state.destination = path; }; }
export function useLocation() { return { search: state.search || '' }; }
`

function find(node, predicate) {
  if (!node || typeof node !== 'object') return null
  if (Array.isArray(node)) { for (const child of node) { const match = find(child, predicate); if (match) return match } return null }
  return predicate(node) ? node : find(node.props?.children, predicate)
}

test('authenticated landing Continue reaches real request/photo helpers once; guests save text without uploads', async () => {
  const server = await createServer({
    envDir: false, cacheDir: 'node_modules/.vite-landing-test', appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false },
    plugins: [{
      name: 'landing-handler-fixture', enforce: 'pre',
      resolveId(id) { if (id === 'virtual:landing-fixture') return '\0landing-fixture' },
      load(id) { if (id === '\0landing-fixture') return runtime },
      transform(code, id) {
        const path = id.replaceAll('\\', '/')
        if (path.endsWith('/components/LandingForm.jsx') || path.endsWith('/components/requests/CreateRequestDialog.jsx')) {
          return code.replace(/from 'react'/g, "from 'virtual:landing-fixture'")
            .replace(/from 'react-router-dom'/g, "from 'virtual:landing-fixture'")
            .replace(/from '\.\.\/auth\/context\.js'/g, "from 'virtual:landing-fixture'")
        }
        if (path.endsWith('/requests/api.js') || path.endsWith('/requests/photos.js')) return code.replace("from '../lib/supabase.js'", "from 'virtual:landing-fixture'")
      },
    }],
  })
  const previousWindow = globalThis.window
  const saved = new Map()
  globalThis.window = { sessionStorage: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) } }
  try {
    const { state, render } = await server.ssrLoadModule('virtual:landing-fixture')
    const { default: LandingForm } = await server.ssrLoadModule('/src/components/LandingForm.jsx')
    const owner = '10000000-0000-4000-8000-000000000001', id = '20000000-0000-4000-8000-000000000002'
    state.account = { status: 'authenticated', user: { id: owner }, profile: { id: owner, role: 'citizen' }, application: null }
    let inserts = 0, uploads = 0, metadata = 0
    const order = []
    const file = { name: 'photo.jpg', type: 'image/jpeg', size: 100 }
    state.client = {
      auth: { getUser: async () => ({ data: { user: { id: owner } }, error: null }) },
      from(table) {
        let payload
        const query = {
          insert(value) { payload = value; return query }, select() { return query },
          async single() {
            if (table === 'requests') {
              inserts++; order.push('request')
              assert.equal(payload.description, 'Нужно починить фонарь')
              assert.equal(payload.latitude, 50.411)
              assert.equal(payload.longitude, 80.2275)
              assert(!Object.hasOwn(payload, 'user_id'))
              return { data: { ...payload, id, request_number: 'A-101', user_id: owner, status: 'new', created_at: '2026-09-30T10:00:00Z', updated_at: '2026-09-30T10:00:00Z' }, error: null }
            }
            assert.equal(table, 'request_photos'); metadata++; order.push('metadata')
            assert.equal(payload.request_id, id)
            return { data: { ...payload, id: 'photo-id', kind: 'citizen' }, error: null }
          },
        }
        return query
      },
      storage: { from(bucket) { assert.equal(bucket, 'request-photos'); return { async upload(path, actualFile) {
        uploads++; order.push('upload'); assert.equal(actualFile, file); assert(path.startsWith(owner + '/' + id + '/'))
        return { data: { path }, error: null }
      } } } },
    }
    const notices = [], props = { inputRef: { current: null }, onNotice: text => notices.push(text) }
    const event = { preventDefault() {} }
    let tree = render(LandingForm, props, 'citizen')
    find(tree, node => node.type === 'textarea').props.onChange({ target: { value: 'Нужно починить фонарь' } })
    find(tree, node => node.type === 'input' && node.props.type === 'file').props.onChange({ target: { files: [file], value: 'file' } })
    tree = render(LandingForm, props, 'citizen')
    const continueHandler = find(tree, node => node.type === 'form').props.onSubmit
    continueHandler(event); continueHandler(event)
    tree = render(LandingForm, props, 'citizen')
    const dialog = find(tree, node => typeof node.type === 'function' && node.type.name === 'CreateRequestDialog')
    assert(dialog, 'Continue must open the existing real request dialog')
    assert.deepEqual(dialog.props.files, [file])
    assert.equal(inserts, 0, 'Continue opens review; only its confirmation creates a request')
    let review = render(dialog.type, dialog.props, 'review')
    const picker = find(review, node => typeof node.type === 'function' && node.type.name === 'LocationPicker')
    assert(picker, 'Existing review dialog must expose the location picker')
    picker.props.onChange({ latitude: 50.4, longitude: 80.2 })
    picker.props.onChange({ latitude: 50.411, longitude: 80.2275 })
    assert.equal(inserts, 0, 'Map interactions cannot create requests')
    review = render(dialog.type, dialog.props, 'review')
    const submit = find(review, node => node.type === 'form').props.onSubmit
    await Promise.all([submit(event), submit(event)])
    assert.deepEqual(order, ['request', 'upload', 'metadata'])
    assert.equal(inserts, 1); assert.equal(uploads, 1); assert.equal(metadata, 1)
    assert.equal(state.destination, '/dashboard')
    assert.deepEqual(notices, [], 'Citizen must never hit the old placeholder or a guest branch')
    assert(!notices.some(text => text.includes('Отправка обращений появится позже')))

    state.search = '?type=idea'
    tree = render(LandingForm, props, 'idea')
    assert.equal(find(tree, node => node.type === 'button' && node.props.children === 'Идея').props['aria-pressed'], true)
    find(tree, node => node.type === 'textarea').props.onChange({ target: { value: 'Идея для города' } })
    tree = render(LandingForm, props, 'idea')
    find(tree, node => node.type === 'form').props.onSubmit(event)
    const ideaDialog = find(render(LandingForm, props, 'idea'), node => node.type === dialog.type)
    assert.equal(ideaDialog.props.type, 'idea')
    assert.equal(ideaDialog.props.description, 'Идея для города')
    state.search = ''

    state.account = { status: 'anonymous', user: null, profile: null, application: null }
    state.destination = null
    tree = render(LandingForm, props, 'guest')
    find(tree, node => node.type === 'textarea').props.onChange({ target: { value: 'Гостевой черновик' } })
    find(tree, node => node.type === 'input' && node.props.type === 'file').props.onChange({ target: { files: [file], value: 'file' } })
    tree = render(LandingForm, props, 'guest')
    find(tree, node => node.type === 'form').props.onSubmit(event)
    assert.equal(state.destination, '/login')
    assert.equal(JSON.parse(saved.get('aitu-request-draft')).description, 'Гостевой черновик')
    assert(!saved.get('aitu-request-draft').includes('photo.jpg'))
    assert.equal(inserts, 1); assert.equal(uploads, 1)
    assert.equal(find(render(LandingForm, props, 'guest'), node => typeof node.type === 'function' && node.type.name === 'CreateRequestDialog'), null)
  } finally { globalThis.window = previousWindow; await server.close() }
})
