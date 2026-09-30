import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export default function PasswordField({ id, label, value, onChange, autoComplete }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <div className="auth-password">
        <input id={id} name={id} type={visible ? 'text' : 'password'} value={value} onChange={onChange} autoComplete={autoComplete} placeholder="Введите пароль" />
        <button type="button" aria-label={`${visible ? 'Скрыть' : 'Показать'} ${label.toLocaleLowerCase('ru')}`} aria-controls={id} aria-pressed={visible} onClick={() => setVisible(current => !current)}>
          {visible ? <EyeOff size={19} strokeWidth={1.7} /> : <Eye size={19} strokeWidth={1.7} />}
        </button>
      </div>
    </div>
  )
}
