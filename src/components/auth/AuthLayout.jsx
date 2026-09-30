import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import ThemeToggle from '../ThemeToggle.jsx'
import '../../styles/auth.css'

export function AuthLogo({ className = 'auth-logo' }) {
  return (
    <Link to="/" className={className} aria-label="AitU — на главную">
      <span>Ait<span>U</span></span>
      <svg viewBox="0 0 36 42" fill="none" aria-hidden="true">
        {[12, 24, 36, 24, 12].map((height, index) => <path key={index} d={`M${4 + index * 7} ${(42 - height) / 2}v${height}`} stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />)}
      </svg>
    </Link>
  )
}

export default function AuthLayout({ children, wide = false }) {
  return (
    <div className="auth-page">
      <header className="auth-topbar">
        <Link to="/" className="auth-back"><ArrowLeft size={18} /><span>Вернуться на главную</span></Link>
        <ThemeToggle className="auth-theme-toggle" />
      </header>
      <main className={`auth-main${wide ? ' auth-main-wide' : ''}`}>{children}</main>
    </div>
  )
}
