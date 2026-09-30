import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import ThemeToggle from './ThemeToggle.jsx'

export default function LandingHeader({ onHowItWorks, onMap, onLogin }) {
  const [languageOpen, setLanguageOpen] = useState(false)
  const languageRef = useRef(null)
  const triggerRef = useRef(null)

  useEffect(() => {
    if (!languageOpen) return
    function closeOutside(event) {
      if (!languageRef.current?.contains(event.target)) setLanguageOpen(false)
    }
    function closeOnEscape(event) {
      if (event.key === 'Escape') {
        setLanguageOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [languageOpen])

  return (
    <header className="landing-header">
      <div className="header-inner">
        <a className="brand" href="#" aria-label="AitU — AI to You, главная">
          <svg className="brand-wave" viewBox="0 0 50 48" fill="none" aria-hidden="true">
            {[8, 18, 30, 42, 30, 18, 8].map((height, index) => (
              <path key={index} d={`M${4 + index * 7} ${(48 - height) / 2}v${height}`} stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            ))}
          </svg>
          <span className="brand-type"><span className="brand-name">Ait<span>U</span></span><span className="brand-tagline">AI to You</span></span>
        </a>
        <nav className="header-nav" aria-label="Основная навигация">
          <button className="nav-link" type="button" onClick={onHowItWorks}>Как это работает</button>
          <button className="nav-link" type="button" onClick={onMap}>Карта города</button>
          <div className="language" ref={languageRef} onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setLanguageOpen(false)
          }}>
            <button ref={triggerRef} className="language-trigger" type="button" aria-expanded={languageOpen} aria-controls="language-options" onClick={() => setLanguageOpen(!languageOpen)}>
              РУС <ChevronDown size={15} className={languageOpen ? 'chevron-open' : ''} />
            </button>
            {languageOpen && (
              <div className="language-options" id="language-options" aria-label="Язык сайта">
                <button type="button" onClick={() => setLanguageOpen(false)}>Русский <Check size={16} /></button>
                <button type="button" disabled>Қазақша <small>Скоро</small></button>
                <button type="button" disabled>English <small>Скоро</small></button>
              </div>
            )}
          </div>
          <ThemeToggle />
          <button className="button button-primary login-button" type="button" onClick={onLogin}>Войти</button>
        </nav>
      </div>
    </header>
  )
}
