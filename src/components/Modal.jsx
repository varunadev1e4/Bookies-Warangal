import { useEffect } from 'react'

export default function Modal({ open, onClose, title, children, maxHeight = '85vh' }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-sheet" style={{ maxHeight }}>
        <div className="modal-handle" />
        {title && <div className="modal-title">{title}</div>}
        {children}
      </div>
    </div>
  )
}
