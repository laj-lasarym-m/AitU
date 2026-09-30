import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

test('AI tab states, retry/controller concurrency, cached analysis and real/demo separation', async () => {
  const server = await createServer({ envDir: false, cacheDir: 'node_modules/.vite-ai-test', server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom',
    // Select the actual AI tab while retaining real child components and context.
    plugins: [{ name: 'select-ai-tab', enforce: 'pre', transform(code, id) {
      if (id.replaceAll('\\', '/').endsWith('/authority/AuthorityRequestDetails.jsx')) {
        return code.replace("import { useState } from 'react'", 'const useState = () => [1, () => {}]')
      }
    } }],
  })
  try {
    const { AnalysisView, default: RequestAIAnalysis } = await server.ssrLoadModule('/src/components/authority/RequestAIAnalysis.jsx')
    const { createAnalysisController, loadAnalysis, analyzeRequest } = await server.ssrLoadModule('/src/requests/ai.js')
    const { AuthContext } = await server.ssrLoadModule('/src/auth/context.js')
    const result = { category: 'Освещение', priority: 'high', responsible_service: 'Служба', summary: '<script>опасность</script>', reason: 'Причина' }
    const render = state => renderToStaticMarkup(h(AnalysisView, { state }))
    assert.match(render({ phase: 'idle' }), /AI-анализ ещё не выполнен/)
    assert.match(render({ phase: 'idle' }), /Анализировать обращение/)
    assert.match(render({ phase: 'checking' }), /Загружаем/)
    assert.match(render({ phase: 'analyzing' }), /disabled=""/)
    const success = render({ phase: 'success', analysis: result })
    for (const text of ['Освещение', 'Высокий', 'Служба', 'Причина', '&lt;script&gt;', 'требует проверки сотрудником']) assert.ok(success.includes(text))
    assert.doesNotMatch(success, /Анализировать обращение|Демо/)
    assert.match(render({ phase: 'error', error: 'Ошибка' }), /role="alert"/)
    assert.match(render({ phase: 'error', error: 'Ошибка' }), /Повторить/)
    const real = { source: 'database', databaseId: 'uuid' }
    let calls = 0, release
    const controller = createAnalysisController(real, { load: async () => null, analyze: async () => {
      calls++; return new Promise(resolve => { release = resolve })
    } })
    await controller.load(); assert.equal(calls, 0); assert.equal(controller.getSnapshot().phase, 'idle')
    const running = controller.run(); await Promise.resolve()
    await controller.run(); assert.equal(calls, 1); assert.equal(controller.getSnapshot().phase, 'analyzing')
    release(result); await running; await controller.run(); assert.equal(calls, 1)
    const cached = createAnalysisController(real, { load: async () => result, analyze: () => { throw Error('must not call AI') } })
    await cached.load(); await cached.run(); assert.equal(cached.getSnapshot().phase, 'success')
    let fail = true, attempts = 0
    const retry = createAnalysisController(real, { load: async () => null, analyze: async () => { attempts++; if (fail) throw Error('network'); return result } })
    await retry.run(); assert.equal(retry.getSnapshot().phase, 'error')
    fail = false; await retry.retry(); assert.equal(attempts, 2); assert.equal(retry.getSnapshot().phase, 'success')
    let body
    assert.deepEqual(await analyzeRequest(real, { functions: { invoke: async (name, options) => { assert.equal(name, 'analyze-request'); body = options.body; return { data: { analysis: result } } } } }), result)
    assert.deepEqual(body, { request_id: 'uuid' })
    await assert.rejects(analyzeRequest({ source: 'demo' }, {}), /Real request/)
    await assert.rejects(loadAnalysis({ source: 'demo' }, {}), /Real request/)
    const account = { user: { id: 'citizen' }, profile: { id: 'citizen', role: 'citizen' } }
    const gated = request => renderToStaticMarkup(h(AuthContext.Provider, { value: { account } }, h(RequestAIAnalysis, { request })))
    assert.match(gated(real), /только подтверждённым/)
    assert.equal(gated({ source: 'demo' }), '')
    const { default: Details } = await server.ssrLoadModule('/src/components/authority/AuthorityRequestDetails.jsx')
    const { authorityRequests } = await server.ssrLoadModule('/src/data/authorityRequests.js')
    const { mapRequest } = await server.ssrLoadModule('/src/requests/model.js')
    const authority = { user: { id: 'employee' }, profile: { id: 'employee', role: 'authority', authority_status: 'verified' } }
    const details = request => renderToStaticMarkup(h(AuthContext.Provider, { value: { account: authority } }, h(Details, { request })))
    const realHTML = details(mapRequest({ id: 'uuid', request_number: 'A-101', title: 'Legacy', type: 'problem', status: 'new' }))
    assert.match(realHTML, /Загружаем AI-анализ/)
    assert.doesNotMatch(realHTML, /AI-анализ появится позже|Предлагаемый маршрут/)
    assert.match(details(authorityRequests[0]), /Предлагаемый маршрут/)
  } finally { await server.close() }
})
