import { useState } from 'react'
import { MapPin, UsersRound, UserRoundPlus, SquarePen, Image, Sparkles, GitFork, ArrowUp, Building2, CalendarDays } from 'lucide-react'
import MiniMap from '../dashboard/MiniMap.jsx'
import { AuthorityStatusBadge } from './AuthorityRequestList.jsx'
import { formatAuthorityDate } from '../../data/authorityRequests.js'
import { isRealRequest } from '../../requests/model.js'
import useRequestPhotos from '../../requests/useRequestPhotos.js'
import RequestPhotoGallery from '../requests/RequestPhotoGallery.jsx'
import { RequestLocation } from '../map/RequestMap.jsx'
import RequestAIAnalysis from './RequestAIAnalysis.jsx'

const tabs = ['Обращение', 'AI-анализ', 'Фото', 'История', 'Связанные']

function PhotoGallery({ request, compact = false, photoState }) {
  if (isRealRequest(request)) return <RequestPhotoGallery state={photoState} compact={compact} />
  return <div className={`authority-photo-gallery${compact ? ' is-compact' : ''}`}>
    {Array.from({ length: compact ? Math.min(request.photoSlots, 3) : request.photoSlots }, (_, index) => <div key={index} className="authority-photo-placeholder"><Image size={compact ? 25 : 34} strokeWidth={1.3} /><span>Фото {index + 1}</span><small>Демо · изображение не добавлено</small></div>)}
    {!compact && request.photos.map((photo, index) => <figure key={index}><a href={photo.src} target="_blank" rel="noreferrer" aria-label={`Открыть фото ${photo.name}`}><img src={photo.src} alt={photo.name} /></a><figcaption>{photo.name}</figcaption></figure>)}
  </div>
}

export default function AuthorityRequestDetails({ request, onAssign, onStatus }) {
  const [tab, setTab] = useState(0)
  const real = isRealRequest(request)
  const realPhotos = useRequestPhotos(request)
  return (
    <section className="db-panel authority-details" aria-label={`Обращение ${request.id}`}>
      <div className="authority-detail-top"><span className="authority-detail-id">{request.id}</span><AuthorityStatusBadge status={request.status} /></div>
      <div className="authority-detail-heading"><div><h2>{request.title}</h2><p className="db-address"><MapPin size={18} />{request.address}</p>{real && <p className="request-created-label">Создано: {request.date} · {request.type === 'idea' ? 'Идея' : 'Проблема'}</p>}</div><div className="authority-confirmations"><div><UsersRound size={21} /><strong>{real ? '—' : request.confirmations}</strong></div><span>{real ? 'подтверждения позже' : 'жителей подтвердили'}</span></div></div>
      <div className="authority-detail-actions"><button className="authority-primary" onClick={onAssign}><UserRoundPlus size={19} />Назначить ответственного</button><button className="authority-secondary" onClick={onStatus}><SquarePen size={18} />Изменить статус</button></div>
      <div className="authority-tabs" role="tablist" aria-label="Разделы обращения" onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? 4 : (tab + (event.key === 'ArrowRight' ? 1 : 4)) % 5
        setTab(next)
        event.currentTarget.children[next].focus()
      }}>{tabs.map((label, index) => <button key={label} id={`authority-tab-${index}`} role="tab" aria-selected={tab === index} aria-controls="authority-tab-panel" tabIndex={tab === index ? 0 : -1} className={tab === index ? 'is-active' : ''} onClick={() => setTab(index)}>{label}{index === 2 && <span>{real ? realPhotos.loading || realPhotos.error ? '—' : realPhotos.photos.length : request.photoSlots + request.photos.length}</span>}{index === 3 && <span>{request.history.length}</span>}</button>)}</div>
      <div className="authority-tab-panel" id="authority-tab-panel" role="tabpanel" aria-labelledby={`authority-tab-${tab}`} tabIndex={0}>
        {tab === 0 && <div className="authority-overview-grid">
          <div className="authority-description"><h3>Описание жителя</h3><p>{request.description}</p><div className="authority-photos-heading"><h3>Фотографии</h3><button className="authority-text-button" onClick={() => setTab(2)}>Все фото</button></div><PhotoGallery request={request} photoState={realPhotos} compact /></div>
          <div className="authority-info-column">{real ? <RequestLocation request={request} /> : <MiniMap landmark={request.landmark} street={request.address.split(',')[0]} />}<section className="authority-info-card"><h3>Информация</h3><dl><div><dt>Категория</dt><dd>{request.category}</dd></div><div><dt>Район</dt><dd>{request.area}</dd></div><div><dt>Приоритет</dt><dd className={`authority-priority-${request.priority === 'Высокий' ? 'high' : request.priority === 'Низкий' ? 'low' : 'medium'}`}><ArrowUp size={15} />{request.priority}</dd></div><div><dt>Источник</dt><dd>{real ? 'Обращение жителя' : request.source}</dd></div></dl></section></div>
        </div>}
        {tab === 1 && (real ? <RequestAIAnalysis request={request} /> : <section className="authority-analysis"><div className="authority-section-heading"><Sparkles size={24} /><h3>AI-анализ обращения</h3><span>Демо</span></div><dl><div><dt>Определённая категория</dt><dd>{request.category} → {request.subcategory}</dd></div><div><dt>Приоритет</dt><dd>{request.priority}</dd></div><div><dt>Причина</dt><dd>{request.reason}</dd></div><div><dt>Предлагаемый маршрут</dt><dd>{request.service}</dd></div><div><dt>Связанные обращения</dt><dd>{request.related} похожих обращений поблизости</dd></div></dl><p className="authority-ai-note">AI recommendation · requires employee confirmation</p></section>)}
        {tab === 2 && <section className="authority-photos-tab"><h3>{real ? 'Фото жителя' : 'Фотографии обращения'}</h3><p>{real ? 'Фотографии, прикреплённые при создании обращения. Загрузка фото до / после от службы появится позже.' : 'Демонстрационные места для фото. Изображения, добавленные при изменении статуса, появятся здесь.'}</p><PhotoGallery request={request} photoState={realPhotos} /></section>}
        {tab === 3 && <section className="authority-history"><h3>История обращения</h3>{real && <p className="request-workflow-note">Показаны создание и текущее состояние. Полный журнал изменений появится позже.</p>}{request.history.map((item, index) => <div className="db-timeline-item" key={index}><span className="db-timeline-dot" /><time>{item.time}</time><strong>{item.title}</strong>{item.text && <p>{item.text}</p>}{item.photo && <a href={item.photo.src} target="_blank" rel="noreferrer" className="authority-history-photo"><Image size={15} />{item.photo.name}</a>}</div>)}</section>}
        {tab === 4 && (real ? <div className="request-deferred"><GitFork size={28} /><span>Связанные обращения и подтверждения появятся позже</span></div> : <section className="authority-related-tab"><div className="authority-section-heading"><GitFork size={25} /><h3>{request.related} похожих обращений поблизости</h3></div><p className="authority-related-count">{request.confirmations} подтверждений жителей</p>{['Похожее обращение на соседнем участке', 'Дополнение от жителей района', 'Предложение по улучшению участка'].slice(0, Math.min(3, request.related)).map((title, index) => <article className="authority-related-item" key={title}><span>Демо · {index + 1}</span><strong>{title}</strong><p>{request.area} район · {request.subcategory}</p></article>)}</section>)}
      </div>
      <div className="authority-responsibility"><Building2 size={21} /><div><span>{real ? 'Ответственный' : 'Ответственная служба'}</span><strong>{request.service}</strong>{!real && request.employee && <small>{request.employee}</small>}</div><div className="authority-deadline"><span><CalendarDays size={14} />Срок ответа</span><strong>{real ? 'Не установлен' : formatAuthorityDate(request.deadline)}</strong></div></div>
      <p className="authority-detail-note">{real ? 'Данные из базы' : 'Демонстрационные данные · изменения сохраняются до обновления страницы'}</p>
    </section>
  )
}
