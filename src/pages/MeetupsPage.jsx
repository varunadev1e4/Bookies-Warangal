import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { notifyAllMembers } from '../lib/notifications'
import Modal from '../components/Modal'

function MeetupCard({ meetup, rsvpCount, attendedCount, hasRsvp, onOpen }) {
  const d      = new Date(meetup.date)
  const day    = String(d.getDate()).padStart(2, '0')
  const mon    = d.toLocaleString('en', { month: 'short' }).toUpperCase()
  const isPast = d < new Date()

  return (
    <div onClick={() => onOpen(meetup)} style={{
      background: 'var(--card)', borderRadius: 'var(--radius)',
      border: `1px solid ${hasRsvp ? 'var(--amber)' : 'var(--border)'}`,
      padding: '16px', marginBottom: 12, display: 'flex', gap: 14,
      cursor: 'pointer', transition: 'all 0.18s', opacity: isPast ? 0.8 : 1,
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
          <span style={{ marginRight: 12 }}>📍 {meetup.location}</span><br />
          <span style={{ marginRight: 12 }}>👥 {rsvpCount} RSVP'd</span>
          {isPast && attendedCount > 0 && (
            <span style={{ color: 'var(--sage)', fontWeight: 600 }}>✅ {attendedCount} attended</span>
          )}
          {meetup.book_discussed && <><br /><span>📖 {meetup.book_discussed}</span></>}
        </div>
        {!isPast && (
          <div style={{ marginTop: 8 }}>
            {hasRsvp
              ? <span className="tag tag-green">✅ RSVP'd</span>
              : <span className="tag tag-amber">RSVP open</span>}
          </div>
        )}
        {isPast && attendedCount === 0 && (
          <div style={{ marginTop: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>Attendance not marked yet</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function MeetupsPage() {
  const { profile, isAdmin } = useAuth()
  const { success, error: showError } = useToast()

  const [meetups, setMeetups]         = useState([])
  const [rsvpMap, setRsvpMap]         = useState({})
  const [attendanceMap, setAttendanceMap] = useState({}) // meetup_id -> count
  const [myRsvps, setMyRsvps]         = useState(new Set())
  const [tab, setTab]                 = useState('upcoming')
  const [loading, setLoading]         = useState(true)
  const [selected, setSelected]       = useState(null)
  const [rsvpLoading, setRsvpLoading] = useState(false)

  // Attendance modal state
  const [showAttendance, setShowAttendance]   = useState(false)
  const [attendanceMeetup, setAttendanceMeetup] = useState(null)
  const [attendees, setAttendees]             = useState([]) // all members
  const [markedIds, setMarkedIds]             = useState(new Set()) // who attended
  const [attLoading, setAttLoading]           = useState(false)
  const [savingAtt, setSavingAtt]             = useState(false)

  // Create meetup state
  const [showAdd, setShowAdd]         = useState(false)
  const [addLoading, setAddLoading]   = useState(false)
  const [form, setForm]               = useState({ title:'', date:'', time:'6:00 PM', location:'', book_discussed:'', description:'' })

  useEffect(() => { fetchMeetups() }, [])

  async function fetchMeetups() {
    setLoading(true)
    const [{ data: meetupData }, { data: rsvpData }, { data: myRsvpData }, { data: attData }] = await Promise.all([
      supabase.from('meetups').select('*').order('date', { ascending: true }),
      supabase.from('meetup_rsvps').select('meetup_id'),
      profile?.id
        ? supabase.from('meetup_rsvps').select('meetup_id').eq('user_id', profile.id)
        : Promise.resolve({ data: [] }),
      supabase.from('meetup_attendance').select('meetup_id').eq('attended', true),
    ])

    setMeetups(meetupData || [])

    const counts = {}
    rsvpData?.forEach(r => { counts[r.meetup_id] = (counts[r.meetup_id] || 0) + 1 })
    setRsvpMap(counts)

    const attCounts = {}
    attData?.forEach(a => { attCounts[a.meetup_id] = (attCounts[a.meetup_id] || 0) + 1 })
    setAttendanceMap(attCounts)

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
      setRsvpMap(m => ({ ...m, [meetupId]: Math.max(0, (m[meetupId] || 1) - 1) }))
    } else {
      const { error } = await supabase.from('meetup_rsvps').insert({ meetup_id: meetupId, user_id: profile.id })
      if (error) { showError(error.message); setRsvpLoading(false); return }
      success('RSVP confirmed! +5 points 🎉')
      const { data: p } = await supabase.from('profiles').select('points').eq('id', profile.id).single()
      await supabase.from('profiles').update({ points: (p?.points || 0) + 5 }).eq('id', profile.id)
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
    if (error) { showError(error.message); setAddLoading(false); return }

    // Notify all members
    await notifyAllMembers({
      type: 'new_meetup',
      title: `New Meetup: ${form.title}`,
      body:  `📍 ${form.location} · 🕐 ${form.time} · ${new Date(form.date).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}`,
      link:  '/meetups',
    })

    setAddLoading(false)
    success('Meetup scheduled! Members notified 🔔')
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

  // ── Attendance ──
  async function openAttendance(meetup) {
    setAttendanceMeetup(meetup)
    setShowAttendance(true)
    setAttLoading(true)
    setSelected(null)

    const [{ data: members }, { data: existing }] = await Promise.all([
      supabase.from('profiles').select('id, name').order('name'),
      supabase.from('meetup_attendance').select('user_id, attended').eq('meetup_id', meetup.id),
    ])
    setAttendees(members || [])
    const ids = new Set((existing || []).filter(a => a.attended).map(a => a.user_id))
    setMarkedIds(ids)
    setAttLoading(false)
  }

  function toggleAttendee(userId) {
    setMarkedIds(prev => {
      const next = new Set(prev)
      next.has(userId) ? next.delete(userId) : next.add(userId)
      return next
    })
  }

  async function saveAttendance() {
    if (!attendanceMeetup) return
    setSavingAtt(true)

    // Delete existing records then re-insert
    await supabase.from('meetup_attendance').delete().eq('meetup_id', attendanceMeetup.id)

    if (markedIds.size > 0) {
      const rows = [...markedIds].map(uid => ({
        meetup_id: attendanceMeetup.id,
        user_id:   uid,
        marked_by: profile.id,
        attended:  true,
      }))
      await supabase.from('meetup_attendance').insert(rows)

      // Award 10 pts + notify each attendee via secure RPC
      for (const uid of markedIds) {
        await supabase.rpc('award_points', { p_user_id: uid, p_points: 10 })
        await supabase.from('notifications').insert({
          user_id: uid,
          type:    'attendance',
          title:   `Attendance marked: ${attendanceMeetup.title}`,
          body:    'You were marked as present! +10 points awarded 🎉',
          link:    '/meetups',
        })
      }
    }

    setSavingAtt(false)
    success(`Attendance saved! ${markedIds.size} members marked present +10pts each`)
    setShowAttendance(false)
    fetchMeetups()
  }

  const now      = new Date()
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
        <button className={`tab ${tab==='upcoming'?'active':''}`} onClick={()=>setTab('upcoming')}>Upcoming</button>
        <button className={`tab ${tab==='past'?'active':''}`}     onClick={()=>setTab('past')}>Past</button>
        <button className={`tab ${tab==='myrsvp'?'active':''}`}   onClick={()=>setTab('myrsvp')}>My RSVPs</button>
      </div>

      {loading
        ? <div style={{ display:'flex', justifyContent:'center', padding:'40px 0' }}><div className="spinner" /></div>
        : filtered.length === 0
          ? <div className="empty-state"><div className="es-icon">🗓️</div><p>No meetups here yet.</p></div>
          : filtered.map(m => (
              <MeetupCard key={m.id} meetup={m}
                rsvpCount={rsvpMap[m.id] || 0}
                attendedCount={attendanceMap[m.id] || 0}
                hasRsvp={myRsvps.has(m.id)}
                onOpen={setSelected} />
            ))
      }

      {/* ── Meetup Detail Modal ── */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={null}>
        {selected && (
          <>
            <div style={{ display:'flex', gap:14, marginBottom:16 }}>
              <div style={{
                background: new Date(selected.date) < now ? '#8a7060' : 'var(--amber)',
                color:'#fff', borderRadius:12, padding:'10px 14px', textAlign:'center', flexShrink:0,
              }}>
                <div style={{ fontFamily:'var(--font-serif)', fontSize:28, fontWeight:900, lineHeight:1 }}>
                  {String(new Date(selected.date).getDate()).padStart(2,'0')}
                </div>
                <div style={{ fontSize:11, fontWeight:600 }}>
                  {new Date(selected.date).toLocaleString('en',{month:'short'}).toUpperCase()}
                </div>
              </div>
              <div>
                <h3 style={{ fontFamily:'var(--font-serif)', fontSize:18, fontWeight:700, marginBottom:6 }}>{selected.title}</h3>
                <p style={{ fontSize:13, color:'var(--muted)', lineHeight:1.7 }}>
                  🕐 {selected.time}<br />
                  📍 {selected.location}<br />
                  👥 {rsvpMap[selected.id] || 0} RSVP'd
                  {attendanceMap[selected.id] > 0 && <> · ✅ {attendanceMap[selected.id]} attended</>}
                  {selected.book_discussed && <><br />📖 {selected.book_discussed}</>}
                </p>
              </div>
            </div>

            {selected.description && (
              <p style={{ fontSize:13, color:'var(--muted)', lineHeight:1.6, marginBottom:18 }}>{selected.description}</p>
            )}

            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {/* RSVP button — only for upcoming */}
              {new Date(selected.date) >= now && (
                <button
                  className={`btn ${myRsvps.has(selected.id) ? 'btn-outline' : 'btn-success'}`}
                  style={{ flex: 1 }} disabled={rsvpLoading}
                  onClick={() => toggleRsvp(selected.id)}
                >
                  {rsvpLoading ? <><span className="spinner spinner-sm" /> …</>
                    : myRsvps.has(selected.id) ? '❌ Cancel RSVP' : '✅ RSVP Yes'}
                </button>
              )}

              {/* WhatsApp share */}
              <button
                className="btn"
                style={{ background:'#25D366', color:'#fff', border:'none', flex: new Date(selected.date) < now ? 1 : 'unset' }}
                onClick={() => {
                  const d = new Date(selected.date)
                  const dateStr = d.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' })
                  const msg = [
                    `📚 *Bookies India Meetup*`,
                    ``,
                    `📖 *${selected.title}*`,
                    `📅 ${dateStr}`,
                    `🕐 ${selected.time}`,
                    `📍 ${selected.location}`,
                    selected.book_discussed ? `📗 Book: ${selected.book_discussed}` : '',
                    selected.description ? `\n${selected.description}` : '',
                    ``,
                    `Join us! RSVP on the Bookies India app 🙌`,
                  ].filter(l => l !== undefined && !(l === '' && l !== '')).join('\n')
                  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight:5, verticalAlign:'middle' }}>
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Share
              </button>

              {/* Attendance button — only admin, only past meetups */}
              {isAdmin && new Date(selected.date) < now && (
                <button className="btn btn-primary" style={{ flex: 1 }}
                  onClick={() => openAttendance(selected)}>
                  📋 Mark Attendance
                </button>
              )}

              {isAdmin && (
                <button className="btn btn-danger btn-sm" onClick={() => deleteMeetup(selected.id)}>🗑</button>
              )}
              <button className="btn btn-outline btn-sm" onClick={() => setSelected(null)}>Close</button>
            </div>
          </>
        )}
      </Modal>

      {/* ── Attendance Modal ── */}
      <Modal open={showAttendance} onClose={() => setShowAttendance(false)}
        title={`📋 Mark Attendance — ${attendanceMeetup?.title || ''}`}>
        {attLoading
          ? <div style={{ display:'flex', justifyContent:'center', padding:'30px 0' }}><div className="spinner" /></div>
          : (
            <>
              <div style={{
                background:'var(--cream)', borderRadius:8, padding:'10px 14px',
                fontSize:12, color:'var(--muted)', marginBottom:14,
                display:'flex', justifyContent:'space-between',
              }}>
                <span>👥 {attendees.length} members total</span>
                <span style={{ fontWeight:700, color:'var(--sage)' }}>✅ {markedIds.size} marked present</span>
              </div>

              {/* Select All / None */}
              <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                <button className="btn btn-outline btn-sm" style={{ flex:1 }}
                  onClick={() => setMarkedIds(new Set(attendees.map(m => m.id)))}>
                  ✅ Select All
                </button>
                <button className="btn btn-outline btn-sm" style={{ flex:1 }}
                  onClick={() => setMarkedIds(new Set())}>
                  ❌ Clear All
                </button>
              </div>

              {/* Member list */}
              <div style={{ maxHeight: 340, overflowY: 'auto', marginBottom: 16 }}>
                {attendees.map(m => {
                  const present = markedIds.has(m.id)
                  return (
                    <div key={m.id}
                      onClick={() => toggleAttendee(m.id)}
                      style={{
                        display:'flex', alignItems:'center', gap:12,
                        padding:'10px 12px', borderRadius:8, marginBottom:6,
                        cursor:'pointer', transition:'all 0.15s',
                        background: present ? '#e8f5e9' : 'var(--cream)',
                        border: `1.5px solid ${present ? 'var(--sage)' : 'var(--border)'}`,
                      }}
                    >
                      <div style={{
                        width:36, height:36, borderRadius:'50%', flexShrink:0,
                        background: present ? 'var(--sage)' : 'var(--border)',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:12, fontWeight:800, color:'#fff',
                        transition:'background 0.15s',
                      }}>
                        {m.name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)}
                      </div>
                      <span style={{ flex:1, fontWeight: present ? 700 : 400, fontSize:14 }}>{m.name}</span>
                      <span style={{ fontSize:18 }}>{present ? '✅' : '⬜'}</span>
                    </div>
                  )
                })}
              </div>

              <div className="form-actions">
                <button className="btn btn-primary btn-lg" onClick={saveAttendance} disabled={savingAtt}>
                  {savingAtt ? <><span className="spinner spinner-sm" /> Saving…</> : `Save Attendance (${markedIds.size} present)`}
                </button>
                <button className="btn btn-outline" onClick={() => setShowAttendance(false)}>Cancel</button>
              </div>
            </>
          )
        }
      </Modal>

      {/* ── Add Meetup Modal ── */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="🗓️ Schedule Meetup">
        <div className="form-group">
          <label className="form-label">Title *</label>
          <input className="input" placeholder="Meetup title"
            value={form.title} onChange={e => setForm(f=>({...f, title:e.target.value}))} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Date *</label>
            <input className="input" type="date"
              value={form.date} onChange={e => setForm(f=>({...f, date:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">Time</label>
            <input className="input" placeholder="6:00 PM"
              value={form.time} onChange={e => setForm(f=>({...f, time:e.target.value}))} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Location / Venue</label>
          <input className="input" placeholder="e.g. Warangal Fort Grounds"
            value={form.location} onChange={e => setForm(f=>({...f, location:e.target.value}))} />
        </div>
        <div className="form-group">
          <label className="form-label">Book to Discuss</label>
          <input className="input" placeholder="Book title"
            value={form.book_discussed} onChange={e => setForm(f=>({...f, book_discussed:e.target.value}))} />
        </div>
        <div className="form-group">
          <label className="form-label">Description / Agenda</label>
          <textarea className="input" placeholder="What's the agenda?"
            value={form.description} onChange={e => setForm(f=>({...f, description:e.target.value}))} />
        </div>
        <div className="form-actions">
          <button className="btn btn-primary btn-lg" onClick={addMeetup} disabled={addLoading}>
            {addLoading ? <><span className="spinner spinner-sm" /> Creating…</> : '📅 Create & Notify Members'}
          </button>
          <button className="btn btn-outline" onClick={() => setShowAdd(false)}>Cancel</button>
        </div>
      </Modal>
    </div>
  )
}