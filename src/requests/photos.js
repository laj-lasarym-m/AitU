import { supabase } from '../lib/supabase.js'
import { createRequest } from './api.js'
import { isRealRequest } from './model.js'
import { withTimeout } from '../auth/actions.js'

export const PHOTO_BUCKET = 'request-photos'
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024
export const PHOTO_MAX_COUNT = 5
export const PHOTO_URL_SECONDS = 300
const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const invalid = message => { throw Object.assign(new Error(message), { code: 'PHOTO_VALIDATION' }) }

export function validatePhotos(files, existingCount = 0) {
  if (files.length + existingCount > PHOTO_MAX_COUNT) invalid('Можно загрузить не более 5 фотографий.')
  for (const file of files) {
    if (!Object.hasOwn(extensions, file.type)) invalid('Поддерживаются JPG, PNG и WEBP.')
    if (!file.size || file.size > PHOTO_MAX_BYTES) invalid('Размер одного изображения должен быть от 1 байта до 5 МБ.')
  }
  return files
}

export function photoPath(userId, requestId, file, randomId = crypto.randomUUID()) {
  validatePhotos([file])
  if (![userId, requestId, randomId].every(value => typeof value === 'string' && uuidPattern.test(value))) invalid('Не удалось подготовить фотографию. Обновите страницу.')
  return `${userId.toLowerCase()}/${requestId.toLowerCase()}/${randomId.toLowerCase()}.${extensions[file.type]}`
}

export function photoErrorMessage(error) {
  if (error?.code === 'PHOTO_VALIDATION') return error.message
  if (['PGRST205', '42P01'].includes(error?.code)) return 'Хранилище фотографий пока не подключено.'
  return 'Не удалось загрузить фотографии. Проверьте соединение и попробуйте ещё раз.'
}

async function userForPhotos(client) {
  if (!client) throw new Error('Photos unavailable')
  const { data, error } = await withTimeout(client.auth.getUser())
  if (error || !data?.user) throw new Error('Authentication required')
  return data.user
}

export async function uploadRequestPhotos(request, files, client = supabase) {
  validatePhotos(files)
  if (!isRealRequest(request)) invalid('Демонстрационные фотографии не отправляются в базу.')
  const user = await userForPhotos(client)
  if (request.userId !== user.id) invalid('Фотографии можно добавить только к своему обращению.')
  const bucket = client.storage.from(PHOTO_BUCKET)
  const uploaded = [], failed = []
  for (const file of files) {
    let path, stored = false
    try {
      path = photoPath(user.id, request.databaseId, file)
      const upload = await withTimeout(bucket.upload(path, file, { contentType: file.type, upsert: false, cacheControl: '300' }), 60000)
      if (upload.error) throw upload.error
      stored = true
      const result = await withTimeout(client.from('request_photos').insert({ request_id: request.databaseId, storage_path: path }).select('id,storage_path,kind').single())
      if (result.error) throw result.error
      uploaded.push(result.data)
    } catch {
      // A metadata response can be lost after commit. Check before declaring
      // failure or cleaning up; RLS additionally forbids deleting linked files.
      if (stored) {
        try {
          const check = await withTimeout(client.from('request_photos').select('id,storage_path,kind').eq('storage_path', path).maybeSingle())
          if (!check.error && check.data) { uploaded.push(check.data); continue }
          if (!check.error) await withTimeout(bucket.remove([path]))
        } catch { /* Offline cleanup is best effort; never delete metadata. */ }
      }
      failed.push(file)
    }
  }
  return { uploaded, failed }
}

// After request creation, attachment errors are results, never a request failure.
// The caller switches to a completion view, so retry cannot create another request.
export async function createRequestWithPhotos(input, files, client = supabase) {
  validatePhotos(files)
  const request = await createRequest(input, client)
  if (!files.length) return { request, uploaded: [], failed: [] }
  try { return { request, ...await uploadRequestPhotos(request, files, client) } }
  catch { return { request, uploaded: [], failed: files } }
}

export function mapPhotoUrls(records, signed) {
  return records.map(record => ({ ...record, url: signed.find(item => item.path === record.storage_path && !item.error)?.signedUrl || null }))
}

export async function loadRequestPhotos(request, expectedUserId, client = supabase) {
  if (!isRealRequest(request)) return []
  const user = await userForPhotos(client)
  if (user.id !== expectedUserId) throw new Error('Session changed')
  const { data, error } = await withTimeout(client.from('request_photos').select('id,request_id,storage_path,kind,created_at').eq('request_id', request.databaseId).order('created_at').order('id'))
  if (error) throw error
  if (!data.length) return []
  const signed = await withTimeout(client.storage.from(PHOTO_BUCKET).createSignedUrls(data.map(photo => photo.storage_path), PHOTO_URL_SECONDS))
  if (signed.error) throw signed.error
  return mapPhotoUrls(data, signed.data || [])
}
