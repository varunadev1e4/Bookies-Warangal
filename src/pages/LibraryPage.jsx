import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { notifyAllMembers } from '../lib/notifications'
import Modal from '../components/Modal'

const GENRES = ['All', 'Fiction', 'Non-Fiction', 'Telugu', 'History', 'Self-Help', 'Science', 'Poetry']
const EMOJIS = ['📖','📗','📘','📙','📕','📚','🔖']

function StatusBadge({ status }) {
  const map = {
    available: { label: 'Available', bg: '#d4f0d4', color: '#1a6b1a' },
    borrowed:  { label: 'Borrowed',  bg: '#fde8cc', color: '#8b3a00' },
    reserved:  { label: 'Reserved',  bg: '#e8d4f0', color: '#5a1a8b' },
  }
  const s = map[status] || map.available
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 10 }}>
      {s.label}
    </span>
  )
}

export default function LibraryPage() {
  const { profile, isAdmin, refreshProfile } = useAuth()
  const { success, error: showError } = useToast()

  const [books, setBooks]         = useState([])
  const [filtered, setFiltered]   = useState([])
  const [genre, setGenre]         = useState('All')
  const [query, setQuery]         = useState('')
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState(null)
  const [borrowing, setBorrowing] = useState(false)

  // Add book modal
  const [showAdd, setShowAdd]     = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [form, setForm]           = useState({ title:'', author:'', genre:'Fiction', emoji:'📖', description:'', total_copies:1 })

  // My borrows for return
  const [myBorrows, setMyBorrows] = useState([])

  useEffect(() => { fetchBooks(); fetchMyBorrows() }, [])
  useEffect(() => { applyFilters() }, [books, query, genre])

  async function fetchBooks() {
    setLoading(true)
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) showError('Failed to load books')
    else setBooks(data || [])
    setLoading(false)
  }

  async function fetchMyBorrows() {
    if (!profile?.id) return
    const { data } = await supabase
      .from('borrows')
      .select('*, books(title, emoji)')
      .eq('user_id', profile.id)
      .eq('status', 'active')
    setMyBorrows(data || [])
  }

  function applyFilters() {
    let list = [...books]
    if (genre !== 'All') list = list.filter(b => b.genre === genre)
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(b => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q))
    }
    setFiltered(list)
  }

  async function borrowBook() {
    if (!profile) return
    setBorrowing(true)
    const { data, error } = await supabase.rpc('borrow_book', {
      p_book_id: selected.id,
      p_user_id: profile.id,
    })
    setBorrowing(false)
    if (error || !data?.success) {
      showError(data?.error || error?.message || 'Could not borrow book')
      return
    }
    success('Book borrowed! +10 points 🎉')
    setSelected(null)
    fetchBooks()
    fetchMyBorrows()
    refreshProfile()
  }

  async function returnBook(borrowId) {
    const { data, error } = await supabase.rpc('return_book', {
      p_borrow_id: borrowId,
      p_user_id: profile.id,
    })
    if (error || !data?.success) { showError(data?.error || 'Could not return book'); return }
    success('Book returned! +15 points 📚')
    fetchBooks()
    fetchMyBorrows()
    refreshProfile()
  }

  async function addBook() {
    if (!form.title.trim() || !form.author.trim()) { showError('Title and author are required'); return }
    setAddLoading(true)
    const { data: inserted, error } = await supabase.from('books').insert({
      ...form,
      available_copies: Number(form.total_copies),
      total_copies: Number(form.total_copies),
      created_by: profile.id,
    }).select().single()
    if (error) { showError(error.message); setAddLoading(false); return }

    // Log activity
    await supabase.from('activity_feed').insert({
      user_id: profile.id,
      action: 'added a book',
      target: form.title,
    })
    // Reward points for contributing
    await supabase.from('profiles').update({ points: (profile.points || 0) + 25 }).eq('id', profile.id)

    // Notify all members
    await notifyAllMembers({
      type:  'new_book',
      title: `New Book: ${form.title}`,
      body:  `by ${form.author} · ${form.genre} — now available in the library!`,
      link:  '/library',
    })

    setAddLoading(false)
    success(`"${form.title}" added to library! +25 points 📚`)
    setShowAdd(false)
    setForm({ title:'', author:'', genre:'Fiction', emoji:'📖', description:'', total_copies:1 })
    fetchBooks()
    refreshProfile()
  }

  async function deleteBook(id) {
    if (!window.confirm('Remove this book from library?')) return
    const { error } = await supabase.from('books').delete().eq('id', id)
    if (error) { showError(error.message); return }
    success('Book removed')
    fetchBooks()
  }

  const alreadyBorrowed = selected && myBorrows.some(b => b.book_id === selected.id)

  return (
    <div className="page-wrapper fade-in">
      <div className="section-header">
        <h2 className="section-title">📚 Library</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ Add Book</button>
      </div>

      {/* My active borrows */}
      {myBorrows.length > 0 && (
        <div className="card" style={{ marginBottom: 18, padding: '14px 16px' }}>
          <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>📥 Currently Borrowed</h3>
          {myBorrows.map(b => (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 22 }}>{b.books?.emoji || '📖'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{b.books?.title}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                  Due: {new Date(b.due_date).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
                </div>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => returnBook(b.id)}>Return</button>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <input className="input" placeholder="🔍  Search books, authors…"
        value={query} onChange={e => setQuery(e.target.value)}
        style={{ marginBottom: 12 }} />

      {/* Genre chips */}
      <div className="chips">
        {GENRES.map(g => (
          <button key={g} className={`chip ${genre === g ? 'active' : ''}`}
            onClick={() => setGenre(g)}>{g}</button>
        ))}
      </div>

      {/* Book grid */}
      {loading
        ? <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><div className="spinner" /></div>
        : filtered.length === 0
          ? <div className="empty-state"><div className="es-icon">🔍</div><p>No books found. Try a different search.</p></div>
          : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(152px, 1fr))', gap: 14 }}>
              {filtered.map(book => (
                <div key={book.id}
                  onClick={() => setSelected(book)}
                  style={{
                    background: 'var(--card)', borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)', overflow: 'hidden',
                    cursor: 'pointer', transition: 'all 0.18s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
                >
                  <div style={{
                    height: 130, background: 'linear-gradient(135deg,#2d1200,#8b3a00)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 44, position: 'relative',
                  }}>
                    {book.emoji}
                    <div style={{ position: 'absolute', top: 8, right: 8 }}>
                      <StatusBadge status={book.available_copies > 0 ? 'available' : 'borrowed'} />
                    </div>
                  </div>
                  <div style={{ padding: '10px 10px 12px' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.3, marginBottom: 3 }}>{book.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{book.author}</div>
                    <span className="tag tag-amber" style={{ fontSize: 10 }}>{book.genre}</span>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                      {book.available_copies}/{book.total_copies} available
                    </div>
                    {book.created_by === profile?.id && (
                      <div style={{ fontSize: 10, color: 'var(--sage)', fontWeight: 700, marginTop: 4 }}>✦ Added by you</div>
                    )}
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
            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              <div style={{
                width: 80, height: 110, borderRadius: 10,
                background: 'linear-gradient(135deg,#2d1200,#8b3a00)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 42, flexShrink: 0,
              }}>{selected.emoji}</div>
              <div>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{selected.title}</h3>
                <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 6 }}>by {selected.author}</p>
                <span className="tag tag-amber">{selected.genre}</span>
                <p style={{ fontSize: 12, marginTop: 8 }}>
                  <StatusBadge status={selected.available_copies > 0 ? 'available' : 'borrowed'} />
                  <span style={{ color: 'var(--muted)', marginLeft: 8, fontSize: 12 }}>
                    {selected.available_copies} of {selected.total_copies} available
                  </span>
                </p>
              </div>
            </div>
            {selected.description && (
              <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 18 }}>{selected.description}</p>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-primary" style={{ flex: 1 }}
                disabled={selected.available_copies === 0 || alreadyBorrowed || borrowing}
                onClick={borrowBook}
              >
                {borrowing ? <><span className="spinner spinner-sm" /> Borrowing…</>
                  : alreadyBorrowed ? '✅ Already Borrowed'
                  : selected.available_copies === 0 ? '⏳ Not Available'
                  : '📥 Borrow Book'}
              </button>
              {isAdmin && (
                <button className="btn btn-danger btn-sm" onClick={() => { deleteBook(selected.id); setSelected(null) }}>
                  🗑 Remove
                </button>
              )}
            </div>
          </>
        )}
      </Modal>

      {/* ── Add Book Modal (All members) ── */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="📚 Add a Book">
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, background: 'var(--cream)', padding: '8px 12px', borderRadius: 8 }}>
          🎁 Contribute a book to the community library and earn <strong style={{ color: 'var(--amber)' }}>+25 points</strong>!
        </p>
        <div className="form-group">
          <label className="form-label">Book Title *</label>
          <input className="input" placeholder="Enter book title"
            value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Author *</label>
          <input className="input" placeholder="Author name"
            value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Genre</label>
            <select className="input" value={form.genre} onChange={e => setForm(f => ({ ...f, genre: e.target.value }))}>
              {GENRES.filter(g => g !== 'All').map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Emoji</label>
            <select className="input" value={form.emoji} onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))}>
              {EMOJIS.map(e => <option key={e}>{e}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Number of Copies</label>
          <input className="input" type="number" min="1" max="20"
            value={form.total_copies} onChange={e => setForm(f => ({ ...f, total_copies: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea className="input" placeholder="Short description of the book…"
            value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>
        <div className="form-actions">
          <button className="btn btn-primary btn-lg" onClick={addBook} disabled={addLoading}>
            {addLoading ? <><span className="spinner spinner-sm" /> Adding…</> : '📚 Add to Library (+25 pts)'}
          </button>
          <button className="btn btn-outline" onClick={() => setShowAdd(false)}>Cancel</button>
        </div>
      </Modal>
    </div>
  )
}