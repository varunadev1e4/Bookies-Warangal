import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

export default function AuthPage() {
  const { signIn, signUp } = useAuth()
  const { success, error: showError } = useToast()
  const navigate = useNavigate()

  const [tab, setTab]             = useState('signin')  // 'signin' | 'signup'
  const [loading, setLoading]     = useState(false)
  const [showAdminHint, setShowAdminHint] = useState(false)

  // Sign in fields
  const [siEmail, setSiEmail]     = useState('')
  const [siPass, setSiPass]       = useState('')

  // Sign up fields
  const [suName, setSuName]       = useState('')
  const [suEmail, setSuEmail]     = useState('')
  const [suPass, setSuPass]       = useState('')
  const [suPass2, setSuPass2]     = useState('')
  const [suAdminCode, setSuAdminCode] = useState('')
  const [showAdminField, setShowAdminField] = useState(false)

  async function handleSignIn(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await signIn({ email: siEmail, password: siPass })
      success('Welcome back!')
      navigate('/')
    } catch (err) {
      showError(err.message || 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignUp(e) {
    e.preventDefault()
    if (suPass !== suPass2) { showError('Passwords do not match'); return }
    if (suPass.length < 6)  { showError('Password must be at least 6 characters'); return }
    setLoading(true)
    try {
      const { role } = await signUp({ name: suName, email: suEmail, password: suPass, adminCode: suAdminCode })
      success(role === 'admin'
        ? '🎉 Admin account created! Check your email to confirm.'
        : '🎉 Welcome! Check your email to confirm your account.')
      setTab('signin')
    } catch (err) {
      showError(err.message || 'Sign up failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: '#1a0a00',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* BG decoration */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 20% 60%, #3a1800 0%, transparent 55%), radial-gradient(ellipse at 85% 20%, #2a0a00 0%, transparent 50%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', fontFamily: 'var(--font-serif)', fontWeight: 900,
        fontSize: 'clamp(90px,22vw,240px)', color: 'rgba(255,255,255,0.025)',
        top: -20, left: -20, userSelect: 'none', lineHeight: 1,
      }}>Books</div>
      <div style={{
        position: 'absolute', fontFamily: 'var(--font-serif)', fontWeight: 900,
        fontSize: 'clamp(60px,15vw,160px)', color: 'rgba(255,255,255,0.02)',
        bottom: -10, right: -10, userSelect: 'none', lineHeight: 1,
      }}>Read</div>

      {/* Card */}
      <div style={{
        position: 'relative', zIndex: 1,
        margin: 'auto', width: '100%', maxWidth: 420,
        padding: '16px',
      }}>
        <div className="card slide-up" style={{ borderRadius: 20, padding: '36px 30px' }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{
              width: 60, height: 60, background: 'var(--amber)', borderRadius: 16,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 30, marginBottom: 12,
            }}>📚</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 900 }}>
              Warangal Bookies
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
              📍 Warangal, Telangana · 750+ Readers
            </p>
          </div>

          {/* Tabs */}
          <div className="tabs" style={{ marginBottom: 22 }}>
            <button className={`tab ${tab === 'signin' ? 'active' : ''}`} onClick={() => setTab('signin')}>Sign In</button>
            <button className={`tab ${tab === 'signup' ? 'active' : ''}`} onClick={() => setTab('signup')}>Create Account</button>
          </div>

          {/* ── SIGN IN ── */}
          {tab === 'signin' && (
            <form onSubmit={handleSignIn}>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="input" type="email" required placeholder="your@email.com"
                  value={siEmail} onChange={e => setSiEmail(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input className="input" type="password" required placeholder="••••••••"
                  value={siPass} onChange={e => setSiPass(e.target.value)} />
              </div>
              <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{ marginTop: 4 }}>
                {loading ? <><span className="spinner spinner-sm" />  Signing in…</> : 'Enter the Library →'}
              </button>
              <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)', marginTop: 14 }}>
                Don't have an account?{' '}
                <button type="button" className="btn-ghost" style={{ fontSize: 12, padding: 0, color: 'var(--amber)', fontWeight: 600 }}
                  onClick={() => setTab('signup')}>Create one</button>
              </p>
            </form>
          )}

          {/* ── SIGN UP ── */}
          {tab === 'signup' && (
            <form onSubmit={handleSignUp}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="input" required placeholder="Your name"
                  value={suName} onChange={e => setSuName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="input" type="email" required placeholder="your@email.com"
                  value={suEmail} onChange={e => setSuEmail(e.target.value)} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input className="input" type="password" required placeholder="Min 6 chars"
                    value={suPass} onChange={e => setSuPass(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm</label>
                  <input className="input" type="password" required placeholder="Repeat"
                    value={suPass2} onChange={e => setSuPass2(e.target.value)} />
                </div>
              </div>

              {/* Admin code toggle */}
              <div style={{ marginBottom: 14 }}>
                <button type="button" onClick={() => setShowAdminField(v => !v)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 12, color: 'var(--amber)', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 5,
                    fontFamily: 'var(--font-sans)',
                  }}>
                  {showAdminField ? '▼' : '▶'} I have an Admin Code
                </button>

                {showAdminField && (
                  <div style={{ marginTop: 10 }}>
                    <input className="input" placeholder="Enter admin code (e.g. WBADMIN2024)"
                      value={suAdminCode} onChange={e => setSuAdminCode(e.target.value)}
                      style={{ borderColor: 'var(--amber)' }} />
                    <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5, lineHeight: 1.5 }}>
                      ⚡ Only club administrators have this code. Wrong code = regular member account.
                      Contact your club admin if you need access.
                    </p>
                  </div>
                )}
              </div>

              <button className="btn btn-primary btn-lg" type="submit" disabled={loading}>
                {loading
                  ? <><span className="spinner spinner-sm" /> Creating account…</>
                  : suAdminCode.trim()
                    ? '⚡ Create Admin Account'
                    : '📖 Join the Club'}
              </button>

              <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)', marginTop: 14 }}>
                Already a member?{' '}
                <button type="button" className="btn-ghost" style={{ fontSize: 12, padding: 0, color: 'var(--amber)', fontWeight: 600 }}
                  onClick={() => setTab('signin')}>Sign in</button>
              </p>
            </form>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 16 }}>
          Warangal Bookies · Community Book Club
        </p>
      </div>
    </div>
  )
}
