import { supabase } from '../lib/supabase.js'
import { withTimeout } from '../auth/actions.js'

async function owner(client, expectedUserId) {
  if (!client || !expectedUserId) throw new Error('Authentication required')
  const { data, error } = await withTimeout(client.auth.getUser())
  if (error || data?.user?.id !== expectedUserId) throw new Error('Session changed')
  return expectedUserId
}
export function notificationError(error) {
  return ['42P01', 'PGRST205'].includes(error?.code) ? 'Уведомления ещё не подключены. Требуется новая миграция.' : 'Не удалось загрузить или обновить уведомления. Попробуйте ещё раз.'
}
export async function fetchNotifications(userId, client = supabase) {
  await owner(client, userId)
  const rows = []
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await withTimeout(client.from('notifications')
      .select('id,user_id,request_id,request_number,type,title,message,is_read,created_at')
      .eq('user_id', userId).order('created_at', { ascending: false }).order('id').range(offset, offset + 99))
    if (error) throw error
    rows.push(...data)
    if (data.length < 100) return rows
  }
}
export async function markNotificationsRead(userId, id = null, client = supabase) {
  await owner(client, userId)
  let query = client.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false)
  if (id) query = query.eq('id', id)
  const { error } = await withTimeout(query)
  if (error) throw error
}
