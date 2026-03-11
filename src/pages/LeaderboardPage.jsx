import React, { useEffect, useState } from 'react'
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
  const [limit, setLimit]     = useState(10)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)

  // Keep tab/limit in a ref so the realtime callback always sees latest values
  const tabRef   = React.useRef(tab)
  const limitRef = React.useRef(limit)
  useEffect(() => { tabRef.current = tab },   [tab])
  useEffect(() => { limitRef.current = limit }, [limit])

  useEffect(() => {
    fetchMembers()

    // Realtime: re-fetch whenever any profile row changes (points/books_read update)
    const channel = supabase
      .channel('leaderboard-live')
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  'profiles',
      }, () => fetchMembers())
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [tab, limit, location.key])

  async function fetchMembers() {
    setLoading(true)
    setFetchError(null)
    const orderCol = tabRef.current === 'books' ? 'books_read' : 'points'
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, points, books_read, role, joined_at')
      .order(orderCol, { ascending: false })
      .limit(limitRef.current)
    if (error) {
      console.error('Leaderboard fetch error:', error)
      setFetchError(error.message)
      setMembers([])
    } else {
      setMembers(data || [])
    }
    setLoading(false)
  }

  const top3 = members.slice(0, Math.min(3, members.length))
  const rest  = members.slice(3)

  return (
    <div className="page-wrapper fade-in">
      <h2 className="section-title" style={{ marginBottom: 16 }}>🏆 Leaderboard</h2>

      {/* Tab row + limit pills */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div className="tabs" style={{ margin: 0 }}>
          <button className={`tab ${tab === 'points' ? 'active' : ''}`} onClick={() => setTab('points')}>By Points</button>
          <button className={`tab ${tab === 'books'  ? 'active' : ''}`} onClick={() => setTab('books')}>Books Read</button>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[10, 20, 50].map(n => (
            <button key={n} onClick={() => setLimit(n)} style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
              border: '1.5px solid', cursor: 'pointer', transition: 'all 0.18s',
              background: limit === n ? 'var(--amber)' : 'transparent',
              color:      limit === n ? '#fff' : 'var(--amber)',
              borderColor: 'var(--amber)',
            }}>Top {n}</button>
          ))}
        </div>
      </div>

      {loading
        ? <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><div className="spinner" /></div>
        : fetchError
          ? <div className="empty-state">
              <div className="es-icon">⚠️</div>
              <p style={{ color: '#c0392b', fontSize: 13 }}>{fetchError}</p>
            </div>
        : members.length === 0
          ? <div className="empty-state"><div className="es-icon">🏆</div><p>No members yet.</p></div>
          : (
            <>
              {/* Podium — works with 1, 2 or 3 members */}
              {top3.length > 0 && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: top3.length === 1 ? '1fr' : top3.length === 2 ? '1fr 1fr' : '1fr 1.2fr 1fr',
                  gap: 8, marginBottom: 20, alignItems: 'flex-end',
                }}>
                  {top3.length === 1 && <PodiumCard member={top3[0]} rank={1} />}
                  {top3.length === 2 && <>
                    <PodiumCard member={top3[0]} rank={1} style={{ paddingTop: 24 }} />
                    <PodiumCard member={top3[1]} rank={2} />
                  </>}
                  {top3.length >= 3 && <>
                    <PodiumCard member={top3[1]} rank={2} />
                    <PodiumCard member={top3[0]} rank={1} style={{ paddingTop: 24 }} />
                    <PodiumCard member={top3[2]} rank={3} />
                  </>}
                </div>
              )}

              {/* Full ranked table — all members */}
              <div className="card" style={{ overflow: 'hidden', marginBottom: 20 }}>
                {/* Table header */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '40px 1fr 70px 70px',
                  padding: '10px 14px', background: 'var(--cream)',
                  borderBottom: '1px solid var(--border)',
                  fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5,
                }}>
                  <span>#</span>
                  <span>Member</span>
                  <span style={{ textAlign: 'center' }}>Books</span>
                  <span style={{ textAlign: 'right' }}>Points</span>
                </div>

                {/* Table rows */}
                {members.map((m, i) => {
                  const rank  = i + 1
                  const badge = getBadge(m.points)
                  const isMe  = m.id === profile?.id
                  const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null

                  return (
                    <div key={m.id} style={{
                      display: 'grid', gridTemplateColumns: '40px 1fr 70px 70px',
                      alignItems: 'center', padding: '11px 14px',
                      background: isMe ? '#fff9f0' : i % 2 === 0 ? 'var(--card)' : '#fdfaf7',
                      borderBottom: '1px solid var(--border)',
                      borderLeft: isMe ? '3px solid var(--amber)' : '3px solid transparent',
                    }}>
                      {/* Rank */}
                      <div style={{ fontWeight: 800, fontSize: rankEmoji ? 18 : 14, color: 'var(--muted)', textAlign: 'center' }}>
                        {rankEmoji || rank}
                      </div>

                      {/* Name + badge */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                          background: isMe ? 'var(--amber)' : 'var(--cream)',
                          border: `2px solid ${isMe ? 'var(--amber)' : 'var(--border)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 800, color: isMe ? '#fff' : 'var(--ink)',
                        }}>{initials(m.name)}</div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {m.name} {isMe && <span style={{ color: 'var(--amber)', fontSize: 10 }}>(You)</span>}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--muted)' }}>{badge.badge} {badge.title}</div>
                        </div>
                      </div>

                      {/* Books read */}
                      <div style={{ textAlign: 'center', fontWeight: tab === 'books' ? 800 : 400, fontSize: 13, color: tab === 'books' ? 'var(--amber)' : 'var(--muted)' }}>
                        {m.books_read || 0}
                      </div>

                      {/* Points */}
                      <div style={{ textAlign: 'right', fontFamily: 'var(--font-serif)', fontWeight: tab === 'points' ? 800 : 600, fontSize: 14, color: tab === 'points' ? 'var(--amber)' : 'var(--ink)' }}>
                        {m.points || 0}
                      </div>
                    </div>
                  )
                })}
              </div>

              {profile && !members.find(m => m.id === profile.id) && (
                <div style={{ textAlign: 'center', padding: '10px 0 20px', fontSize: 13, color: 'var(--muted)' }}>
                  You're not in the top {limit} yet — keep reading! 📚
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