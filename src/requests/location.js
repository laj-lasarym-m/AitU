import { isRealRequest } from './model.js'

export const SEMEY_CENTER = [50.411, 80.2275]

export function hasCoordinates(value) {
  return Number.isFinite(value?.latitude) && Number.isFinite(value?.longitude)
    && value.latitude >= -90 && value.latitude <= 90
    && value.longitude >= -180 && value.longitude <= 180
}

export function locationPayload(input) {
  if (input.latitude == null && input.longitude == null) return {}
  if (!hasCoordinates(input)) throw Object.assign(new Error('Выберите допустимую точку на карте.'), { code: 'VALIDATION' })
  return { latitude: input.latitude, longitude: input.longitude }
}

// Only filter the already authorized fetch result. Never supplement it with demo
// rows, address guesses or a separate public/city-wide database query.
export function locatedRequests(rows, { status = '', category = '' } = {}) {
  return rows.filter(row => isRealRequest(row) && hasCoordinates(row)
    && (!status || row.statusCode === status) && (!category || row.category === category))
}
