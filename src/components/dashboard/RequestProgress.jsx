import { Check } from 'lucide-react'

export default function RequestProgress({ step }) {
  return (
    <ol className="db-progress" aria-label="Статус обращения">
      {['Получена', 'На рассмотрении', 'В работе', 'Завершена'].map((label, index) => (
        <li key={label} className={`${index < step ? 'is-complete' : ''} ${index === step ? 'is-current' : ''}`} aria-current={index === step ? 'step' : undefined}>
          <span className="db-progress-dot">{index < step && <Check size={15} strokeWidth={2.5} />}</span><span>{label}</span>
        </li>
      ))}
    </ol>
  )
}
