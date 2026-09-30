import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import App from '../App.jsx'

export default function LandingRoute() {
  const { hash } = useLocation()
  useEffect(() => {
    if (hash !== '#appeal-form') return
    const input = document.getElementById('appeal-text')
    input?.scrollIntoView({ block: 'center' })
    input?.focus({ preventScroll: true })
  }, [hash])
  return <App />
}
