import { useEffect, useRef, useState } from 'react'
import { Map, ArrowRight, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import LandingHeader from './components/LandingHeader.jsx'
import LandingHero from './components/LandingHero.jsx'
import LandingForm from './components/LandingForm.jsx'
import KazakhOrnament from './components/KazakhOrnament.jsx'
import './styles/landing.css'

export default function App() { 
  const navigate = useNavigate() 
  const inputRef = useRef(null) 
  const [notice, setNotice] = useState('')
  const [voiceText, setVoiceText] = useState('')
  const [isListening, setIsListening] = useState(false)
 
  useEffect(() => { 
    if (!notice) return 
    const timeout = setTimeout(() => setNotice(''), 6000) 
    return () => clearTimeout(timeout) 
  }, [notice])

  function focusForm() {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    inputRef.current?.scrollIntoView({ behavior: reduceMotion ? 'instant' : 'smooth', block: 'center' })
    inputRef.current?.focus({ preventScroll: true })
  }

  function showMapNotice() { 
  setNotice('Карта города появится позже.') 
}

function startVoiceInput() {
  // сюда вставим код распознавания голоса
}

  function startVoiceInput() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      setNotice('Ваш браузер не поддерживает голосовой ввод. Попробуйте Chrome или Edge.')
      return
    }

    if (isListening) return

    const recognition = new SpeechRecognition()

    recognition.lang = 'ru-RU'
    recognition.interimResults = false
    recognition.continuous = false
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setIsListening(true)
      setNotice('🎤 Слушаю... Расскажите о проблеме или идее.')
    }

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim()

      if (!transcript) return

      setVoiceText(transcript)
      setNotice('Готово! Проверьте распознанный текст перед отправкой.')

      setTimeout(() => {
        focusForm()
      }, 100)
    }

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        setNotice('Разрешите доступ к микрофону в браузере и попробуйте снова.')
      } else if (event.error === 'no-speech') {
        setNotice('Не удалось услышать речь. Попробуйте ещё раз.')
      } else {
        setNotice('Не удалось распознать речь. Попробуйте ещё раз.')
      }
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    try {
      recognition.start()
    } catch {
      setIsListening(false)
      setNotice('Не удалось запустить микрофон. Попробуйте ещё раз.')
    }
  }

return (
    <>
      <LandingHeader
        onHowItWorks={() => {
          focusForm()
          setNotice('Выберите проблему или идею, опишите её, при желании добавьте до 5 фотографий и нажмите «Продолжить».')
        }}
        onMap={showMapNotice}
        onLogin={() => navigate('/login')}
      />
      <main className="landing">
        <div className="landing-background" aria-hidden="true" />
        <div className="landing-tint" aria-hidden="true" />
        <KazakhOrnament className="ornament-left" />
        <KazakhOrnament className="ornament-right" />
        <KazakhOrnament className="ornament-bottom" />
        <div className="landing-frost" aria-hidden="true" />
        <div className="landing-fade" aria-hidden="true" />
        <div className="landing-content">
          <LandingHero
            onWrite={focusForm}
            onVoice={startVoiceInput}
          />
          <LandingForm
            inputRef={inputRef}
            onNotice={setNotice}
            voiceText={voiceText}
/>
          <button className="nearby-link" type="button" onClick={showMapNotice}>
            <Map size={25} strokeWidth={1.8} />
            <span>Посмотреть идеи и проблемы рядом</span>
            <ArrowRight size={19} />
          </button>
        </div>
      </main>
      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button type="button" aria-label="Закрыть уведомление" onClick={() => setNotice('')}><X size={18} /></button>
        </div>
      )}
    </>
  )
}
