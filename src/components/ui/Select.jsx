import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function Select({ options, value, onChange, placeholder = '-- Pilih --', style }) {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 })

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        triggerRef.current && !triggerRef.current.contains(event.target) &&
        menuRef.current && !menuRef.current.contains(event.target)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    if (isOpen) {
      const handleScroll = (event) => {
        // JIKA YANG DI-SCROLL ADALAH MENU DROPDOWN ITU SENDIRI, ABAIKAN
        if (menuRef.current && menuRef.current.contains(event.target)) {
          return
        }
        // Jika halaman luar yang di-scroll, tutup dropdown
        setIsOpen(false)
      }
      
      window.addEventListener('scroll', handleScroll, true)
      return () => window.removeEventListener('scroll', handleScroll, true)
    }
  }, [isOpen])

  const handleToggle = () => {
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      
      // Cek apakah space di bawah cukup, kalau tidak buka ke atas
      const spaceBelow = window.innerHeight - rect.bottom
      const menuHeight = Math.min(options.length * 46, 250) // Estimasi tinggi menu
      
      let topPosition = rect.bottom + 4
      if (spaceBelow < menuHeight && rect.top > menuHeight) {
        topPosition = rect.top - menuHeight - 4
      }

      setCoords({ top: topPosition, left: rect.left, width: rect.width })
    }
    setIsOpen(!isOpen)
  }

  const selectedOption = options.find(opt => opt.value === value)

  return (
    <>
      <div 
        ref={triggerRef}
        onClick={handleToggle}
        style={{
          width: '100%', padding: '12px 16px', border: '1px solid var(--border-color)',
          borderRadius: '10px', backgroundColor: 'var(--card-bg)', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: '14px', color: selectedOption ? 'var(--text-main)' : 'var(--text-muted)',
          boxShadow: isOpen ? '0 0 0 4px rgba(236, 72, 153, 0.15)' : 'none',
          borderColor: isOpen ? 'var(--primary)' : 'var(--border-color)',
          transition: 'all 0.2s',
          ...style
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '8px' }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16, flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>

      {isOpen && createPortal(
        <div 
          ref={menuRef}
          className="custom-select-menu"
          style={{
            position: 'fixed', 
            top: coords.top, 
            left: coords.left, 
            minWidth: coords.width, 
            width: 'max-content', 
            maxWidth: '350px',
            // Tambahkan sedikit penyesuaian agar batas kanan tidak keluar layar
            ...(coords.left + coords.width > window.innerWidth - 20 ? { left: 'auto', right: 20 } : {})
          }}
        >
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`custom-select-option ${value === opt.value ? 'selected' : ''}`}
              onClick={() => { onChange(opt.value); setIsOpen(false); }}
            >
              {opt.label}
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}