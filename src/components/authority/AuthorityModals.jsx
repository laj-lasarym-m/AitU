import { useEffect, useId, useRef, useState } from 'react'
import { X, Paperclip, CalendarDays } from 'lucide-react'
import { authorityServices, authorityStatuses } from '../../data/authorityRequests.js'
import { isRealRequest, requestStatuses } from '../../requests/model.js'

function Modal({ title, children, onClose }) {
  const dialogRef = useRef(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = dialogRef.current
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => { dialog.close(); document.body.style.overflow = previousOverflow; previousFocus?.focus() }
  }, [])
  return <dialog ref={dialogRef} className="authority-modal" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === event.currentTarget) onClose() }}><div className="authority-modal-inner"><div className="authority-modal-heading"><h2 id={titleId}>{title}</h2><button className="db-icon-button" type="button" aria-label="Закрыть окно" onClick={onClose}><X size={20} /></button></div>{children}</div></dialog>
}

export function AssignResponsibleModal({ request, onClose, onSave, busy = false, saveError = '' }) {
  const real = isRealRequest(request)
  const [service, setService] = useState(request.service)
  const [employee, setEmployee] = useState(request.employee || authorityServices[request.service]?.[0] || '')
  const [deadline, setDeadline] = useState(request.deadline)
  return <Modal title="Назначить ответственного" onClose={onClose}><form className="authority-modal-form" onSubmit={event => { event.preventDefault(); onSave({ kind: 'assignment', service, employee, deadline }) }}>
    {real ? <><label>Ответственный<input autoFocus type="text" maxLength={200} value={employee} disabled={busy} onChange={event => setEmployee(event.target.value)} placeholder="Имя сотрудника или название службы" /></label><p className="request-workflow-note">Сохраняется только имя или название. Справочник сотрудников и сроки ответа появятся позже. Пустое поле снимает назначение.</p></> : <>
    <label>Служба<select autoFocus value={service} onChange={event => { setService(event.target.value); setEmployee(authorityServices[event.target.value][0]) }}>{Object.keys(authorityServices).map(value => <option key={value}>{value}</option>)}</select></label>
    <label>Сотрудник<select value={employee} onChange={event => setEmployee(event.target.value)}>{authorityServices[service].map(value => <option key={value}>{value}</option>)}</select></label>
    <label>Срок ответа<div className="authority-date-input"><input type="date" required value={deadline} onChange={event => setDeadline(event.target.value)} aria-label="Срок ответа" /><CalendarDays size={18} aria-hidden="true" /></div></label>
    </>}
    {saveError && <p className="authority-form-error" role="alert">{saveError}</p>}
    <div className="authority-modal-actions"><button className="authority-cancel" type="button" disabled={busy} onClick={onClose}>Отмена</button><button className="authority-primary" type="submit" disabled={busy}>{busy ? 'Сохраняем…' : 'Назначить'}</button></div>
  </form></Modal>
}

export function ChangeStatusModal({ request, onClose, onSave, busy = false, saveError = '' }) {
  const real = isRealRequest(request)
  const [status, setStatus] = useState(request.status)
  const [comment, setComment] = useState('')
  const [photo, setPhoto] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)
  const readerRef = useRef(null)
  useEffect(() => () => readerRef.current?.abort(), [])

  function choosePhoto(event) {
    const file = event.target.files?.[0]
    if (!file) return
    readerRef.current?.abort()
    setError('')
    setPhoto(null)
    setLoading(false)
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 10 * 1024 * 1024) { setError('Выберите JPG или PNG размером до 10 МБ.'); event.target.value = ''; return }
    const reader = new FileReader()
    readerRef.current = reader
    setLoading(true)
    reader.onload = () => { setPhoto({ name: file.name, src: reader.result }); setLoading(false) }
    reader.onerror = () => { setError('Не удалось прочитать изображение. Попробуйте ещё раз.'); setLoading(false) }
    reader.readAsDataURL(file)
  }

  return <Modal title="Изменить статус" onClose={onClose}><form className="authority-modal-form" onSubmit={event => { event.preventDefault(); if (!loading && !busy) onSave({ kind: 'status', status, comment, photo }) }}>
    <label>Новый статус<select autoFocus value={status} disabled={busy} onChange={event => setStatus(event.target.value)}>{(real ? Object.values(requestStatuses) : authorityStatuses).map(value => <option key={value}>{value}</option>)}</select></label>
    <label>Комментарий жителю<textarea rows={4} disabled={real} placeholder={real ? 'Комментарии появятся на следующем этапе' : 'Напишите комментарий, который увидит житель...'} value={comment} onChange={event => setComment(event.target.value)} /></label>
    {real ? <p className="request-workflow-note">Сохраняется только статус. Комментарии и загрузка фотографий пока недоступны.</p> : <>
    <div className="authority-upload"><span>Добавить фото <small>(необязательно)</small></span><div><input ref={inputRef} type="file" hidden accept="image/jpeg,image/png" onChange={choosePhoto} /><button type="button" className="authority-secondary" onClick={() => inputRef.current.click()}><Paperclip size={18} />Выбрать файл</button><small>JPG, PNG до 10 МБ</small></div>{loading && <p role="status">Подготовка фото…</p>}{photo && <p className="authority-selected-photo"><span>{photo.name}</span><button className="db-icon-button" type="button" aria-label="Убрать фото" onClick={() => { setPhoto(null); inputRef.current.value = '' }}><X size={17} /></button></p>}{error && <p className="authority-form-error" role="alert">{error}</p>}</div>
    </>}
    {saveError && <p className="authority-form-error" role="alert">{saveError}</p>}
    <div className="authority-modal-actions"><button className="authority-cancel" type="button" disabled={busy} onClick={onClose}>Отмена</button><button className="authority-primary" type="submit" disabled={loading || busy}>{busy ? 'Сохраняем…' : 'Сохранить'}</button></div>
  </form></Modal>
}
