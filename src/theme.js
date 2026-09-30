export const THEME_STORAGE_KEY = 'aitu-theme'

export function readThemePreference() {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : null
  } catch {
    return null
  }
}

export function resolveTheme(preference, systemDark) {
  return preference ?? (systemDark ? 'dark' : 'light')
}

export function saveThemePreference(theme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // The toggle still works in memory if browser storage is unavailable.
  }
}
