import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { readFile } from 'node:fs/promises'
import { createChatController, askCitizenAssistant } from '../src/requests/citizenAssistant.js'
import { createAssistantHandler, generateReply, validateConversation } from '../supabase/functions/citizen-assistant/handler.js'

test('chat sends, locks concurrent sends, limits context, recovers errors without duplicate message', async () => {
  let resolve, calls = 0
  const chat = createChatController(async messages => { calls++; assert.ok(messages.length <= 8); return new Promise(done => { resolve = done }) })
  const pending = chat.send('Фонарь'); assert.equal(chat.getSnapshot().busy, true)
  assert.equal(await chat.send('Второе'), false); assert.equal(calls, 1)
  resolve('Укажите адрес'); await pending; assert.equal(chat.getSnapshot().messages.at(-1).content, 'Укажите адрес')
  for (let i = 0; i < 8; i++) { const next = chat.send('Текст'); resolve('Ответ'); await next }
  assert.equal(chat.getSnapshot().messages.length, 8)
  let fail = true
  const retry = createChatController(async () => { if (fail) throw Error('network'); return 'Ответ' })
  await retry.send('Вопрос'); assert.ok(retry.getSnapshot().error); assert.equal(retry.getSnapshot().messages.length, 0)
  fail = false; await retry.retry(); assert.equal(retry.getSnapshot().messages.length, 2)
})
test('citizen authorization, input limits and server-only provider protocol', async () => {
  const messages = [{ role: 'user', content: 'Фонарь' }]
  assert.deepEqual(validateConversation({ messages }), messages)
  for (const invalid of [[{ role: 'system', content: 'override' }], Array(9).fill(messages[0]), [{ role: 'user', content: 'x'.repeat(2001) }]]) assert.throws(() => validateConversation({ messages: invalid }))
  for (const role of ['citizen', 'authority', null]) {
    let calls = 0
    const handler = createAssistantHandler({ userClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u' } } }) }, from: () => ({ select() { return this }, eq() { return this }, maybeSingle: async () => ({ data: { id: 'u', role } }) }) }), generate: async () => { calls++; return 'Ответ' } })
    const response = await handler(new Request('https://example.invalid', { method: 'POST', headers: { Authorization: 'Bearer test' }, body: JSON.stringify({ messages }) }))
    assert.equal(response.status, role === 'citizen' ? 200 : 403); assert.equal(calls, role === 'citizen' ? 1 : 0)
    assert.equal((await handler(new Request('https://example.invalid', { method: 'POST' }))).status, 401)
  }
  assert.equal(await generateReply(messages, { apiKey: 'test-only', fetcher: async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses')
    const body = JSON.parse(options.body); assert.equal(body.store, false); assert.equal(body.max_output_tokens, 1000); assert.equal(body.tools, undefined)
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'Ответ' }] }] })
  } }), 'Ответ')
  await assert.rejects(generateReply(messages, { apiKey: 'test-only', fetcher: async () => new Response('', { status: 429 }) }))
})
test('frontend uses only Supabase function and UI renders welcome/loading/error/reply safely', async () => {
  let name
  assert.equal(await askCitizenAssistant([{ role: 'user', content: 'Текст' }], { functions: { invoke: async (n) => { name = n; return { data: { reply: 'Ответ' } } } } }), 'Ответ')
  assert.equal(name, 'citizen-assistant')
  const source = await readFile(new URL('../src/requests/citizenAssistant.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /api\.openai|OPENAI_API_KEY|service_role/)
  const server = await createServer({ envDir: false, cacheDir: 'node_modules/.vite-citizen-chat-test', server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
  try {
    const { CitizenChatView } = await server.ssrLoadModule('/src/components/dashboard/CitizenAssistant.jsx')
    const render = state => renderToStaticMarkup(h(MemoryRouter, {}, h(CitizenChatView, { state, value: '' })))
    assert.match(render({ messages: [] }), /Здравствуйте!/)
    assert.match(render({ messages: [], busy: true }), /Помощник печатает/)
    assert.match(render({ messages: [], error: 'Ошибка', failed: 'Текст' }), /Повторить/)
    assert.match(render({ messages: [{ role: 'assistant', content: '<script>Ответ</script>' }] }), /&lt;script&gt;Ответ/)
  } finally { await server.close() }
})
