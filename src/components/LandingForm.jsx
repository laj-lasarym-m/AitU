import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowRight, Paperclip } from 'lucide-react'
import { useAuth } from '../auth/context.js'
import { getAccountPath } from '../auth/access.js'
import { clearRequestDraft, readRequestDraft, saveRequestDraft } from '../requests/draft.js'
import CreateRequestDialog from './requests/CreateRequestDialog.jsx'
import PhotoPreviews from './requests/PhotoPreviews.jsx'
import { validatePhotos, photoErrorMessage } from '../requests/photos.js'

export default function LandingForm({ inputRef, onNotice, voiceText }) {
  const { search } = useLocation()
  const [draft] = useState(readRequestDraft)
  const [type, setType] = useState(new URLSearchParams(search).get('type') === 'idea' ? 'idea' : draft?.type ?? 'problem')
  const [message, setMessage] = useState(draft?.description ?? '')
  const [reviewing, setReviewing] = useState(false)
  const [files, setFiles] = useState([])
  const fileInput = useRef(null)
  const { account } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!voiceText?.trim()) return

    setMessage(current => {
      if (!current.trim()) return voiceText.trim()
      return `${current.trim()} ${voiceText.trim()}`
    })
  }, [voiceText])

  function selectPhotos(event) {
    const chosen = Array.from(event.target.files || [])
    event.target.value = ''
    try { 
      validatePhotos(chosen, files.length)
      setFiles(current => [...current, ...chosen])
    }
    catch (error) { 
      onNotice(photoErrorMessage(error)) 
    }
  }

  function submit(event) {
    event.preventDefault()
    if (!message.trim()) {
      inputRef.current?.focus()
      onNotice('Сначала опишите вашу проблему или идею.')
      return
    }
    if (account.status === 'loading') { onNotice('Проверяем аккаунт. Попробуйте через несколько секунд.'); return }
    if (account.status === 'anonymous') {
      if (!saveRequestDraft({ type, description: message })) { onNotice('Не удалось сохранить черновик в браузере. Скопируйте текст перед входом.'); return }
      navigate('/login')
      return
    }
    if (getAccountPath(account) !== '/dashboard') { onNotice('Для отправки обращения нужен доступ к кабинету жителя. Проверьте аккаунт.'); return }
    setReviewing(true)
  }

  return (
    <><form className="landing-form" id="appeal-form" aria-label="Новое обращение" onSubmit={submit}>
      <div className="form-tabs" role="group" aria-label="Тип обращения">
        <button type="button" aria-pressed={type === 'problem'} className={type === 'problem' ? 'selected' : ''} onClick={() => setType('problem')}>Проблема</button>
        <button type="button" aria-pressed={type === 'idea'} className={type === 'idea' ? 'selected' : ''} onClick={() => setType('idea')}>Идея</button>
      </div>
      <div className="form-input-area">
        <label className="visually-hidden" htmlFor="appeal-text">Опишите вашу проблему или идею</label>
        <textarea id="appeal-text" ref={inputRef} value={message} onChange={(event) => setMessage(event.target.value)} maxLength={10000} placeholder="Например, у остановки возле колледжа не горит свет..." rows={2} />
        <div className="form-actions">
          <div className="photo-control">
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={selectPhotos} />
            <button className="attach-button" type="button" onClick={() => fileInput.current.click()}><Paperclip size={23} strokeWidth={1.8} /><span>Добавить фото</span></button>
          </div>
          <button className="button button-primary continue-button" type="submit">Продолжить <ArrowRight size={19} strokeWidth={1.6} /></button>
        </div>
      </div>
      <PhotoPreviews files={files} onRemove={index => setFiles(current => current.filter((_, i) => i !== index))} />
      {(account.status === 'anonymous' && files.length > 0 || draft) && <p className="request-photo-selection">После входа фотографии нужно выбрать заново. Черновик сохраняет только текст.</p>}
    </form>{reviewing && <CreateRequestDialog type={type} description={message} files={files} onClose={() => setReviewing(false)} onCreated={() => { clearRequestDraft(); setMessage(''); setFiles([]); setReviewing(false); navigate('/dashboard') }} />}</>
  )
}
