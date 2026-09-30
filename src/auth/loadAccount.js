import { supabase, supabaseConfigurationStatus } from '../lib/supabase.js'

export const PROFILE_COLUMNS = 'id,full_name,role,authority_status,organization,created_at,updated_at'
// Deliberately excludes IIN; SELECT * is also denied by SQL column grants.
export const APPLICATION_COLUMNS = 'id,user_id,organization,position,status,created_at,reviewed_at'

// Called by the shared session layer. Never request IIN or trust signup roles.
// Use in a router loader/effect, outside onAuthStateChange's synchronous callback.
export async function loadAccount(client = supabase) {
  const empty = { user: null, profile: null, application: null }
  if (!client) return { ...empty, status: supabaseConfigurationStatus === 'unconfigured' ? 'unconfigured' : 'unavailable' }

  try {
    const { data: { user } = {}, error: authError } = await client.auth.getUser()
    if (authError) {
      return { ...empty, status: authError.name === 'AuthSessionMissingError' ? 'anonymous' : 'unavailable' }
    }
    if (!user) return { ...empty, status: 'anonymous' }
    const [profileResult, applicationResult] = await Promise.all([
      client.from('profiles').select(PROFILE_COLUMNS).eq('id', user.id).maybeSingle(),
      client.from('authority_applications').select(APPLICATION_COLUMNS).eq('user_id', user.id).maybeSingle(),
    ])
    if (profileResult.error || applicationResult.error || !profileResult.data || profileResult.data.id !== user.id || (applicationResult.data && applicationResult.data.user_id !== user.id)) {
      return { ...empty, status: 'unavailable' }
    }
    return { status: 'authenticated', user, profile: profileResult.data, application: applicationResult.data }
  } catch {
    // Missing schema, network errors, etc. must never grant access or fall back to demo.
    return { ...empty, status: 'unavailable' }
  }
}
