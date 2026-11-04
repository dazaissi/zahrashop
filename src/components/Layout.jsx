import { useState, useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useUI } from '../context/UIContext'
import { supabase } from '../supabaseClient'
import { FaBars, FaTimes, FaBell, FaCheckDouble, FaChartPie, FaFileInvoiceDollar, FaUsers, FaBoxOpen, FaMoneyBillWave, FaChartLine, FaUserTie, FaHistory, FaCog, FaMoon, FaSun, FaWhatsapp } from 'react-icons/fa'

const allMenus = [
  { to: '/dashboard', label: 'Dashboard', icon: <FaChartPie />, roles: ['owner', 'admin'] },
  { to: '/invoices', label: 'Invoice', icon: <FaFileInvoiceDollar />, roles: ['owner', 'admin'] },
  { to: '/customers', label: 'Pelanggan', icon: <FaUsers />, roles: ['owner', 'admin'] },
  { to: '/products', label: 'Produk & Stok', icon: <FaBoxOpen />, roles: ['owner', 'admin'] },
  { to: '/expenses', label: 'Pengeluaran', icon: <FaMoneyBillWave />, roles: ['owner'] }, // Hanya Owner
  { to: '/reports', label: 'Laporan', icon: <FaChartLine />, roles: ['owner'] }, // Hanya Owner
  { to: '/team', label: 'Tim & Karyawan', icon: <FaUserTie />, roles: ['owner'] }, // Hanya Owner
  { to: '/activity-logs', label: 'Riwayat', icon: <FaHistory />, roles: ['owner'] }, // Hanya Owner
  { to: '/settings', label: 'Pengaturan', icon: <FaCog />, roles: ['owner'] }, // Hanya Owner
]

export default function Layout() {
  const { signOut, session } = useAuth()
  const { showConfirm, showToast } = useUI()
  const loc = useLocation()
  
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [showNotif, setShowNotif] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [readNotifs, setReadNotifs] = useState(() => JSON.parse(localStorage.getItem('read_notifs')) || [])
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark')
  const [ownerPhone, setOwnerPhone] = useState('')
  
  // State untuk Role User
  const [userRole, setUserRole] = useState('admin') // Default sementara

  useEffect(() => {
    if (isDark) document.documentElement.setAttribute('data-theme', 'dark')
    else document.documentElement.removeAttribute('data-theme')
    localStorage.setItem('theme', isDark ? 'dark' : 'light')
  }, [isDark])

  useEffect(() => {
    if (session) {
      fetchNotifications()
      // Ambil data role dan no hp
      supabase.from('profiles').select('phone, role').eq('id', session.user.id).single()
        .then(({ data }) => { 
          if (data?.phone) setOwnerPhone(data.phone) 
          if (data?.role) setUserRole(data.role) 
        })
    }
  }, [session, readNotifs])

  // Filter menu berdasarkan role yang login
  const visibleMenus = allMenus.filter(m => m.roles.includes(userRole))

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
    setNotifications([...kritis, ...tagihan].filter(n => !readNotifs.includes(n.id)))
  }

  function handleMarkAllRead() {
    if (notifications.length === 0) return
    const newReadNotifs = [...readNotifs, ...notifications.map(n => n.id)]
    setReadNotifs(newReadNotifs)
    localStorage.setItem('read_notifs', JSON.stringify(newReadNotifs))
    setNotifications([])
    setShowNotif(false)
  }

  function getStockWaReminder() {
    if (!ownerPhone) return showToast('Isi No. HP di menu Pengaturan terlebih dahulu!', 'error')
    const listStok = notifications.filter(n => n.type === 'stok').map(n => `- ${n.name} (Sisa ${n.stock})`).join('\n')
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

  const BrandLogo = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <img src="/logo.png" alt="Logo" style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 8 }} onError={(e) => { e.target.style.display = 'none' }} />
      <h2 style={{ margin: 0 }}>Zahrashop</h2>
    </div>
  )

  return (
    <div className="app">
      <div className="mobile-header">
        <button onClick={() => setIsMobileOpen(true)} className="mobile-menu-btn"><FaBars size={24} /></button>
        <BrandLogo />
        <div style={{ width: 24 }}></div>
      </div>

      <aside className={`sidebar ${isMobileOpen ? 'open' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <BrandLogo />
          <button className="mobile-close-btn" onClick={() => setIsMobileOpen(false)}><FaTimes size={24} /></button>
        </div>
        
        <nav>
          {/* Render menu yang sudah difilter */}
          {visibleMenus.map(m => (
            <Link key={m.to} to={m.to} className={loc.pathname.startsWith(m.to) ? 'active' : ''} onClick={() => setIsMobileOpen(false)}>
              <span style={{ fontSize: '18px' }}>{m.icon}</span>
              {m.label}
            </Link>
          ))}
        </nav>

        <button 
          onClick={() => setIsDark(!isDark)} 
          style={{ background: 'rgba(255, 255, 255, 0.15)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', width: '100%', padding: '10px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12, transition: 'all 0.2s', fontWeight: 'bold' }}
        >
          {isDark ? <><FaMoon /> Mode Gelap</> : <><FaSun /> Mode Terang</>}
        </button>

        <div style={{ position: 'relative', marginBottom: 16 }}>
          <button 
            onClick={() => setShowNotif(!showNotif)} 
            style={{ background: 'rgba(255, 255, 255, 0.15)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', width: '100%', padding: '10px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 'bold', transition: 'all 0.2s' }}
          >
            <FaBell size={18} /> Notifikasi ({notifications.length})
            {notifications.length > 0 && <span style={{ width: 10, height: 10, background: '#fbbf24', borderRadius: '50%', position: 'absolute', top: 10, right: 12, boxShadow: '0 0 0 2px #ec4899' }}></span>}
          </button>
          
          {showNotif && (
            <div style={{ position: 'absolute', bottom: '100%', left: 0, width: '320px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 16, boxShadow: '0 10px 25px rgba(0,0,0,0.2)', maxHeight: 350, overflowY: 'auto', zIndex: 1000, right: 0, margin: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 'bold', color: 'var(--text-main)' }}>Pemberitahuan</span>
                {notifications.length > 0 && (
                  <button onClick={handleMarkAllRead} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 'bold' }}>
                    <FaCheckDouble /> Tandai Dibaca
                  </button>
                )}
              </div>
              {notifications.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>Tidak ada notifikasi baru.</p>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} style={{ fontSize: 13, padding: '10px 0', borderBottom: '1px solid var(--border-color)', color: n.type === 'stok' ? '#ef4444' : '#3b82f6', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 6 }}><span>{n.type === 'stok' ? '⚠️' : '📄'}</span><span style={{ lineHeight: 1.4, color: 'var(--text-main)' }}>{n.message}</span></div>
                    {n.type === 'stok' && <button onClick={getStockWaReminder} style={{ alignSelf: 'flex-start', background: '#25D366', color: 'white', border: 'none', padding: '4px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 'bold' }}><FaWhatsapp /> Ingatkan Restock</button>}
                    {n.type === 'invoice' && <button onClick={() => getInvoiceWaReminder(n)} style={{ alignSelf: 'flex-start', background: '#25D366', color: 'white', border: 'none', padding: '4px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 'bold' }}><FaWhatsapp /> Tagih Pelanggan</button>}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <button 
          onClick={async () => { if (await showConfirm('Konfirmasi', 'Yakin ingin keluar dari aplikasi?')) signOut() }} 
          style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '12px', borderRadius: 10, fontWeight: 'bold', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
        >
          Keluar
        </button>
      </aside>

      {isMobileOpen && <div className="mobile-overlay" onClick={() => setIsMobileOpen(false)}></div>}
      <main className="content"><Outlet /></main>
    </div>
  )
}