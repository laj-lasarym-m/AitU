import { isRealRequest } from './model.js'

export function citizenPoints(rows, userId) {
  const requests = rows.filter(row => userId && isRealRequest(row) && row.userId === userId && ['problem', 'idea'].includes(row.type))
  const stats = { submitted: requests.length, ideas: 0, resolvedProblems: 0, resolvedIdeas: 0 }
  const activity = requests.map(request => {
    const idea = request.type === 'idea', resolved = request.statusCode === 'resolved'
    if (idea) stats.ideas++
    if (resolved) stats[idea ? 'resolvedIdeas' : 'resolvedProblems']++
    return { request, base: idea ? 15 : 10, bonus: resolved ? idea ? 30 : 20 : 0 }
  }).sort((a, b) => (Date.parse(b.request.createdAt) || 0) - (Date.parse(a.request.createdAt) || 0))
  return { total: activity.reduce((sum, item) => sum + item.base + item.bonus, 0), stats, activity: activity.slice(0, 10) }
}
