import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const NAV = [
  { to: '/', icon: '🏠', label: 'Home' },
  { to: '/library', icon: '📚', label: 'Library' },
  { to: '/meetups', icon: '🗓️', label: 'Meetups' },
  { to: '/suggestions', icon: '💡', label: 'Suggest' },
  { to: '/profile', icon: '👤', label: 'Profile' },
]

export default function Layout({ children }) {
  const { profile, isAdmin } = useAuth()
  const location = useLocation()
  const [unread, setUnread] = useState(0)
  const initials = profile?.name?.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) || '?'

  useEffect(() => {
    if (!profile?.id) return
    fetchUnread()
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
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/" className="brand-link">
          <span className="brand-icon">📚</span>
          <span className="brand-name">Warangal Bookies</span>
        </NavLink>

        <div className="topbar-actions">
          <NavLink to="/notifications" className="notification-link">
            <div className="notification-btn">
              <span aria-hidden>🔔</span>
              {unread > 0 && (
                <div className="notification-badge">
                  {unread > 99 ? '99+' : unread}
                </div>
              )}
            </div>
          </NavLink>

          {isAdmin && (
            <NavLink to="/admin" className="admin-pill-link">
              <span className="admin-pill">ADMIN</span>
            </NavLink>
          )}

          <NavLink to="/profile" className="avatar-link">
            <div className="avatar avatar-sm">{initials}</div>
          </NavLink>
        </div>
      </header>

      <main className="app-content">{children}</main>

      <nav className="bottom-nav">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className={({ isActive }) => `bottom-nav-link ${isActive ? 'active' : ''}`}
          >
            <span className="bottom-nav-icon" aria-hidden>{n.icon}</span>
            <span className="bottom-nav-label">{n.label}</span>
          </NavLink>
        ))}
        {isAdmin && (
          <NavLink
            to="/admin"
            className={({ isActive }) => `bottom-nav-link ${isActive ? 'active' : ''}`}
          >
            <span className="bottom-nav-icon" aria-hidden>⚡</span>
            <span className="bottom-nav-label">Admin</span>
          </NavLink>
        )}
      </nav>
    </div>
  )
}
