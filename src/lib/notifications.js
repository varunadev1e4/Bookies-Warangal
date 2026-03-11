// Helper to send notifications to all members or specific users
import { supabase } from './supabase'

export async function notifyAllMembers({ type, title, body, link }) {
  const { data: members } = await supabase
    .from('profiles')
    .select('id')
  if (!members?.length) return
  const rows = members.map(m => ({ user_id: m.id, type, title, body, link }))
  await supabase.from('notifications').insert(rows)
}

export async function notifyUser({ userId, type, title, body, link }) {
  await supabase.from('notifications').insert({ user_id: userId, type, title, body, link })
}