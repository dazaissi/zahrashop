import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useUI } from '../context/UIContext'
import { formatRupiah, formatTanggal } from '../lib/format'
import {
  FaArrowLeft, FaWhatsapp, FaEnvelope, FaPhone, FaMapMarkerAlt,
  FaSearch, FaShoppingBag, FaMoneyBillWave, FaFileInvoice,
  FaCalendarAlt, FaSyncAlt, FaCircle
} from 'react-icons/fa'
import Button from '../components/ui/Button'

function getLocalDateString(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getPaidAmount(invoice) {
  const total = Number(invoice.total || 0)
  if (invoice.status === 'paid') return total
  return Math.min(total, Math.max(0, Number(invoice.paid_amount || 0)))
}

function getInvoicePaymentStatus(invoice) {
  const total = Number(invoice.total || 0)
  const paid = getPaidAmount(invoice)
  if (invoice.status === 'paid' || (total > 0 && paid >= total)) return 'paid'
  if (paid > 0) return 'partial'
  return 'unpaid'
}

function getStatusLabel(status) {
  if (status === 'paid') return 'Lunas'
  if (status === 'partial') return 'Sebagian'
  return 'Belum Lunas'
}

function getStatusColor(status) {
  if (status === 'paid') return '#10b981'
  if (status === 'partial') return '#f59e0b'
  return '#ef4444'
}

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useUI()

  const [customer, setCustomer] = useState(null)
  const [invoices, setInvoices] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const [waHover, setWaHover] = useState(false)
  const [kembaliHover, setKembaliHover] = useState(false)

  const [period, setPeriod] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('newest')

  const fetchRef = useRef(null)
  const timerRef = useRef(null)

  const fetchCustomerDetail = useCallback(async ({ silent = false } = {}) => {
    if (!id) return
    if (!silent) setLoading(true)
    try {
      const { data: customerData, error: customerError } = await supabase
        .from('customers').select('*').eq('id', id).maybeSingle()

      if (customerError) throw customerError
      if (!customerData) {
        setCustomer(null)
        setInvoices([])
        setPayments([])
        return
      }
      setCustomer(customerData)

      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices').select('*').eq('customer_id', id)
        .order('issue_date', { ascending: false })
      if (invoiceError) throw invoiceError

      const invoiceList = invoiceData || []
      setInvoices(invoiceList)

      if (invoiceList.length > 0) {
        const ids = invoiceList.map(inv => inv.id)
        const { data: paymentData, error: paymentError } = await supabase
          .from('invoice_payments').select('*, invoices(invoice_number)')
          .in('invoice_id', ids)
          .order('payment_date', { ascending: false })
        if (paymentError) throw paymentError
        setPayments(paymentData || [])
      } else {
        setPayments([])
      }
    } catch (err) {
      if (!silent) showToast('Gagal memuat data pelanggan: ' + err.message, 'error')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [id, showToast])

  useEffect(() => { fetchRef.current = fetchCustomerDetail }, [fetchCustomerDetail])

  useEffect(() => {
    fetchCustomerDetail()
  }, [fetchCustomerDetail])

  useEffect(() => {
    if (!id) return
    const ch = supabase.channel(`customer-detail-${id}-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers', filter: `id=eq.${id}` }, () => {
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => fetchRef.current?.({ silent: true }), 250)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices', filter: `customer_id=eq.${id}` }, () => {
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => fetchRef.current?.({ silent: true }), 250)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoice_payments' }, () => {
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => fetchRef.current?.({ silent: true }), 250)
      })
      .subscribe(s => setRealtimeConnected(s === 'SUBSCRIBED'))
    return () => {
      setRealtimeConnected(false)
      supabase.removeChannel(ch)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [id])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchRef.current?.({ silent: true })
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [])

  function getDateRange() {
    const today = new Date()
    const todayString = getLocalDateString(today)
    if (period === 'today') return { start: todayString, end: todayString }
    if (period === '7days') {
      const start = new Date()
      start.setDate(start.getDate() - 6)
      return { start: getLocalDateString(start), end: todayString }
    }
    if (period === 'month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      return { start: getLocalDateString(start), end: todayString }
    }
    if (period === 'year') return { start: `${today.getFullYear()}-01-01`, end: todayString }
    if (period === 'custom') return { start: startDate, end: endDate }
    return { start: '', end: '' }
  }

  const filteredInvoices = useMemo(() => {
    const range = getDateRange()
    let result = invoices.filter(invoice => {
      const invoiceDate = invoice.issue_date ? String(invoice.issue_date).slice(0, 10) : ''
      const matchesDate = (!range.start || invoiceDate >= range.start) && (!range.end || invoiceDate <= range.end)
      const invoiceStatus = getInvoicePaymentStatus(invoice)
      const matchesStatus = statusFilter === 'all' || invoiceStatus === statusFilter
      const matchesSearch = (invoice.invoice_number || '').toLowerCase().includes(search.toLowerCase().trim())
      return matchesDate && matchesStatus && matchesSearch
    })
    result.sort((a, b) => {
      if (sortBy === 'oldest') return new Date(a.issue_date) - new Date(b.issue_date)
      if (sortBy === 'highest') return Number(b.total || 0) - Number(a.total || 0)
      if (sortBy === 'lowest') return Number(a.total || 0) - Number(b.total || 0)
      return new Date(b.issue_date) - new Date(a.issue_date)
    })
    return result
  }, [invoices, period, startDate, endDate, statusFilter, search, sortBy])

  const totalBelanja = invoices.reduce((s, inv) => s + Number(inv.total || 0), 0)
  const totalDibayar = invoices.reduce((s, inv) => s + getPaidAmount(inv), 0)
  const totalHutang = Math.max(0, totalBelanja - totalDibayar)
  const filteredTotal = filteredInvoices.reduce((s, inv) => s + Number(inv.total || 0), 0)
  const filteredPaid = filteredInvoices.reduce((s, inv) => s + getPaidAmount(inv), 0)
  const filteredDebt = Math.max(0, filteredTotal - filteredPaid)

  function getWhatsAppLink(phoneStr) {
    if (!phoneStr) return '#'
    let formatted = phoneStr.replace(/\D/g, '')
    if (formatted.startsWith('0')) formatted = '62' + formatted.slice(1)
    else if (formatted.startsWith('8')) formatted = '62' + formatted
    return `https://wa.me/${formatted}`
  }

  function resetFilters() {
    setPeriod('all'); setStartDate(''); setEndDate('')
    setStatusFilter('all'); setSearch(''); setSortBy('newest')
  }

  if (loading) {
    return (
      <div>
        <div className="skeleton" style={{ height: 180, marginBottom: 20 }} />
        <div className="skeleton" style={{ height: 300 }} />
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 40 }}>
        <h3>Pelanggan tidak ditemukan</h3>
        <p style={{ color: 'var(--text-muted)' }}>Data pelanggan mungkin sudah dihapus atau tidak tersedia.</p>
        <span
          onMouseEnter={() => setKembaliHover(true)}
          onMouseLeave={() => setKembaliHover(false)}
          style={{
            display: 'inline-block',
            transform: kembaliHover ? 'translateY(-1px)' : 'translateY(0)',
            filter: kembaliHover ? 'brightness(1.08)' : 'brightness(1)',
            boxShadow: kembaliHover ? '0 6px 14px rgba(0, 0, 0, 0.12)' : '0 0 0 rgba(0, 0, 0, 0)',
            borderRadius: 10,
            transition: 'all 0.18s ease'
          }}
        >
          <Button variant="secondary" onClick={() => navigate('/customers')}>
            <FaArrowLeft /> Kembali ke Pelanggan
          </Button>
        </span>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <span
          onMouseEnter={() => setKembaliHover(true)}
          onMouseLeave={() => setKembaliHover(false)}
          style={{
            display: 'inline-block',
            transform: kembaliHover ? 'translateY(-1px)' : 'translateY(0)',
            filter: kembaliHover ? 'brightness(1.08)' : 'brightness(1)',
            boxShadow: kembaliHover ? '0 6px 14px rgba(0, 0, 0, 0.12)' : '0 0 0 rgba(0, 0, 0, 0)',
            borderRadius: 10,
            transition: 'all 0.18s ease'
          }}
        >
          <Button variant="secondary" onClick={() => navigate('/customers')}>
            <FaArrowLeft /> Kembali
          </Button>
        </span>

        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            Detail Pelanggan
            <span title={realtimeConnected ? 'Realtime aktif' : 'Realtime tidak aktif'} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: realtimeConnected ? '#dcfce7' : '#fee2e2', color: realtimeConnected ? '#166534' : '#991b1b' }}>
              <FaCircle size={6} /> {realtimeConnected ? 'LIVE' : 'OFFLINE'}
            </span>
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0' }}>Informasi dan riwayat transaksi pelanggan.</p>
        </div>

        <Button variant="secondary" onClick={() => fetchCustomerDetail()} disabled={loading}>
          <FaSyncAlt style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
        </Button>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 58, height: 58, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--primary-light, rgba(236,72,153,0.12))', color: 'var(--primary)', fontSize: 25, fontWeight: 800 }}>
              {(customer.name || '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 style={{ margin: '0 0 5px' }}>{customer.name}</h2>
              <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 13 }}>{customer.customer_code || '-'}</span>
            </div>
          </div>

          {customer.phone && (
            <a
              href={getWhatsAppLink(customer.phone)}
              target="_blank"
              rel="noopener noreferrer"
              onMouseEnter={() => setWaHover(true)}
              onMouseLeave={() => setWaHover(false)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px',
                borderRadius: 10, background: waHover ? '#1ebe5b' : '#25D366', color: '#fff',
                fontWeight: 700, fontSize: 14, textDecoration: 'none',
                boxShadow: waHover ? '0 6px 16px rgba(37, 211, 102, 0.35)' : '0 2px 6px rgba(37, 211, 102, 0.25)',
                transform: waHover ? 'translateY(-1px)' : 'translateY(0)',
                transition: 'all 0.18s ease'
              }}
            >
              <FaWhatsapp size={18} /> Hubungi WhatsApp
            </a>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 24 }}>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '0 0 6px' }}><FaPhone /> Nomor Telepon</p>
            <strong>{customer.phone || '-'}</strong>
          </div>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '0 0 6px' }}><FaEnvelope /> Email</p>
            <strong>{customer.email || '-'}</strong>
          </div>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '0 0 6px' }}><FaMapMarkerAlt /> Alamat</p>
            <strong>{customer.address || '-'}</strong>
          </div>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '0 0 6px' }}><FaCalendarAlt /> Bergabung</p>
            <strong>{customer.created_at ? formatTanggal(customer.created_at) : '-'}</strong>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="card">
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}><FaShoppingBag /> Total Pembelian</div>
          <h2 style={{ margin: '10px 0 0', color: '#10b981', fontSize: 21 }}>{formatRupiah(totalBelanja)}</h2>
        </div>
        <div className="card">
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}><FaFileInvoice /> Total Transaksi</div>
          <h2 style={{ margin: '10px 0 0', fontSize: 21 }}>{invoices.length}</h2>
        </div>
        <div className="card">
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}><FaMoneyBillWave /> Total Dibayar</div>
          <h2 style={{ margin: '10px 0 0', color: 'var(--primary)', fontSize: 21 }}>{formatRupiah(totalDibayar)}</h2>
        </div>
        <div className="card">
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}><FaMoneyBillWave /> Sisa Tagihan</div>
          <h2 style={{ margin: '10px 0 0', color: '#ef4444', fontSize: 21 }}>{formatRupiah(totalHutang)}</h2>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 18 }}>
          <h3 style={{ margin: '0 0 5px' }}>Riwayat Transaksi</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>Cari dan filter transaksi pelanggan berdasarkan periode dan status pembayaran.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12 }}>Periode Transaksi</label>
            <select value={period} onChange={e => setPeriod(e.target.value)} style={{ width: '100%' }}>
              <option value="all">Semua Periode</option>
              <option value="today">Hari Ini</option>
              <option value="7days">7 Hari Terakhir</option>
              <option value="month">Bulan Ini</option>
              <option value="year">Tahun Ini</option>
              <option value="custom">Pilih Tanggal</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12 }}>Status Pembayaran</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: '100%' }}>
              <option value="all">Semua Status</option>
              <option value="paid">Lunas</option>
              <option value="partial">Dibayar Sebagian</option>
              <option value="unpaid">Belum Dibayar</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12 }}>Urutkan Transaksi</label>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ width: '100%' }}>
              <option value="newest">Terbaru</option>
              <option value="oldest">Terlama</option>
              <option value="highest">Nominal Terbesar</option>
              <option value="lowest">Nominal Terkecil</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12 }}>Cari Invoice</label>
            <div style={{ position: 'relative' }}>
              <FaSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nomor invoice..." style={{ width: '100%', paddingLeft: 36 }} />
            </div>
          </div>
        </div>

        {period === 'custom' && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 12 }}>Dari Tanggal</label>
              <input type="date" value={startDate} max={endDate || undefined} onChange={e => setStartDate(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 12 }}>Sampai Tanggal</label>
              <input type="date" value={endDate} min={startDate || undefined} onChange={e => setEndDate(e.target.value)} style={{ width: '100%' }} />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '12px 0', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', marginBottom: 16 }}>
          <div>
            <strong>{filteredInvoices.length} transaksi ditemukan</strong>
            <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>Total nominal: {formatRupiah(filteredTotal)}</div>
          </div>
          <Button variant="secondary" onClick={resetFilters}>Reset Filter</Button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
          <div style={{ background: 'var(--bg-color)', padding: 12, borderRadius: 10 }}>
            <small style={{ color: 'var(--text-muted)' }}>Total Dibayar</small>
            <div style={{ fontWeight: 700, color: '#10b981', marginTop: 5 }}>{formatRupiah(filteredPaid)}</div>
          </div>
          <div style={{ background: 'var(--bg-color)', padding: 12, borderRadius: 10 }}>
            <small style={{ color: 'var(--text-muted)' }}>Sisa Tagihan</small>
            <div style={{ fontWeight: 700, color: '#ef4444', marginTop: 5 }}>{formatRupiah(filteredDebt)}</div>
          </div>
        </div>

        <div className="table-responsive">
          <table>
            <thead>
              <tr><th>Invoice</th><th>Tanggal</th><th>Total</th><th>Dibayar</th><th>Sisa</th><th>Status</th><th>Aksi</th></tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: 32 }}>Tidak ada transaksi yang sesuai dengan filter.</td></tr>
              ) : filteredInvoices.map(invoice => {
                const paid = getPaidAmount(invoice)
                const remaining = Math.max(0, Number(invoice.total || 0) - paid)
                const status = getInvoicePaymentStatus(invoice)
                return (
                  <tr key={invoice.id}>
                    <td><strong>{invoice.invoice_number || '-'}</strong></td>
                    <td>{formatTanggal(invoice.issue_date)}</td>
                    <td>{formatRupiah(invoice.total)}</td>
                    <td style={{ color: '#10b981', fontWeight: 600 }}>{formatRupiah(paid)}</td>
                    <td style={{ color: remaining > 0 ? '#ef4444' : 'inherit' }}>{formatRupiah(remaining)}</td>
                    <td><span style={{ color: getStatusColor(status), fontWeight: 700, fontSize: 12 }}>{getStatusLabel(status)}</span></td>
                    <td><Link to={`/invoices/${invoice.id}`} style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}>Lihat Invoice</Link></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 5px' }}>Riwayat Pembayaran</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>Semua pembayaran yang pernah dilakukan pelanggan.</p>
        </div>
        <div className="table-responsive">
          <table>
            <thead>
              <tr><th>Tanggal Pembayaran</th><th>Nomor Invoice</th><th>Nominal</th></tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr><td colSpan="3" style={{ textAlign: 'center', padding: 32 }}>Belum ada riwayat pembayaran.</td></tr>
              ) : payments.map(payment => (
                <tr key={payment.id}>
                  <td>{formatTanggal(payment.payment_date)}</td>
                  <td>{payment.invoices?.invoice_number || '-'}</td>
                  <td style={{ color: '#10b981', fontWeight: 700 }}>{formatRupiah(payment.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}