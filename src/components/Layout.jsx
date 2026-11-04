import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useUI } from '../context/UIContext'
import { supabase } from '../supabaseClient'

import {
  FaBars, FaTimes, FaBell, FaCheckDouble, FaChartPie,
  FaFileInvoiceDollar, FaUsers, FaBoxOpen, FaMoneyBillWave,
  FaChartLine, FaUserTie, FaHistory, FaCog, FaMoon, FaSun,
  FaWhatsapp, FaUserCircle, FaClipboardList, FaPlus, FaTrash,
  FaCheck, FaBellSlash, FaSync
} from 'react-icons/fa'

import { motion, AnimatePresence } from 'framer-motion'

const allMenus = [
  { to: '/dashboard', label: 'Dashboard', icon: <FaChartPie />, roles: ['owner', 'admin'] },
  { to: '/invoices', label: 'Invoice', icon: <FaFileInvoiceDollar />, roles: ['owner', 'admin'] },
  { to: '/customers', label: 'Pelanggan', icon: <FaUsers />, roles: ['owner', 'admin'] },
  { to: '/products', label: 'Produk & Stok', icon: <FaBoxOpen />, roles: ['owner', 'admin'] },
  { to: '/stock-opname', label: 'Stock Opname', icon: <FaClipboardList />, roles: ['owner', 'admin'] },
  { to: '/expenses', label: 'Pengeluaran', icon: <FaMoneyBillWave />, roles: ['owner'] },
  { to: '/reports', label: 'Laporan', icon: <FaChartLine />, roles: ['owner'] },
  { to: '/team', label: 'Tim & Karyawan', icon: <FaUserTie />, roles: ['owner'] },
  { to: '/activity-logs', label: 'Riwayat', icon: <FaHistory />, roles: ['owner'] },
  { to: '/settings', label: 'Pengaturan', icon: <FaCog />, roles: ['owner'] }
]

const getStoredList = key => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

export default function Layout() {
  const { signOut, session, profile } = useAuth()
  const { showConfirm, showToast } = useUI()
  const loc = useLocation()

  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [showNotif, setShowNotif] = useState(false)
  const [notifPos, setNotifPos] = useState({ left: 16, bottom: 100 })

  const desktopNotifBtnRef = useRef(null)
  const mobileNotifBtnRef = useRef(null)

  const [activeNotifs, setActiveNotifs] = useState([])
  const [historyNotifs, setHistoryNotifs] = useState(() => getStoredList('notif_history'))
  const [deletedNotifs, setDeletedNotifs] = useState(() => getStoredList('notif_deleted'))
  const [notifTab, setNotifTab] = useState('active')
  const [isFetchingNotif, setIsFetchingNotif] = useState(false)

  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark')
  const [ownerPhone, setOwnerPhone] = useState('')

  const userRole = profile?.role?.toLowerCase() || null

  const userName =
    session?.user?.user_metadata?.full_name ||
    session?.user?.user_metadata?.name ||
    profile?.business_name ||
    session?.user?.email?.split('@')[0] ||
    'Pengguna'

  const userAvatar =
    profile?.avatar_url ||
    session?.user?.user_metadata?.avatar_url ||
    session?.user?.user_metadata?.picture ||
    ''

  const profileLoading = !profile

  useEffect(() => {
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }

    localStorage.setItem('theme', isDark ? 'dark' : 'light')
  }, [isDark])

  useEffect(() => {
    let cancelled = false

    async function loadOwnerPhone() {
      if (!profile?.id) {
        setOwnerPhone('')
        return
      }

      if (profile.role?.toLowerCase() === 'owner') {
        setOwnerPhone(profile.phone || '')
        return
      }

      if (profile.role?.toLowerCase() === 'admin' && profile.owner_id) {
        const { data, error } = await supabase
          .from('profiles')
          .select('phone')
          .eq('id', profile.owner_id)
          .maybeSingle()

        if (!cancelled) {
          if (error) {
            console.error('Gagal memuat nomor Owner:', error)
            setOwnerPhone('')
          } else {
            setOwnerPhone(data?.phone || '')
          }
        }

        return
      }

      setOwnerPhone('')
    }

    loadOwnerPhone()

    return () => {
      cancelled = true
    }
  }, [profile])

  useEffect(() => {
    if (session?.user?.id && userRole) {
      fetchNotifications()
    }
  }, [session, userRole])

  function handleToggleNotif(buttonRef) {
    if (showNotif) {
      setShowNotif(false)
      return
    }

    const button = buttonRef?.current

    if (button) {
      const rect = button.getBoundingClientRect()
      const popoverWidth = Math.min(340, window.innerWidth - 32)

      let left = rect.left

      if (left + popoverWidth > window.innerWidth - 16) {
        left = window.innerWidth - popoverWidth - 16
      }

      setNotifPos({
        left: Math.max(16, left),
        bottom: window.innerHeight - rect.top + 12
      })
    }

    setShowNotif(true)
  }

  async function fetchNotifications() {
    if (!session?.user?.id || !userRole) return

    setIsFetchingNotif(true)

    try {
      const [
        { data: prod, error: prodError },
        { data: inv, error: invError }
      ] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, stock, min_stock'),

        supabase
          .from('invoices')
          .select('id, invoice_number, total, paid_amount, status, customers(name, phone)')
          .in('status', ['sent', 'partial', 'overdue'])
      ])

      if (prodError) throw prodError
      if (invError) throw invError

      const kritis = (prod || [])
        .filter(product => {
          const stock = Number(product.stock) || 0
          const minStock = Number(product.min_stock) || 0
          return stock <= minStock
        })
        .map(product => ({
          id: `stok-${product.id}-qty-${product.stock}`,
          type: 'stok',
          name: product.name,
          stock: product.stock,
          min: product.min_stock,
          message: `Stok ${product.name} menipis (Sisa: ${product.stock})`
        }))

      const tagihan = (inv || [])
        .filter(invoice => {
          const remaining =
            (Number(invoice.total) || 0) -
            (Number(invoice.paid_amount) || 0)

          return remaining > 0
        })
        .map(invoice => ({
          id: `inv-${invoice.id}-status-${invoice.status}`,
          type: 'invoice',
          invNumber: invoice.invoice_number,
          customer: invoice.customers,
          total:
            (Number(invoice.total) || 0) -
            (Number(invoice.paid_amount) || 0),
          message: `Invoice ${invoice.invoice_number} (${invoice.customers?.name || 'Umum'}) belum lunas`
        }))

      const combined = [...kritis, ...tagihan]

      const filtered = combined.filter(notif =>
        !historyNotifs.some(item => item.id === notif.id) &&
        !deletedNotifs.includes(notif.id)
      )

      setActiveNotifs(filtered)
    } catch (error) {
      console.error('Gagal fetch notifikasi:', error)
      showToast('Gagal memuat notifikasi.', 'error')
    } finally {
      setIsFetchingNotif(false)
    }
  }

  function handleMarkAllRead() {
    if (activeNotifs.length === 0) return

    const newHistory = [...historyNotifs, ...activeNotifs]

    setHistoryNotifs(newHistory)
    localStorage.setItem('notif_history', JSON.stringify(newHistory))
    setActiveNotifs([])
  }

  function handleReadOne(notif) {
    if (historyNotifs.some(item => item.id === notif.id)) return

    const newHistory = [...historyNotifs, notif]

    setHistoryNotifs(newHistory)
    localStorage.setItem('notif_history', JSON.stringify(newHistory))
    setActiveNotifs(prev => prev.filter(item => item.id !== notif.id))
  }

  function handleDelete(notifId) {
    const newDeleted = [...new Set([...deletedNotifs, notifId])]

    setDeletedNotifs(newDeleted)
    localStorage.setItem('notif_deleted', JSON.stringify(newDeleted))

    setActiveNotifs(prev => prev.filter(item => item.id !== notifId))

    const newHistory = historyNotifs.filter(item => item.id !== notifId)

    setHistoryNotifs(newHistory)
    localStorage.setItem('notif_history', JSON.stringify(newHistory))
  }

  function getStockWaReminder() {
    if (!ownerPhone) {
      return showToast(
        'Nomor HP belum tersedia di profil pengguna.',
        'error'
      )
    }

    const listStok = activeNotifs
      .filter(notif => notif.type === 'stok')
      .map(notif => `- ${notif.name} (Sisa ${notif.stock})`)
      .join('\n')

    if (!listStok) {
      return showToast('Tidak ada stok kritis saat ini.', 'info')
    }

    let phone = ownerPhone.replace(/\D/g, '')

    if (phone.startsWith('0')) {
      phone = '62' + phone.slice(1)
    }

    const pesan =
      `Halo Owner, ini adalah pengingat dari sistem Zahra Shop.\n\n` +
      `Stok barang berikut sudah menipis dan perlu segera diperiksa:\n${listStok}`

    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(pesan)}`,
      '_blank'
    )
  }

  function getInvoiceWaReminder(notif) {
    if (!notif.customer?.phone) {
      return showToast(
        'Nomor HP pelanggan tidak ada di database.',
        'error'
      )
    }

    let phone = notif.customer.phone.replace(/\D/g, '')

    if (phone.startsWith('0')) {
      phone = '62' + phone.slice(1)
    }

    const pesan =
      `Halo ${notif.customer.name || 'Pelanggan'},\n\n` +
      `Ini adalah pengingat pembayaran dari Zahra Shop.\n\n` +
      `Invoice ${notif.invNumber} Anda memiliki sisa tagihan sebesar ` +
      `${new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
      }).format(notif.total)}.\n\n` +
      `Mohon segera diselesaikan pembayarannya. Terima kasih.`

    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(pesan)}`,
      '_blank'
    )
  }

  const visibleMenus = allMenus.filter(menu =>
    menu.roles.includes(userRole)
  )

  const BrandLogo = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <img
        src={`${import.meta.env.BASE_URL}logo.png`}
        alt="Logo"
        style={{
          width: 32,
          height: 32,
          objectFit: 'contain',
          borderRadius: 8
        }}
        onError={event => {
          event.currentTarget.style.display = 'none'
        }}
      />

      <h2 style={{ margin: 0 }}>Zahrashop</h2>
    </div>
  )

  const renderNotifItem = (notif, isHistory = false) => (
    <div
      key={notif.id}
      style={{
        fontSize: 13,
        padding: '10px 0',
        borderBottom: '1px solid var(--border-color)',
        color: notif.type === 'stok' ? '#ef4444' : '#3b82f6',
        display: 'flex',
        flexDirection: 'column',
        gap: 6
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 6,
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', gap: 6 }}>
          <span>{notif.type === 'stok' ? '⚠️' : '📄'}</span>

          <span style={{ lineHeight: 1.4, color: 'var(--text-main)' }}>
            {notif.message}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {!isHistory && (
            <button
              onClick={() => handleReadOne(notif)}
              title="Tandai Dibaca"
              style={{
                background: 'none',
                border: 'none',
                color: '#10b981',
                cursor: 'pointer',
                padding: 4
              }}
            >
              <FaCheck size={12} />
            </button>
          )}

          <button
            onClick={() => handleDelete(notif.id)}
            title="Hapus"
            style={{
              background: 'none',
              border: 'none',
              color: '#ef4444',
              cursor: 'pointer',
              padding: 4
            }}
          >
            <FaTrash size={12} />
          </button>
        </div>
      </div>

      {!isHistory && notif.type === 'stok' && (
        <button
          onClick={getStockWaReminder}
          style={{
            alignSelf: 'flex-start',
            background: '#25D366',
            color: 'white',
            border: 'none',
            padding: '4px 10px',
            borderRadius: 4,
            fontSize: 11,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontWeight: 'bold'
          }}
        >
          <FaWhatsapp /> Ingatkan Restock
        </button>
      )}

      {!isHistory && notif.type === 'invoice' && (
        <button
          onClick={() => getInvoiceWaReminder(notif)}
          style={{
            alignSelf: 'flex-start',
            background: '#25D366',
            color: 'white',
            border: 'none',
            padding: '4px 10px',
            borderRadius: 4,
            fontSize: 11,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontWeight: 'bold'
          }}
        >
          <FaWhatsapp /> Tagih Pelanggan
        </button>
      )}
    </div>
  )

  const EmptyState = ({ tab }) => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        color: 'var(--text-muted)'
      }}
    >
      {tab === 'active'
        ? <FaBellSlash size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
        : <FaHistory size={32} style={{ marginBottom: 12, opacity: 0.4 }} />}

      <p
        style={{
          margin: 0,
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--text-main)'
        }}
      >
        {tab === 'active'
          ? 'Tidak ada notifikasi baru'
          : 'Belum ada riwayat'}
      </p>

      <p style={{ margin: '4px 0 0', fontSize: 12, textAlign: 'center' }}>
        {tab === 'active'
          ? 'Semua stok dan tagihan aman terkendali.'
          : 'Notifikasi yang sudah dibaca akan muncul di sini.'}
      </p>
    </div>
  )

  return (
    <div className="app">
      <div className="mobile-header">
        <BrandLogo />

        <button
          ref={mobileNotifBtnRef}
          onClick={() => handleToggleNotif(mobileNotifBtnRef)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'white',
            position: 'relative'
          }}
        >
          <FaBell size={20} />

          {activeNotifs.length > 0 && (
            <span
              style={{
                width: 8,
                height: 8,
                background: '#fbbf24',
                borderRadius: '50%',
                position: 'absolute',
                top: 0,
                right: -2
              }}
            />
          )}
        </button>
      </div>

      <aside className={`sidebar ${isMobileOpen ? 'open' : ''}`}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 24
          }}
        >
          <BrandLogo />

          <button
            className="mobile-close-btn"
            onClick={() => setIsMobileOpen(false)}
          >
            <FaTimes size={24} />
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: 12,
            background: 'rgba(255,255,255,0.1)',
            borderRadius: 12,
            marginBottom: 24
          }}
        >
          {userAvatar ? (
            <img
              src={userAvatar}
              alt="Avatar"
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                objectFit: 'cover',
                border: '2px solid white'
              }}
            />
          ) : (
            <FaUserCircle size={40} color="white" />
          )}

          <div style={{ overflow: 'hidden' }}>
            <h4
              style={{
                margin: 0,
                color: 'white',
                fontSize: 14,
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                overflow: 'hidden'
              }}
            >
              {userName}
            </h4>

            <p
              style={{
                margin: 0,
                color: 'rgba(255,255,255,0.7)',
                fontSize: 12,
                textTransform: 'capitalize'
              }}
            >
              {profileLoading ? 'Memuat...' : userRole || 'Role tidak tersedia'}
            </p>
          </div>
        </div>

        <nav>
          {!profileLoading && visibleMenus.map(menu => (
            <Link
              key={menu.to}
              to={menu.to}
              className={
                loc.pathname === menu.to ||
                (menu.to !== '/dashboard' && loc.pathname.startsWith(menu.to + '/'))
                  ? 'active'
                  : ''
              }
              onClick={() => setIsMobileOpen(false)}
            >
              <span style={{ fontSize: 18 }}>{menu.icon}</span>
              {menu.label}
            </Link>
          ))}
        </nav>

        <button
          onClick={() => setIsDark(!isDark)}
          style={{
            background: 'rgba(255, 255, 255, 0.15)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#fff',
            width: '100%',
            padding: 10,
            borderRadius: 8,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            marginBottom: 12,
            transition: 'all 0.3s',
            fontWeight: 'bold'
          }}
        >
          {isDark ? <><FaMoon /> Mode Gelap</> : <><FaSun /> Mode Terang</>}
        </button>

        <div style={{ position: 'relative', marginBottom: 16 }}>
          <button
            ref={desktopNotifBtnRef}
            onClick={() => handleToggleNotif(desktopNotifBtnRef)}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#fff',
              width: '100%',
              padding: 10,
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontWeight: 'bold',
              transition: 'all 0.3s'
            }}
          >
            <FaBell size={18} />
            Notifikasi ({activeNotifs.length})

            {activeNotifs.length > 0 && (
              <span
                style={{
                  width: 10,
                  height: 10,
                  background: '#fbbf24',
                  borderRadius: '50%',
                  position: 'absolute',
                  top: 10,
                  right: 12,
                  boxShadow: '0 0 0 2px #ec4899'
                }}
              />
            )}
          </button>
        </div>

        <button
          onClick={async () => {
            const confirmed = await showConfirm(
              'Konfirmasi',
              'Yakin ingin keluar dari aplikasi?'
            )

            if (confirmed) signOut()
          }}
          style={{
            background: 'rgba(0,0,0,0.2)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: 'white',
            padding: 12,
            borderRadius: 10,
            fontWeight: 'bold',
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s'
          }}
        >
          Keluar
        </button>
      </aside>

      {isMobileOpen && (
        <div
          className="mobile-overlay"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {showNotif && createPortal(
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9998
            }}
            onClick={() => setShowNotif(false)}
          />

          <div
            style={{
              position: 'fixed',
              left: notifPos.left,
              bottom: notifPos.bottom,
              width: 340,
              maxWidth: 'calc(100vw - 32px)',
              background: 'var(--card-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: 12,
              padding: 16,
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
              maxHeight: 400,
              display: 'flex',
              flexDirection: 'column',
              zIndex: 9999
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: 8,
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: 8,
                marginBottom: 8,
                alignItems: 'center'
              }}
            >
              <button
                onClick={() => setNotifTab('active')}
                style={{
                  background: notifTab === 'active' ? 'var(--primary)' : 'transparent',
                  color: notifTab === 'active' ? 'white' : 'var(--text-muted)',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontWeight: 'bold',
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                Aktif
              </button>

              <button
                onClick={() => setNotifTab('history')}
                style={{
                  background: notifTab === 'history' ? 'var(--primary)' : 'transparent',
                  color: notifTab === 'history' ? 'white' : 'var(--text-muted)',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontWeight: 'bold',
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                Riwayat
              </button>

              <div style={{ flex: 1 }} />

              <button
                onClick={fetchNotifications}
                disabled={isFetchingNotif}
                title="Muat Ulang"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: isFetchingNotif ? 'not-allowed' : 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <FaSync
                  size={12}
                  className={isFetchingNotif ? 'spin-anim' : ''}
                />
              </button>

              {notifTab === 'active' && activeNotifs.length > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    fontSize: 11,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontWeight: 'bold'
                  }}
                >
                  <FaCheckDouble /> Baca Semua
                </button>
              )}
            </div>

            <div style={{ overflowY: 'auto', flex: 1 }}>
              {notifTab === 'active' ? (
                activeNotifs.length === 0
                  ? <EmptyState tab="active" />
                  : activeNotifs.map(notif => renderNotifItem(notif))
              ) : (
                historyNotifs.length === 0
                  ? <EmptyState tab="history" />
                  : historyNotifs.slice().reverse().map(notif =>
                      renderNotifItem(notif, true)
                    )
              )}
            </div>
          </div>
        </>,
        document.body
      )}

      <main className="content">
        <AnimatePresence mode="wait">
          <motion.div
            key={loc.pathname}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      <div className="bottom-nav">
        <Link
          to="/dashboard"
          className={loc.pathname === '/dashboard' ? 'active' : ''}
        >
          <FaChartPie />
          <span>Dashboard</span>
        </Link>

        <Link
          to="/invoices"
          className={loc.pathname.startsWith('/invoices') ? 'active' : ''}
        >
          <FaFileInvoiceDollar />
          <span>Invoice</span>
        </Link>

        <Link to="/invoices/new" className="fab-btn">
          <FaPlus />
        </Link>

        <Link
          to="/products"
          className={loc.pathname.startsWith('/products') ? 'active' : ''}
        >
          <FaBoxOpen />
          <span>Produk</span>
        </Link>

        <button
          onClick={() => setIsMobileOpen(true)}
          style={{
            background: 'none',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            color: 'var(--text-muted)',
            fontSize: 11,
            fontWeight: 600,
            gap: 4,
            flex: 1
          }}
        >
          <FaBars size={20} />
          <span>Menu</span>
        </button>
      </div>
    </div>
  )
}