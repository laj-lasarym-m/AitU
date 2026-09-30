// Supabase alone owns session contents. No role decisions are stored here.
const memory = new Map()
const preferenceKey = 'aitu-auth-remember'
let remember = true

export function setRememberSession(value) {
  remember = value
  try { window.localStorage.setItem(preferenceKey, String(value)) } catch { /* Memory fallback. */ }
}

function persistent() {
  try { return window.localStorage.getItem(preferenceKey) !== 'false' } catch { return remember }
}

export const authStorage = {
  getItem(key) {
    // A missing key in working browser storage means signed out, not a reason
    // to resurrect an older in-memory token (e.g. after another tab signs out).
    try { return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key) ?? null } catch { return memory.get(key) ?? null }
  },
  setItem(key, value) {
    memory.set(key, value)
    try {
      const target = persistent() ? window.localStorage : window.sessionStorage
      const other = persistent() ? window.sessionStorage : window.localStorage
      target.setItem(key, value)
      other.removeItem(key)
    } catch { /* Session still works in memory when storage is unavailable. */ }
  },
  removeItem(key) {
    memory.delete(key)
    try { window.localStorage.removeItem(key); window.sessionStorage.removeItem(key) } catch { /* Nothing else is cleared. */ }
  },
}

// Only a resume hint for the application FORM, never an authorization flag.
// Passwords and IIN must never be passed to these functions.
export function rememberAuthorityIntent(email) {
  try { window.sessionStorage.setItem('aitu-authority-application-email', email.trim().toLowerCase()) } catch { /* Redirect link also carries a non-sensitive form hint. */ }
}
export function hasAuthorityIntent(email) {
  try { return Boolean(email) && window.sessionStorage.getItem('aitu-authority-application-email') === email.toLowerCase() } catch { return false }
}
export function clearAuthorityIntent() {
  try { window.sessionStorage.removeItem('aitu-authority-application-email') } catch { /* Optional hint. */ }
}
