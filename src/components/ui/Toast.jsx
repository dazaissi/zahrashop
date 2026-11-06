import { useEffect } from 'react'
import { FaCheckCircle, FaExclamationCircle } from 'react-icons/fa'

export default function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => { onClose() }, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  const isSuccess = type === 'success'
  
  return (
    <div style={{
      position: 'fixed', top: 24, right: 24, zIndex: 10000,
      // Background dibuat solid (putih / dark solid) bukan transparan
      background: 'var(--card-bg)', 
      padding: '16px 24px', borderRadius: 12,
      boxShadow: '0 10px 25px rgba(0,0,0,0.15)', 
      borderLeft: `4px solid ${isSuccess ? '#10b981' : '#ef4444'}`,
      display: 'flex', alignItems: 'center', gap: 12,
      animation: 'slideInRight 0.3s ease-out forwards',
      color: 'var(--text-main)', fontWeight: 'bold',
      // Tambahan agar solid di dark mode
      backdropFilter: 'blur(10px)',
      border: '1px solid var(--border-color)'
    }}>
      {isSuccess ? <FaCheckCircle color="#10b981" size={24} /> : <FaExclamationCircle color="#ef4444" size={24} />}
      {message}
    </div>
  )
}