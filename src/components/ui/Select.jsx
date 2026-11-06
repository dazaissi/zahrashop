import { useState, useRef, useEffect, useLayoutEffect, useId } from 'react'
import { createPortal } from 'react-dom'

const MENU_GAP = 4
const MENU_MARGIN = 8
const ITEM_HEIGHT = 44
const MENU_MAX_HEIGHT = 320
const MENU_MIN_HEIGHT = 80

let animationsInjected = false
function ensureAnimations() {
  if (animationsInjected || typeof document === 'undefined') return
  animationsInjected = true
  const style = document.createElement('style')
  style.setAttribute('data-zs-select', '')
  style.textContent = `
    @keyframes zsSelectMenuDown {
      from { opacity: 0; transform: translateY(-4px) scaleY(0.98); }
      to   { opacity: 1; transform: translateY(0)    scaleY(1); }
    }
    @keyframes zsSelectMenuUp {
      from { opacity: 0; transform: translateY(4px)  scaleY(0.98); }
      to   { opacity: 1; transform: translateY(0)    scaleY(1); }
    }
  `
  document.head.appendChild(style)
}

export default function Select({
  options = [],
  value,
  onChange,
  placeholder = '-- Pilih --',
  style,
  disabled = false
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const selectId = useId()

  const [coords, setCoords] = useState({
    top: 0, left: 0, width: 0, maxHeight: 250, openUp: false
  })

  const selectedOption = options.find(option => option.value === value)
  const selectedIndex = options.findIndex(option => option.value === value)

  useEffect(() => { ensureAnimations() }, [])

  function updatePosition() {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()

    if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) {
      setIsOpen(false); return
    }

    const desiredHeight = Math.min(options.length * ITEM_HEIGHT, MENU_MAX_HEIGHT)
    const spaceBelow = window.innerHeight - rect.bottom - MENU_MARGIN - MENU_GAP
    const spaceAbove = rect.top - MENU_MARGIN - MENU_GAP
    const openUp = spaceBelow < desiredHeight && spaceAbove > spaceBelow
    const availableSpace = openUp ? spaceAbove : spaceBelow
    const maxHeight = Math.min(desiredHeight, Math.max(availableSpace, MENU_MIN_HEIGHT))

    const width = rect.width
    const left = Math.max(MENU_MARGIN, Math.min(rect.left, window.innerWidth - width - MENU_MARGIN))
    const top = openUp ? Math.max(MENU_MARGIN, rect.top - Math.min(desiredHeight, maxHeight) - MENU_GAP) : rect.bottom + MENU_GAP

    setCoords({ top, left, width, maxHeight, openUp })
  }

  useLayoutEffect(() => {
    if (isOpen) updatePosition()
  }, [isOpen, options.length])

  useEffect(() => {
    if (!isOpen) return
    let rafId = null
    function schedule() {
      if (rafId) return
      rafId = requestAnimationFrame(() => { rafId = null; updatePosition() })
    }
    function handleScroll(event) {
      if (menuRef.current && event.target && menuRef.current.contains(event.target)) return
      schedule()
    }
    function handleResize() { schedule() }
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true })
    window.addEventListener('resize', handleResize, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true })
      window.removeEventListener('resize', handleResize)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    function handlePointerDown(event) {
      if (triggerRef.current?.contains(event.target)) return
      if (menuRef.current?.contains(event.target)) return
      setIsOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || highlightedIndex < 0 || !menuRef.current) return
    const menu = menuRef.current
    const optionEl = menu.querySelector(`[data-index="${highlightedIndex}"]`)
    if (!optionEl) return

    const optionTop = optionEl.offsetTop
    const optionBottom = optionTop + optionEl.offsetHeight
    const scrollTop = menu.scrollTop
    const menuHeight = menu.clientHeight

    if (optionTop < scrollTop) {
      menu.scrollTo({ top: optionTop - 4, behavior: 'smooth' })
    } else if (optionBottom > scrollTop + menuHeight) {
      menu.scrollTo({ top: optionBottom - menuHeight + 4, behavior: 'smooth' })
    }
  }, [highlightedIndex, isOpen])

  function handleToggle() {
    if (disabled) return
    if (!isOpen) setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0)
    setIsOpen(current => !current)
  }

  function handleSelect(option) {
    if (typeof onChange === 'function') onChange(option.value)
    setIsOpen(false)
  }

  function handleKeyDown(event) {
    if (disabled) return
    if (!isOpen) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
        event.preventDefault(); handleToggle()
      }
      return
    }

    switch (event.key) {
      case 'Escape': event.preventDefault(); setIsOpen(false); triggerRef.current?.focus(); break
      case 'ArrowDown': event.preventDefault(); setHighlightedIndex(i => Math.min((i < 0 ? -1 : i) + 1, options.length - 1)); break
      case 'ArrowUp': event.preventDefault(); setHighlightedIndex(i => Math.max(i - 1, 0)); break
      case 'Home': event.preventDefault(); setHighlightedIndex(0); break
      case 'End': event.preventDefault(); setHighlightedIndex(options.length - 1); break
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (highlightedIndex >= 0 && options[highlightedIndex]) handleSelect(options[highlightedIndex]);
        break
      case 'Tab': setIsOpen(false); break
      default: break
    }
  }

  return (
    <>
      <div
        ref={triggerRef}
        role="combobox"
        tabIndex={disabled ? -1 : 0}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? `${selectId}-menu` : undefined}
        aria-activedescendant={isOpen && highlightedIndex >= 0 ? `${selectId}-opt-${highlightedIndex}` : undefined}
        aria-disabled={disabled}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
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
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          userSelect: 'none',
          outline: 'none',
          ...style
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>

        <svg
          xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--primary)"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ width: 16, height: 16, flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {isOpen && createPortal(
        <div
          ref={menuRef}
          id={`${selectId}-menu`}
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
            overscrollBehavior: 'contain',
            touchAction: 'pan-y',
            zIndex: 2147483646,
            animation: coords.openUp ? 'zsSelectMenuUp 0.14s ease' : 'zsSelectMenuDown 0.14s ease',
            transformOrigin: coords.openUp ? 'bottom center' : 'top center'
          }}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value
            const isHighlighted = index === highlightedIndex

            return (
              <div
                key={option.value}
                id={`${selectId}-opt-${index}`}
                data-index={index}
                role="option"
                aria-selected={isSelected}
                // Memakai class 'highlighted' agar styling diatur sepenuhnya oleh CSS
                className={`custom-select-option ${isSelected ? 'selected' : ''} ${option.isAction ? 'action-option' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                onMouseEnter={() => setHighlightedIndex(index)}
                onMouseDown={e => e.preventDefault()}
                onClick={() => handleSelect(option)}
              >
                {option.label}
              </div>
            )
          })}
        </div>,
        document.body
      )}
    </>
  )
}