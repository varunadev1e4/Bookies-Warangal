import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import Modal from '../components/Modal'

const BADGES = [
  { key:'bookworm', icon:'📚', label:'Bookworm',    desc:'Read 5 books',    earned:(p)=>p.books_read>=5  },
  { key:'reviewer', icon:'⭐', label:'Reviewer',    desc:'Write a review',  earned:(_,r)=>r>0           },
  { key:'attendee', icon:'🗓️', label:'Attendee',    desc:'Attend a meetup', earned:(_,__,a)=>a>0        },
  { key:'gold',     icon:'🥇', label:'Gold Reader', desc:'1000+ points',    earned:(p)=>p.points>=1000  },
  { key:'legend',   icon:'👑', label:'Legend',      desc:'2000+ points',    earned:(p)=>p.points>=2000  },
  { key:'books25',  icon:'🌟', label:'25 Books',    desc:'Read 25 books',   earned:(p)=>p.books_read>=25},
]

function StarRating({ value, onChange }) {
  return (
    <div style={{ display:'flex', gap:4 }}>
      {[1,2,3,4,5].map(n => (
        <button key={n} type="button" onClick={() => onChange(n)}
          style={{ background:'none', border:'none', cursor:'pointer', fontSize:24, filter:n<=value?'none':'grayscale(1)' }}>⭐</button>
      ))}
    </div>
  )
}

function duration(borrowed, returned) {
  if (!returned) return null
  const days = Math.round((new Date(returned) - new Date(borrowed)) / 86400000)
  return days <= 0 ? 'same day' : `${days} day${days>1?'s':''}`
}

export default function ProfilePage() {
  const { profile, signOut, refreshProfile } = useAuth()
  const { success, error: showError } = useToast()
  const navigate = useNavigate()

  const [borrows,   setBorrows]   = useState([])
  const [reviews,   setReviews]   = useState([])
  const [attended,  setAttended]  = useState(0)
  const [loading,   setLoading]   = useState(true)
  const [histTab,   setHistTab]   = useState('all')   // 'all' | 'active' | 'returned'

  const [showReview, setShowReview] = useState(false)
  const [books,      setBooks]      = useState([])
  const [reviewForm, setReviewForm] = useState({ book_id:'', rating:4, body:'' })
  const [reviewLoading, setReviewLoading] = useState(false)

  const [showEdit,   setShowEdit]   = useState(false)
  const [editName,   setEditName]   = useState(profile?.name||'')
  const [editBio,    setEditBio]    = useState(profile?.bio||'')
  const [editLoading, setEditLoading] = useState(false)

  useEffect(() => { if (profile?.id) { fetchData(); fetchBooks() } }, [profile?.id])

  async function fetchData() {
    setLoading(true)
    const [
      { data: borrowData },
      { data: reviewData },
      { count: attCount },
    ] = await Promise.all([
      supabase.from('borrows')
        .select('*, books(title,emoji,author,genre)')
        .eq('user_id', profile.id)
        .order('borrowed_at', { ascending: false }),
      supabase.from('reviews')
        .select('*, books(title,emoji)')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false }),
      supabase.from('meetup_attendance')
        .select('*', { count:'exact', head:true })
        .eq('user_id', profile.id)
        .eq('attended', true),
    ])
    setBorrows(borrowData || [])
    setReviews(reviewData || [])
    setAttended(attCount || 0)
    setLoading(false)
  }

  async function fetchBooks() {
    const { data } = await supabase.from('books').select('id, title').order('title')
    setBooks(data || [])
  }

  async function saveReview() {
    if (!reviewForm.book_id) { showError('Please select a book'); return }
    setReviewLoading(true)
    const { error } = await supabase.from('reviews').upsert({
      book_id: reviewForm.book_id, user_id: profile.id,
      rating: reviewForm.rating, body: reviewForm.body,
    }, { onConflict: 'book_id,user_id' })
    setReviewLoading(false)
    if (error) { showError(error.message); return }
    await supabase.from('profiles').update({ points: profile.points + 20 }).eq('id', profile.id)
    success('Review posted! +20 points ⭐')
    setShowReview(false)
    setReviewForm({ book_id:'', rating:4, body:'' })
    fetchData(); refreshProfile()
  }

  async function saveProfile() {
    setEditLoading(true)
    const { error } = await supabase.from('profiles').update({ name: editName, bio: editBio }).eq('id', profile.id)
    setEditLoading(false)
    if (error) { showError(error.message); return }
    success('Profile updated!')
    setShowEdit(false); refreshProfile()
  }

  if (!profile) return null

  const ini       = profile.name?.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)||'?'
  const nextLevel = [400,700,1000,1500,2000].find(n=>n>profile.points)||9999
  const prevLevel = [0,400,700,1000,1500,2000].reverse().find(n=>n<=profile.points)||0
  const levelPct  = Math.round(((profile.points-prevLevel)/(nextLevel-prevLevel))*100)

  const activeBorrows   = borrows.filter(b => b.status === 'active')
  const returnedBorrows = borrows.filter(b => b.status === 'returned')
  const overdueBorrows  = borrows.filter(b => b.status === 'overdue')

  const histFiltered = histTab === 'active'   ? activeBorrows
                     : histTab === 'returned' ? returnedBorrows
                     : histTab === 'overdue'  ? overdueBorrows
                     : borrows

  return (
    <div className="page-wrapper fade-in">

      {/* ── Profile Header ── */}
      <div style={{
        background: 'linear-gradient(135deg,#1a0a00,#3a1200)',
        borderRadius: 'var(--radius-lg)', padding: '28px 22px',
        color:'#fff', textAlign:'center', marginBottom:16,
        position:'relative', overflow:'hidden',
      }}>
        <div style={{ position:'absolute', inset:0, opacity:0.03,
          backgroundImage:"repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)",
          backgroundSize:'20px 20px', pointerEvents:'none' }} />

        <div className="avatar avatar-xl" style={{ margin:'0 auto 12px', fontSize:28 }}>{ini}</div>
        <h2 style={{ fontFamily:'var(--font-serif)', fontSize:22, fontWeight:900 }}>{profile.name}</h2>
        <p style={{ fontSize:13, opacity:0.65, marginTop:4 }}>
          {profile.role==='admin' ? '⚡ Admin' : '📖 Member'} · {profile.city} · Joined {new Date(profile.joined_at).toLocaleDateString('en-IN',{month:'short',year:'numeric'})}
        </p>
        {profile.bio && <p style={{ fontSize:13, opacity:0.75, marginTop:6, fontStyle:'italic' }}>{profile.bio}</p>}

        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginTop:18 }}>
          {[
            { num: profile.books_read,     label:'Read'     },
            { num: activeBorrows.length,   label:'Borrowed' },
            { num: attended,               label:'Attended' },
            { num: profile.points,         label:'Points'   },
          ].map(s => (
            <div key={s.label} style={{ background:'rgba(255,255,255,0.07)', borderRadius:10, padding:'10px 6px' }}>
              <span style={{ fontFamily:'var(--font-serif)', fontSize:20, fontWeight:700, color:'#f0a030', display:'block' }}>{s.num}</span>
              <span style={{ fontSize:10, opacity:0.6 }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Points bar ── */}
      <div style={{ background:'var(--cream)', borderRadius:'var(--radius)', padding:'14px 16px', display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
        <span style={{ fontSize:26 }}>⭐</span>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:'var(--font-serif)', fontWeight:700, fontSize:18, color:'var(--amber)' }}>
            {profile.points} pts
            <span style={{ fontSize:12, fontWeight:500, color:'var(--muted)', marginLeft:8 }}>
              {nextLevel===9999 ? '👑 Legend tier' : `· ${nextLevel-profile.points} to next tier`}
            </span>
          </div>
          <div style={{ height:6, background:'var(--border)', borderRadius:10, marginTop:6 }}>
            <div style={{ height:'100%', background:'var(--amber)', borderRadius:10, width:`${Math.min(100,levelPct)}%`, transition:'width 0.6s' }} />
          </div>
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div style={{ display:'flex', gap:10, marginBottom:16 }}>
        <button className="btn btn-primary" style={{ flex:1 }} onClick={() => setShowReview(true)}>⭐ Write Review</button>
        <button className="btn btn-outline" style={{ flex:1 }} onClick={() => navigate('/members')}>👥 Members</button>
        <button className="btn btn-outline" onClick={() => { setEditName(profile.name); setEditBio(profile.bio||''); setShowEdit(true) }}>✏️</button>
      </div>

      {/* ── Badges ── */}
      <div className="card" style={{ marginBottom:14 }}>
        <h3 style={{ fontWeight:700, fontSize:15, marginBottom:14 }}>🏅 Badges</h3>
        <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
          {BADGES.map(b => {
            const earned = b.earned(profile, reviews.length, attended)
            return (
              <div key={b.key} style={{ textAlign:'center', width:68 }} title={b.desc}>
                <div style={{
                  width:50, height:50, borderRadius:'50%', margin:'0 auto 5px',
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:22,
                  background: earned ? 'linear-gradient(135deg,var(--amber),var(--amber-light))' : 'var(--cream)',
                  filter: earned ? 'none' : 'grayscale(1)', opacity: earned ? 1 : 0.4,
                  transition: 'all 0.2s',
                }}>{b.icon}</div>
                <div style={{ fontSize:10, color:'var(--muted)', lineHeight:1.3 }}>{b.label}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Reading History ── */}
      <div className="card" style={{ marginBottom:14 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <h3 style={{ fontWeight:700, fontSize:15 }}>📚 Reading History</h3>
          <span style={{ fontSize:12, color:'var(--muted)' }}>{borrows.length} total</span>
        </div>

        {/* History filter tabs */}
        <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap' }}>
          {[
            { key:'all',      label:`All (${borrows.length})`           },
            { key:'active',   label:`📖 Active (${activeBorrows.length})`   },
            { key:'returned', label:`✅ Returned (${returnedBorrows.length})` },
            { key:'overdue',  label:`⏰ Overdue (${overdueBorrows.length})`  },
          ].map(t => (
            <button key={t.key} onClick={() => setHistTab(t.key)} style={{
              padding:'5px 11px', borderRadius:20, fontSize:11, fontWeight:700,
              border:'1.5px solid', cursor:'pointer', transition:'all 0.15s',
              background: histTab===t.key ? 'var(--amber)' : 'transparent',
              color:      histTab===t.key ? '#fff' : 'var(--muted)',
              borderColor: histTab===t.key ? 'var(--amber)' : 'var(--border)',
            }}>{t.label}</button>
          ))}
        </div>

        {loading
          ? <div className="spinner" style={{ margin:'16px auto', display:'block' }} />
          : histFiltered.length === 0
            ? <p style={{ fontSize:13, color:'var(--muted)', padding:'10px 0' }}>
                {histTab==='all' ? 'No borrow history yet.' : `No ${histTab} books.`}
              </p>
            : histFiltered.map(b => (
                <div key={b.id} style={{
                  display:'flex', alignItems:'flex-start', gap:12,
                  padding:'12px 0', borderBottom:'1px solid var(--border)',
                }}>
                  {/* Book spine */}
                  <div style={{
                    width:42, height:56, borderRadius:6, flexShrink:0,
                    background: b.status==='returned'
                      ? 'linear-gradient(135deg,#2a5a2a,#3d8c3d)'
                      : b.status==='overdue'
                        ? 'linear-gradient(135deg,#7a1a0a,#c0392b)'
                        : 'linear-gradient(135deg,#2d1200,#8b3a00)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:22,
                  }}>{b.books?.emoji || '📖'}</div>

                  {/* Details */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:13, marginBottom:2 }}>{b.books?.title}</div>
                    <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>
                      by {b.books?.author} · {b.books?.genre}
                    </div>
                    {/* Date row */}
                    <div style={{ fontSize:11, color:'var(--muted)', lineHeight:1.7 }}>
                      <span>📅 Borrowed: <strong>{new Date(b.borrowed_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</strong></span>
                      {b.returned_at
                        ? <><br/><span>↩️ Returned: <strong>{new Date(b.returned_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</strong></span>
                          {duration(b.borrowed_at, b.returned_at) && (
                            <span style={{ marginLeft:8, background:'var(--cream)', padding:'1px 7px', borderRadius:10 }}>
                              ⏱ {duration(b.borrowed_at, b.returned_at)}
                            </span>
                          )}</>
                        : <><br/><span style={{ color: b.status==='overdue' ? '#c0392b' : 'inherit' }}>
                            📌 Due: <strong>{new Date(b.due_date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</strong>
                          </span></>
                      }
                    </div>
                  </div>

                  {/* Status badge */}
                  <span className={`tag ${b.status==='returned'?'tag-green':b.status==='overdue'?'tag-red':'tag-amber'}`}
                    style={{ fontSize:10, flexShrink:0, marginTop:2, textTransform:'capitalize' }}>
                    {b.status}
                  </span>
                </div>
              ))
        }
      </div>

      {/* ── My Reviews ── */}
      {reviews.length > 0 && (
        <div className="card" style={{ marginBottom:14 }}>
          <h3 style={{ fontWeight:700, fontSize:15, marginBottom:12 }}>📝 My Reviews</h3>
          {reviews.map(r => (
            <div key={r.id} style={{ padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
                <span style={{ fontSize:20 }}>{r.books?.emoji||'📖'}</span>
                <strong style={{ fontSize:13, flex:1 }}>{r.books?.title}</strong>
                <span style={{ fontSize:12 }}>{'⭐'.repeat(r.rating)}</span>
              </div>
              {r.body && <p style={{ fontSize:13, color:'var(--muted)', lineHeight:1.5 }}>{r.body}</p>}
            </div>
          ))}
        </div>
      )}

      <button className="btn btn-outline" style={{ width:'100%', marginTop:4 }} onClick={signOut}>
        🚪 Sign Out
      </button>

      {/* ── Write Review Modal ── */}
      <Modal open={showReview} onClose={() => setShowReview(false)} title="⭐ Write a Review">
        <div className="form-group">
          <label className="form-label">Book</label>
          <select className="input" value={reviewForm.book_id} onChange={e => setReviewForm(f=>({...f,book_id:e.target.value}))}>
            <option value="">Select a book…</option>
            {books.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Rating</label>
          <StarRating value={reviewForm.rating} onChange={v => setReviewForm(f=>({...f,rating:v}))} />
        </div>
        <div className="form-group">
          <label className="form-label">Your Thoughts</label>
          <textarea className="input" placeholder="Share your thoughts about this book…"
            value={reviewForm.body} onChange={e => setReviewForm(f=>({...f,body:e.target.value}))} />
        </div>
        <div className="form-actions">
          <button className="btn btn-primary btn-lg" onClick={saveReview} disabled={reviewLoading}>
            {reviewLoading ? <><span className="spinner spinner-sm"/> Posting…</> : 'Post Review (+20 pts)'}
          </button>
          <button className="btn btn-outline" onClick={() => setShowReview(false)}>Cancel</button>
        </div>
      </Modal>

      {/* ── Edit Profile Modal ── */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="✏️ Edit Profile">
        <div className="form-group">
          <label className="form-label">Name</label>
          <input className="input" value={editName} onChange={e => setEditName(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Bio</label>
          <textarea className="input" placeholder="A short bio about yourself…"
            value={editBio} onChange={e => setEditBio(e.target.value)} />
        </div>
        <div className="form-actions">
          <button className="btn btn-primary btn-lg" onClick={saveProfile} disabled={editLoading}>
            {editLoading ? <><span className="spinner spinner-sm"/> Saving…</> : 'Save Changes'}
          </button>
          <button className="btn btn-outline" onClick={() => setShowEdit(false)}>Cancel</button>
        </div>
      </Modal>
    </div>
  )
}