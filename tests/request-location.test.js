import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { hasCoordinates, locationPayload, locatedRequests } from '../src/requests/location.js'
import { createRequestPayload, fetchRequests, workflowPayload } from '../src/requests/api.js'
import { mapRequest } from '../src/requests/model.js'
import { demoRequests } from '../src/data/requests.js'

const row = { id: 'request-uuid', request_number: 'A-103', user_id: 'citizen-a', type: 'problem', title: 'Фонарь', description: 'Не работает', status: 'new', category: 'Освещение', address: 'ул. Абая', created_at: '2026-09-30T10:00:00Z', updated_at: '2026-09-30T10:00:00Z', latitude: 50.411, longitude: 80.2275 }

test('coordinate pairs accept zero and boundaries, reject non-finite/out-of-range/incomplete values', () => {
  for (const [latitude, longitude] of [[0, 0], [-90, -180], [90, 180], [50.411, 80.2275]]) {
    assert(hasCoordinates({ latitude, longitude }))
    assert.deepEqual(locationPayload({ latitude, longitude }), { latitude, longitude })
  }
  for (const value of [{ latitude: 91, longitude: 0 }, { latitude: 0, longitude: -181 }, { latitude: NaN, longitude: 1 }, { latitude: 1, longitude: Infinity }, { latitude: '50', longitude: 80 }, { latitude: 0 }, { longitude: 0 }, { latitude: null, longitude: 0 }]) {
    assert.equal(hasCoordinates(value), false)
    assert.throws(() => locationPayload(value), { code: 'VALIDATION' })
  }
  assert.equal(hasCoordinates(null), false)
  assert.deepEqual(locationPayload({}), {})
  assert.deepEqual(locationPayload({ latitude: null, longitude: null }), {})
})

test('the existing create payload carries optional coordinates; workflow updates never do', () => {
  const input = { type: 'problem', title: 'Фонарь', description: 'Не работает', address: 'Мой адрес' }
  assert.deepEqual(createRequestPayload({ ...input, latitude: 0, longitude: 0 }), { ...input, category: null, latitude: 0, longitude: 0 })
  assert(!Object.hasOwn(createRequestPayload(input), 'latitude'))
  assert(!Object.hasOwn(createRequestPayload({ ...input, latitude: null, longitude: null }), 'longitude'))
  assert.deepEqual(workflowPayload({ status: 'in_progress', latitude: 1, longitude: 2 }), { status: 'in_progress' })
  assert.throws(() => createRequestPayload({ ...input, latitude: 91, longitude: 0 }), { code: 'VALIDATION' })
})

test('legacy A-101/A-102 remain without invented coordinates; demo rows never enter real maps', () => {
  for (const request_number of ['A-101', 'A-102']) {
    const request = mapRequest({ ...row, request_number, latitude: undefined, longitude: null })
    assert.equal(request.latitude, null)
    assert.equal(request.longitude, null)
    assert.equal(hasCoordinates(request), false)
    assert.equal(request.title, row.title)
  }
  const located = mapRequest(row)
  const fakeDemo = { ...demoRequests[0], latitude: row.latitude, longitude: row.longitude }
  assert.deepEqual(locatedRequests([located, fakeDemo, mapRequest({ ...row, latitude: null, longitude: null })]), [located])
  assert.deepEqual(locatedRequests([located], { status: 'resolved' }), [])
  assert.deepEqual(locatedRequests([located], { category: 'Освещение', status: 'new' }), [located])
})

test('citizen maps consume the owner-filtered fetch; authority maps use the authorized result unchanged', async () => {
  const other = { ...row, id: 'other-uuid', request_number: 'A-104', user_id: 'citizen-b', latitude: 50.5, longitude: 80.3 }
  const calls = []
  function clientFor(userId) {
    return { auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) }, from(table) {
      assert.equal(table, 'requests')
      let owner
      const query = { select(columns) { assert(columns.includes('latitude,longitude')); return query }, order() { return query }, eq(key, value) { assert.equal(key, 'user_id'); owner = value; return query }, async range() { calls.push({ userId, owner }); return { data: owner ? [row, other].filter(item => item.user_id === owner) : [row, other], error: null } } }
      return query
    } }
  }
  const citizen = await fetchRequests('citizen', 'citizen-a', clientFor('citizen-a'))
  assert.deepEqual(locatedRequests(citizen).map(item => item.userId), ['citizen-a'])
  assert.equal(calls[0].owner, 'citizen-a')
  const authority = await fetchRequests('authority', 'authority', clientFor('authority'))
  assert.deepEqual(locatedRequests(authority).map(item => [item.latitude, item.longitude]), [[50.411, 80.2275], [50.5, 80.3]])
  assert.equal(calls.length, 2, 'Map filtering performs no extra database request')
})

test('real detail map state, legacy/empty/error/loading states render without loading Leaflet on the server', async () => {
  const server = await createServer({ envDir: false, cacheDir: 'node_modules/.vite-location-tests', server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
  try {
    const { RequestLocation, LocationPicker } = await server.ssrLoadModule('/src/components/map/RequestMap.jsx')
    const { default: CityMap } = await server.ssrLoadModule('/src/components/map/CityRequestMap.jsx')
    const render = (Component, props) => renderToStaticMarkup(h(Component, props))
    assert.match(render(RequestLocation, { request: mapRequest(row) }), /Карта обращений/)
    assert.match(render(RequestLocation, { request: mapRequest(row) }), /ул. Абая/)
    assert.match(render(RequestLocation, { request: mapRequest({ ...row, latitude: null, longitude: null }) }), /Местоположение не указано/)
    const picker = render(LocationPicker, { value: { latitude: 50.411, longitude: 80.2275 } })
    assert.match(picker, /50.411000, 80.227500/)
    assert.match(picker, /type="button"/)
    assert.match(render(CityMap, { rows: [], loading: true }), /Загружаем обращения/)
    assert.match(render(CityMap, { rows: [], error: 'Ошибка загрузки' }), /role="alert"/)
    assert.match(render(CityMap, { rows: [] }), /Нет обращений с указанным местоположением/)
    assert.match(render(CityMap, { rows: [mapRequest(row)] }), /только ваши обращения/)
    assert.match(render(CityMap, { rows: [mapRequest(row)], authority: true }), /Статус на карте/)
  } finally { await server.close() }
})

test('location migration only adds nullable constrained columns and INSERT privileges', async () => {
  const sql = await readFile(new URL('../supabase/step-5c-request-location.sql', import.meta.url), 'utf8')
  assert.match(sql, /add column latitude double precision,/)
  assert.match(sql, /latitude between -90 and 90/)
  assert.match(sql, /longitude between -180 and 180/)
  assert.match(sql, /latitude is null and longitude is null/)
  assert.match(sql, /grant insert \(latitude, longitude\) on public.requests to authenticated/)
  assert.doesNotMatch(sql, /grant update|create policy|disable row level security|update public\.requests|default [0-9]/i)
})
