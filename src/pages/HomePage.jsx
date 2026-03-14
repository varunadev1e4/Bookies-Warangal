import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import Modal from '../components/Modal'

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

function PastChallenges({ past, ChallengeCard }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ marginBottom: 10 }}>
      <button onClick={() => setOpen(v => !v)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderRadius: 'var(--radius)',
        background: 'var(--cream)', border: '1px dashed var(--border)',
        cursor: 'pointer', fontFamily: 'var(--font-sans)',
        marginBottom: open ? 10 : 0,
      }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🗂️</span>
          Past Challenges
          <span style={{
            background: 'var(--border)', color: 'var(--muted)',
            fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10,
          }}>{past.length}</span>
        </span>
        <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700 }}>{open ? '▲ Hide' : '▼ Show'}</span>
      </button>
      {open && past.map(c => <ChallengeCard key={c.id} c={c} isPast={true} />)}
    </div>
  )
}

export default function HomePage() {
  const { profile, refreshProfile } = useAuth()
  const { success, error: showError } = useToast()
  const navigate = useNavigate()

  const [stats, setStats]             = useState({ members: 0, books: 0, meetups: 0 })
  const [botm, setBotm]               = useState(null)
  const [announcements, setAnnouncements] = useState([])
  const [challenges, setChallenges]   = useState([])
  const [myProgress, setMyProgress]   = useState({})
  const [activity, setActivity]       = useState([])
  const [loading, setLoading]         = useState(true)

  // Book log dialog
  const [logModal, setLogModal]       = useState(null)   // challenge being logged against
  const [logForm,  setLogForm]        = useState({ title:'', author:'', rating:4 })
  const [logSaving, setLogSaving]     = useState(false)

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

  // Opens the dialog — actual save happens in saveBookLog
  function openLogModal(challenge) {
    setLogForm({ title: '', author: '', rating: 4 })
    setLogModal(challenge)
  }

  async function saveBookLog() {
    if (!logForm.title.trim()) { showError('Book title is required'); return }
    const challenge = logModal
    setLogSaving(true)

    const current = myProgress[challenge.id] || 0
    const newVal  = Math.min(challenge.target, current + 1)

    // 1. Save to challenge_reads so it appears in reading history
    await supabase.from('challenge_reads').insert({
      user_id:      profile.id,
      challenge_id: challenge.id,
      title:        logForm.title.trim(),
      author:       logForm.author.trim() || null,
      rating:       logForm.rating,
    })

    // 2. Upsert challenge progress
    const { error } = await supabase
      .from('challenge_progress')
      .upsert(
        { challenge_id: challenge.id, user_id: profile.id, books_completed: newVal },
        { onConflict: 'challenge_id,user_id' }
      )
    if (error) { showError('Could not update progress'); setLogSaving(false); return }

    // 3. Optimistically update bar
    setMyProgress(prev => ({ ...prev, [challenge.id]: newVal }))

    // 4. Award points (fresh fetch to avoid stale closure)
    const { data: freshData } = await supabase
      .from('profiles').select('points').eq('id', profile.id).single()
    const bonusPoints = newVal === challenge.target ? 5 + challenge.points_reward : 5
    await supabase.from('profiles')
      .update({ points: (freshData?.points || 0) + bonusPoints })
      .eq('id', profile.id)

    // 5. Activity feed
    await supabase.from('activity_feed').insert({
      user_id: profile.id,
      action:  'logged a book for',
      target:  challenge.title,
    })

    setLogSaving(false)
    setLogModal(null)

    if (newVal === challenge.target) {
      success(`🏆 Challenge complete! "${logForm.title}" logged · +${bonusPoints} pts!`)
    } else {
      success(`"${logForm.title}" logged! +5 pts · ${newVal}/${challenge.target} done 📚`)
    }
    refreshProfile()
  }

  async function undoProgress(challenge) {
    const current = myProgress[challenge.id] || 0
    if (current <= 0) return
    const newVal = current - 1
    await supabase.from('challenge_progress').upsert(
      { challenge_id: challenge.id, user_id: profile.id, books_completed: newVal },
      { onConflict: 'challenge_id,user_id' }
    )
    setMyProgress(prev => ({ ...prev, [challenge.id]: newVal }))
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
          Keep reading, keep growing. India's fastest-growing reading community.
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
          { icon: '📚', label: 'Library',     to: '/library'     },
          { icon: '🗓️', label: 'Meetups',     to: '/meetups'     },
          { icon: '🏆', label: 'Rankings',    to: '/leaderboard' },
          { icon: '💡', label: 'Suggestions', to: '/suggestions' },
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
      {challenges.length > 0 && (() => {
        const active = challenges.filter(c => !c.end_date || new Date(c.end_date) >= new Date())
        const past   = challenges.filter(c => c.end_date && new Date(c.end_date) < new Date())

        const ChallengeCard = ({ c, isPast }) => {
          const completed = myProgress[c.id] || 0
          const pct       = Math.min(100, Math.round((completed / c.target) * 100))
          const done      = completed >= c.target

          return (
            <div className="card" style={{
              padding: '16px', marginBottom: 10,
              opacity: isPast ? 0.75 : 1,
              background: isPast ? '#faf7f4' : 'var(--card)',
            }}>
              {/* Title row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ flex: 1, paddingRight: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>
                    {c.title}
                    {done && <span style={{ marginLeft: 8 }}>🏆</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {isPast
                      ? `Ended ${new Date(c.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                      : c.end_date
                        ? `Ends ${new Date(c.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
                        : 'No end date'
                    }
                    {' · '}+{c.points_reward} pts reward
                  </div>
                </div>
                <span style={{
                  fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 20, flexShrink: 0,
                  color: done ? 'var(--sage)' : isPast ? 'var(--muted)' : 'var(--amber)',
                }}>{pct}%</span>
              </div>

              {/* Progress bar */}
              <div style={{ height: 10, background: 'var(--cream)', borderRadius: 10, marginBottom: 10, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 10, width: `${pct}%`, transition: 'width 0.5s ease',
                  background: done
                    ? 'linear-gradient(90deg,#3d6b34,#5a9e4a)'
                    : isPast
                      ? 'linear-gradient(90deg,#aaa,#ccc)'
                      : 'linear-gradient(90deg,var(--amber),var(--amber-light))',
                }} />
              </div>

              {/* Bottom row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                  <strong style={{ color: 'var(--ink)', fontFamily: 'var(--font-serif)', fontSize: 16 }}>{completed}</strong>
                  {' / '}{c.target} books
                  {done && <span style={{ color: 'var(--sage)', fontWeight: 700, marginLeft: 8 }}>Complete!</span>}
                </span>

                {/* Active challenge buttons */}
                {!isPast && !done && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {completed > 0 && (
                      <button onClick={() => undoProgress(c)} title="Undo last entry" style={{
                        width: 30, height: 30, borderRadius: 8,
                        border: '1.5px solid var(--border)', background: 'transparent',
                        cursor: 'pointer', fontSize: 15, color: 'var(--muted)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>−</button>
                    )}
                    <button onClick={() => openLogModal(c)} style={{
                      padding: '6px 14px', borderRadius: 8, background: 'var(--amber)',
                      color: '#fff', border: 'none', cursor: 'pointer',
                      fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)',
                    }}>📖 +1 Book</button>
                  </div>
                )}
                {!isPast && done && (
                  <span style={{ padding: '6px 12px', borderRadius: 8, background: '#e8f5e9', color: 'var(--sage)', fontSize: 12, fontWeight: 700 }}>✅ Done!</span>
                )}
                {isPast && done && (
                  <span style={{ padding: '6px 10px', borderRadius: 8, background: '#e8f5e9', color: 'var(--sage)', fontSize: 11, fontWeight: 700 }}>✅ Completed</span>
                )}
                {isPast && !done && (
                  <span style={{ padding: '6px 10px', borderRadius: 8, background: '#fdecea', color: '#c0392b', fontSize: 11, fontWeight: 700 }}>⏰ Missed</span>
                )}
              </div>
            </div>
          )
        }

        return (
          <>
            {/* Active challenges */}
            {active.length > 0 && (
              <>
                <div className="section-header">
                  <h2 className="section-title">📊 Active Challenges</h2>
                </div>
                {active.map(c => <ChallengeCard key={c.id} c={c} isPast={false} />)}
              </>
            )}

            {/* Past challenges — collapsible */}
            {past.length > 0 && (
              <PastChallenges past={past} ChallengeCard={ChallengeCard} />
            )}
          </>
        )
      })()}

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

      {/* ── Log Book Modal ── */}
      <Modal open={!!logModal} onClose={() => setLogModal(null)} title="📖 Log a Book">
        {logModal && (
          <>
            <div style={{
              background: 'var(--cream)', borderRadius: 10, padding: '10px 14px',
              fontSize: 12, color: 'var(--muted)', marginBottom: 16,
            }}>
              Challenge: <strong style={{ color: 'var(--ink)' }}>{logModal.title}</strong>
              <span style={{ marginLeft: 8 }}>· {myProgress[logModal.id] || 0}/{logModal.target} done</span>
            </div>

            <div className="form-group">
              <label className="form-label">Book Title *</label>
              <input className="input" placeholder="e.g. The God of Small Things"
                value={logForm.title}
                onChange={e => setLogForm(f => ({ ...f, title: e.target.value }))}
                autoFocus />
            </div>

            <div className="form-group">
              <label className="form-label">Author</label>
              <input className="input" placeholder="e.g. Arundhati Roy"
                value={logForm.author}
                onChange={e => setLogForm(f => ({ ...f, author: e.target.value }))} />
            </div>

            <div className="form-group">
              <label className="form-label">Your Rating</label>
              <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
                {[1,2,3,4,5].map(n => (
                  <button key={n} type="button"
                    onClick={() => setLogForm(f => ({ ...f, rating: n }))}
                    style={{
                      width: 42, height: 42, borderRadius: 10, fontSize: 20,
                      border: `2px solid ${logForm.rating >= n ? 'var(--amber)' : 'var(--border)'}`,
                      background: logForm.rating >= n ? '#fff8ee' : 'transparent',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}>⭐</button>
                ))}
                <span style={{ fontSize: 13, color: 'var(--muted)', marginLeft: 4 }}>
                  {['','Awful','Poor','Okay','Good','Amazing'][logForm.rating]}
                </span>
              </div>
            </div>

            <div className="form-actions">
              <button className="btn btn-primary btn-lg" onClick={saveBookLog} disabled={logSaving}>
                {logSaving ? <><span className="spinner spinner-sm" /> Saving…</> : '✅ Log Book (+5 pts)'}
              </button>
              <button className="btn btn-outline" onClick={() => setLogModal(null)}>Cancel</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}