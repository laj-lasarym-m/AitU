export const requestStatuses = {
  new: 'Новая', reviewing: 'На рассмотрении', in_progress: 'В работе',
  needs_info: 'Нужны уточнения', resolved: 'Завершена', rejected: 'Отклонено',
}
export const requestPriorities = { low: 'Низкий', medium: 'Средний', high: 'Высокий' }
export const statusCodeFromLabel = label => Object.keys(requestStatuses).find(code => requestStatuses[code] === label)
export const isRealRequest = request => request?.source === 'database' && Boolean(request.databaseId)

export function formatRequestTime(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Не указано' : new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

// Adapt real rows to the approved components. Never borrow demo record values.
export function mapRequest(row) {
  const status = requestStatuses[row.status] ?? 'Неизвестный статус'
  const created = formatRequestTime(row.created_at)
  const updated = formatRequestTime(row.updated_at)
  return {
    id: row.request_number, databaseId: row.id, source: 'database', userId: row.user_id,
    type: row.type, title: row.title, description: row.description,
    latitude: row.latitude ?? null, longitude: row.longitude ?? null,
    category: row.category || 'Не указана', address: row.address || 'Адрес не указан',
    status, statusCode: row.status, priority: requestPriorities[row.priority] ?? 'Не определён',
    assignedTo: row.assigned_to || '', employee: row.assigned_to || '',
    date: created, createdAt: row.created_at, updatedAt: row.updated_at,
    step: ({ new: 0, reviewing: 1, needs_info: 1, in_progress: 2, resolved: 3, rejected: -1 })[row.status] ?? -1,
    area: 'Не указан', service: row.assigned_to || 'Не назначен', due: 'Срок не установлен', deadline: '',
    photos: [], photoSlots: 0, confirmations: 0, related: 0, ideas: 0,
    update: 'Текущее состояние', updateTime: updated, updateText: status,
    history: [
      { title: 'Обращение создано', time: created, text: row.request_number },
      ...(row.updated_at !== row.created_at ? [{ title: 'Текущее состояние', time: updated, text: status }] : []),
    ],
  }
}

export function requestErrorMessage(error) {
  if (['42P01', 'PGRST205'].includes(error?.code)) return 'Хранилище обращений пока не подключено. Попробуйте позже.'
  if (['42501', 'PGRST116'].includes(error?.code)) return 'Нет доступа к обращению или данные изменились. Обновите страницу.'
  if (error?.code === 'AUTH_REQUIRED') return 'Войдите в аккаунт, чтобы продолжить.'
  if (error?.code === 'VALIDATION') return error.message
  return 'Не удалось сохранить или загрузить обращение. Проверьте соединение и попробуйте ещё раз.'
}
