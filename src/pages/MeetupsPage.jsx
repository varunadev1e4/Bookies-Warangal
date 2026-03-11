import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import Modal from '../components/Modal'

function MeetupCard({ meetup, rsvpCount, hasRsvp, onOpen }) {
  const d = new Date(meetup.date)
  const day = String(d.getDate()).padStart(2, '0')
  const mon = d.toLocaleString('en', { month: 'short' }).toUpperCase()
  const isPast = d < new Date()

  return (
    <div
      onClick={() => onOpen(meetup)}
      style={{
        background: 'var(--card)', borderRadius: 'var(--radius)',
        border: `1px solid ${hasRsvp ? 'var(--amber)' : 'var(--border)'}`,
        padding: '16px', marginBottom: 12, display: 'flex', gap: 14,
        cursor: 'pointer', transition: 'all 0.18s',
        opacity: isPast ? 0.7 : 1,
      }}
      onMouseEnter={e => { if (!isPast) e.currentTarget.style.borderColor = 'var(--amber)' }}
      onMouseLeave={e => { if (!hasRsvp) e.currentTarget.style.borderColor = 'var(--border)' }}
    >
      <div style={{
        textAlign: 'center', minWidth: 52,
        background: isPast ? '#8a7060' : 'var(--amber)',
        borderRadius: 10, padding: '10px 8px', color: '#fff', flexShrink: 0,
      }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 900, lineHeight: 1 }}>{day}</div>
        <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.9 }}>{mon}</div>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 15, fontWeight: 700, marginBottom: 5 }}>{meetup.title}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
          <span style={{ marginRight: 12 }}>🕐 {meetup.time}</span>
          <span style={{ marginRight: 12 }}>📍 {meetup.location}</span>
          <br />
          <span style={{ marginRight: 12 }}>👥 {rsvpCount} attending</span>
          {meetup.book_discussed && <span>📖 {meetup.book_discussed}</span>}
        </div>
        {!isPast && (
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            {hasRsvp
              ? <span className="tag tag-green">✅ RSVP'd</span>
              : <span className="tag tag-amber">RSVP open</span>}
          </div>
        )}
      </div>
    </div>
  )
}

export default function MeetupsPage() {
  const { profile, isAdmin } = useAuth()
  const { success, error: showError } = useToast()

  const [meetups, setMeetups]   = useState([])
  const [rsvpMap, setRsvpMap]   = useState({})    // meetup_id -> count
  const [myRsvps, setMyRsvps]   = useState(new Set())
  const [tab, setTab]           = useState('upcoming')
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState(null)
  const [rsvpLoading, setRsvpLoading] = useState(false)

  const [showAdd, setShowAdd]   = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [form, setForm]         = useState({ title:'', date:'', time:'6:00 PM', location:'', book_discussed:'', description:'' })

  useEffect(() => { fetchMeetups() }, [])

  async function fetchMeetups() {
    setLoading(true)
    const [{ data: meetupData }, { data: rsvpData }, { data: myRsvpData }] = await Promise.all([
      supabase.from('meetups').select('*').order('date', { ascending: true }),
      supabase.from('meetup_rsvps').select('meetup_id'),
      profile?.id
        ? supabase.from('meetup_rsvps').select('meetup_id').eq('user_id', profile.id)
        : Promise.resolve({ data: [] }),
    ])

    setMeetups(meetupData || [])

    const counts = {}
    rsvpData?.forEach(r => { counts[r.meetup_id] = (counts[r.meetup_id] || 0) + 1 })
    setRsvpMap(counts)

    setMyRsvps(new Set((myRsvpData || []).map(r => r.meetup_id)))
    setLoading(false)
  }

  async function toggleRsvp(meetupId) {
    if (!profile) return
    setRsvpLoading(true)
    if (myRsvps.has(meetupId)) {
      await supabase.from('meetup_rsvps').delete().eq('meetup_id', meetupId).eq('user_id', profile.id)
      success('RSVP cancelled')
      setMyRsvps(s => { const n = new Set(s); n.delete(meetupId); return n })
      setRsvpMap(m => ({ ...m, [meetupId]: (m[meetupId] || 1) - 1 }))
    } else {
      const { error } = await supabase.from('meetup_rsvps').insert({ meetup_id: meetupId, user_id: profile.id })
      if (error) { showError(error.message); setRsvpLoading(false); return }
      success('RSVP confirmed! +5 points 🎉')
      // bonus points
      await supabase.from('profiles').update({ points: (profile.points || 0) + 5 }).eq('id', profile.id)
      setMyRsvps(s => new Set([...s, meetupId]))
      setRsvpMap(m => ({ ...m, [meetupId]: (m[meetupId] || 0) + 1 }))
    }
    setRsvpLoading(false)
    setSelected(null)
  }

  async function addMeetup() {
    if (!form.title.trim() || !form.date) { showError('Title and date are required'); return }
    setAddLoading(true)
    const { error } = await supabase.from('meetups').insert({ ...form, created_by: profile.id })
    setAddLoading(false)
    if (error) { showError(error.message); return }
    success('Meetup scheduled!')
    setShowAdd(false)
    setForm({ title:'', date:'', time:'6:00 PM', location:'', book_discussed:'', description:'' })
    fetchMeetups()
  }

  async function deleteMeetup(id) {
    if (!window.confirm('Delete this meetup?')) return
    await supabase.from('meetups').delete().eq('id', id)
    success('Meetup deleted')
    setSelected(null)
    fetchMeetups()
  }

  const now = new Date()
  const filtered = meetups.filter(m => {
    const d = new Date(m.date)
    if (tab === 'upcoming') return d >= now
    if (tab === 'past')     return d < now
    if (tab === 'myrsvp')   return myRsvps.has(m.id)
    return true
  })

  return (
    <div className="page-wrapper fade-in">
      <div className="section-header">
        <h2 className="section-title">🗓️ Meetups</h2>
        {isAdmin && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ Plan</button>
        )}
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'upcoming' ? 'active' : ''}`} onClick={() => setTab('upcoming')}>Upcoming</button>
        <button className={`tab ${tab === 'past'     ? 'active' : ''}`} onClick={() => setTab('past')}>Past</button>
        <button className={`tab ${tab === 'myrsvp'  ? 'active' : ''}`} onClick={() => setTab('myrsvp')}>My RSVPs</button>
      </div>

      {loading
        ? <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><div className="spinner" /></div>
        : filtered.length === 0
          ? <div className="empty-state"><div className="es-icon">🗓️</div><p>No meetups here yet.</p></div>
          : filtered.map(m => (
              <MeetupCard key={m.id} meetup={m}
                rsvpCount={rsvpMap[m.id] || 0}
                hasRsvp={myRsvps.has(m.id)}
                onOpen={setSelected} />
            ))
      }

      {/* ── Meetup Detail Modal ── */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={null}>
        {selected && (
          <>
            <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
              <div style={{
                background: 'var(--amber)', color: '#fff', borderRadius: 12,
                padding: '10px 14px', textAlign: 'center', flexShrink: 0,
              }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 900, lineHeight: 1 }}>
                  {String(new Date(selected.date).getDate()).padStart(2,'0')}
                </div>
                <div style={{ fontSize: 11, fontWeight: 600 }}>
                  {new Date(selected.date).toLocaleString('en', { month: 'short' }).toUpperCase()}
                </div>
              </div>
              <div>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{selected.title}</h3>
                <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>
                  🕐 {selected.time}<br />
                  📍 {selected.location}<br />
                  👥 {rsvpMap[selected.id] || 0} attending
                  {selected.book_discussed && <><br />📖 {selected.book_discussed}</>}
                </p>
              </div>
            </div>
            {selected.description && (
              <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 18 }}>{selected.description}</p>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              {new Date(selected.date) >= now && (
                <button
                  className={`btn ${myRsvps.has(selected.id) ? 'btn-outline' : 'btn-success'}`}
                  style={{ flex: 1 }}
                  disabled={rsvpLoading}
                  onClick={() => toggleRsvp(selected.id)}
                >
                  {rsvpLoading ? <><span className="spinner spinner-sm" /> …</>
                    : myRsvps.has(selected.id) ? '❌ Cancel RSVP' : '✅ RSVP Yes'}
                </button>
              )}
              {isAdmin && (
                <button className="btn btn-danger btn-sm" onClick={() => deleteMeetup(selected.id)}>🗑 Delete</button>
              )}
              <button className="btn btn-outline" onClick={() => setSelected(null)}>Close</button>
            </div>
          </>
        )}
      </Modal>

      {/* ── Add Meetup Modal (Admin) ── */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="🗓️ Schedule Meetup">
        <div className="form-group">
          <label className="form-label">Title *</label>
          <input className="input" placeholder="Meetup title"
            value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Date *</label>
            <input className="input" type="date"
              value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Time</label>
            <input className="input" placeholder="6:00 PM"
              value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Location / Venue</label>
          <input className="input" placeholder="e.g. Warangal Fort Grounds"
            value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Book to Discuss</label>
          <input className="input" placeholder="Book title"
            value={form.book_discussed} onChange={e => setForm(f => ({ ...f, book_discussed: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Description / Agenda</label>
          <textarea className="input" placeholder="What's the agenda?"
            value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>
        <div className="form-actions">
          <button className="btn btn-primary btn-lg" onClick={addMeetup} disabled={addLoading}>
            {addLoading ? <><span className="spinner spinner-sm" /> Creating…</> : 'Create Meetup'}
          </button>
          <button className="btn btn-outline" onClick={() => setShowAdd(false)}>Cancel</button>
        </div>
      </Modal>
    </div>
  )
}
