import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const NAV = [
  { to: '/',           icon: '🏠', label: 'Home'      },
  { to: '/library',    icon: '📚', label: 'Library'   },
  { to: '/meetups',    icon: '🗓️', label: 'Meetups'   },
  { to: '/leaderboard',icon: '🏆', label: 'Ranks'     },
  { to: '/profile',    icon: '👤', label: 'Profile'   },
]

export default function Layout({ children }) {
  const { profile, isAdmin } = useAuth()
  const initials = profile?.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* ─── Top Bar ─── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: '#1a0a00',
        height: 58,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 18px',
        boxShadow: '0 2px 20px rgba(0,0,0,0.3)',
      }}>
        <NavLink to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 22 }}>📚</span>
          <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: 19, color: '#f0a030' }}>
            Warangal Bookies
          </span>
        </NavLink>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isAdmin && (
            <NavLink to="/admin" style={{ textDecoration: 'none' }}>
              <span style={{
                background: '#3d6b34', color: '#fff',
                fontSize: 11, fontWeight: 700,
                padding: '3px 9px', borderRadius: 20, letterSpacing: '0.5px'
              }}>ADMIN</span>
            </NavLink>
          )}
          <NavLink to="/profile" style={{ textDecoration: 'none' }}>
            <div className="avatar avatar-sm" style={{ cursor: 'pointer' }}>{initials}</div>
          </NavLink>
        </div>
      </header>

      {/* ─── Content ─── */}
      <main style={{ flex: 1 }}>
        {children}
      </main>

      {/* ─── Bottom Nav ─── */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#1a0a00',
        display: 'flex',
        paddingBottom: 'env(safe-area-inset-bottom, 6px)',
        zIndex: 100,
        boxShadow: '0 -2px 20px rgba(0,0,0,0.35)',
      }}>
        {NAV.map(n => (
          <NavLink
            key={n.to} to={n.to} end={n.to === '/'}
            style={({ isActive }) => ({
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 2, padding: '8px 4px 6px',
              textDecoration: 'none',
              color: isActive ? '#f0a030' : 'rgba(255,255,255,0.45)',
              transition: 'color 0.18s',
            })}
          >
            <span style={{ fontSize: 20, lineHeight: 1 }}>{n.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 500 }}>{n.label}</span>
          </NavLink>
        ))}
        {isAdmin && (
          <NavLink to="/admin"
            style={({ isActive }) => ({
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 2, padding: '8px 4px 6px',
              textDecoration: 'none',
              color: isActive ? '#f0a030' : 'rgba(255,255,255,0.45)',
              transition: 'color 0.18s',
            })}
          >
            <span style={{ fontSize: 20, lineHeight: 1 }}>⚡</span>
            <span style={{ fontSize: 10, fontWeight: 500 }}>Admin</span>
          </NavLink>
        )}
      </nav>
    </div>
  )
}
