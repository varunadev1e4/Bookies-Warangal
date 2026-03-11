import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
    return data
  }

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION immediately with the persisted session
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false))
      } else {
        setProfile(null)
        setLoading(false)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function signUp({ name, email, password, adminCode }) {
    let role = 'member'
    if (adminCode && adminCode.trim()) {
      const { data: valid, error: rpcErr } = await supabase
        .rpc('verify_admin_code', { code: adminCode.trim() })
      if (rpcErr) throw new Error('Could not verify admin code')
      if (!valid) throw new Error('Invalid admin code. Contact the club administrator.')
      role = 'admin'
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, role } }
    })
    if (error) throw error

    // Auto sign in immediately — no email confirmation step
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) throw signInError

    return { data, role }
  }

  async function signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  async function refreshProfile() {
    if (user) return fetchProfile(user.id)
  }

  const isAdmin = profile?.role === 'admin'

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}