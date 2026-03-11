import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

function StatCard({ num, label }) {
  return (
    <div style={{
      textAlign: 'center',
      background: 'rgba(255,255,255,0.07)',
      borderRadius: 10, padding: '12px 8px',
    }}>
      <span style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 900, color: '#f0a030', display: 'block' }}>
        {num ?? '–'}
      </span>
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>{label}</span>
    </div>
  )
}

function ActivityItem({ item }) {
  const initials = item.profiles?.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'
  const actionText = {
    borrowed: `borrowed "${item.target}"`,
    returned: `returned "${item.target}" and earned points`,
  }[item.action] || item.action

  const timeAgo = (ts) => {
    const diff = (Date.now() - new Date(ts)) / 1000
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`
    return `${Math.floor(diff/86400)}d ago`
  }

  return (
    <div style={{ display: 'flex', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--border)' }}>
      <div className="avatar avatar-sm">{initials}</div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 13, lineHeight: 1.5 }}>
          <strong>{item.profiles?.name}</strong> {actionText}
        </p>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>{timeAgo(item.created_at)}</span>
      </div>
    </div>
  )
}

export default function HomePage() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [stats, setStats]             = useState({ members: 0, books: 0, meetups: 0 })
  const [botm, setBotm]               = useState(null)
  const [announcements, setAnnouncements] = useState([])
  const [challenges, setChallenges]   = useState([])
  const [myProgress, setMyProgress]   = useState({})
  const [activity, setActivity]       = useState([])
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    fetchAll()
  }, [profile?.id])

  async function fetchAll() {
    setLoading(true)
    await Promise.all([
      fetchStats(),
      fetchBOTM(),
      fetchAnnouncements(),
      fetchChallenges(),
      fetchActivity(),
    ])
    setLoading(false)
  }

  async function fetchStats() {
    const [{ count: members }, { count: books }, { count: meetups }] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('books').select('*', { count: 'exact', head: true }),
      supabase.from('meetups').select('*', { count: 'exact', head: true }),
    ])
    setStats({ members: members || 0, books: books || 0, meetups: meetups || 0 })
  }

  async function fetchBOTM() {
    const now = new Date()
    const { data } = await supabase
      .from('book_of_month')
      .select('*, books(*)')
      .eq('month', now.getMonth() + 1)
      .eq('year', now.getFullYear())
      .maybeSingle()
    setBotm(data)
  }

  async function fetchAnnouncements() {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(3)
    setAnnouncements(data || [])
  }

  async function fetchChallenges() {
    const { data: challs } = await supabase
      .from('challenges')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(3)
    setChallenges(challs || [])

    if (profile?.id && challs?.length) {
      const { data: prog } = await supabase
        .from('challenge_progress')
        .select('*')
        .eq('user_id', profile.id)
        .in('challenge_id', challs.map(c => c.id))
      const map = {}
      prog?.forEach(p => { map[p.challenge_id] = p.books_completed })
      setMyProgress(map)
    }
  }

  async function fetchActivity() {
    const { data } = await supabase
      .from('activity_feed')
      .select('*, profiles(name)')
      .order('created_at', { ascending: false })
      .limit(8)
    setActivity(data || [])
  }

  const firstName = profile?.name?.split(' ')[0] || 'Reader'

  return (
    <div className="page-wrapper fade-in">
      {/* ── Hero ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1a0a00 0%, #3a1200 100%)',
        borderRadius: 'var(--radius-lg)',
        padding: '26px 22px',
        marginBottom: 18,
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', right: -8, top: -8, fontSize: 110, opacity: 0.06, transform: 'rotate(12deg)', pointerEvents: 'none' }}>📚</div>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 900, color: '#f0a030', marginBottom: 5 }}>
          Welcome back, {firstName}! {profile?.role === 'admin' ? '⚡' : '👋'}
        </h2>
        <p style={{ fontSize: 13, opacity: 0.75, lineHeight: 1.5 }}>
          Keep reading, keep growing. Warangal's biggest reading community.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 18 }}>
          <StatCard num={stats.members} label="Members" />
          <StatCard num={stats.books}   label="Books"   />
          <StatCard num={stats.meetups} label="Meetups" />
        </div>
      </div>

      {/* ── Announcements ── */}
      {announcements.length > 0 && (
        <>
          <div className="section-header">
            <h2 className="section-title">📢 Announcements</h2>
          </div>
          {announcements.map(a => (
            <div key={a.id} style={{
              background: 'linear-gradient(135deg, #1a3a1a, #2a5a2a)',
              borderRadius: 'var(--radius)', padding: '14px 16px',
              color: '#fff', marginBottom: 10, display: 'flex', gap: 12,
            }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>📣</span>
              <div>
                <h4 style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{a.title}</h4>
                <p style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.5 }}>{a.body}</p>
              </div>
            </div>
          ))}
        </>
      )}

      {/* ── Book of the Month ── */}
      {botm?.books && (
        <>
          <div className="section-header" style={{ marginTop: 4 }}>
            <h2 className="section-title">📖 Book of the Month</h2>
          </div>
          <div style={{
            background: 'linear-gradient(135deg, #2d1200, #4a2000)',
            borderRadius: 'var(--radius)', padding: '18px',
            display: 'flex', gap: 14, color: '#fff', marginBottom: 18,
          }}>
            <div style={{
              width: 68, height: 94, borderRadius: 8, background: 'var(--amber)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 36, flexShrink: 0, boxShadow: '4px 4px 12px rgba(0,0,0,0.4)',
            }}>{botm.books.emoji}</div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 10, color: '#f0a030', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
                Featured this month
              </span>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 700, margin: '4px 0' }}>{botm.books.title}</div>
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>by {botm.books.author}</div>
              {botm.progress_percent > 0 && (
                <>
                  <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, height: 6, marginBottom: 5 }}>
                    <div style={{ background: '#f0a030', borderRadius: 10, height: '100%', width: `${botm.progress_percent}%` }} />
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.65 }}>{botm.progress_percent}% members reading</div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Quick Actions ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 22 }}>
        {[
          { icon: '📚', label: 'Borrow Book',  to: '/library'     },
          { icon: '🗓️', label: 'Meetups',      to: '/meetups'     },
          { icon: '🏆', label: 'Rankings',     to: '/leaderboard' },
          { icon: '👤', label: 'My Profile',   to: '/profile'     },
        ].map(qa => (
          <div key={qa.to} onClick={() => navigate(qa.to)}
            style={{
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '14px 6px', textAlign: 'center',
              cursor: 'pointer', transition: 'all 0.18s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--amber)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <span style={{ fontSize: 22, display: 'block', marginBottom: 5 }}>{qa.icon}</span>
            <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>{qa.label}</span>
          </div>
        ))}
      </div>

      {/* ── Reading Challenges ── */}
      {challenges.length > 0 && (
        <>
          <div className="section-header">
            <h2 className="section-title">📊 Challenges</h2>
          </div>
          {challenges.map(c => {
            const completed = myProgress[c.id] || 0
            const pct = Math.min(100, Math.round((completed / c.target) * 100))
            return (
              <div key={c.id} className="card" style={{ padding: '14px 16px', marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{c.title}</span>
                  <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 18, color: 'var(--amber)' }}>{pct}%</span>
                </div>
                <div style={{ height: 8, background: 'var(--cream)', borderRadius: 10 }}>
                  <div style={{ height: '100%', borderRadius: 10, background: 'linear-gradient(90deg, var(--amber), var(--amber-light))', width: `${pct}%`, transition: 'width 0.6s' }} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                  {completed} of {c.target} books
                  {c.end_date && ` · Ends ${new Date(c.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                  {` · +${c.points_reward} pts reward`}
                </div>
              </div>
            )
          })}
        </>
      )}

      {/* ── Activity Feed ── */}
      <div className="section-header" style={{ marginTop: 10 }}>
        <h2 className="section-title">🔥 Club Activity</h2>
      </div>
      <div className="card" style={{ padding: '4px 16px' }}>
        {loading
          ? <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}><div className="spinner" /></div>
          : activity.length
            ? activity.map((item, i) => (
                <div key={item.id} style={{ borderBottom: i === activity.length - 1 ? 'none' : undefined }}>
                  <ActivityItem item={item} />
                </div>
              ))
            : (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                No activity yet — be the first to borrow a book! 📚
              </div>
            )
        }
      </div>
    </div>
  )
}
