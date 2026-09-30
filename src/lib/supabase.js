import { createClient } from '@supabase/supabase-js'
import { authStorage } from '../auth/storage.js'

// VITE_* values are public browser configuration, never server credentials.
export function createSupabaseConfiguration(env = {}) {
  const url = env.VITE_SUPABASE_URL?.trim()
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || env.VITE_SUPABASE_ANON_KEY?.trim()
  if (!url && !key) return { client: null, status: 'unconfigured' }
  if (!url || !key) return { client: null, status: 'invalid' }

  try {
    const parsed = new URL(url)
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) {
      return { client: null, status: 'invalid' }
    }
    // Catch accidental server-key configuration before constructing a client.
    // This is a configuration check, not JWT verification or authorization.
    if (!key.startsWith('sb_publishable_')) {
      const payload = key.split('.')[1]
      if (!payload || JSON.parse(atob(payload.replaceAll('-', '+').replaceAll('_', '/'))).role !== 'anon') {
        return { client: null, status: 'invalid' }
      }
    }
    return { client: createClient(url, key, { auth: { storage: authStorage } }), status: 'configured' }
  } catch {
    // Do not log configuration values, keys, or raw SDK errors.
    return { client: null, status: 'invalid' }
  }
}

const configuration = createSupabaseConfiguration(import.meta.env ?? {})
export const supabase = configuration.client
export const supabaseConfigurationStatus = configuration.status
export const isSupabaseConfigured = configuration.status === 'configured'
