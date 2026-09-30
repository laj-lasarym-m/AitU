import { useEffect, useRef, useState } from 'react'
import { MapPin, CircleAlert, GitFork, Building2, CalendarDays, ThumbsUp, Check, Paperclip, Send, Image, X } from 'lucide-react'
import { StatusBadge } from './RequestList.jsx'
import RequestProgress from './RequestProgress.jsx'
import MiniMap from './MiniMap.jsx'
import { isRealRequest } from '../../requests/model.js'
import useRequestPhotos from '../../requests/useRequestPhotos.js'
import RequestPhotoGallery from '../requests/RequestPhotoGallery.jsx'
import { RequestLocation } from '../map/RequestMap.jsx'

const tabs = ['Обращение', 'История', 'Фото до / после']

function TimelineItem({ title, time, text, photo }) {
  return <div className="db-timeline-item"><span className="db-timeline-dot" /><strong>{title}</strong><time>{time}</time><p>{text}</p>{photo && <span className="db-timeline-attachment"><Paperclip size={14} />{photo.name}</span>}</div>
}

export default function RequestDetails({ request, confirmed, onConfirm, updates, onAddUpdate, onNotice }) {
  const real = isRealRequest(request)
  const realPhotos = useRequestPhotos(request)
  const [tab, setTab] = useState(0)
  const [draft, setDraft] = useState('')
  const [photo, setPhoto] = useState(null)
  const [readingPhoto, setReadingPhoto] = useState(false)
  const fileInput = useRef(null)
  const readerRef = useRef(null)
  const latest = updates.at(-1)

  useEffect(() => () => readerRef.current?.abort(), [])

  function attachPhoto(event) {
    if (real) return
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
      onNotice('Выберите изображение размером до 10 МБ.')
      event.target.value = ''
      return
    }
    readerRef.current?.abort()
    const reader = new FileReader()
    readerRef.current = reader
    setReadingPhoto(true)
    reader.onload = () => { setPhoto({ name: file.name, src: reader.result }); setReadingPhoto(false) }
    reader.onerror = () => { setReadingPhoto(false); onNotice('Не удалось прочитать фото. Попробуйте другое изображение.') }
    reader.readAsDataURL(file)
  }

  function sendUpdate(event) {
    event.preventDefault()
    if (real) { onNotice('Дополнения к созданным обращениям появятся позже. Фотографии можно приложить при создании обращения.'); return }
    if (readingPhoto) return
    if (!draft.trim() && !photo) {
      onNotice('Добавьте информацию или выберите фото.')
      return
    }
    onAddUpdate({ title: 'Вы добавили информацию', time: 'Только что', text: draft.trim(), photo })
    setDraft('')
    setPhoto(null)
    fileInput.current.value = ''
    onNotice('Дополнение добавлено локально в демонстрационное обращение.')
  }

  const photos = updates.filter(update => update.photo)
  return (
    <section className="db-detail-panel db-panel" aria-label={`Обращение ${request.id}`}>
      <div className="db-detail-heading"><div><span className="db-detail-id">{request.id}</span><h2>{request.title}</h2></div><StatusBadge request={request} /></div>
      <p className="db-address"><MapPin size={19} strokeWidth={1.7} />{request.address}</p>
      <div className="db-detail-tabs" role="tablist" aria-label="Разделы обращения" onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (tab + (event.key === 'ArrowRight' ? 1 : 2)) % 3
        setTab(next)
        event.currentTarget.children[next].focus()
      }}>
        {tabs.map((label, index) => <button key={label} id={`db-tab-${index}`} role="tab" aria-selected={tab === index} aria-controls="db-tab-content" tabIndex={tab === index ? 0 : -1} className={tab === index ? 'is-active' : ''} onClick={() => setTab(index)}>{label}</button>)}
      </div>
      <div id="db-tab-content" role="tabpanel" aria-labelledby={`db-tab-${tab}`} tabIndex={0} className="db-tab-content">
        {tab === 0 && <>
          {request.step >= 0 ? <RequestProgress step={request.step} /> : <p className="db-description">Статус: {request.status}</p>}
          <p className="db-description">{request.description}</p>
          {real && <p className="request-created-label">Создано: {request.date} · Категория: {request.category}</p>}
          <div className="db-priority"><CircleAlert size={19} fill="currentColor" /><span>{real ? 'Приоритет' : 'Приоритет ИИ'}: {request.priority}{!real && <><span className="db-separator">·</span>Проверяется специалистом</>}</span></div>
          <div className="db-related"><GitFork size={36} strokeWidth={1.8} /><div><strong>Связанные обращения</strong>{real ? <p>Связи и подтверждения появятся позже</p> : <p>{request.related} заявок<span>·</span>{request.confirmations + Number(confirmed)} подтверждений</p>}</div>{!real && <span className="db-related-ideas">+{request.ideas} {request.ideas === 1 ? 'идея' : 'идеи'} жителей</span>}</div>
          <div className="db-location-row">
            {real ? <RequestLocation request={request} /> : <MiniMap landmark={request.landmark} />}
            <div className="db-service-card"><span className="db-service-label">{real ? 'Ответственный' : 'Ответственная служба'}</span><p><Building2 size={25} strokeWidth={1.6} />{request.service}</p><div className="db-service-divider" /><span className="db-service-label">Следующий ответ</span><p><CalendarDays size={24} strokeWidth={1.6} />{request.due}</p><button className={`db-confirm${confirmed ? ' is-confirmed' : ''}`} onClick={() => real ? onNotice('Подтверждения жителей появятся позже.') : onConfirm()} disabled={confirmed}>{confirmed ? <Check size={19} /> : <ThumbsUp size={19} />} {confirmed ? 'Вы подтвердили' : request.type === 'idea' ? 'Поддержать идею' : 'Подтвердить проблему'}</button></div>
          </div>
          <section className="db-latest" aria-label="Последнее обновление"><h3>Последнее обновление</h3><TimelineItem title={latest?.title ?? request.update} time={latest?.time ?? request.updateTime} text={latest?.text ?? request.updateText} photo={latest?.photo} /></section>
        </>}
        {tab === 1 && <section className="db-history"><h3>История обращения</h3>{real && <p className="request-created-label">Дата создания и текущее состояние. Полная история изменений появится позже.</p>}{request.history.map(item => <TimelineItem key={item.title} {...item} />)}{updates.map((item, index) => <TimelineItem key={index} {...item} />)}</section>}
        {tab === 2 && (real ? <section className="db-photos"><h3>Фото обращения</h3><RequestPhotoGallery state={realPhotos} /><p className="db-photo-hint">Фото до / после от службы появятся позже.</p></section> : <section className="db-photos"><h3>Фото до / после</h3><div className="db-photo-placeholders">{['До', 'После'].map(label => <div key={label}><Image size={32} strokeWidth={1.4} /><strong>{label}</strong><p>Фотографий пока нет</p></div>)}</div><p className="db-photo-hint">Добавьте фото через поле ниже, чтобы дополнить обращение.</p>{photos.length > 0 && <><h3>Ваши фотографии</h3><div className="db-photo-gallery">{photos.map((update, index) => <figure key={index}><img src={update.photo.src} alt={update.photo.name} /><figcaption>{update.photo.name}</figcaption></figure>)}</div></>}</section>)}
      </div>
      <form className="db-update-form" onSubmit={sendUpdate}>
        {photo && <div className="db-attachment-chip"><Paperclip size={15} /><span>{photo.name}</span><button type="button" aria-label="Убрать прикреплённое фото" onClick={() => { setPhoto(null); fileInput.current.value = '' }}><X size={15} /></button></div>}
        <div className="db-update-row"><div className="db-update-input"><input ref={fileInput} type="file" accept="image/*" hidden onChange={attachPhoto} /><button type="button" aria-label="Прикрепить фото" onClick={() => real ? onNotice('Загрузка фото появится позже.') : fileInput.current.click()}><Paperclip size={24} strokeWidth={1.7} /></button><input aria-label="Добавить информацию" disabled={real} placeholder={real ? 'Дополнения появятся позже' : readingPhoto ? 'Читаем фото…' : 'Добавить информацию или фото...'} value={draft} onChange={event => setDraft(event.target.value)} /></div><button className="db-send" type="submit" aria-label="Добавить обновление" disabled={readingPhoto}><Send size={24} strokeWidth={1.7} /></button></div>
      </form>
      <div className="db-detail-footer"><button onClick={() => { if (real) { onNotice('Дополнения к реальным обращениям появятся позже.'); return } onAddUpdate({ title: 'Проблема ещё актуальна', time: 'Только что', text: 'Вы отметили, что вопрос пока не решён.' }); onNotice('Отметка добавлена локально в историю обращения.') }}><CircleAlert size={24} strokeWidth={1.6} /><span>Сообщить, если проблема осталась</span></button><small>{real ? 'Данные из базы' : 'Демонстрационные данные'}</small></div>
    </section>
  )
}
