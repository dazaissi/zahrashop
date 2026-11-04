import { useState, useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useUI } from '../context/UIContext'
import { supabase } from '../supabaseClient'
import { 
  FaBars, FaTimes, FaBell, FaCheckDouble, FaChartPie, FaFileInvoiceDollar, 
  FaUsers, FaBoxOpen, FaMoneyBillWave, FaChartLine, FaUserTie, 
  FaHistory, FaCog, FaMoon, FaSun, FaWhatsapp, FaUserCircle, FaClipboardList, FaPlus, FaTrash, FaCheck 
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
  { to: '/settings', label: 'Pengaturan', icon: <FaCog />, roles: ['owner'] },
]

export default function Layout() {
  const { signOut, session } = useAuth()
  const { showConfirm, showToast } = useUI()
  const loc = useLocation()
  
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [showNotif, setShowNotif] = useState(false)
  
  // State Notifikasi
  const [activeNotifs, setActiveNotifs] = useState([]) // Notif yang belum dibaca
  const [historyNotifs, setHistoryNotifs] = useState(() => JSON.parse(localStorage.getItem('notif_history')) || [])
  const [deletedNotifs, setDeletedNotifs] = useState(() => JSON.parse(localStorage.getItem('notif_deleted')) || [])
  const [notifTab, setNotifTab] = useState('active') // 'active' atau 'history'

  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark')
  const [ownerPhone, setOwnerPhone] = useState('')
  const [userRole, setUserRole] = useState('admin')
  const [userName, setUserName] = useState('Pengguna')
  const [userAvatar, setUserAvatar] = useState('')

  useEffect(() => {
    if (isDark) document.documentElement.setAttribute('data-theme', 'dark')
    else document.documentElement.removeAttribute('data-theme')
    localStorage.setItem('theme', isDark ? 'dark' : 'light')
  }, [isDark])

  useEffect(() => {
    if (session) {
      fetchNotifications()
      supabase.from('profiles').select('phone, role, avatar_url').eq('id', session.user.id).single()
        .then(({ data }) => { 
          if (data?.phone) setOwnerPhone(data.phone) 
          if (data?.role) setUserRole(data.role) 
          const googleAvatar = session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture
          setUserAvatar(data?.avatar_url || googleAvatar || '')
          const googleName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email.split('@')[0]
          setUserName(googleName)
        })
    }
  }, [session])

  async function fetchNotifications() {
    const { data: prod } = await supabase.from('products').select('*')
    const kritis = (prod || []).filter(p => p.stock <= p.min_stock).map(p => ({
      id: `stok-${p.id}-qty-${p.stock}`, type: 'stok', name: p.name, stock: p.stock, min: p.min_stock,
      message: `Stok ${p.name} menipis (Sisa: ${p.stock})`
    }))
    const { data: inv } = await supabase.from('invoices').select('*, customers(name, phone)').in('status', ['sent', 'partial', 'overdue'])
    const tagihan = (inv || []).map(i => ({
      id: `inv-${i.id}-status-${i.status}`, type: 'invoice', invNumber: i.invoice_number, customer: i.customers, total: i.total - i.paid_amount,
      message: `Invoice ${i.invoice_number} (${i.customers?.name || 'Umum'}) belum lunas`
    }))
    
    // Ambil yang belum masuk di history dan belum dihapus
    const combined = [...kritis, ...tagihan]
    const filtered = combined.filter(n => !historyNotifs.some(h => h.id === n.id) && !deletedNotifs.includes(n.id))
    setActiveNotifs(filtered)
  }

  function handleMarkAllRead() {
    if (activeNotifs.length === 0) return
    const newHistory = [...historyNotifs, ...activeNotifs]
    setHistoryNotifs(newHistory)
    localStorage.setItem('notif_history', JSON.stringify(newHistory))
    setActiveNotifs([])
  }

  function handleReadOne(notif) {
    if (historyNotifs.some(h => h.id === notif.id)) return
    const newHistory = [...historyNotifs, notif]
    setHistoryNotifs(newHistory)
    localStorage.setItem('notif_history', JSON.stringify(newHistory))
    setActiveNotifs(prev => prev.filter(n => n.id !== notif.id))
  }

  function handleDelete(notifId) {
    const newDeleted = [...deletedNotifs, notifId]
    setDeletedNotifs(newDeleted)
    localStorage.setItem('notif_deleted', JSON.stringify(newDeleted))
    setActiveNotifs(prev => prev.filter(n => n.id !== notifId))
    
    // Hapus dari history juga
    const newHistory = historyNotifs.filter(h => h.id !== notifId)
    setHistoryNotifs(newHistory)
    localStorage.setItem('notif_history', JSON.stringify(newHistory))
  }

  function getStockWaReminder() {
    if (!ownerPhone) return showToast('Isi No. HP di menu Pengaturan terlebih dahulu!', 'error')
    const listStok = activeNotifs.filter(n => n.type === 'stok').map(n => `- ${n.name} (Sisa ${n.stock})`).join('\n')
    let phone = ownerPhone.replace(/\D/g, '')
    if (phone.startsWith('0')) phone = '62' + phone.slice(1)
    const pesan = `Halo Owner, ini adalah pengingat otomatis dari sistem.\n\nStok barang berikut sudah menipis dan perlu segera di-restock:\n${listStok}`
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(pesan)}`, '_blank')
  }

  function getInvoiceWaReminder(inv) {
    if (!inv.customer?.phone) return showToast('Nomor HP pelanggan tidak ada di database!', 'error')
    let phone = inv.customer.phone.replace(/\D/g, '')
    if (phone.startsWith('0')) phone = '62' + phone.slice(1)
    const pesan = `Halo *${inv.customer.name}*,\n\nIni adalah pesan pengingat otomatis.\n\nInvoice *${inv.invNumber}* Anda memiliki sisa tagihan sebesar *${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(inv.total)}*.\n\nMohon segera diselesaikan pembayarannya. Terima kasih.`
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(pesan)}`, '_blank')
  }

  const visibleMenus = allMenus.filter(m => m.roles.includes(userRole))

  const BrandLogo = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Logo" style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 8 }} onError={(e) => { e.target.style.display = 'none' }} />
      <h2 style={{ margin: 0 }}>Zahrashop</h2>
    </div>
  )

  const renderNotifItem = (n, isHistory = false) => (
    <div key={n.id} style={{ fontSize: 13, padding: '10px 0', borderBottom: '1px solid var(--border-color)', color: n.type === 'stok' ? '#ef4444' : '#3b82f6', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <span>{n.type === 'stok' ? '⚠️' : '📄'}</span>
          <span style={{ lineHeight: 1.4, color: 'var(--text-main)' }}>{n.message}</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {!isHistory && (
            <button onClick={() => handleReadOne(n)} title="Tandai Dibaca" style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', padding: 4 }}>
              <FaCheck size={12} />
            </button>
          )}
          <button onClick={() => handleDelete(n.id)} title="Hapus" style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}>
            <FaTrash size={12} />
          </button>
        </div>
      </div>
      
      {/* Tombol Aksi WA (Hanya di tab Aktif) */}
      {!isHistory && n.type === 'stok' && (
        <button onClick={getStockWaReminder} style={{ alignSelf: 'flex-start', background: '#25D366', color: 'white', border: 'none', padding: '4px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 'bold' }}>
          <FaWhatsapp /> Ingatkan Restock
        </button>
      )}
      {!isHistory && n.type === 'invoice' && (
        <button onClick={() => getInvoiceWaReminder(n)} style={{ alignSelf: 'flex-start', background: '#25D366', color: 'white', border: 'none', padding: '4px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 'bold' }}>
          <FaWhatsapp /> Tagih Pelanggan
        </button>
      )}
    </div>
  )

  return (
    <div className="app">
      <div className="mobile-header">
        <BrandLogo />
        <button onClick={() => setShowNotif(!showNotif)} style={{ background: 'transparent', border: 'none', color: 'white', position: 'relative' }}>
          <FaBell size={20} />
          {activeNotifs.length > 0 && <span style={{ width: 8, height: 8, background: '#fbbf24', borderRadius: '50%', position: 'absolute', top: 0, right: -2 }}></span>}
        </button>
      </div>

      <aside className={`sidebar ${isMobileOpen ? 'open' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <BrandLogo />
          <button className="mobile-close-btn" onClick={() => setIsMobileOpen(false)}><FaTimes size={24} /></button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', background: 'rgba(255,255,255,0.1)', borderRadius: 12, marginBottom: 24 }}>
          {userAvatar ? <img src={userAvatar} alt="Avatar" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: '2px solid white' }} /> : <FaUserCircle size={40} color="white" />}
          <div style={{ overflow: 'hidden' }}>
            <h4 style={{ margin: 0, color: 'white', fontSize: 14, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{userName}</h4>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)', fontSize: 12, textTransform: 'capitalize' }}>{userRole}</p>
          </div>
        </div>
        
        <nav>
          {visibleMenus.map(m => (
            <Link key={m.to} to={m.to} className={loc.pathname.startsWith(m.to) ? 'active' : ''} onClick={() => setIsMobileOpen(false)}>
              <span style={{ fontSize: '18px' }}>{m.icon}</span>
              {m.label}
            </Link>
          ))}
        </nav>

        <button onClick={() => setIsDark(!isDark)} style={{ background: 'rgba(255, 255, 255, 0.15)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', width: '100%', padding: '10px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12, transition: 'all 0.3s', fontWeight: 'bold' }}>
          {isDark ? <><FaMoon /> Mode Gelap</> : <><FaSun /> Mode Terang</>}
        </button>

        {/* NOTIFIKASI */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <button onClick={() => setShowNotif(!showNotif)} style={{ background: 'rgba(255, 255, 255, 0.15)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', width: '100%', padding: '10px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 'bold', transition: 'all 0.3s' }}>
            <FaBell size={18} /> Notifikasi ({activeNotifs.length})
            {activeNotifs.length > 0 && <span style={{ width: 10, height: 10, background: '#fbbf24', borderRadius: '50%', position: 'absolute', top: 10, right: 12, boxShadow: '0 0 0 2px #ec4899' }}></span>}
          </button>
          
          {showNotif && (
            <div style={{ position: 'absolute', bottom: '100%', left: 0, width: '340px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 16, boxShadow: '0 10px 25px rgba(0,0,0,0.2)', maxHeight: 400, display: 'flex', flexDirection: 'column', zIndex: 1000, right: 0, margin: 'auto' }}>
              
              {/* TABS AKTIF & RIWAYAT */}
              <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border-color)', paddingBottom: 8, marginBottom: 8 }}>
                <button onClick={() => setNotifTab('active')} style={{ background: notifTab === 'active' ? 'var(--primary)' : 'transparent', color: notifTab === 'active' ? 'white' : 'var(--text-muted)', border: 'none', padding: '6px 12px', borderRadius: 6, fontWeight: 'bold', fontSize: 12, cursor: 'pointer' }}>Aktif</button>
                <button onClick={() => setNotifTab('history')} style={{ background: notifTab === 'history' ? 'var(--primary)' : 'transparent', color: notifTab === 'history' ? 'white' : 'var(--text-muted)', border: 'none', padding: '6px 12px', borderRadius: 6, fontWeight: 'bold', fontSize: 12, cursor: 'pointer' }}>Riwayat</button>
                <div style={{ flex: 1 }}></div>
                {notifTab === 'active' && activeNotifs.length > 0 && (
                  <button onClick={handleMarkAllRead} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 'bold' }}>
                    <FaCheckDouble /> Baca Semua
                  </button>
                )}
              </div>

              {/* LIST NOTIFIKASI */}
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {notifTab === 'active' ? (
                  activeNotifs.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>Tidak ada notifikasi baru.</p>
                  ) : activeNotifs.map(n => renderNotifItem(n, false))
                ) : (
                  historyNotifs.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>Belum ada riwayat notifikasi.</p>
                  ) : historyNotifs.slice().reverse().map(n => renderNotifItem(n, true))
                )}
              </div>

            </div>
          )}
        </div>

        <button onClick={async () => { if (await showConfirm('Konfirmasi', 'Yakin ingin keluar dari aplikasi?')) signOut() }} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '12px', borderRadius: 10, fontWeight: 'bold', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s' }}>
          Keluar
        </button>
      </aside>

      {isMobileOpen && <div className="mobile-overlay" onClick={() => setIsMobileOpen(false)}></div>}

      <main className="content">
        <AnimatePresence mode="wait">
          <motion.div key={loc.pathname} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.3, ease: 'easeOut' }}>
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      <div className="bottom-nav">
        <Link to="/dashboard" className={loc.pathname === '/dashboard' ? 'active' : ''}>
          <FaChartPie /> <span>Dashboard</span>
        </Link>
        <Link to="/invoices" className={loc.pathname.startsWith('/invoices') ? 'active' : ''}>
          <FaFileInvoiceDollar /> <span>Invoice</span>
        </Link>
        
        <Link to="/invoices/new" className="fab-btn">
          <FaPlus />
        </Link>

        <Link to="/products" className={loc.pathname.startsWith('/products') ? 'active' : ''}>
          <FaBoxOpen /> <span>Produk</span>
        </Link>
        <button onClick={() => setIsMobileOpen(true)} style={{ background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, gap: 4, flex: 1 }}>
          <FaBars size={20} /> <span>Menu</span>
        </button>
      </div>
    </div>
  )
}