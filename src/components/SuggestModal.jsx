import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import Modal from './Modal'

const GENRES = ['Fiction','Non-Fiction','Telugu','History','Self-Help','Science','Poetry']

export default function SuggestModal({ open, onClose, onSuccess, prefillTitle = '' }) {
  const { profile } = useAuth()
  const { success, error: showError } = useToast()
  const [form, setForm]     = useState({ title: prefillTitle, author:'', genre:'Fiction', reason:'' })
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!form.title.trim()) { showError('Book title is required'); return }
    if (!profile?.id) { showError('You must be logged in'); return }
    setSaving(true)
    const { data, error } = await supabase.from('suggestions').insert({
      user_id: profile.id,
      title:   form.title.trim(),
      author:  form.author.trim() || null,
      genre:   form.genre,
      reason:  form.reason.trim() || null,
    }).select().single()
    setSaving(false)
    if (error) {
      console.error('Suggestion insert error:', error)
      showError(`Could not save: ${error.message}`)
      return
    }
    success('Suggestion added! Others can vote on it 💡')
    setForm({ title:'', author:'', genre:'Fiction', reason:'' })
    ;(onSuccess || onClose)()
  }

  return (
    <Modal open={open} onClose={onClose} title="💡 Suggest a Book">
      <p style={{ fontSize:12, color:'var(--muted)', marginBottom:14, background:'var(--cream)', padding:'8px 12px', borderRadius:8 }}>
        Suggest a book you'd love the club to read. Members can upvote the best suggestions!
      </p>
      <div className="form-group">
        <label className="form-label">Book Title *</label>
        <input className="input" placeholder="e.g. Midnight's Children"
          value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} autoFocus />
      </div>
      <div className="form-group">
        <label className="form-label">Author</label>
        <input className="input" placeholder="e.g. Salman Rushdie"
          value={form.author} onChange={e => setForm(f=>({...f,author:e.target.value}))} />
      </div>
      <div className="form-group">
        <label className="form-label">Genre</label>
        <select className="input" value={form.genre} onChange={e => setForm(f=>({...f,genre:e.target.value}))}>
          {GENRES.map(g => <option key={g}>{g}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Why should the club read this?</label>
        <textarea className="input" rows={3} placeholder="Tell others why this book is worth reading…"
          value={form.reason} onChange={e => setForm(f=>({...f,reason:e.target.value}))} />
      </div>
      <div className="form-actions">
        <button className="btn btn-primary btn-lg" onClick={submit} disabled={saving}>
          {saving ? <><span className="spinner spinner-sm"/> Submitting…</> : '💡 Submit Suggestion'}
        </button>
        <button className="btn btn-outline" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  )
}