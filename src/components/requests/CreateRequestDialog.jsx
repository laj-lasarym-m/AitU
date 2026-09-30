import { useEffect, useId, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { createRequestWithPhotos, photoErrorMessage } from '../../requests/photos.js'
import { requestErrorMessage } from '../../requests/model.js'
import { LocationPicker } from '../map/RequestMap.jsx'
import '../../styles/auth.css'
import '../../styles/requests.css'

export default function CreateRequestDialog({ type, description, files = [], onClose, onCreated }) {
  const dialog = useRef(null)
  const submitting = useRef(false)
  const titleId = useId()
  const [title, setTitle] = useState(description.trim().split('\n')[0].slice(0, 160))
  const [category, setCategory] = useState('')
  const [address, setAddress] = useState('')
  const [location, setLocation] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [completed, setCompleted] = useState(null)
  useEffect(() => {
    const node = dialog.current, focus = document.activeElement, overflow = document.body.style.overflow
    node.showModal(); document.body.style.overflow = 'hidden'
    return () => { node.close(); document.body.style.overflow = overflow; focus?.focus() }
  }, [])
  async function submit(event) {
    event.preventDefault()
    if (submitting.current || completed) return
    submitting.current = true; setBusy(true); setError('')
    try {
      const result = await createRequestWithPhotos({ type, title, description, category, address, ...location }, files)
      if (result.failed.length) setCompleted(result)
      else onCreated(result.request)
    }
    catch (failure) { setError(failure?.code === 'PHOTO_VALIDATION' ? photoErrorMessage(failure) : requestErrorMessage(failure)) }
    finally { submitting.current = false; setBusy(false) }
  }
  function close() { if (!submitting.current) { if (completed) onCreated(completed.request); else onClose() } }
  return <dialog ref={dialog} className="request-create-dialog auth-page" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); close() }}><section className="auth-card"><div className="request-create-heading"><h2 id={titleId}>{completed ? 'Обращение создано' : 'Новое обращение'}</h2><button type="button" aria-label="Закрыть" disabled={busy} onClick={close}><X size={21} /></button></div>{completed ? <div className="auth-form"><p role="status">Обращение {completed.request.id} сохранено. Загружено фото: {completed.uploaded.length} из {files.length}. Не удалось загрузить: {completed.failed.length}. Обращение доступно в вашем кабинете; повторно отправлять его не нужно.</p><button className="auth-primary" type="button" onClick={close}>Открыть мои обращения</button></div> : <form className="auth-form" onSubmit={submit}>
    <div className="auth-field"><label htmlFor="request-title">Краткий заголовок</label><input autoFocus id="request-title" value={title} onChange={event => setTitle(event.target.value)} maxLength={160} required disabled={busy} /></div>
    <div className="auth-field"><label>Описание · {type === 'idea' ? 'Идея' : 'Проблема'}</label><p className="request-create-description">{description}</p></div>
    <div className="auth-field"><label htmlFor="request-address">Адрес (необязательно)</label><input id="request-address" placeholder="Улица, дом или ориентир" value={address} onChange={event => setAddress(event.target.value)} maxLength={300} disabled={busy} /></div>
    <div className="auth-field"><label htmlFor="request-category">Категория (необязательно)</label><input id="request-category" placeholder="Например, освещение" value={category} onChange={event => setCategory(event.target.value)} maxLength={100} disabled={busy} /></div>
    <LocationPicker value={location} onChange={setLocation} disabled={busy} />
    <p className="auth-inline-message">{files.length ? `Фото: ${files.length} / 5. Загрузка начнётся после сохранения обращения.` : 'Фотографии не выбраны.'}</p>
    {error && <p className="auth-inline-message" role="alert">{error}</p>}
    <div className="request-create-actions"><button type="submit" className="auth-primary" disabled={busy}>{busy ? 'Отправляем…' : 'Отправить обращение'}</button><button type="button" className="auth-text-button" disabled={busy} onClick={onClose}>Вернуться к тексту</button></div>
  </form>}</section></dialog>
}
