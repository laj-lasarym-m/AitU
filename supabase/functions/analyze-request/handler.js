import { AnalysisError, analysisFields, validateAnalysis } from './validation.js'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function checked(result) {
  if (result.error) throw new AnalysisError('database_error', 503)
  return result.data
}
async function authorize(client, token) {
  const { data, error } = await client.auth.getUser(token)
  if (error || !data?.user) throw new AnalysisError('unauthenticated', 401)
  const profile = checked(await client.from('profiles').select('id,role,authority_status').eq('id', data.user.id).maybeSingle())
  if (profile?.id !== data.user.id || profile?.role !== 'authority' || profile?.authority_status !== 'verified') {
    throw new AnalysisError('forbidden', 403)
  }
}

export function createHandler({ userClient, adminClient, generate, origins = ['http://localhost:5173'], now = () => Date.now() }) {
  return async request => {
    const origin = request.headers.get('origin')
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin',
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS' }
    if (origin && origins.includes(origin)) headers['Access-Control-Allow-Origin'] = origin
    const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers })
    let admin, lockId, lockToken
    try {
      if (origin && !origins.includes(origin)) throw new AnalysisError('forbidden', 403)
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
      if (request.method !== 'POST') throw new AnalysisError('method_not_allowed', 405)
      const authorization = request.headers.get('authorization') || ''
      if (!/^Bearer \S+$/i.test(authorization)) throw new AnalysisError('unauthenticated', 401)
      const token = authorization.slice(7)
      const client = userClient(authorization)
      await authorize(client, token)
      const raw = await request.text()
      let body
      try { body = raw.length <= 1024 ? JSON.parse(raw) : null } catch { /* rejected below */ }
      if (!body || Object.keys(body).length !== 1 || typeof body.request_id !== 'string' || !uuid.test(body.request_id)) throw new AnalysisError('invalid_request', 400)
      const id = body.request_id
      const row = checked(await client.from('requests').select('id,type,title,description,category,address').eq('id', id).maybeSingle())
      if (!row) throw new AnalysisError('request_not_found', 404)
      const read = async () => checked(await client.from('request_ai_analyses').select(analysisFields).eq('request_id', id).maybeSingle())
      const cached = await read()
      if (cached) return reply({ analysis: validateAnalysis(cached) })
      // Privileged client is used only after identity + database role + request checks.
      admin = adminClient()
      checked(await admin.from('request_ai_analysis_locks').delete().eq('request_id', id).lt('expires_at', new Date(now()).toISOString()))
      const leaseToken = crypto.randomUUID()
      const lock = await admin.from('request_ai_analysis_locks').insert({ request_id: id, token: leaseToken, expires_at: new Date(now() + 90000).toISOString() })
      if (lock.error?.code === '23505') throw new AnalysisError('analysis_busy', 409)
      checked(lock)
      lockId = id; lockToken = leaseToken
      // Another worker may have completed between our first read and lease acquisition.
      const completed = await read()
      if (completed) return reply({ analysis: validateAnalysis(completed) })
      const analysis = validateAnalysis(await generate(row))
      await authorize(client, token) // Do not persist after session expiry or role revocation.
      checked(await admin.from('request_ai_analyses').insert({ request_id: id, ...analysis }))
      return reply({ analysis })
    } catch (error) {
      // Never expose provider bodies, keys, JWTs, citizen text or database errors.
      return reply({ error: error instanceof AnalysisError ? error.code : 'internal_error' }, error instanceof AnalysisError ? error.status : 500)
    } finally {
      if (lockId) {
        try { await admin.from('request_ai_analysis_locks').delete().eq('request_id', lockId).eq('token', lockToken) } catch { /* lease expires if cleanup fails */ }
      }
    }
  }
}
