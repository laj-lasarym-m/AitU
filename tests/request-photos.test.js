import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { validatePhotos, photoPath, PHOTO_MAX_BYTES, uploadRequestPhotos, createRequestWithPhotos, loadRequestPhotos, mapPhotoUrls } from '../src/requests/photos.js'
import { demoRequests } from '../src/data/requests.js'

const owner = '10000000-0000-4000-8000-000000000001'
const requestId = '20000000-0000-4000-8000-000000000002'
const randomId = '30000000-0000-4000-8000-000000000003'
const image = (type = 'image/jpeg', size = 100) => ({ name: '../../private.png', type, size })
const request = { source: 'database', databaseId: requestId, userId: owner, id: 'A-101' }

test('photos accept JPEG, PNG, WEBP and enforce MIME, size and total count', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) assert.equal(validatePhotos([image(type, PHOTO_MAX_BYTES)]).length, 1)
  for (const type of ['image/svg+xml', 'image/gif', 'text/html', '', 'application/octet-stream']) assert.throws(() => validatePhotos([image(type)]), /Поддерживаются/)
  assert.throws(() => validatePhotos([image('image/png', PHOTO_MAX_BYTES + 1)]), /5 МБ/)
  assert.throws(() => validatePhotos([image('image/png', 0)]), /5 МБ/)
  assert.equal(validatePhotos(Array.from({ length: 5 }, () => image())).length, 5)
  assert.throws(() => validatePhotos(Array.from({ length: 6 }, () => image())), /не более 5/)
  assert.throws(() => validatePhotos([image(), image()], 4), /не более 5/)
})

test('safe path uses authenticated owner, request UUID and random UUID, never raw filename', () => {
  assert.equal(photoPath(owner, requestId, image(), randomId), `${owner}/${requestId}/${randomId}.jpg`)
  assert.match(photoPath(owner, requestId, image('image/webp')), /\.webp$/)
  assert.notEqual(photoPath(owner, requestId, image()), photoPath(owner, requestId, image()))
  assert.throws(() => photoPath('../other', requestId, image(), randomId))
  assert.throws(() => photoPath(owner, 'A-101', image(), randomId))
})

// An in-memory Supabase interface fixture: no remote accounts, SQL or uploads.
function fixture({ uploadFailure = false, metadataFailure = false, lostResponse = false, authMissing = false } = {}) {
  const calls = { requests: 0, uploads: [], metadata: [], removed: [], signed: [] }
  let linked = []
  const bucket = {
    async upload(path, file, options) { calls.uploads.push({ path, options }); return { error: (typeof uploadFailure === 'function' ? uploadFailure(file) : uploadFailure) ? new Error('Offline') : null } },
    async remove(paths) { calls.removed.push(...paths); return { data: [], error: null } },
    async createSignedUrls(paths, seconds) { calls.signed.push({ paths, seconds }); return { data: paths.map(path => ({ path, signedUrl: `https://photos.invalid/signed/${path}?token=fixture` })), error: null } },
  }
  const client = {
    auth: { getUser: async () => ({ data: { user: authMissing ? null : { id: owner } }, error: null }) },
    storage: { from(name) { assert.equal(name, 'request-photos'); return bucket } },
    from(table) {
      let payload, filter
      const query = {
        insert(value) { payload = value; return query },
        select() { return query }, eq(column, value) { filter = { column, value }; return query }, order() { return query },
        async single() {
          if (table === 'requests') {
            calls.requests++
            return { data: { ...payload, id: requestId, request_number: 'A-101', user_id: owner, status: 'new', created_at: '2026-09-30T10:00:00Z', updated_at: '2026-09-30T10:00:00Z' }, error: null }
          }
          assert.equal(table, 'request_photos')
          assert.deepEqual(Object.keys(payload).sort(), ['request_id', 'storage_path'])
          calls.metadata.push(payload)
          const data = { ...payload, id: 'photo-one', kind: 'citizen' }
          if (!metadataFailure || lostResponse) linked.push(data)
          return { data: metadataFailure ? null : data, error: metadataFailure ? { code: '42501' } : null }
        },
        async maybeSingle() { return { data: linked.find(row => row.storage_path === filter.value) || null, error: null } },
        then(resolve, reject) {
          assert.equal(table, 'request_photos')
          assert.deepEqual(filter, { column: 'request_id', value: requestId })
          return Promise.resolve({ data: linked, error: null }).then(resolve, reject)
        },
      }
      return query
    },
  }
  return { client, calls, seed(records) { linked = records } }
}

test('request is created once before upload; safe metadata and private display follow', async () => {
  const { client, calls } = fixture()
  const result = await createRequestWithPhotos({ type: 'idea', title: 'Идея', description: 'Описание' }, [image()], client)
  assert.equal(calls.requests, 1)
  assert.equal(result.request.databaseId, requestId)
  assert.equal(result.uploaded.length, 1)
  assert.equal(result.failed.length, 0)
  assert(calls.uploads[0].path.startsWith(`${owner}/${requestId}/`))
  assert.equal(calls.uploads[0].options.upsert, false)
  assert.equal(calls.uploads[0].options.contentType, 'image/jpeg')
  const photos = await loadRequestPhotos(result.request, owner, client)
  assert.equal(photos[0].kind, 'citizen')
  assert.match(photos[0].url, /signed/)
  assert.equal(calls.signed[0].seconds, 300)
  assert(!JSON.stringify(calls.metadata).includes('signedUrl'))
  assert(!JSON.stringify(calls.metadata).includes('user_id'))
})

test('failed uploads keep the created request and never create a second request', async () => {
  const { client, calls } = fixture({ uploadFailure: true })
  const result = await createRequestWithPhotos({ type: 'problem', title: 'Проблема', description: 'Описание' }, [image(), image('image/png')], client)
  assert.equal(result.request.id, 'A-101')
  assert.equal(result.failed.length, 2)
  assert.equal(calls.requests, 1)
  assert.equal(calls.metadata.length, 0)
  // A photo-only retry uses the existing request and cannot insert another one.
  await uploadRequestPhotos(result.request, result.failed, client)
  assert.equal(calls.requests, 1)
})

test('metadata failure cleans up an unlinked upload; lost successful response preserves it', async () => {
  const failed = fixture({ metadataFailure: true })
  const result = await uploadRequestPhotos(request, [image()], failed.client)
  assert.equal(result.failed.length, 1)
  assert.deepEqual(failed.calls.removed, failed.calls.uploads.map(call => call.path))
  const committed = fixture({ metadataFailure: true, lostResponse: true })
  const recovered = await uploadRequestPhotos(request, [image()], committed.client)
  assert.equal(recovered.uploaded.length, 1)
  assert.equal(recovered.failed.length, 0)
  assert.equal(committed.calls.removed.length, 0)
})

test('one failed photo does not discard successful attachments or stop remaining uploads', async () => {
  const { client, calls } = fixture({ uploadFailure: file => file.type === 'image/png' })
  const result = await createRequestWithPhotos({ type: 'idea', title: 'Идея', description: 'Описание' }, [image('image/png'), image('image/webp')], client)
  assert.equal(result.failed.length, 1)
  assert.equal(result.uploaded.length, 1)
  assert.equal(calls.uploads.length, 2)
  assert.equal(calls.requests, 1)
})

test('anonymous, foreign-owner and demo uploads are rejected without any Storage call', async () => {
  const { client, calls } = fixture()
  await assert.rejects(uploadRequestPhotos({ ...request, userId: 'another' }, [image()], client))
  await assert.rejects(uploadRequestPhotos(demoRequests[0], [image()], client))
  await assert.rejects(uploadRequestPhotos(request, [image()], fixture({ authMissing: true }).client))
  assert.equal(calls.uploads.length, 0)
  assert.deepEqual(await loadRequestPhotos(demoRequests[0], owner, client), [])
  await assert.rejects(loadRequestPhotos(request, 'changed-session', client))
  assert.equal(calls.signed.length, 0)
})

test('invalid photos fail before creating a request; URL mapping matches paths, not order', async () => {
  const { client, calls } = fixture()
  await assert.rejects(createRequestWithPhotos({}, [image('text/html')], client))
  assert.equal(calls.requests, 0)
  const mapped = mapPhotoUrls([{ storage_path: 'a' }, { storage_path: 'b' }, { storage_path: 'c' }], [{ path: 'b', signedUrl: 'signed-b' }, { path: 'a', error: 'denied', signedUrl: 'must-not-use' }])
  assert.deepEqual(mapped.map(row => row.url), [null, 'signed-b', null])
})

test('photo migration is review-only and restricts metadata and Storage access', async () => {
  const sql = await readFile(new URL('../supabase/step-5c-request-photos.sql', import.meta.url), 'utf8')
  assert.match(sql, /'request-photos', 'request-photos', false, 5242880/)
  assert.match(sql, /array\['image\/jpeg', 'image\/png', 'image\/webp'\]/)
  assert.match(sql, /alter table public\.request_photos enable row level security/)
  assert.match(sql, /grant insert \(request_id, storage_path\)/)
  assert.match(sql, /user_id uuid not null default auth\.uid\(\)/)
  assert.match(sql, /new\.user_id is distinct from auth\.uid\(\)/)
  assert.match(sql, /for update;/)
  assert.match(sql, /count\(\*\)[\s\S]*?>= 5/)
  assert.match(sql, /request_photos_storage_authority_read[\s\S]*?is_verified_authority/)
  assert.match(sql, /request_photos_storage_orphan_delete[\s\S]*?not exists \(select 1 from public\.request_photos/)
  assert.doesNotMatch(sql, /grant (?:update|delete)|create or replace|alter table public\.requests|create policy[^;]*for update/i)
})
