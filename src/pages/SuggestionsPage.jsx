import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import SuggestModal from '../components/SuggestModal'

const GENRE_COLORS = {
  Fiction:    '#e8d4f0',
  'Non-Fiction':'#d4e8f0',
  Telugu:     '#f0e8d4',
  History:    '#d4f0e8',
  'Self-Help':'#f0d4d4',
  Science:    '#d4d4f0',
  Poetry:     '#f0f0d4',
}

export default function SuggestionsPage() {
  const { profile, isAdmin } = useAuth()
  const { success, error: showError } = useToast()

  const [suggestions, setSuggestions] = useState([])
  const [myVotes,     setMyVotes]     = useState(new Set())
  const [loading,     setLoading]     = useState(true)
  const [showAdd,     setShowAdd]     = useState(false)
  const [sort,        setSort]        = useState('votes') // 'votes' | 'newest'

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: suggs }, { data: votes }] = await Promise.all([
      supabase.from('suggestions')
        .select('*, profiles(name, role)')
        .order(sort === 'votes' ? 'votes' : 'created_at', { ascending: false }),
      profile?.id
        ? supabase.from('suggestion_votes').select('suggestion_id').eq('user_id', profile.id)
        : Promise.resolve({ data: [] }),
    ])
    setSuggestions(suggs || [])
    setMyVotes(new Set((votes || []).map(v => v.suggestion_id)))
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [sort])

  async function toggleVote(s) {
    const voted = myVotes.has(s.id)
    if (voted) {
      await supabase.from('suggestion_votes').delete().eq('suggestion_id', s.id).eq('user_id', profile.id)
      await supabase.from('suggestions').update({ votes: Math.max(0, s.votes - 1) }).eq('id', s.id)
      setMyVotes(v => { const n = new Set(v); n.delete(s.id); return n })
      setSuggestions(prev => prev.map(x => x.id===s.id ? {...x, votes: Math.max(0,x.votes-1)} : x))
    } else {
      await supabase.from('suggestion_votes').insert({ suggestion_id: s.id, user_id: profile.id })
      await supabase.from('suggestions').update({ votes: s.votes + 1 }).eq('id', s.id)
      setMyVotes(v => new Set([...v, s.id]))
      setSuggestions(prev => prev.map(x => x.id===s.id ? {...x, votes: x.votes+1} : x))
    }
  }

  async function deleteSuggestion(id) {
    if (!window.confirm('Remove this suggestion?')) return
    await supabase.from('suggestions').delete().eq('id', id)
    setSuggestions(prev => prev.filter(s => s.id !== id))
    success('Suggestion removed')
  }

  function timeAgo(ts) {
    const d = (Date.now() - new Date(ts)) / 1000
    if (d < 3600)  return `${Math.floor(d/60)}m ago`
    if (d < 86400) return `${Math.floor(d/3600)}h ago`
    return `${Math.floor(d/86400)}d ago`
  }

  // Sort locally for snappy UI
  const sorted = [...suggestions].sort((a, b) =>
    sort === 'votes' ? b.votes - a.votes : new Date(b.created_at) - new Date(a.created_at)
  )

  return (
    <div className="page-wrapper fade-in">
      <div className="section-header">
        <h2 className="section-title">💡 Suggestions</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ Suggest</button>
      </div>

      {/* Sort + count */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <span style={{ fontSize:12, color:'var(--muted)' }}>{suggestions.length} suggestion{suggestions.length!==1?'s':''}</span>
        <div style={{ display:'flex', gap:6 }}>
          {['votes','newest'].map(s => (
            <button key={s} onClick={() => setSort(s)} style={{
              padding:'5px 12px', borderRadius:16, fontSize:11, fontWeight:700,
              border:'1.5px solid', cursor:'pointer',
              background: sort===s ? 'var(--amber)' : 'transparent',
              color:       sort===s ? '#fff' : 'var(--muted)',
              borderColor: sort===s ? 'var(--amber)' : 'var(--border)',
            }}>{s==='votes' ? '🔥 Top' : '🆕 New'}</button>
          ))}
        </div>
      </div>

      {loading
        ? <div style={{ display:'flex', justifyContent:'center', padding:'40px 0' }}><div className="spinner"/></div>
        : sorted.length === 0
          ? <div className="empty-state">
              <div className="es-icon">💡</div>
              <p>No suggestions yet.</p>
              <button className="btn btn-primary" style={{ marginTop:12 }} onClick={() => setShowAdd(true)}>Be the first to suggest!</button>
            </div>
          : sorted.map((s, i) => {
              const voted   = myVotes.has(s.id)
              const isOwner = s.user_id === profile?.id
              const genreColor = GENRE_COLORS[s.genre] || '#f0f0f0'
              return (
                <div key={s.id} style={{
                  background:'var(--card)', borderRadius:'var(--radius)',
                  border:`1px solid ${voted ? 'var(--amber)' : 'var(--border)'}`,
                  padding:'14px', marginBottom:10, display:'flex', gap:12,
                  transition:'border-color 0.18s',
                }}>
                  {/* Vote button */}
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, flexShrink:0 }}>
                    <button onClick={() => toggleVote(s)} style={{
                      width:44, height:44, borderRadius:12,
                      background: voted ? 'var(--amber)' : 'var(--cream)',
                      border: `2px solid ${voted ? 'var(--amber)' : 'var(--border)'}`,
                      cursor:'pointer', fontSize:18, transition:'all 0.15s',
                      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:0,
                    }}>
                      <span>{voted ? '👍' : '👍'}</span>
                    </button>
                    <span style={{ fontFamily:'var(--font-serif)', fontWeight:800, fontSize:16, color: voted ? 'var(--amber)' : 'var(--ink)' }}>
                      {s.votes}
                    </span>
                  </div>

                  {/* Content */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'flex-start', gap:8, marginBottom:4 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:700, fontSize:15, fontFamily:'var(--font-serif)' }}>
                          {i < 3 && sort==='votes' && s.votes > 0 ? ['🥇','🥈','🥉'][i]+' ' : ''}{s.title}
                        </div>
                        {s.author && <div style={{ fontSize:12, color:'var(--muted)', marginTop:2 }}>by {s.author}</div>}
                      </div>
                      {s.genre && (
                        <span style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:10, background:genreColor, flexShrink:0 }}>
                          {s.genre}
                        </span>
                      )}
                    </div>

                    {s.reason && (
                      <p style={{ fontSize:12, color:'var(--muted)', lineHeight:1.55, marginBottom:8, fontStyle:'italic' }}>
                        "{s.reason}"
                      </p>
                    )}

                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <div style={{ fontSize:11, color:'var(--muted)' }}>
                        {s.profiles?.role === 'admin' ? '⚡ ' : ''}
                        <strong>{s.profiles?.name || 'Member'}</strong> · {timeAgo(s.created_at)}
                      </div>
                      {(isOwner || isAdmin) && (
                        <button onClick={() => deleteSuggestion(s.id)} style={{
                          background:'none', border:'none', cursor:'pointer',
                          fontSize:14, color:'var(--muted)', padding:'2px 6px',
                        }}>🗑</button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
      }

      <SuggestModal open={showAdd} onClose={() => { setShowAdd(false); fetchAll() }} />
    </div>
  )
}