import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import '../../styles/request-photos.css'

function Preview({ file }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    const next = URL.createObjectURL(file)
    queueMicrotask(() => setUrl(next))
    return () => URL.revokeObjectURL(next)
  }, [file])
  return url ? <img src={url} alt="Выбранная фотография" /> : null
}

export default function PhotoPreviews({ files, onRemove }) {
  if (!files.length) return null
  return <div className="request-photo-selection"><span>Выбрано фото: {files.length} / 5</span><div className="request-photo-previews">{files.map((file, index) => <div key={`${index}-${file.name}-${file.lastModified}`}><Preview file={file} /><button type="button" aria-label={`Убрать фотографию ${index + 1}`} onClick={() => onRemove(index)}><X size={15} /></button></div>)}</div></div>
}
