import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const BADGE_MAP = [
  { min: 2000, badge: '👑', title: 'Legend'        },
  { min: 1500, badge: '🌟', title: 'Champion'      },
  { min: 1000, badge: '🏆', title: 'Gold Reader'   },
  { min:  700, badge: '🥈', title: 'Silver Reader' },
  { min:  400, badge: '🥉', title: 'Bronze Reader' },
  { min:    0, badge: '📖', title: 'Reader'        },
]

function getBadge(points) {
  return BADGE_MAP.find(b => points >= b.min) || BADGE_MAP[BADGE_MAP.length - 1]
}

function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function PodiumCard({ member, rank, style = {} }) {
  const rankStyle = {
    1: { bg: 'linear-gradient(135deg,#c8960a,#f0c040)', emoji: '🥇' },
    2: { bg: 'linear-gradient(135deg,#7a8090,#aab0c0)', emoji: '🥈' },
    3: { bg: 'linear-gradient(135deg,#7a3a10,#b06030)', emoji: '🥉' },
  }[rank] || {}

  return (
    <div style={{
      textAlign: 'center', padding: '16px 8px 12px',
      borderRadius: 'var(--radius)', background: rankStyle.bg,
      color: '#fff', ...style,
    }}>
      <div style={{ fontSize: 24, marginBottom: 6 }}>{rankStyle.emoji}</div>
      <div style={{
        width: 52, height: 52, borderRadius: '50%',
        background: 'rgba(255,255,255,0.25)',
        margin: '0 auto 8px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, fontWeight: 800,
        border: '3px solid rgba(255,255,255,0.45)',
      }}>{initials(member?.name)}</div>
      <div style={{ fontWeight: 700, fontSize: 13 }}>{member?.name?.split(' ')[0] || '–'}</div>
      <div style={{ fontSize: 11, opacity: 0.85, marginTop: 3 }}>
        {member?.points || 0} pts
      </div>
    </div>
  )
}

export default function LeaderboardPage() {
  const { profile } = useAuth()
  const location = useLocation()
  const [members, setMembers] = useState([])
  const [tab, setTab]         = useState('points')
  const [loading, setLoading] = useState(true)

  // Refetch whenever the user navigates to this page OR switches tab
  useEffect(() => { fetchMembers() }, [tab, location.key])

  async function fetchMembers() {
    setLoading(true)
    const orderCol = tab === 'books' ? 'books_read' : 'points'
    const { data } = await supabase
      .from('profiles')
      .select('id, name, points, books_read, role, joined_at')
      .order(orderCol, { ascending: false })
      .limit(50)
    setMembers(data || [])
    setLoading(false)
  }

  const top3 = members.slice(0, 3)
  const rest  = members.slice(3)

  return (
    <div className="page-wrapper fade-in">
      <h2 className="section-title" style={{ marginBottom: 16 }}>🏆 Leaderboard</h2>

      <div className="tabs">
        <button className={`tab ${tab === 'points'  ? 'active' : ''}`} onClick={() => setTab('points')}>By Points</button>
        <button className={`tab ${tab === 'books'   ? 'active' : ''}`} onClick={() => setTab('books')}>Books Read</button>
      </div>

      {loading
        ? <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><div className="spinner" /></div>
        : members.length === 0
          ? <div className="empty-state"><div className="es-icon">🏆</div><p>No members yet.</p></div>
          : (
            <>
              {/* Podium */}
              {top3.length >= 3 && (
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr',
                  gap: 8, marginBottom: 20, alignItems: 'flex-end',
                }}>
                  <PodiumCard member={top3[1]} rank={2} />
                  <PodiumCard member={top3[0]} rank={1} style={{ paddingTop: 24 }} />
                  <PodiumCard member={top3[2]} rank={3} />
                </div>
              )}

              {/* Rest of the list */}
              {rest.map((m, i) => {
                const rank = i + 4
                const badge = getBadge(m.points)
                const isMe = m.id === profile?.id

                return (
                  <div key={m.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px',
                    background: isMe ? '#fff9f0' : 'var(--card)',
                    borderRadius: 'var(--radius)',
                    border: `1px solid ${isMe ? 'var(--amber)' : 'var(--border)'}`,
                    marginBottom: 8,
                    transition: 'all 0.18s',
                  }}>
                    <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 18, color: 'var(--muted)', width: 28, textAlign: 'center' }}>
                      {rank}
                    </div>
                    <div className="avatar avatar-md">{initials(m.name)}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {m.name} {isMe && <span style={{ fontSize: 11, color: 'var(--amber)', fontWeight: 700 }}>(You)</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                        {m.books_read} books read · {badge.title}
                      </div>
                    </div>
                    <div style={{ fontSize: 20 }}>{badge.badge}</div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 18, color: 'var(--amber)' }}>
                      {tab === 'books' ? m.books_read : m.points}
                    </div>
                  </div>
                )
              })}

              {/* My rank if not in view */}
              {profile && !members.slice(0, 50).find(m => m.id === profile.id) && (
                <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 13, color: 'var(--muted)' }}>
                  You're not in the top 50 yet — keep reading! 📚
                </div>
              )}
            </>
          )
      }

      {/* Badge legend */}
      <div className="card" style={{ marginTop: 20, padding: '16px' }}>
        <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>🏅 Badge Guide</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {BADGE_MAP.map(b => (
            <div key={b.badge} style={{ textAlign: 'center', padding: '10px 6px', background: 'var(--cream)', borderRadius: 10 }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>{b.badge}</div>
              <div style={{ fontWeight: 600, fontSize: 12 }}>{b.title}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{b.min}+ pts</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}