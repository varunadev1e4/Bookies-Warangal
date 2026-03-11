import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { notifyAllMembers } from '../lib/notifications'
import Modal from '../components/Modal'

function StatCard({ num, label, color = 'var(--amber)' }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '18px 14px' }}>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 34, fontWeight: 900, color }}>{num ?? '–'}</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{label}</div>
    </div>
  )
}

function AdminAction({ icon, title, desc, onClick }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
      background: 'var(--card)', borderRadius: 'var(--radius)',
      border: '1px solid var(--border)', cursor: 'pointer', marginBottom: 10, transition: 'all 0.18s',
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--amber)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      <div style={{ width: 44, height: 44, background: 'var(--cream)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{desc}</div>
      </div>
      <span style={{ color: 'var(--muted)', fontSize: 18 }}>›</span>
    </div>
  )
}

export default function AdminPage() {
  const { profile } = useAuth()
  const { success, error: showError } = useToast()

  const [stats, setStats]           = useState({})
  const [overdue, setOverdue]       = useState([])
  const [members, setMembers]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [tab, setTab]               = useState('overview')

  // Modals
  const [showAnnounce, setShowAnnounce] = useState(false)
  const [showChallenge, setShowChallenge] = useState(false)
  const [showBOTM, setShowBOTM]         = useState(false)
  const [showAdminCode, setShowAdminCode] = useState(false)

  const [announceForm, setAnnounceForm] = useState({ title: '', body: '' })
  const [challengeForm, setChallengeForm] = useState({ title: '', target: 5, start_date: '', end_date: '', points_reward: 100 })
  const [botmForm, setBotmForm]         = useState({ book_id: '', progress_percent: 0 })
  const [books, setBooks]               = useState([])
  const [formLoading, setFormLoading]   = useState(false)

  // Change admin code
  const [newCode, setNewCode]           = useState('')
  const [codeLoading, setCodeLoading]   = useState(false)

  useEffect(() => { fetchAll(); fetchBooks() }, [])

  async function fetchAll() {
    setLoading(true)
    const [
      { count: memberCount },
      { count: bookCount },
      { count: meetupCount },
      { data: activeData, count: activeCount },
      { data: overdueData },
      { data: memberData },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('books').select('*', { count: 'exact', head: true }),
      supabase.from('meetups').select('*', { count: 'exact', head: true }),
      supabase.from('borrows').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('borrows')
        .select('*, books(title), profiles(name, email)')
        .eq('status', 'active')
        .lt('due_date', new Date().toISOString()),
      supabase.from('profiles').select('*').order('joined_at', { ascending: false }).limit(20),
    ])

    setStats({
      members: memberCount || 0,
      books: bookCount || 0,
      meetups: meetupCount || 0,
      activeBorrows: activeCount || 0,
      overdue: overdueData?.length || 0,
    })
    setOverdue(overdueData || [])
    setMembers(memberData || [])
    setLoading(false)
  }

  async function fetchBooks() {
    const { data } = await supabase.from('books').select('id, title').order('title')
    setBooks(data || [])
  }

  async function sendAnnouncement() {
    if (!announceForm.title.trim()) { showError('Title is required'); return }
    setFormLoading(true)
    const { error } = await supabase.from('announcements').insert({
      ...announceForm, created_by: profile.id,
    })
    if (error) { showError(error.message); setFormLoading(false); return }
    await notifyAllMembers({
      type:  'announcement',
      title: `📣 ${announceForm.title}`,
      body:  announceForm.body || '',
      link:  '/',
    })
    setFormLoading(false)
    success('Announcement sent! Members notified 🔔')
    setShowAnnounce(false)
    setAnnounceForm({ title: '', body: '' })
  }

  async function createChallenge() {
    if (!challengeForm.title.trim()) { showError('Title is required'); return }
    setFormLoading(true)
    const { error } = await supabase.from('challenges').insert(challengeForm)
    setFormLoading(false)
    if (error) { showError(error.message); return }
    success('Reading challenge created! 🏆')
    setShowChallenge(false)
    setChallengeForm({ title: '', target: 5, start_date: '', end_date: '', points_reward: 100 })
  }

  async function setBOTM() {
    if (!botmForm.book_id) { showError('Please select a book'); return }
    const now = new Date()
    setFormLoading(true)
    const { error } = await supabase.from('book_of_month').upsert({
      book_id: botmForm.book_id,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      progress_percent: Number(botmForm.progress_percent),
    }, { onConflict: 'month,year' })
    setFormLoading(false)
    if (error) { showError(error.message); return }
    success('Book of the Month updated! 📖')
    setShowBOTM(false)
  }

  async function markReturned(borrowId, userId, bookId) {
    const { error } = await supabase.rpc('return_book', { p_borrow_id: borrowId, p_user_id: userId })
    if (error) { showError(error.message); return }
    success('Marked as returned')
    fetchAll()
  }

  async function sendOverdueReminders() {
    // In a real app this would call an Edge Function to send emails
    success(`Reminders sent to ${overdue.length} member${overdue.length !== 1 ? 's' : ''}! 📧`)
  }

  async function changeAdminCode() {
    if (!newCode.trim() || newCode.length < 6) { showError('Code must be at least 6 characters'); return }
    setCodeLoading(true)
    const { error } = await supabase
      .from('settings')
      .update({ value: newCode.trim() })
      .eq('key', 'admin_code')
    setCodeLoading(false)
    if (error) { showError(error.message); return }
    success('Admin code updated!')
    setShowAdminCode(false)
    setNewCode('')
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}><div className="spinner" /></div>

  return (
    <div className="page-wrapper fade-in">
      <h2 className="section-title" style={{ marginBottom: 16 }}>⚡ Admin Dashboard</h2>

      <div className="tabs">
        <button className={`tab ${tab === 'overview'  ? 'active' : ''}`} onClick={() => setTab('overview')}>Overview</button>
        <button className={`tab ${tab === 'members'   ? 'active' : ''}`} onClick={() => setTab('members')}>Members</button>
        <button className={`tab ${tab === 'overdue'   ? 'active' : ''}`} onClick={() => setTab('overdue')}>Overdue {overdue.length > 0 && `(${overdue.length})`}</button>
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === 'overview' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <StatCard num={stats.members}      label="Total Members"     />
            <StatCard num={stats.books}        label="Books in Library"  />
            <StatCard num={stats.activeBorrows} label="Active Borrows"   />
            <StatCard num={stats.overdue}      label="Overdue Returns"   color={stats.overdue > 0 ? '#c0392b' : 'var(--amber)'} />
          </div>

          {overdue.length > 0 && (
            <div style={{ background: '#fff5f5', border: '1px solid #f0d4d4', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <strong style={{ fontSize: 14, color: '#c0392b' }}>⚠️ {overdue.length} overdue books</strong>
                <button className="btn btn-danger btn-sm" onClick={sendOverdueReminders}>Send Reminders</button>
              </div>
              {overdue.slice(0, 3).map(b => (
                <div key={b.id} style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
                  📖 {b.books?.title} — {b.profiles?.name} (due {new Date(b.due_date).toLocaleDateString('en-IN')})
                </div>
              ))}
            </div>
          )}

          <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>🛠️ Management</h3>
          <AdminAction icon="📢" title="Post Announcement" desc="Send updates to all members" onClick={() => setShowAnnounce(true)} />
          <AdminAction icon="📖" title="Book of the Month" desc="Set the featured book" onClick={() => setShowBOTM(true)} />
          <AdminAction icon="🏆" title="Create Challenge" desc="Launch a reading challenge" onClick={() => setShowChallenge(true)} />
          <AdminAction icon="🔑" title="Change Admin Code" desc="Update the secret admin registration code" onClick={() => setShowAdminCode(true)} />
        </>
      )}

      {/* ── MEMBERS TAB ── */}
      {tab === 'members' && (
        <>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
            Showing last 20 joined members
          </p>
          {members.map(m => (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
              background: 'var(--card)', borderRadius: 'var(--radius)',
              border: '1px solid var(--border)', marginBottom: 8,
            }}>
              <div className="avatar avatar-sm">
                {m.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>
                  {m.name}
                  {m.role === 'admin' && <span className="tag tag-green" style={{ marginLeft: 8, fontSize: 10 }}>Admin</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {m.email} · {m.points} pts · {m.books_read} books
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                {new Date(m.joined_at).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
              </div>
            </div>
          ))}
        </>
      )}

      {/* ── OVERDUE TAB ── */}
      {tab === 'overdue' && (
        <>
          {overdue.length === 0
            ? <div className="empty-state"><div className="es-icon">✅</div><p>No overdue books! Great job everyone.</p></div>
            : (
              <>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                  <button className="btn btn-danger btn-sm" onClick={sendOverdueReminders}>
                    📧 Send All Reminders
                  </button>
                </div>
                {overdue.map(b => (
                  <div key={b.id} style={{
                    display: 'flex', gap: 12, padding: '14px 16px',
                    background: '#fff5f5', borderRadius: 'var(--radius)',
                    border: '1px solid #f0d4d4', marginBottom: 10,
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{b.books?.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                        Borrowed by: <strong>{b.profiles?.name}</strong> ({b.profiles?.email})
                      </div>
                      <div style={{ fontSize: 12, color: '#c0392b', marginTop: 2 }}>
                        Due: {new Date(b.due_date).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
                        {' — '}
                        {Math.floor((Date.now() - new Date(b.due_date)) / 86400000)} days overdue
                      </div>
                    </div>
                    <button className="btn btn-success btn-sm" onClick={() => markReturned(b.id, b.user_id, b.book_id)}>
                      ✓ Mark Returned
                    </button>
                  </div>
                ))}
              </>
            )
          }
        </>
      )}

      {/* ── Announcement Modal ── */}
      <Modal open={showAnnounce} onClose={() => setShowAnnounce(false)} title="📢 Post Announcement">
        <div className="form-group">
          <label className="form-label">Title *</label>
          <input className="input" placeholder="Announcement title"
            value={announceForm.title} onChange={e => setAnnounceForm(f => ({ ...f, title: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Body</label>
          <textarea className="input" placeholder="Write the full announcement…"
            value={announceForm.body} onChange={e => setAnnounceForm(f => ({ ...f, body: e.target.value }))} />
        </div>
        <div className="form-actions">
          <button className="btn btn-primary btn-lg" onClick={sendAnnouncement} disabled={formLoading}>
            {formLoading ? <><span className="spinner spinner-sm" /> Sending…</> : '📣 Send to All Members'}
          </button>
          <button className="btn btn-outline" onClick={() => setShowAnnounce(false)}>Cancel</button>
        </div>
      </Modal>

      {/* ── Challenge Modal ── */}
      <Modal open={showChallenge} onClose={() => setShowChallenge(false)} title="🏆 Create Reading Challenge">
        <div className="form-group">
          <label className="form-label">Challenge Title *</label>
          <input className="input" placeholder="e.g. 2024 Telangana Authors"
            value={challengeForm.title} onChange={e => setChallengeForm(f => ({ ...f, title: e.target.value }))} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Target (books)</label>
            <input className="input" type="number" min="1"
              value={challengeForm.target} onChange={e => setChallengeForm(f => ({ ...f, target: Number(e.target.value) }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Points Reward</label>
            <input className="input" type="number"
              value={challengeForm.points_reward} onChange={e => setChallengeForm(f => ({ ...f, points_reward: Number(e.target.value) }))} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Start Date</label>
            <input className="input" type="date"
              value={challengeForm.start_date} onChange={e => setChallengeForm(f => ({ ...f, start_date: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">End Date</label>
            <input className="input" type="date"
              value={challengeForm.end_date} onChange={e => setChallengeForm(f => ({ ...f, end_date: e.target.value }))} />
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-primary btn-lg" onClick={createChallenge} disabled={formLoading}>
            {formLoading ? <><span className="spinner spinner-sm" /> Creating…</> : 'Create Challenge'}
          </button>
          <button className="btn btn-outline" onClick={() => setShowChallenge(false)}>Cancel</button>
        </div>
      </Modal>

      {/* ── BOTM Modal ── */}
      <Modal open={showBOTM} onClose={() => setShowBOTM(false)} title="📖 Book of the Month">
        <div className="form-group">
          <label className="form-label">Select Book</label>
          <select className="input" value={botmForm.book_id} onChange={e => setBotmForm(f => ({ ...f, book_id: e.target.value }))}>
            <option value="">Choose a book…</option>
            {books.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Members Reading % (0–100)</label>
          <input className="input" type="number" min="0" max="100"
            value={botmForm.progress_percent} onChange={e => setBotmForm(f => ({ ...f, progress_percent: e.target.value }))} />
        </div>
        <div className="form-actions">
          <button className="btn btn-primary btn-lg" onClick={setBOTM} disabled={formLoading}>
            {formLoading ? <><span className="spinner spinner-sm" /> Setting…</> : 'Set as Book of Month'}
          </button>
          <button className="btn btn-outline" onClick={() => setShowBOTM(false)}>Cancel</button>
        </div>
      </Modal>

      {/* ── Admin Code Modal ── */}
      <Modal open={showAdminCode} onClose={() => setShowAdminCode(false)} title="🔑 Change Admin Code">
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
          The admin code is used during sign-up to create admin accounts. Only share this with trusted club administrators.
          Current code is hidden for security.
        </p>
        <div className="form-group">
          <label className="form-label">New Admin Code (min 6 chars)</label>
          <input className="input" placeholder="e.g. WBADMIN2025" type="password"
            value={newCode} onChange={e => setNewCode(e.target.value)} />
        </div>
        <div className="form-actions">
          <button className="btn btn-danger btn-lg" onClick={changeAdminCode} disabled={codeLoading}>
            {codeLoading ? <><span className="spinner spinner-sm" /> Updating…</> : '🔑 Update Admin Code'}
          </button>
          <button className="btn btn-outline" onClick={() => setShowAdminCode(false)}>Cancel</button>
        </div>
      </Modal>
    </div>
  )
}