import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const NAV = [
  { to: '/',            icon: '🏠', label: 'Home'      },
  { to: '/library',     icon: '📚', label: 'Library'   },
  { to: '/meetups',     icon: '🗓️', label: 'Meetups'   },
  { to: '/leaderboard', icon: '🏆', label: 'Ranks'     },
  { to: '/profile',     icon: '👤', label: 'Profile'   },
]

export default function Layout({ children }) {
  const { profile, isAdmin } = useAuth()
  const location = useLocation()
  const [unread, setUnread] = useState(0)
  const initials = profile?.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'

  // Fetch unread count on mount + route change
  useEffect(() => {
    if (!profile?.id) return
    fetchUnread()
    // Realtime subscription for live badge updates
    const channel = supabase
      .channel('notifications-badge')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${profile.id}`,
      }, () => fetchUnread())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [profile?.id])

  // Re-check when navigating away from notifications page
  useEffect(() => {
    if (profile?.id) fetchUnread()
  }, [location.pathname])

  async function fetchUnread() {
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('read', false)
    setUnread(count || 0)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* ─── Top Bar ─── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: '#1a0a00', height: 58,
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* 🔔 Notification bell */}
          <NavLink to="/notifications" style={{ textDecoration: 'none', position: 'relative' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, cursor: 'pointer', transition: 'background 0.18s',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
            >
              🔔
              {unread > 0 && (
                <div style={{
                  position: 'absolute', top: -4, right: -4,
                  background: '#e74c3c', color: '#fff',
                  fontSize: 10, fontWeight: 800,
                  minWidth: 18, height: 18, borderRadius: 9,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 4px', border: '2px solid #1a0a00',
                }}>
                  {unread > 99 ? '99+' : unread}
                </div>
              )}
            </div>
          </NavLink>

          {isAdmin && (
            <NavLink to="/admin" style={{ textDecoration: 'none' }}>
              <span style={{
                background: '#3d6b34', color: '#fff',
                fontSize: 11, fontWeight: 700,
                padding: '3px 9px', borderRadius: 20, letterSpacing: '0.5px',
              }}>ADMIN</span>
            </NavLink>
          )}

          <NavLink to="/profile" style={{ textDecoration: 'none' }}>
            <div className="avatar avatar-sm" style={{ cursor: 'pointer' }}>{initials}</div>
          </NavLink>
        </div>
      </header>

      {/* ─── Content ─── */}
      <main style={{ flex: 1 }}>{children}</main>

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
          <NavLink key={n.to} to={n.to} end={n.to === '/'}
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