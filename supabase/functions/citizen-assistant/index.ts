import { createClient } from 'npm:@supabase/supabase-js@2.117.2'
import { createAssistantHandler, generateReply } from './handler.js'

Deno.serve(createAssistantHandler({
  userClient: (authorization: string) => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: authorization }, fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) },
  }),
  generate: (messages: Array<{ role: string; content: string }>) => generateReply(messages, {
    apiKey: Deno.env.get('OPENAI_API_KEY'), model: Deno.env.get('OPENAI_MODEL'),
  }),
  origins: (Deno.env.get('AI_ALLOWED_ORIGINS') || 'http://localhost:5173').split(',').map(value => value.trim()),
}))
