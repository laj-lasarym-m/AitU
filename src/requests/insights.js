import { isRealRequest, requestStatuses, requestPriorities } from './model.js'

export const ownIdeas = (rows, userId) => rows.filter(row => isRealRequest(row) && row.userId === userId && Boolean(userId) && row.type === 'idea')
export const ideaSubmissionUrl = '/?type=idea#appeal-form'

export function requestAnalytics(rows) {
  const real = rows.filter(isRealRequest)
  const categories = new Map()
  const statuses = Object.fromEntries(Object.keys(requestStatuses).map(key => [key, 0]))
  const priorities = { low: 0, medium: 0, high: 0, unknown: 0 }
  const types = { problem: 0, idea: 0 }
  for (const row of real) {
    const category = row.category?.trim() || 'Не указана'
    categories.set(category, (categories.get(category) || 0) + 1)
    const status = Object.hasOwn(statuses, row.statusCode) ? row.statusCode : 'unknown'
    statuses[status] = (statuses[status] || 0) + 1
    const priority = Object.keys(requestPriorities).find(key => requestPriorities[key] === row.priority) || 'unknown'
    priorities[priority]++
    if (Object.hasOwn(types, row.type)) types[row.type]++
  }
  return { total: real.length, statuses, priorities, types, categories: [...categories].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ru')) }
}
