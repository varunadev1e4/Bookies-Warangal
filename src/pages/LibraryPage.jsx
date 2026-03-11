import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { notifyAllMembers } from '../lib/notifications'
import Modal from '../components/Modal'
import SuggestModal from '../components/SuggestModal'

const GENRES = ['All','Fiction','Non-Fiction','Telugu','History','Self-Help','Science','Poetry']
const EMOJIS = ['📖','📗','📘','📙','📕','📚','🔖']

function StatusBadge({ status }) {
  const map = {
    available: { label:'Available', bg:'#d4f0d4', color:'#1a6b1a' },
    borrowed:  { label:'Borrowed',  bg:'#fde8cc', color:'#8b3a00' },
  }
  const s = map[status] || map.available
  return <span style={{ background:s.bg, color:s.color, fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:10 }}>{s.label}</span>
}

function avgRating(reviews) {
  if (!reviews?.length) return null
  return (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
}

function StarDisplay({ reviews }) {
  const avg = avgRating(reviews)
  if (!avg) return <span style={{ fontSize:10, color:'var(--muted)' }}>No reviews yet</span>
  const full  = Math.floor(avg)
  const half  = avg - full >= 0.5
  return (
    <span style={{ display:'flex', alignItems:'center', gap:3 }}>
      {[1,2,3,4,5].map(n => (
        <span key={n} style={{ fontSize:11, filter: n <= full ? 'none' : half && n === full+1 ? 'none' : 'grayscale(1)', opacity: n <= full ? 1 : half && n === full+1 ? 0.6 : 0.25 }}>⭐</span>
      ))}
      <span style={{ fontSize:11, fontWeight:700, color:'var(--amber)', marginLeft:2 }}>{avg}</span>
      <span style={{ fontSize:10, color:'var(--muted)' }}>({reviews.length})</span>
    </span>
  )
}

export default function LibraryPage() {
  const { profile, isAdmin, refreshProfile } = useAuth()
  const { success, error: showError } = useToast()
  const location = useLocation()

  const [books, setBooks]           = useState([])
  const [filtered, setFiltered]     = useState([])
  const [genre, setGenre]           = useState('All')
  const [query, setQuery]           = useState('')
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState(null)
  const [requesting, setRequesting] = useState(false)
  const [myBorrows, setMyBorrows]   = useState([])

  // Pending requests (where current user is owner)
  const [pendingRequests, setPendingRequests] = useState([])
  // Requests I sent (pending)
  const [mySentRequests, setMySentRequests]   = useState(new Set()) // book_ids with pending request

  // Add book modal
  const [showAdd, setShowAdd]       = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [form, setForm]             = useState({ title:'', author:'', genre:'Fiction', emoji:'📖', description:'', total_copies:1 })

  // Suggest modal
  const [showSuggest, setShowSuggest] = useState(false)

  useEffect(() => {
    fetchBooks()
    fetchMyBorrows()
    fetchRequests()
    // Auto-open suggest modal if navigated with ?suggest=1
    if (location.search.includes('suggest=1')) setShowSuggest(true)
  }, [])

  useEffect(() => { applyFilters() }, [books, query, genre])

  async function fetchBooks() {
    setLoading(true)
    const { data, error } = await supabase
      .from('books')
      .select('*, adder:profiles!created_by(name), reviews(rating)')
      .order('created_at', { ascending: false })
    if (error) showError('Failed to load books')
    else setBooks(data || [])
    setLoading(false)
  }

  async function fetchMyBorrows() {
    if (!profile?.id) return
    const { data } = await supabase
      .from('borrows')
      .select('*, books(title,emoji)')
      .eq('user_id', profile.id)
      .eq('status', 'active')
    setMyBorrows(data || [])
  }

  async function fetchRequests() {
    if (!profile?.id) return
    const [{ data: incoming }, { data: outgoing }] = await Promise.all([
      // Requests where I'm the owner (pending)
      supabase.from('borrow_requests')
        .select('*, book:books(title,emoji), requester:profiles!requester_id(name)')
        .eq('owner_id', profile.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: true }),
      // Requests I sent (pending) — to know which books I already requested
      supabase.from('borrow_requests')
        .select('book_id')
        .eq('requester_id', profile.id)
        .eq('status', 'pending'),
    ])
    setPendingRequests(incoming || [])
    setMySentRequests(new Set((outgoing || []).map(r => r.book_id)))
  }

  function applyFilters() {
    let list = [...books]
    if (genre !== 'All') list = list.filter(b => b.genre === genre)
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(b =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        (b.adder?.name || '').toLowerCase().includes(q)
      )
    }
    setFiltered(list)
  }

  async function requestBorrow() {
    if (!profile || !selected) return
    setRequesting(true)
    const ownerId = selected.created_by
    // Insert request
    const { error } = await supabase.from('borrow_requests').insert({
      book_id:      selected.id,
      requester_id: profile.id,
      owner_id:     ownerId,
    })
    if (error) { showError(error.message || 'Could not send request'); setRequesting(false); return }

    // Notify the book owner
    await supabase.from('notifications').insert({
      user_id: ownerId,
      type:    'borrow_request',
      title:   `📥 Borrow request: ${selected.title}`,
      body:    `${profile.name} wants to borrow your book. Go to Library to accept or reject.`,
      link:    '/library',
    })

    setMySentRequests(s => new Set([...s, selected.id]))
    setRequesting(false)
    success('Request sent! Waiting for the owner to accept 📬')
    setSelected(null)
    fetchRequests()
  }

  async function handleRequest(requestId, action) {
    if (action === 'accept') {
      const { data, error } = await supabase.rpc('accept_borrow_request', { p_request_id: requestId })
      if (error || !data?.success) { showError(data?.error || error?.message || 'Could not accept'); return }
      // Notify requester
      const req = pendingRequests.find(r => r.id === requestId)
      if (req) {
        await supabase.from('notifications').insert({
          user_id: req.requester_id,
          type:    'borrow_accepted',
          title:   `✅ Borrow request accepted!`,
          body:    `${profile.name} accepted your request for "${req.book?.title}". +10 points added!`,
          link:    '/library',
        })
      }
      success('Request accepted! Borrow logged +10 pts to them ✅')
    } else {
      await supabase.from('borrow_requests').update({ status:'rejected' }).eq('id', requestId)
      const req = pendingRequests.find(r => r.id === requestId)
      if (req) {
        await supabase.from('notifications').insert({
          user_id: req.requester_id,
          type:    'borrow_rejected',
          title:   `❌ Borrow request rejected`,
          body:    `Your request for "${req.book?.title}" was not accepted this time.`,
          link:    '/library',
        })
      }
      success('Request rejected')
    }
    fetchBooks()
    fetchMyBorrows()
    fetchRequests()
  }

  async function returnBook(borrowId) {
    const { data, error } = await supabase.rpc('return_book', { p_borrow_id: borrowId, p_user_id: profile.id })
    if (error || !data?.success) { showError(data?.error || 'Could not return book'); return }
    success('Book returned! +15 points 📚')
    fetchBooks(); fetchMyBorrows(); refreshProfile()
  }

  async function addBook() {
    if (!form.title.trim() || !form.author.trim()) { showError('Title and author are required'); return }
    setAddLoading(true)
    const { error } = await supabase.from('books').insert({
      ...form,
      available_copies: Number(form.total_copies),
      total_copies:     Number(form.total_copies),
      created_by:       profile.id,
    })
    if (error) { showError(error.message); setAddLoading(false); return }

    await supabase.from('activity_feed').insert({ user_id:profile.id, action:'added a book', target:form.title })
    await supabase.from('profiles').update({ points:(profile.points||0)+25 }).eq('id', profile.id)
    await notifyAllMembers({
      type:'new_book', title:`New Book: ${form.title}`,
      body:`by ${form.author} · ${form.genre} — now available in the library!`, link:'/library',
    })
    setAddLoading(false)
    success(`"${form.title}" added! +25 points 📚`)
    setShowAdd(false)
    setForm({ title:'', author:'', genre:'Fiction', emoji:'📖', description:'', total_copies:1 })
    fetchBooks(); refreshProfile()
  }

  async function deleteBook(id) {
    if (!window.confirm('Remove this book from library?')) return
    await supabase.from('books').delete().eq('id', id)
    success('Book removed'); fetchBooks()
  }

  const alreadyBorrowed  = selected && myBorrows.some(b => b.book_id === selected.id)
  const alreadyRequested = selected && mySentRequests.has(selected.id)
  const isMyBook         = selected && selected.created_by === profile?.id

  return (
    <div className="page-wrapper fade-in">
      <div className="section-header">
        <h2 className="section-title">📚 Library</h2>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-outline btn-sm" onClick={() => setShowSuggest(true)}>💡 Suggest</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ Add</button>
        </div>
      </div>

      {/* ── Pending borrow requests (owner view) ── */}
      {pendingRequests.length > 0 && (
        <div className="card" style={{ marginBottom:16, border:'1.5px solid var(--amber)' }}>
          <h3 style={{ fontWeight:700, fontSize:14, marginBottom:10, display:'flex', alignItems:'center', gap:8 }}>
            📬 Pending Borrow Requests
            <span style={{ background:'var(--amber)', color:'#fff', fontSize:11, fontWeight:800, padding:'1px 8px', borderRadius:10 }}>
              {pendingRequests.length}
            </span>
          </h3>
          {pendingRequests.map(req => (
            <div key={req.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
              <span style={{ fontSize:22, flexShrink:0 }}>{req.book?.emoji || '📖'}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600, fontSize:13 }}>{req.book?.title}</div>
                <div style={{ fontSize:11, color:'var(--muted)' }}>
                  Requested by <strong>{req.requester?.name}</strong> · {new Date(req.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}
                </div>
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <button className="btn btn-success btn-sm" onClick={() => handleRequest(req.id,'accept')}>✅ Accept</button>
                <button className="btn btn-outline btn-sm" onClick={() => handleRequest(req.id,'reject')} style={{ color:'#c0392b', borderColor:'#c0392b' }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── My active borrows ── */}
      {myBorrows.length > 0 && (
        <div className="card" style={{ marginBottom:18, padding:'14px 16px' }}>
          <h3 style={{ fontWeight:700, fontSize:14, marginBottom:10 }}>📥 Currently Borrowed</h3>
          {myBorrows.map(b => (
            <div key={b.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
              <span style={{ fontSize:22 }}>{b.books?.emoji||'📖'}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600, fontSize:13 }}>{b.books?.title}</div>
                <div style={{ fontSize:11, color:'var(--muted)' }}>Due: {new Date(b.due_date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</div>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => returnBook(b.id)}>Return</button>
            </div>
          ))}
        </div>
      )}

      <input className="input" placeholder="🔍  Search books, authors, added by…"
        value={query} onChange={e => setQuery(e.target.value)} style={{ marginBottom:12 }} />

      <div className="chips">
        {GENRES.map(g => (
          <button key={g} className={`chip ${genre===g?'active':''}`} onClick={() => setGenre(g)}>{g}</button>
        ))}
      </div>

      {loading
        ? <div style={{ display:'flex', justifyContent:'center', padding:'40px 0' }}><div className="spinner"/></div>
        : filtered.length === 0
          ? <div className="empty-state"><div className="es-icon">🔍</div><p>No books found.</p></div>
          : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(152px,1fr))', gap:14 }}>
              {filtered.map(book => (
                <div key={book.id} onClick={() => setSelected(book)} style={{
                  background:'var(--card)', borderRadius:'var(--radius)',
                  border:'1px solid var(--border)', overflow:'hidden',
                  cursor:'pointer', transition:'all 0.18s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow='var(--shadow-lg)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='' }}
                >
                  <div style={{
                    height:130, background:'linear-gradient(135deg,#2d1200,#8b3a00)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:44, position:'relative',
                  }}>
                    {book.emoji}
                    <div style={{ position:'absolute', top:8, right:8 }}>
                      <StatusBadge status={book.available_copies>0?'available':'borrowed'} />
                    </div>
                    {mySentRequests.has(book.id) && (
                      <div style={{ position:'absolute', bottom:6, left:6, background:'rgba(0,0,0,0.6)', color:'#f0a030', fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:8 }}>
                        📬 Requested
                      </div>
                    )}
                  </div>
                  <div style={{ padding:'10px 10px 12px' }}>
                    <div style={{ fontWeight:600, fontSize:13, lineHeight:1.3, marginBottom:2 }}>{book.title}</div>
                    <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>{book.author}</div>
                    <span className="tag tag-amber" style={{ fontSize:10 }}>{book.genre}</span>
                    <div style={{ fontSize:10, color:'var(--muted)', marginTop:6 }}>
                      {book.available_copies}/{book.total_copies} available
                    </div>
                    {/* Rating */}
                    <div style={{ marginTop:5 }}>
                      <StarDisplay reviews={book.reviews} />
                    </div>
                    {/* Who added */}
                    <div style={{ fontSize:10, marginTop:4, color: book.created_by===profile?.id ? 'var(--sage)' : 'var(--muted)', fontWeight: book.created_by===profile?.id ? 700 : 400 }}>
                      {book.created_by===profile?.id ? '✦ Added by you' : `Added by ${book.adder?.name || 'member'}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
      }

      {/* ── Book Detail Modal ── */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={null}>
        {selected && (
          <>
            <div style={{ display:'flex', gap:16, marginBottom:16 }}>
              <div style={{
                width:80, height:110, borderRadius:10,
                background:'linear-gradient(135deg,#2d1200,#8b3a00)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:42, flexShrink:0,
              }}>{selected.emoji}</div>
              <div>
                <h3 style={{ fontFamily:'var(--font-serif)', fontSize:18, fontWeight:700, marginBottom:4 }}>{selected.title}</h3>
                <p style={{ color:'var(--muted)', fontSize:13, marginBottom:4 }}>by {selected.author}</p>
                <div style={{ fontSize:11, color:'var(--muted)', marginBottom:6 }}>
                  {selected.created_by === profile?.id
                    ? <span style={{ color:'var(--sage)', fontWeight:700 }}>✦ Added by you</span>
                    : <span>Added by <strong>{selected.adder?.name || 'a member'}</strong></span>
                  }
                </div>
                <span className="tag tag-amber">{selected.genre}</span>
                <div style={{ marginTop:10 }}>
                  <StarDisplay reviews={selected.reviews} />
                </div>
                <p style={{ fontSize:12, marginTop:8 }}>
                  <StatusBadge status={selected.available_copies>0?'available':'borrowed'} />
                  <span style={{ color:'var(--muted)', marginLeft:8, fontSize:12 }}>
                    {selected.available_copies} of {selected.total_copies} available
                  </span>
                </p>
              </div>
            </div>

            {selected.description && (
              <p style={{ fontSize:13, color:'var(--muted)', lineHeight:1.6, marginBottom:16 }}>{selected.description}</p>
            )}

            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              {/* Borrow action */}
              {!isMyBook && (
                alreadyBorrowed
                  ? <button className="btn btn-outline" style={{ flex:1 }} disabled>✅ Already Borrowed</button>
                  : alreadyRequested
                    ? <button className="btn btn-outline" style={{ flex:1, color:'var(--amber)', borderColor:'var(--amber)' }} disabled>📬 Request Pending</button>
                    : selected.available_copies === 0
                      ? <button className="btn btn-outline" style={{ flex:1 }} disabled>⏳ Not Available</button>
                      : <button className="btn btn-primary" style={{ flex:1 }} onClick={requestBorrow} disabled={requesting}>
                          {requesting ? <><span className="spinner spinner-sm"/> Sending…</> : '📥 Request to Borrow'}
                        </button>
              )}
              {isMyBook && (
                <div style={{ flex:1, padding:'10px 14px', background:'var(--cream)', borderRadius:10, fontSize:12, color:'var(--muted)', textAlign:'center' }}>
                  📖 Your book — others can request to borrow it
                </div>
              )}
              {isAdmin && (
                <button className="btn btn-danger btn-sm" onClick={() => { deleteBook(selected.id); setSelected(null) }}>🗑</button>
              )}
            </div>
          </>
        )}
      </Modal>

      {/* ── Add Book Modal ── */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="📚 Add a Book">
        <p style={{ fontSize:12, color:'var(--muted)', marginBottom:14, background:'var(--cream)', padding:'8px 12px', borderRadius:8 }}>
          🎁 Contribute a book and earn <strong style={{ color:'var(--amber)' }}>+25 points</strong>!
        </p>
        <div className="form-group">
          <label className="form-label">Book Title *</label>
          <input className="input" placeholder="Enter book title" value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} />
        </div>
        <div className="form-group">
          <label className="form-label">Author *</label>
          <input className="input" placeholder="Author name" value={form.author} onChange={e => setForm(f=>({...f,author:e.target.value}))} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Genre</label>
            <select className="input" value={form.genre} onChange={e => setForm(f=>({...f,genre:e.target.value}))}>
              {GENRES.filter(g=>g!=='All').map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Emoji</label>
            <select className="input" value={form.emoji} onChange={e => setForm(f=>({...f,emoji:e.target.value}))}>
              {EMOJIS.map(e => <option key={e}>{e}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Number of Copies</label>
          <input className="input" type="number" min="1" max="20" value={form.total_copies} onChange={e => setForm(f=>({...f,total_copies:e.target.value}))} />
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea className="input" placeholder="Short description…" value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} />
        </div>
        <div className="form-actions">
          <button className="btn btn-primary btn-lg" onClick={addBook} disabled={addLoading}>
            {addLoading ? <><span className="spinner spinner-sm"/> Adding…</> : '📚 Add to Library (+25 pts)'}
          </button>
          <button className="btn btn-outline" onClick={() => setShowAdd(false)}>Cancel</button>
        </div>
      </Modal>

      {/* ── Suggest Modal ── */}
      <SuggestModal open={showSuggest} onClose={() => setShowSuggest(false)} />
    </div>
  )
}