import { createContext, useCallback, useContext, useState } from 'react'

const ToastCtx = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const show = useCallback((msg, type = 'info') => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000)
  }, [])

  const success = useCallback((m) => show(m, 'success'), [show])
  const error   = useCallback((m) => show(m, 'error'),   [show])

  return (
    <ToastCtx.Provider value={{ show, success, error }}>
      {children}
      <div style={{ position:'fixed', bottom:'90px', left:'50%', transform:'translateX(-50%)', zIndex:1000, display:'flex', flexDirection:'column', gap:'8px', alignItems:'center', pointerEvents:'none' }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: t.type === 'error' ? '#c0392b' : t.type === 'success' ? '#1a6b1a' : '#1a0a00',
            color: 'white', padding: '11px 20px', borderRadius: '10px',
            fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap',
            animation: 'fadeInUp 0.3s ease', boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
          }}>
            {t.type === 'success' ? '✅ ' : t.type === 'error' ? '❌ ' : 'ℹ️ '}{t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)
