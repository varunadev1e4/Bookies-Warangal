import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/Modal'

const BADGE_MAP = [
  { min: 2000, badge: '👑', title: 'Legend'       },
  { min: 1500, badge: '🌟', title: 'Champion'     },
  { min: 1000, badge: '🏆', title: 'Gold Reader'  },
  { min:  700, badge: '🥈', title: 'Silver'       },
  { min:  400, badge: '🥉', title: 'Bronze'       },
  { min:    0, badge: '📖', title: 'Reader'       },
]
function getBadge(pts) { return BADGE_MAP.find(b => pts >= b.min) || BADGE_MAP.at(-1) }
function initials(name) { return (name||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2) }

export default function MembersPage() {
  const { profile: me } = useAuth()
  const [members,  setMembers]  = useState([])
  const [filtered, setFiltered] = useState([])
  const [query,    setQuery]    = useState('')
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState(null)   // member being viewed
  const [history,  setHistory]  = useState([])     // borrows
  const [crHistory, setCrHistory] = useState([])   // challenge reads
  const [histTab,   setHistTab]   = useState('all') // 'all'|'challenge'
  const [histLoad, setHistLoad] = useState(false)
  const [attended, setAttended] = useState(0)

  useEffect(() => { fetchMembers() }, [])

  useEffect(() => {
    const q = query.toLowerCase()
    setFiltered(
      members.filter(m =>
        m.name.toLowerCase().includes(q) ||
        (m.city || '').toLowerCase().includes(q)
      )
    )
  }, [query, members])

  async function fetchMembers() {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, name, points, books_read, role, city, bio, joined_at')
      .order('points', { ascending: false })
    setMembers(data || [])
    setFiltered(data || [])
    setLoading(false)
  }

  async function openMember(m) {
    setSelected(m)
    setHistLoad(true)
    setHistory([])
    setCrHistory([])
    setHistTab('all')
    setAttended(0)
    const [{ data: borrows }, { data: cr }, { count: attCount }] = await Promise.all([
      supabase.from('borrows')
        .select('*, books(title, emoji, author, genre)')
        .eq('user_id', m.id)
        .order('borrowed_at', { ascending: false }),
      supabase.from('challenge_reads')
        .select('*, challenges(title)')
        .eq('user_id', m.id)
        .order('logged_at', { ascending: false }),
      supabase.from('meetup_attendance')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', m.id)
        .eq('attended', true),
    ])
    setHistory(borrows || [])
    setCrHistory(cr || [])
    setAttended(attCount || 0)
    setHistLoad(false)
  }

  const badge = selected ? getBadge(selected.points) : null

  return (
    <div className="page-wrapper fade-in">
      <div className="section-header">
        <h2 className="section-title">👥 Members</h2>
        <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
          {members.length} readers
        </span>
      </div>

      {/* Search */}
      <input
        className="input"
        placeholder="🔍  Search by name or city…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        style={{ marginBottom: 14 }}
      />

      {loading
        ? <div style={{ display:'flex', justifyContent:'center', padding:'40px 0' }}><div className="spinner"/></div>
        : filtered.length === 0
          ? <div className="empty-state"><div className="es-icon">👥</div><p>No members found.</p></div>
          : filtered.map((m, i) => {
              const b    = getBadge(m.points)
              const isMe = m.id === me?.id
              return (
                <div key={m.id} onClick={() => openMember(m)} style={{
                  display: 'flex', alignItems: 'center', gap: 13,
                  padding: '13px 14px', marginBottom: 8,
                  background: isMe ? '#fff9f0' : 'var(--card)',
                  border: `1px solid ${isMe ? 'var(--amber)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius)', cursor: 'pointer', transition: 'all 0.18s',
                }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--amber)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = isMe ? 'var(--amber)' : 'var(--border)'}
                >
                  {/* Rank */}
                  <div style={{ width: 24, textAlign: 'center', fontWeight: 800, fontSize: 13, color: 'var(--muted)', flexShrink: 0 }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                  </div>
                  {/* Avatar */}
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                    background: isMe ? 'var(--amber)' : 'linear-gradient(135deg,#2d1200,#8b3a00)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 800, color: '#fff',
                    border: `2px solid ${isMe ? 'var(--amber-light)' : 'transparent'}`,
                  }}>
                    {initials(m.name)}
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.name}</span>
                      {isMe && <span style={{ fontSize: 10, color: 'var(--amber)', fontWeight: 700, flexShrink: 0 }}>You</span>}
                      {m.role === 'admin' && <span style={{ fontSize: 10, background: '#3d6b34', color: '#fff', padding: '1px 6px', borderRadius: 8, flexShrink: 0 }}>Admin</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                      {b.badge} {b.title} · {m.books_read || 0} books · {m.city || 'Warangal'}
                    </div>
                  </div>
                  {/* Points */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 800, fontSize: 16, color: 'var(--amber)' }}>
                      {m.points || 0}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>pts</div>
                  </div>
                </div>
              )
            })
      }

      {/* ── Member Detail Modal ── */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={null}>
        {selected && (
          <>
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg,#1a0a00,#3a1200)',
              borderRadius: 12, padding: '20px 18px',
              color: '#fff', textAlign: 'center', marginBottom: 16,
            }}>
              <div style={{
                width: 58, height: 58, borderRadius: '50%', margin: '0 auto 10px',
                background: 'linear-gradient(135deg,var(--amber),var(--amber-light))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, fontWeight: 900, color: '#fff',
              }}>{initials(selected.name)}</div>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 900, marginBottom: 4 }}>
                {selected.name}
                {selected.role === 'admin' && <span style={{ fontSize: 11, background: '#3d6b34', padding: '2px 7px', borderRadius: 8, marginLeft: 8 }}>Admin</span>}
              </h3>
              {selected.bio && <p style={{ fontSize: 12, opacity: 0.7, fontStyle: 'italic', marginBottom: 8 }}>{selected.bio}</p>}
              <p style={{ fontSize: 12, opacity: 0.6 }}>
                📍 {selected.city || 'Warangal'} · Joined {new Date(selected.joined_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
              </p>

              {/* Stats row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 14 }}>
                {[
                  { n: selected.points || 0,      l: 'Points'   },
                  { n: selected.books_read || 0,  l: 'Read'     },
                  { n: history.filter(b => b.status === 'active').length, l: 'Borrowed' },
                  { n: attended,                  l: 'Attended' },
                ].map(s => (
                  <div key={s.l} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 4px' }}>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 800, color: '#f0a030' }}>{s.n}</div>
                    <div style={{ fontSize: 10, opacity: 0.65 }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Badge row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--cream)', borderRadius: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 22 }}>{badge.badge}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{badge.title}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{selected.points} points earned</div>
              </div>
            </div>

            {/* Reading history */}
            {/* Reading history */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <h4 style={{ fontWeight:700, fontSize:14 }}>📚 Reading History</h4>
              <span style={{ fontSize:11, color:'var(--muted)' }}>{history.length + crHistory.length} total</span>
            </div>
            <div style={{ display:'flex', gap:6, marginBottom:10 }}>
              {[
                { key:'all',       label:`Library (${history.length})`         },
                { key:'challenge', label:`📊 Challenges (${crHistory.length})` },
              ].map(t => (
                <button key={t.key} onClick={() => setHistTab(t.key)} style={{
                  padding:'4px 10px', borderRadius:16, fontSize:11, fontWeight:700,
                  border:'1.5px solid', cursor:'pointer',
                  background:  histTab===t.key ? 'var(--amber)' : 'transparent',
                  color:       histTab===t.key ? '#fff' : 'var(--muted)',
                  borderColor: histTab===t.key ? 'var(--amber)' : 'var(--border)',
                }}>{t.label}</button>
              ))}
            </div>
            {histLoad
              ? <div style={{ display:'flex', justifyContent:'center', padding:'20px 0' }}><div className="spinner"/></div>
              : (histTab==='challenge' ? crHistory : history).length === 0
                ? <p style={{ fontSize:13, color:'var(--muted)', textAlign:'center', padding:'16px 0' }}>
                    {histTab==='challenge' ? 'No challenge books logged yet.' : 'No books borrowed yet.'}
                  </p>
                : <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                    {(histTab==='challenge' ? crHistory : history).map(b => {
                      const isCR = histTab === 'challenge'
                      return (
                        <div key={b.id} style={{
                          display:'flex', alignItems:'center', gap:10,
                          padding:'9px 0', borderBottom:'1px solid var(--border)',
                        }}>
                          <span style={{ fontSize:22, flexShrink:0 }}>{isCR ? '📊' : (b.books?.emoji||'📖')}</span>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontWeight:600, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {isCR ? b.title : b.books?.title}
                            </div>
                            <div style={{ fontSize:11, color:'var(--muted)' }}>
                              {isCR
                                ? <>{b.author && `by ${b.author} · `}{'⭐'.repeat(b.rating||0)}</>
                                : `by ${b.books?.author} · ${b.books?.genre}`
                              }
                            </div>
                            <div style={{ fontSize:10, color:'var(--muted)', marginTop:2 }}>
                              {isCR
                                ? `Logged ${new Date(b.logged_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}`
                                : <>Borrowed {new Date(b.borrowed_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
                                    {b.returned_at && ` → Returned ${new Date(b.returned_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}`}
                                  </>
                              }
                            </div>
                          </div>
                          {isCR
                            ? <span style={{ fontSize:10, flexShrink:0, background:'#e8eaf6', color:'#3949ab', padding:'2px 7px', borderRadius:8, border:'1px solid #9fa8da' }}>challenge</span>
                            : <span className={`tag ${b.status==='returned'?'tag-green':b.status==='overdue'?'tag-red':'tag-amber'}`} style={{ fontSize:10, flexShrink:0 }}>
                                {b.status}
                              </span>
                          }
                        </div>
                      )
                    })}
                  </div>
            }

            <button className="btn btn-outline" style={{ width:'100%', marginTop: 16 }} onClick={() => setSelected(null)}>Close</button>
          </>
        )}
      </Modal>
    </div>
  )
}