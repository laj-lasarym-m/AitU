import { Component, lazy, Suspense, useSyncExternalStore } from 'react'
import { hasCoordinates } from '../../requests/location.js'
import '../../styles/request-map.css'

// Leaflet touches window at import time. Keep it out of SSR and the initial
// landing bundle; detail/creation/map views share this single lazy module.
const LeafletMap = lazy(() => import('./LeafletMap.jsx'))
const subscribe = () => () => {}
const clientSnapshot = () => true
const serverSnapshot = () => false

class MapBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return <p role="alert">Не удалось открыть карту. <button type="button" onClick={() => this.setState({ failed: false })}>Повторить</button></p>
    return this.props.children
  }
}

export default function RequestMap(props) {
  const client = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot)
  return <div className={`request-map-shell${props.compact ? ' is-compact' : ''}`} aria-label={props.onPick ? 'Выбор местоположения обращения' : 'Карта обращений'}><MapBoundary><Suspense fallback={<p role="status">Загружаем карту…</p>}>{client ? <LeafletMap {...props} /> : <p role="status">Загружаем карту…</p>}</Suspense></MapBoundary></div>
}

export function RequestLocation({ request }) {
  if (!hasCoordinates(request)) return <div className="request-deferred">Местоположение не указано.<br />{request.address}</div>
  return <div className="request-location"><RequestMap compact requests={[request]} /><p>{request.address}</p></div>
}

export function LocationPicker({ value, onChange, disabled }) {
  return <section className="request-location-picker"><p>Местоположение (необязательно)</p><small>Нажмите на карту, чтобы отметить место. Введённый адрес не изменится.</small><RequestMap value={value} onPick={onChange} disabled={disabled} />{hasCoordinates(value) ? <div className="request-location-value"><output aria-label="Выбранные координаты">{value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}</output><button type="button" disabled={disabled} onClick={() => onChange(null)}>Убрать точку</button></div> : <small>Точка пока не выбрана.</small>}</section>
}
