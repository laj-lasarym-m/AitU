import { supabase } from '../lib/supabase.js'
import { isRealRequest } from './model.js'
import { withTimeout } from '../auth/actions.js'

const fields = 'category,priority,responsible_service,summary,reason'
const messages = {
  provider_not_configured: 'AI-сервис ещё не настроен. Обратитесь к администратору.',
  provider_unavailable: 'AI-сервис временно недоступен. Попробуйте ещё раз.',
  invalid_output: 'AI вернул некорректный результат. Попробуйте ещё раз.',
  unauthenticated: 'Сессия истекла. Войдите снова.',
  forbidden: 'AI-анализ доступен только подтверждённым сотрудникам.',
  request_not_found: 'Обращение не найдено или недоступно.',
  analysis_busy: 'Это обращение уже анализируется. Повторите попытку через минуту.',
  database_error: 'Не удалось прочитать или сохранить анализ. Попробуйте ещё раз.',
}
export function analysisErrorMessage(error) {
  return messages[error?.code] || 'Не удалось выполнить AI-анализ. Проверьте соединение и попробуйте ещё раз.'
}

function ensureReal(request, client) {
  if (!client || !isRealRequest(request)) throw new Error('Real request required')
}
export async function loadAnalysis(request, client = supabase) {
  ensureReal(request, client)
  const { data, error } = await withTimeout(client.from('request_ai_analyses').select(fields).eq('request_id', request.databaseId).maybeSingle())
  if (error) throw Object.assign(new Error('Analysis read failed'), { code: 'database_error' })
  return data
}
export async function analyzeRequest(request, client = supabase) {
  ensureReal(request, client)
  const { data, error } = await client.functions.invoke('analyze-request', {
    body: { request_id: request.databaseId }, signal: AbortSignal.timeout(85000),
  })
  if (error) {
    let code
    try { code = (await error.context?.json())?.error } catch { /* network/gateway error */ }
    throw Object.assign(new Error('Analysis failed'), { code })
  }
  if (!data?.analysis || data.error) throw Object.assign(new Error('Analysis failed'), { code: data?.error })
  return data.analysis
}

// Per mounted request/account. Reads are automatic; provider calls require run().
// The synchronous busy guard also covers clicks before React has re-rendered.
export function createAnalysisController(request, { load = loadAnalysis, analyze = analyzeRequest } = {}) {
  let state = { phase: 'checking', analysis: null, error: '' }
  let busy = false
  let retryAnalysis = false
  const listeners = new Set()
  const publish = next => { state = next; listeners.forEach(listener => listener()) }
  async function execute(generate) {
    if (busy || state.analysis) return
    busy = true
    retryAnalysis = generate
    publish({ phase: generate ? 'analyzing' : 'checking', analysis: null, error: '' })
    try {
      const existing = await load(request)
      const analysis = existing || (generate ? await analyze(request) : null)
      publish({ phase: analysis ? 'success' : 'idle', analysis, error: '' })
    } catch (error) { publish({ phase: 'error', analysis: null, error: analysisErrorMessage(error) }) }
    finally { busy = false }
  }
  return { getSnapshot: () => state, subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) },
    load: () => execute(false), run: () => execute(true), retry: () => execute(retryAnalysis) }
}
