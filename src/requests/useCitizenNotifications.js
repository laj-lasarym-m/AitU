import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { createNotificationStore } from './notificationStore.js'

export default function useCitizenNotifications(userId) {
  const store = useMemo(() => createNotificationStore(userId), [userId])
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  useEffect(() => store.start(), [store])
  return { ...state, refresh: store.refresh, markRead: store.markRead, markAllRead: store.markAllRead, dismissToast: store.dismissToast }
}
