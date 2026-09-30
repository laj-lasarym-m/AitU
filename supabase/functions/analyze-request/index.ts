import { createClient } from 'npm:@supabase/supabase-js@2.117.2'
import { createHandler } from './handler.js'
import { generateAnalysis } from './provider.js'

const url = Deno.env.get('SUPABASE_URL')!
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) } }

Deno.serve(createHandler({
  userClient: (authorization: string) => createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    ...options, global: { ...options.global, headers: { Authorization: authorization } },
  }),
  adminClient: () => createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, options),
  generate: (row: Record<string, unknown>) => generateAnalysis(row, {
    apiKey: Deno.env.get('OPENAI_API_KEY'), model: Deno.env.get('OPENAI_MODEL'), provider: Deno.env.get('AI_PROVIDER') || 'openai',
  }),
  origins: (Deno.env.get('AI_ALLOWED_ORIGINS') || 'http://localhost:5173').split(',').map(origin => origin.trim()),
}))
