import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import { Icon } from 'leaflet'
import markerUrl from 'leaflet/dist/images/marker-icon.png'
import markerRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'
import 'leaflet/dist/leaflet.css'
import { hasCoordinates, locatedRequests, SEMEY_CENTER } from '../../requests/location.js'

const icon = new Icon({ iconUrl: markerUrl, iconRetinaUrl: markerRetinaUrl, shadowUrl, iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] })

function MapInteraction({ onPick, disabled, bounds }) {
  const map = useMap()
  useMapEvents({ click(event) {
    if (!onPick || disabled) return
    const point = event.latlng.wrap()
    const location = { latitude: point.lat, longitude: point.lng }
    if (hasCoordinates(location)) onPick(location)
  } })
  useEffect(() => {
    const points = JSON.parse(bounds)
    if (points.length === 1) map.setView(points[0], 15)
    else if (points.length > 1) map.fitBounds(points, { padding: [35, 35], maxZoom: 15 })
    else map.setView(SEMEY_CENTER, 12)
  }, [map, bounds])
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map])
  return null
}

export default function LeafletMap({ requests = [], value, onPick, onOpen, authority = false, disabled = false }) {
  const [tileError, setTileError] = useState(false)
  const [tileLoading, setTileLoading] = useState(true)
  const rows = locatedRequests(requests)
  // Selecting a point must not recenter the picker or trigger submission.
  const bounds = JSON.stringify(onPick ? [] : rows.map(row => [row.latitude, row.longitude]))
  return <><MapContainer center={SEMEY_CENTER} zoom={12} scrollWheelZoom={false} className="request-leaflet-map"><TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution={'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'} eventHandlers={{ loading: () => setTileLoading(true), load: () => setTileLoading(false), tileerror: () => { setTileError(true); setTileLoading(false) } }} /><MapInteraction onPick={onPick} disabled={disabled} bounds={bounds} />{onPick && hasCoordinates(value) && <Marker icon={icon} position={[value.latitude, value.longitude]} />}{rows.map(row => <Marker key={row.databaseId} icon={icon} position={[row.latitude, row.longitude]}><Popup><strong>{row.id} · {row.title}</strong><p>{row.status}<br />{row.category}<br />{row.address}{authority && <><br />Приоритет: {row.priority}</>}</p>{onOpen && <button type="button" onClick={() => onOpen(row)}>Открыть обращение</button>}</Popup></Marker>)}</MapContainer>{tileError ? <p className="request-map-message" role="status">Не удалось загрузить часть карты. Проверьте соединение; данные обращения сохранены независимо от карты.</p> : tileLoading && <p className="request-map-message" role="status">Загружаем подложку карты…</p>}</>
}
