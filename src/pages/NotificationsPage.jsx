import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const TYPE_ICON = {
  new_meetup:    '🗓️',
  new_book:      '📚',
  announcement:  '📣',
  attendance:    '✅',
  challenge:     '📊',
}

export default function NotificationsPage() {
  const { profile } = useAuth()
  const navigate    = useNavigate()
  const [notifs, setNotifs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (profile?.id) fetchNotifs() }, [profile?.id])

  async function fetchNotifs() {
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(60)
    setNotifs(data || [])
    setLoading(false)
    // mark all as read
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', profile.id)
      .eq('read', false)
  }

  async function clearAll() {
    await supabase.from('notifications').delete().eq('user_id', profile.id)
    setNotifs([])
  }

  function timeAgo(ts) {
    const diff = (Date.now() - new Date(ts)) / 1000
    if (diff < 60)   return 'just now'
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`
    if (diff < 86400)return `${Math.floor(diff/3600)}h ago`
    return `${Math.floor(diff/86400)}d ago`
  }

  return (
    <div className="page-wrapper fade-in">
      <div className="section-header">
        <h2 className="section-title">🔔 Notifications</h2>
        {notifs.length > 0 && (
          <button className="btn btn-outline btn-sm" onClick={clearAll}>Clear all</button>
        )}
      </div>

      {loading
        ? <div style={{ display:'flex', justifyContent:'center', padding:'40px 0' }}><div className="spinner" /></div>
        : notifs.length === 0
          ? <div className="empty-state">
              <div className="es-icon">🔔</div>
              <p>You're all caught up!</p>
            </div>
          : notifs.map(n => (
              <div key={n.id}
                onClick={() => n.link && navigate(n.link)}
                style={{
                  display: 'flex', gap: 14, padding: '14px 16px',
                  background: n.read ? 'var(--card)' : '#fff9f0',
                  borderRadius: 'var(--radius)',
                  border: `1px solid ${n.read ? 'var(--border)' : 'var(--amber)'}`,
                  marginBottom: 8,
                  cursor: n.link ? 'pointer' : 'default',
                  transition: 'all 0.18s',
                }}
              >
                {/* Icon */}
                <div style={{
                  width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                  background: n.read ? 'var(--cream)' : 'linear-gradient(135deg,#f0a030,#c8640a)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20,
                }}>
                  {TYPE_ICON[n.type] || '🔔'}
                </div>
                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: n.read ? 500 : 700, fontSize: 14, marginBottom: 3 }}>
                    {n.title}
                    {!n.read && (
                      <span style={{
                        display: 'inline-block', width: 7, height: 7,
                        background: 'var(--amber)', borderRadius: '50%',
                        marginLeft: 8, verticalAlign: 'middle',
                      }} />
                    )}
                  </div>
                  {n.body && (
                    <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 4 }}>
                      {n.body}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{timeAgo(n.created_at)}</div>
                </div>
                {n.link && (
                  <div style={{ fontSize: 16, color: 'var(--muted)', alignSelf: 'center' }}>›</div>
                )}
              </div>
            ))
      }
    </div>
  )
}