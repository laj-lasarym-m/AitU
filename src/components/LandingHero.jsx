import { Mic } from 'lucide-react'

export default function LandingHero({ onWrite, onVoice }) {
  return (
    <section className="landing-hero" aria-labelledby="hero-title">
      <h1 id="hero-title">Город меняется.<br />Начни с голоса.</h1>
      <p>Сообщи о проблеме или предложи идею — AitU поможет.</p>
      <div className="hero-actions">
        <button className="button button-primary" type="button" onClick={onVoice}><Mic size={21} strokeWidth={1.6} />Рассказать голосом</button>
        <button className="button button-outline" type="button" onClick={onWrite}>Написать обращение</button>
      </div>
    </section>
  )
}
