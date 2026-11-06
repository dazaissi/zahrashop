import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useUI } from '../context/UIContext'
import { formatRupiah } from '../lib/format'
import {
  FaWhatsapp, FaHistory, FaEdit, FaTrash, FaSearch, FaUsers,
  FaShoppingBag, FaTimes, FaSave, FaTrophy, FaSyncAlt, FaCircle
} from 'react-icons/fa'
import Button from '../components/ui/Button'
import Select from '../components/ui/Select'

const EXCLUDED_INVOICE_STATUSES = ['cancelled', 'canceled', 'void', 'draft', 'rejected', 'batal']

function isActiveInvoice(invoice) {
  const status = String(invoice.status || '').toLowerCase()
  return !EXCLUDED_INVOICE_STATUSES.includes(status)
}

function getLocalDateString(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getPeriodLabel(period) {
  switch (period) {
    case 'today': return 'hari ini'
    case '7days': return '7 hari terakhir'
    case 'month': return 'bulan ini'
    case 'year': return 'tahun ini'
    case 'custom': return 'rentang tanggal khusus'
    default: return 'semua waktu'
  }
}

const TOP_PERIOD_OPTIONS = [
  { value: 'all', label: 'Semua Waktu' },
  { value: 'today', label: 'Hari Ini' },
  { value: '7days', label: '7 Hari Terakhir' },
  { value: 'month', label: 'Bulan Ini' },
  { value: 'year', label: 'Tahun Ini' },
  { value: 'custom', label: 'Rentang Tanggal' }
]

export default function Customers() {
  const { session } = useAuth()
  const { showConfirm, showToast } = useUI()
  const navigate = useNavigate()

  const [customers, setCustomers] = useState([])
  const [allInvoices, setAllInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const [isOwner, setIsOwner] = useState(false)

  const [topPeriod, setTopPeriod] = useState('all')
  const [topStartDate, setTopStartDate] = useState('')
  const [topEndDate, setTopEndDate] = useState('')

  const [id, setId] = useState(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchRef = useRef(null)
  const timerRef = useRef(null)

  const fetchCustomers = useCallback(async ({ silent = false } = {}) => {
    if (!session?.user?.id) return
    if (!silent) setLoading(true)
    try {
      const { data, error } = await supabase
        .from('customers').select('*')
        .order('customer_code', { ascending: true })
      if (error) throw error
      setCustomers(data || [])

      const { data: inv, error: invErr } = await supabase
        .from('invoices')
        .select('customer_id, total, paid_amount, status, issue_date')
        .not('customer_id', 'is', null)
      if (invErr) throw invErr
      setAllInvoices(inv || [])
    } catch (err) {
      if (!silent) showToast('Gagal memuat pelanggan: ' + err.message, 'error')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [session?.user?.id, showToast])

  useEffect(() => { fetchRef.current = fetchCustomers }, [fetchCustomers])

  useEffect(() => {
    if (!session?.user?.id) return
    supabase.from('profiles').select('role').eq('id', session.user.id).single()
      .then(({ data }) => setIsOwner(String(data?.role || '').toLowerCase() === 'owner'))
  }, [session?.user?.id])

  useEffect(() => {
    if (session?.user?.id) fetchCustomers()
  }, [session?.user?.id, fetchCustomers])

  useEffect(() => {
    if (!session?.user?.id) return
    const ch = supabase.channel(`customers-rt-${session.user.id}-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => {
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => fetchRef.current?.({ silent: true }), 250)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => {
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => fetchRef.current?.({ silent: true }), 250)
      })
      .subscribe(s => setRealtimeConnected(s === 'SUBSCRIBED'))
    return () => {
      setRealtimeConnected(false)
      supabase.removeChannel(ch)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [session?.user?.id])

  useEffect(() => {
    if (!session?.user?.id) return
    const onVisible = () => { if (document.visibilityState === 'visible') fetchRef.current?.({ silent: true }) }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [session?.user?.id])

  const activeInvoices = useMemo(() => allInvoices.filter(isActiveInvoice), [allInvoices])

  const purchaseTotals = useMemo(() => {
    const totals = {}
    activeInvoices.forEach(invoice => {
      const cid = String(invoice.customer_id)
      totals[cid] = (totals[cid] || 0) + Number(invoice.total || 0)
    })
    return totals
  }, [activeInvoices])

  const totalSeluruhPembelian = useMemo(
    () => Object.values(purchaseTotals).reduce((sum, v) => sum + Number(v || 0), 0),
    [purchaseTotals]
  )

  const topDateRange = useMemo(() => {
    const today = new Date()
    const todayString = getLocalDateString(today)
    if (topPeriod === 'today') return { start: todayString, end: todayString }
    if (topPeriod === '7days') {
      const start = new Date()
      start.setDate(start.getDate() - 6)
      return { start: getLocalDateString(start), end: todayString }
    }
    if (topPeriod === 'month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      return { start: getLocalDateString(start), end: todayString }
    }
    if (topPeriod === 'year') return { start: `${today.getFullYear()}-01-01`, end: todayString }
    if (topPeriod === 'custom') return { start: topStartDate, end: topEndDate }
    return { start: '', end: '' }
  }, [topPeriod, topStartDate, topEndDate])

  const topCustomers = useMemo(() => {
    const customerMap = new Map(customers.map(c => [String(c.id), c]))
    const { start, end } = topDateRange
    const filtered = activeInvoices.filter(invoice => {
      if (!start && !end) return true
      const invoiceDate = invoice.issue_date ? String(invoice.issue_date).slice(0, 10) : ''
      return (!start || invoiceDate >= start) && (!end || invoiceDate <= end)
    })
    const stats = {}
    filtered.forEach(invoice => {
      const cid = String(invoice.customer_id)
      const customer = customerMap.get(cid)
      if (!customer) return
      const total = Number(invoice.total || 0)
      const paid = invoice.status === 'paid' ? total : Math.min(total, Math.max(0, Number(invoice.paid_amount || 0)))
      if (!stats[cid]) stats[cid] = { customer, totalPurchases: 0, transactionCount: 0, totalPaid: 0 }
      stats[cid].totalPurchases += total
      stats[cid].transactionCount += 1
      stats[cid].totalPaid += paid
    })
    return Object.values(stats).sort((a, b) => b.totalPurchases - a.totalPurchases).slice(0, 5)
  }, [activeInvoices, customers, topDateRange])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!session) return showToast('Sesi tidak ditemukan.', 'error')
    if (!name.trim()) return showToast('Nama pelanggan wajib diisi.', 'error')
    setIsSubmitting(true)
    const payload = {
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      user_id: session.user.id
    }
    let errorMsg = null
    if (id) {
      const { error } = await supabase.from('customers').update({
        name: payload.name, email: payload.email, phone: payload.phone, address: payload.address
      }).eq('id', id)
      if (error) errorMsg = error.message
    } else {
      const { error } = await supabase.from('customers').insert([payload])
      if (error) errorMsg = error.message
    }
    if (errorMsg) {
      showToast('Gagal menyimpan: ' + errorMsg, 'error')
    } else {
      const wasEditing = Boolean(id)
      resetForm()
      await fetchCustomers({ silent: true })
      showToast(wasEditing ? 'Data pelanggan berhasil diperbarui!' : 'Pelanggan berhasil ditambahkan!', 'success')
    }
    setIsSubmitting(false)
  }

  async function handleDelete(customer) {
    if (!isOwner) {
      showToast('Hanya owner yang dapat menghapus pelanggan.', 'error')
      return
    }
    const confirmed = await showConfirm('Hapus Pelanggan', `Yakin ingin menghapus data pelanggan "${customer.name}"?`)
    if (!confirmed) return
    const { error } = await supabase.from('customers').delete().eq('id', customer.id)
    if (error) {
      showToast('Gagal menghapus pelanggan: ' + error.message, 'error')
      return
    }
    if (id === customer.id) resetForm()
    await fetchCustomers({ silent: true })
    showToast('Pelanggan berhasil dihapus.', 'success')
  }

  function editCustomer(customer) {
    setId(customer.id)
    setName(customer.name || '')
    setEmail(customer.email || '')
    setPhone(customer.phone || '')
    setAddress(customer.address || '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetForm() {
    setId(null); setName(''); setEmail(''); setPhone(''); setAddress('')
  }

  function resetTopFilter() {
    setTopPeriod('all'); setTopStartDate(''); setTopEndDate('')
  }

  function getWhatsAppLink(phoneStr) {
    if (!phoneStr) return '#'
    let formatted = phoneStr.replace(/\D/g, '')
    if (formatted.startsWith('0')) formatted = '62' + formatted.slice(1)
    else if (formatted.startsWith('8')) formatted = '62' + formatted
    return `https://wa.me/${formatted}`
  }

  function getRankColor(index) {
    if (index === 0) return '#f59e0b'
    if (index === 1) return '#94a3b8'
    if (index === 2) return '#b45309'
    return 'var(--text-muted)'
  }

  const filteredCustomers = customers.filter(customer => {
    const keyword = search.toLowerCase()
    return (
      (customer.name || '').toLowerCase().includes(keyword) ||
      (customer.customer_code || '').toLowerCase().includes(keyword) ||
      (customer.phone || '').toLowerCase().includes(keyword) ||
      (customer.email || '').toLowerCase().includes(keyword)
    )
  })

  const isTopFilterActive = topPeriod !== 'all' || topStartDate || topEndDate

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 12 }}>
            Data Pelanggan
            <span title={realtimeConnected ? 'Realtime aktif' : 'Realtime tidak aktif'} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: realtimeConnected ? '#dcfce7' : '#fee2e2', color: realtimeConnected ? '#166534' : '#991b1b' }}>
              <FaCircle size={6} /> {realtimeConnected ? 'LIVE' : 'OFFLINE'}
            </span>
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Kelola informasi dan riwayat transaksi pelanggan.</p>
        </div>
        <Button variant="secondary" onClick={() => fetchCustomers()} disabled={loading || isSubmitting}>
          <FaSyncAlt style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
        </Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: 'var(--primary-light, rgba(236,72,153,0.12))', padding: 12, borderRadius: 12, color: 'var(--primary)' }}><FaUsers size={22} /></div>
            <div>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>Total Pelanggan</p>
              <h2 style={{ margin: 0 }}>{customers.length}</h2>
            </div>
          </div>
        </div>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: 'rgba(16,185,129,0.12)', padding: 12, borderRadius: 12, color: '#10b981' }}><FaShoppingBag size={22} /></div>
            <div>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>Total Pembelian Pelanggan</p>
              <h2 style={{ margin: 0, fontSize: 20 }}>{formatRupiah(totalSeluruhPembelian)}</h2>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
          <div>
            <h3 style={{ margin: '0 0 5px', display: 'flex', alignItems: 'center', gap: 8 }}><FaTrophy style={{ color: '#f59e0b' }} /> Pelanggan Teratas</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>5 pelanggan dengan total pembelian tertinggi ({getPeriodLabel(topPeriod)}).</p>
          </div>
          <span style={{ background: 'var(--primary-light, rgba(236,72,153,0.12))', color: 'var(--primary)', fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 999 }}>Top 5</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: topPeriod === 'custom' ? 'repeat(auto-fit, minmax(180px, 1fr))' : 'minmax(200px, 1fr) auto', gap: 12, marginBottom: 18, alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: 'var(--text-muted)' }}>Periode</label>
            <Select options={TOP_PERIOD_OPTIONS} value={topPeriod} onChange={v => setTopPeriod(v)} placeholder="Pilih periode" />
          </div>
          {topPeriod === 'custom' && (
            <>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: 'var(--text-muted)' }}>Dari Tanggal</label>
                <input type="date" value={topStartDate} max={topEndDate || undefined} onChange={e => setTopStartDate(e.target.value)} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: 'var(--text-muted)' }}>Sampai Tanggal</label>
                <input type="date" value={topEndDate} min={topStartDate || undefined} onChange={e => setTopEndDate(e.target.value)} style={{ width: '100%' }} />
              </div>
            </>
          )}
          {isTopFilterActive && <div><Button variant="secondary" onClick={resetTopFilter}>Reset</Button></div>}
        </div>

        {loading ? (
          <div className="skeleton" style={{ height: 220 }} />
        ) : topCustomers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
            {isTopFilterActive ? 'Belum ada transaksi pada periode ini.' : 'Belum ada transaksi pelanggan.'}
          </div>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr><th>Peringkat</th><th>Pelanggan</th><th>Jumlah Transaksi</th><th>Total Pembelian</th><th>Total Dibayar</th></tr>
              </thead>
              <tbody>
                {topCustomers.map((item, index) => (
                  <tr key={item.customer.id}>
                    <td><strong style={{ color: getRankColor(index), fontSize: 16, fontWeight: 800 }}>#{index + 1}</strong></td>
                    <td>
                      <strong>{item.customer.name}</strong><br />
                      <small style={{ color: 'var(--text-muted)' }}>{item.customer.customer_code || '-'}</small>
                    </td>
                    <td>{item.transactionCount} transaksi</td>
                    <td><strong style={{ color: 'var(--primary)' }}>{formatRupiah(item.totalPurchases)}</strong></td>
                    <td><strong style={{ color: '#10b981' }}>{formatRupiah(item.totalPaid)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 24, maxWidth: 700 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>{id ? 'Edit Pelanggan' : 'Tambah Pelanggan Baru'}</h3>
          {id && <Button variant="secondary" onClick={resetForm}><FaTimes /> Batal</Button>}
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>Nama Pelanggan *</label>
            <input required placeholder="Masukkan nama pelanggan" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>Email</label>
            <input placeholder="email@contoh.com" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>Nomor HP</label>
            <input placeholder="Contoh: 08123456789" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>Alamat</label>
            <textarea placeholder="Masukkan alamat pelanggan" rows="3" value={address} onChange={e => setAddress(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button type="submit" variant="solid" disabled={isSubmitting}>
              <FaSave /> {isSubmitting ? 'Menyimpan...' : id ? 'Simpan Perubahan' : 'Tambah Pelanggan'}
            </Button>
          </div>
        </form>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: '0 0 4px' }}>Daftar Pelanggan</h3>
            <small style={{ color: 'var(--text-muted)' }}>{filteredCustomers.length} pelanggan ditemukan</small>
          </div>
          <div style={{ position: 'relative', width: '100%', maxWidth: 320 }}>
            <FaSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input placeholder="Cari nama, kode, nomor HP..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36, width: '100%' }} />
          </div>
        </div>

        {loading ? (
          <div className="skeleton" style={{ height: 200 }} />
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr><th>Kode</th><th>Nama</th><th>Kontak</th><th>Total Pembelian</th><th>Aksi</th></tr>
              </thead>
              <tbody>
                {filteredCustomers.length === 0 ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: 32 }}>{search ? 'Pelanggan tidak ditemukan.' : 'Belum ada data pelanggan.'}</td></tr>
                ) : filteredCustomers.map(customer => (
                  <tr key={customer.id}>
                    <td><strong style={{ color: 'var(--primary)' }}>{customer.customer_code || '-'}</strong></td>
                    <td>
                      <strong>{customer.name}</strong>
                      {customer.address && (<><br /><small style={{ color: 'var(--text-muted)' }}>{customer.address}</small></>)}
                    </td>
                    <td>
                      {customer.phone ? (
                        <a href={getWhatsAppLink(customer.phone)} target="_blank" rel="noopener noreferrer" style={{ color: '#25D366', textDecoration: 'none', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <FaWhatsapp size={17} /> {customer.phone}
                        </a>
                      ) : '-'}
                      {customer.email && (<><br /><small style={{ color: 'var(--text-muted)' }}>{customer.email}</small></>)}
                    </td>
                    <td><strong>{formatRupiah(purchaseTotals[customer.id] || 0)}</strong></td>
                    <td>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Button variant="primary" onClick={() => navigate(`/customers/${customer.id}`)}><FaHistory /> Detail</Button>
                        <Button variant="secondary" onClick={() => editCustomer(customer)}><FaEdit /> Edit</Button>
                        {isOwner && (
                          <Button variant="danger" onClick={() => handleDelete(customer)}><FaTrash /> Hapus</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}