import { supabase } from '../lib/supabase.js'
import { withTimeout } from '../auth/actions.js'
import { isRealRequest, mapRequest, requestStatuses, requestPriorities } from './model.js'
import { locationPayload } from './location.js'

export const REQUEST_COLUMNS = 'id,request_number,user_id,type,title,description,category,address,status,priority,assigned_to,created_at,updated_at,latitude,longitude'
const invalid = message => { throw Object.assign(new Error(message), { code: 'VALIDATION' }) }
function text(value, max, label, required = false) {
  const result = typeof value === 'string' ? value.trim() : ''
  if ((required && !result) || result.length > max) invalid(`${label}: введите ${required ? 'от 1 до' : 'не более'} ${max} символов.`)
  return result || null
}

export function createRequestPayload(input) {
  if (!['problem', 'idea'].includes(input.type)) invalid('Выберите проблему или идею.')
  return { type: input.type, title: text(input.title, 160, 'Заголовок', true), description: text(input.description, 10000, 'Описание', true), category: text(input.category, 100, 'Категория'), address: text(input.address, 300, 'Адрес'), ...locationPayload(input) }
}

export function workflowPayload(input) {
  const payload = {}
  if (Object.hasOwn(input, 'status')) {
    if (!Object.hasOwn(requestStatuses, input.status)) invalid('Выберите допустимый статус.')
    payload.status = input.status
  }
  if (Object.hasOwn(input, 'priority')) {
    if (input.priority !== null && !Object.hasOwn(requestPriorities, input.priority)) invalid('Выберите допустимый приоритет.')
    payload.priority = input.priority
  }
  if (Object.hasOwn(input, 'assigned_to')) payload.assigned_to = text(input.assigned_to, 200, 'Ответственный')
  if (!Object.keys(payload).length) invalid('Нет изменений для сохранения.')
  return payload
}

async function authenticatedUser(client) {
  if (!client) throw new Error('Requests unavailable')
  const { data, error } = await withTimeout(client.auth.getUser())
  if (error || !data?.user) throw Object.assign(new Error('Authentication required'), { code: 'AUTH_REQUIRED' })
  return data.user
}

export async function createRequest(input, client = supabase) {
  const payload = createRequestPayload(input)
  await authenticatedUser(client)
  // No user_id or request_number from the browser: DB auth.uid() and trigger own them.
  const { data, error } = await withTimeout(client.from('requests').insert(payload).select(REQUEST_COLUMNS).single())
  if (error) throw error
  return mapRequest(data)
}

export async function fetchRequests(scope, expectedUserId, client = supabase) {
  const user = await authenticatedUser(client)
  if (user.id !== expectedUserId) throw Object.assign(new Error('Session changed'), { code: 'AUTH_REQUIRED' })
  if (!['citizen', 'authority'].includes(scope)) invalid('Недопустимый список обращений.')
  const rows = []
  // Avoid silently hiding older records behind Supabase's default row limit.
  for (let offset = 0; ; offset += 100) {
    let query = client.from('requests').select(REQUEST_COLUMNS).order('created_at', { ascending: false }).order('id')
    if (scope === 'citizen') query = query.eq('user_id', user.id)
    const { data, error } = await withTimeout(query.range(offset, offset + 99))
    if (error) throw error
    rows.push(...data)
    if (data.length < 100) return rows.map(mapRequest)
  }
}

export async function updateRequestWorkflow(request, changes, client = supabase) {
  if (!isRealRequest(request)) invalid('Демонстрационные обращения не сохраняются в базе.')
  const payload = workflowPayload(changes)
  await authenticatedUser(client)
  const { data, error } = await withTimeout(client.from('requests').update(payload).eq('id', request.databaseId).select(REQUEST_COLUMNS).single())
  if (error) throw error
  return mapRequest(data)
}
