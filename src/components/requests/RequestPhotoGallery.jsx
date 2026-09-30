import { useEffect, useRef, useState } from 'react'
import { Image, X } from 'lucide-react'
import '../../styles/request-photos.css'

function PhotoViewer({ photo, onClose }) {
  const dialog = useRef(null)
  useEffect(() => {
    const node = dialog.current, focus = document.activeElement, overflow = document.body.style.overflow
    node.showModal(); document.body.style.overflow = 'hidden'
    return () => { node.close(); document.body.style.overflow = overflow; focus?.focus() }
  }, [])
  return <dialog className="request-photo-viewer" ref={dialog} aria-label="Просмотр фотографии" onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === event.currentTarget) onClose() }}><button type="button" aria-label="Закрыть фотографию" onClick={onClose}><X size={24} /></button><img src={photo.url} alt="Фотография обращения" /></dialog>
}

export default function RequestPhotoGallery({ state, compact = false }) {
  const [selectedId, setSelectedId] = useState(null)
  const selected = state.photos.find(photo => photo.id === selectedId && photo.url)
  if (state.loading) return <p className="request-workflow-note" role="status">Загружаем фотографии…</p>
  if (state.error) return <div className="request-workflow-note" role="alert">{state.error} <button className="authority-text-button" onClick={state.reload}>Повторить</button></div>
  if (!state.photos.length) return <div className="request-deferred"><Image size={28} /><span>Фотографии не прикреплены</span></div>
  return <div className="request-real-photos"><div className={`request-photo-grid${compact ? ' is-compact' : ''}`}>{state.photos.map((photo, index) => <figure key={photo.id}>{photo.url ? <button type="button" onClick={() => setSelectedId(photo.id)} aria-label={`Открыть фотографию ${index + 1}`}><img src={photo.url} alt={`Фото обращения ${index + 1}`} loading="lazy" /></button> : <span>Фото недоступно</span>}<figcaption>{photo.kind === 'citizen' ? 'Фото жителя' : photo.kind === 'before' ? 'Фото до' : 'Фото после'}</figcaption></figure>)}</div><button className="authority-text-button" type="button" onClick={state.reload}>Обновить фотографии</button>{selected && <PhotoViewer photo={selected} onClose={() => setSelectedId(null)} />}</div>
}
