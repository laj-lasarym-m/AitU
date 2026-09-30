const key = 'aitu-request-draft'
const lifetime = 30 * 60 * 1000

// Only an explicit auth redirect saves the plain text draft in this tab.
// Reads discard drafts older than 30 minutes. No files, credentials, IIN,
// owner IDs, or URL payloads are added to the stored draft.
export function saveRequestDraft(draft) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify({ type: draft.type === 'idea' ? 'idea' : 'problem', description: draft.description.slice(0, 10000), savedAt: Date.now() }))
    return true
  } catch { return false }
}
export function clearRequestDraft() {
  try { window.sessionStorage.removeItem(key) } catch { /* Optional browser storage. */ }
}
export function readRequestDraft() {
  try {
    const draft = JSON.parse(window.sessionStorage.getItem(key))
    if (!draft || typeof draft.description !== 'string' || !['problem', 'idea'].includes(draft.type) || !Number.isFinite(draft.savedAt) || Date.now() - draft.savedAt > lifetime || draft.savedAt > Date.now()) { clearRequestDraft(); return null }
    return { type: draft.type, description: draft.description.slice(0, 10000) }
  } catch { clearRequestDraft(); return null }
}
