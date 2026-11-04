
import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'

export default function Select({
  options = [],
  value,
  onChange,
  placeholder = '-- Pilih --',
  style,
  disabled = false
}) {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const [coords, setCoords] = useState({
    top: 0,
    left: 0,
    width: 0,
    maxHeight: 250
  })

  function updatePosition() {
    if (!triggerRef.current) return

    const rect = triggerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom - 12
    const spaceAbove = rect.top - 12

    const openUp = spaceBelow < Math.min(options.length * 46, 250)
      && spaceAbove > spaceBelow

    const availableSpace = openUp ? spaceAbove : spaceBelow
    const maxHeight = Math.max(100, Math.min(250, availableSpace))

    const width = rect.width
    const left = Math.max(
      8,
      Math.min(rect.left, window.innerWidth - width - 8)
    )

    const top = openUp
      ? Math.max(8, rect.top - Math.min(options.length * 46, maxHeight) - 4)
      : rect.bottom + 4

    setCoords({
      top,
      left,
      width,
      maxHeight
    })
  }

  useLayoutEffect(() => {
    if (isOpen) updatePosition()
  }, [isOpen, options.length])

  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(event) {
      if (
        triggerRef.current?.contains(event.target) ||
        menuRef.current?.contains(event.target)
      ) {
        return
      }

      setIsOpen(false)
    }

    function handleScroll(event) {
      if (menuRef.current?.contains(event.target)) return
      setIsOpen(false)
    }

    function handleResize() {
      updatePosition()
    }

    document.addEventListener('pointerdown', handleClickOutside)
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleResize)

    return () => {
      document.removeEventListener('pointerdown', handleClickOutside)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleResize)
    }
  }, [isOpen, options.length])

  function handleToggle() {
    if (disabled) return

    if (!isOpen) updatePosition()

    setIsOpen(current => !current)
  }

  const selectedOption = options.find(
    option => option.value === value
  )

  return (
    <>
      <div
        ref={triggerRef}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={handleToggle}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            handleToggle()
          }

          if (event.key === 'Escape') {
            setIsOpen(false)
          }
        }}
        style={{
          width: '100%',
          padding: '12px 16px',
          border: `1px solid ${isOpen ? 'var(--primary)' : 'var(--border-color)'}`,
          borderRadius: 10,
          backgroundColor: 'var(--card-bg)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 14,
          color: selectedOption ? 'var(--text-main)' : 'var(--text-muted)',
          boxShadow: isOpen ? '0 0 0 4px rgba(236, 72, 153, 0.15)' : 'none',
          transition: 'all 0.2s',
          ...style
        }}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            paddingRight: 8
          }}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>

        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            width: 16,
            height: 16,
            flexShrink: 0,
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s'
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {isOpen && createPortal(
        <div
          ref={menuRef}
          className="custom-select-menu"
          role="listbox"
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            width: coords.width,
            minWidth: coords.width,
            maxWidth: 'calc(100vw - 16px)',
            maxHeight: coords.maxHeight,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            overscrollBehavior: 'contain',
            zIndex: 99999
          }}
        >
          {options.map(option => (
            <div
              key={option.value}
              role="option"
              aria-selected={value === option.value}
              className={`custom-select-option ${
                value === option.value ? 'selected' : ''
              }`}
              onClick={() => {
                onChange(option.value)
                setIsOpen(false)
              }}
            >
              {option.label}
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}
