export const limits = { category: 100, responsible_service: 200, summary: 600, reason: 1000 }
export const analysisFields = 'category,priority,responsible_service,summary,reason'

export class AnalysisError extends Error {
  constructor(code, status = 502) { super(code); this.code = code; this.status = status }
}

export function validateAnalysis(value) {
  const keys = [...Object.keys(limits), 'priority']
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))
    || !['low', 'medium', 'high'].includes(value.priority)) throw new AnalysisError('invalid_output')
  const clean = { priority: value.priority }
  for (const [key, max] of Object.entries(limits)) {
    if (typeof value[key] !== 'string') throw new AnalysisError('invalid_output')
    // Intentional sanitization of model-generated control characters.
    // eslint-disable-next-line no-control-regex
    const text = value[key].replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
    if (!text || text.length > max) throw new AnalysisError('invalid_output')
    clean[key] = text
  }
  return clean
}

export function requestContext(row) {
  // Deliberately exclude identity, coordinates, photos and every workflow field.
  return { type: row.type, title: row.title, description: row.description,
    category: row.category || null, address: row.address || null }
}
