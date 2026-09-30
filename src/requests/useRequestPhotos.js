import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/context.js'
import { isRealRequest } from './model.js'
import { loadRequestPhotos, photoErrorMessage } from './photos.js'

export default function useRequestPhotos(request) {
  const { account } = useAuth()
  const userId = account.user?.id
  const requestId = isRealRequest(request) ? request.databaseId : null
  const key = `${userId || ''}/${requestId || ''}`
  const [state, setState] = useState({ key, photos: [], loading: Boolean(requestId), error: '' })
  const sequence = useRef(0)
  const invalidate = useCallback(() => { sequence.current++ }, [])
  const reload = useCallback(async () => {
    if (!requestId || !userId) return
    const current = ++sequence.current
    setState({ key, photos: [], loading: true, error: '' })
    try {
      const photos = await loadRequestPhotos({ source: 'database', databaseId: requestId }, userId)
      if (sequence.current === current) setState({ key, photos, loading: false, error: '' })
    } catch (error) {
      if (sequence.current === current) setState({ key, photos: [], loading: false, error: photoErrorMessage(error) })
    }
  }, [requestId, userId, key])
  useEffect(() => {
    let active = true
    queueMicrotask(() => { if (active) void reload() })
    // URLs stay only in this mounted detail view; renew before five-minute expiry.
    const timer = requestId ? setInterval(() => { void reload() }, 240000) : null
    return () => { active = false; clearInterval(timer); invalidate() }
  }, [reload, requestId, invalidate])
  return { ...(state.key === key ? state : { photos: [], loading: Boolean(requestId), error: '' }), reload }
}
