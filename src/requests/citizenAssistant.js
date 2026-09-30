import { supabase } from '../lib/supabase.js'

export async function askCitizenAssistant(messages, client = supabase) {
  if (!client) throw Error('unavailable')
  const { data, error } = await client.functions.invoke('citizen-assistant', { body: { messages: messages.slice(-8) }, signal: AbortSignal.timeout(55000) })
  if (error || typeof data?.reply !== 'string' || !data.reply.trim() || data.reply.length > 4000) throw Error('unavailable')
  return data.reply
}

export function createChatController(ask = askCitizenAssistant) {
  let state = { messages: [], busy: false, error: '', failed: '' }
  const listeners = new Set()
  function publish(change) { state = { ...state, ...change }; listeners.forEach(listener => listener()) }
  async function send(text) {
    const content = text.trim()
    if (state.busy || !content || content.length > 2000) return false
    const history = state.messages
    const next = [...history, { role: 'user', content }].slice(-8)
    publish({ messages: next, busy: true, error: '', failed: '' })
    try {
      const reply = await ask(next)
      publish({ messages: [...next, { role: 'assistant', content: reply }].slice(-8), busy: false })
      return true
    } catch {
      publish({ messages: history, busy: false, failed: content, error: 'AI-помощник временно недоступен. Попробуйте ещё раз.' })
      return false
    }
  }
  return { getSnapshot: () => state, subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn) }, send, retry: () => send(state.failed) }
}
