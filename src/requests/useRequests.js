import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/context.js'
import { fetchRequests } from './api.js'
import { requestErrorMessage } from './model.js'

export default function useRequests(scope, enabled = true) {
  const { account } = useAuth()
  const userId = account.user?.id
  const version = useRef(0)
  const [state, setState] = useState({ rows: [], loading: enabled, error: '', userId })
  const reload = useCallback(async () => {
    if (!enabled || !userId) return
    const current = ++version.current
    setState(previous => ({ rows: previous.userId === userId ? previous.rows : [], userId, loading: true, error: '' }))
    try {
      const rows = await fetchRequests(scope, userId)
      if (version.current === current) setState({ rows, userId, loading: false, error: '' })
    } catch (error) {
      if (version.current === current) setState({ rows: [], userId, loading: false, error: requestErrorMessage(error) })
    }
  }, [scope, enabled, userId])
  const invalidate = useCallback(() => { version.current++ }, [])
  useEffect(() => {
    let active = true
    // Defer the initial read; StrictMode cleanup cancels the discarded setup.
    queueMicrotask(() => { if (active) void reload() })
    return () => { active = false; invalidate() }
  }, [reload, invalidate])
  function replaceSaved(row) {
    // Invalidate reads started before the update, so an old response cannot undo it.
    version.current++
    setState(previous => ({ ...previous, loading: false, error: '', rows: previous.rows.map(current => current.databaseId === row.databaseId ? row : current) }))
  }
  return { ...state, rows: state.userId === userId ? state.rows : [], reload, replaceSaved }
}
