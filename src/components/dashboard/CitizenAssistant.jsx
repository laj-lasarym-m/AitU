import { useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { Send } from 'lucide-react'
import { createChatController } from '../../requests/citizenAssistant.js'
import '../../styles/citizen-assistant.css'

export function CitizenChatView({ state, value, onChange, onSend, onRetry }) {
  return <section className="db-panel citizen-chat" aria-label="AI-помощник">
    <p className="insights-note">Помогу сформулировать обращение и разобраться с городскими вопросами</p>
    <div className="citizen-chat-history" role="log" aria-live="polite" aria-label="Переписка с помощником">
      <p className="citizen-chat-message">Здравствуйте! Опишите проблему или идею своими словами — я помогу сформулировать обращение.</p>
      {state.messages.map((message, index) => <div className={`citizen-chat-message ${message.role === 'user' ? 'from-user' : ''}`} key={index}><strong>{message.role === 'user' ? 'Вы' : 'AI-помощник'}</strong><p>{message.content}</p></div>)}
      {state.busy && <p role="status">Помощник печатает…</p>}
    </div>
    {state.error && <div><p role="alert">{state.error}</p><p className="insights-note">Неотправленное сообщение: {state.failed}</p><button className="insights-refresh" disabled={state.busy} onClick={onRetry}>Повторить</button></div>}
    <form onSubmit={event => { event.preventDefault(); onSend() }} className="citizen-chat-form">
      <label className="visually-hidden" htmlFor="citizen-chat-input">Сообщение помощнику</label>
      <textarea id="citizen-chat-input" placeholder="Напишите сообщение..." value={value} onChange={event => onChange(event.target.value)} maxLength={2000} rows={3} disabled={state.busy} />
      <button className="db-new-request" type="submit" disabled={state.busy || !value.trim()}><Send size={18} />Отправить</button>
    </form>
    <p className="insights-note">AI помогает подготовить текст и может ошибаться. Он не отправляет обращения. Переписка хранится только на этой странице.</p>
    <Link className="insights-refresh" to="/#appeal-form">Создать обращение</Link>
  </section>
}

export default function CitizenAssistant() {
  const [controller] = useState(createChatController)
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  const [value, setValue] = useState('')
  async function send() { if (await controller.send(value)) setValue('') }
  return <CitizenChatView state={state} value={value} onChange={setValue} onSend={send} onRetry={async () => { if (await controller.retry()) setValue('') }} />
}
