import { APPLICATION_COLUMNS } from './loadAccount.js'

export async function withTimeout(promise, milliseconds = 15000) {
  let timer
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error('Request timed out'), { code: 'timeout' })), milliseconds)
    })])
  } finally { clearTimeout(timer) }
}

export function authErrorMessage(error) {
  const code = error?.code
  if (['invalid_credentials', 'invalid_grant'].includes(code)) return 'Неверный email или пароль.'
  if (['user_already_exists', 'email_exists'].includes(code)) return 'Аккаунт с таким email уже существует.'
  if (code === 'email_not_confirmed') return 'Подтвердите email по ссылке из письма, затем войдите снова.'
  if (code === 'weak_password') return 'Выберите более надёжный пароль: не менее 8 символов.'
  if (['email_address_invalid', 'validation_failed'].includes(code)) return 'Проверьте email и заполненные поля.'
  if (code === '23505') return 'Заявка уже отправлена. Обновите состояние аккаунта.'
  if (['over_email_send_rate_limit', 'over_request_rate_limit'].includes(code) || error?.status === 429) return 'Слишком много попыток. Подождите немного и попробуйте снова.'
  if (['signup_disabled', 'email_provider_disabled'].includes(code)) return 'Регистрация по email сейчас недоступна. Попробуйте позже.'
  if (['42501', '42P01', '42703', 'PGRST204', 'PGRST205', 'unexpected_failure'].includes(code)) return 'Не удалось обработать данные аккаунта. Попробуйте позже или обратитесь в поддержку.'
  return 'Не удалось подключиться к серверу. Попробуйте ещё раз.'
}

export function validateCredentials({ name, email, password, confirmation }, registering = false) {
  if (registering && (!name?.trim() || name.trim().length > 200)) return 'Введите имя длиной до 200 символов.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email?.trim() ?? '')) return 'Введите корректный email.'
  if (!password) return 'Введите пароль.'
  if (registering && password.length < 8) return 'Пароль должен содержать не менее 8 символов.'
  if (registering && password !== confirmation) return 'Пароли не совпадают.'
  return ''
}

export async function registerAccount(client, draft, authority, origin) {
  if (!client) throw new Error('Auth unavailable')
  const { data, error } = await withTimeout(client.auth.signUp({
    email: draft.email.trim(), password: draft.password,
    options: { data: { full_name: draft.name.trim() }, emailRedirectTo: `${origin}/login${authority ? '?apply=authority' : ''}` },
  }))
  if (error) throw error
  // Supabase may obscure duplicate confirmed accounts rather than return an error.
  if (data.user?.identities?.length === 0) throw Object.assign(new Error('Account exists'), { code: 'user_already_exists' })
  return data
}

export function validateAuthorityApplication({ iin, organization, position }) {
  if (!/^[0-9]{12}$/.test(iin)) return 'ИИН должен состоять из 12 цифр.'
  if (!organization.trim() || organization.trim().length > 300) return 'Укажите орган / службу (до 300 символов).'
  if (!position.trim() || position.trim().length > 200) return 'Укажите должность (до 200 символов).'
  return ''
}

export async function submitAuthorityApplication(client, fields) {
  if (!client) throw new Error('Auth unavailable')
  // Defaults/RLS provide user_id and pending status. No privileged fields are sent.
  const { data, error } = await withTimeout(client.from('authority_applications').insert({
    iin: fields.iin, organization: fields.organization.trim(), position: fields.position.trim(),
  }).select(APPLICATION_COLUMNS).single())
  if (error) throw error
  return data
}
