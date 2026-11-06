import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import html2pdf from 'html2pdf.js'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useUI } from '../context/UIContext'
import { formatRupiah, formatTanggal } from '../lib/format'
import Button from '../components/ui/Button'
import {
  FaFileExcel, FaPrint, FaChartLine, FaBoxOpen, FaMobileAlt, FaTrophy,
  FaMoneyBillWave, FaShoppingBag, FaWallet, FaFire, FaReceipt,
  FaPercentage, FaInbox
} from 'react-icons/fa'

const EXCLUDED_INVOICE_STATUSES = ['draft', 'cancelled', 'canceled', 'void', 'rejected', 'batal']

function isActiveInvoice(invoice) {
  const status = String(invoice.status || '').toLowerCase()
  return !EXCLUDED_INVOICE_STATUSES.includes(status)
}

const getLocalDate = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getNextDate = (dateString) => {
  const date = new Date(`${dateString}T00:00:00`)
  date.setDate(date.getDate() + 1)
  return getLocalDate(date)
}

const AnimatedNumber = ({ value, prefix = 'Rp ' }) => {
  const [displayValue, setDisplayValue] = useState(0)
  const prevRef = useRef(0)
  const hasAnimatedRef = useRef(false)

  useEffect(() => {
    const end = Number(value) || 0
    const start = hasAnimatedRef.current ? prevRef.current : 0
    const duration = hasAnimatedRef.current ? 450 : 900
    const steps = 30

    if (start === end) {
      setDisplayValue(end)
      prevRef.current = end
      hasAnimatedRef.current = true
      return
    }

    let step = 0
    const timer = setInterval(() => {
      step++
      const progress = Math.min(step / steps, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayValue(Math.round(start + (end - start) * eased))
      if (progress >= 1) {
        setDisplayValue(end)
        clearInterval(timer)
      }
    }, duration / steps)

    prevRef.current = end
    hasAnimatedRef.current = true
    return () => clearInterval(timer)
  }, [value])

  return <span>{prefix}{Math.round(displayValue).toLocaleString('id-ID')}</span>
}

function StatCard({ icon, label, value, color, prefix = 'Rp ', subtitle }) {
  return (
    <div className="stat-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 18, minWidth: 0, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 3, background: `linear-gradient(90deg, ${color}, ${color}40)` }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: `linear-gradient(135deg, ${color}25, ${color}10)`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</span>
      </div>
      <strong style={{ fontSize: 20, display: 'block', overflowWrap: 'anywhere' }}><AnimatedNumber value={value} prefix={prefix} /></strong>
      {subtitle && <small style={{ display: 'block', color: 'var(--text-muted)', marginTop: 5 }}>{subtitle}</small>}
    </div>
  )
}

function InsightCard({ icon, label, primary, secondary, color }) {
  return (
    <div style={{ padding: '16px 18px', borderRadius: 12, background: 'var(--bg-color)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 14, pageBreakInside: 'avoid' }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${color}25, ${color}10)`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{label}</small>
        <strong style={{ display: 'block', fontSize: 15, marginBottom: 2, overflowWrap: 'anywhere' }}>{primary}</strong>
        <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12 }}>{secondary}</small>
      </div>
    </div>
  )
}

function EmptyState({ icon, title, subtitle }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
      <div style={{ width: 56, height: 56, margin: '0 auto 14px', borderRadius: 14, background: 'var(--bg-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{icon}</div>
      <strong style={{ display: 'block', color: 'var(--text-main)', marginBottom: 4 }}>{title}</strong>
      <small>{subtitle}</small>
    </div>
  )
}

function getMedalStyle(index) {
  if (index === 0) return { bg: 'rgba(251,191,36,0.15)', color: '#f59e0b', label: '🥇' }
  if (index === 1) return { bg: 'rgba(148,163,184,0.15)', color: '#64748b', label: '🥈' }
  if (index === 2) return { bg: 'rgba(249,115,22,0.15)', color: '#ea580c', label: '🥉' }
  return null
}

function StatusPill({ status }) {
  const isPaid = status === 'paid'
  const color = isPaid ? '#10b981' : '#f59e0b'
  const label = isPaid ? 'LUNAS' : 'BELUM LUNAS'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: `${color}18`, color, fontWeight: 700, fontSize: 11, letterSpacing: '0.5px' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      {label}
    </span>
  )
}

export default function Reports() {
  const { session } = useAuth()
  const { showToast } = useUI()

  const [userRole, setUserRole] = useState(null)
  const [authorized, setAuthorized] = useState(false)
  const [checkingRole, setCheckingRole] = useState(true)

  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(1)
    return getLocalDate(date)
  })
  const [endDate, setEndDate] = useState(() => getLocalDate(new Date()))
  const [activeFilter, setActiveFilter] = useState('bulan-ini')

  const [loading, setLoading] = useState(true)
  const [initialLoading, setInitialLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const [reportData, setReportData] = useState([])
  const [summary, setSummary] = useState({ omzet: 0, uangMasuk: 0, labaKotor: 0, piutang: 0, transaksi: 0 })
  const [topProducts, setTopProducts] = useState([])
  const [profitableProducts, setProfitableProducts] = useState([])
  const [chartData, setChartData] = useState([])
  const [productComparison, setProductComparison] = useState({
    physical: { quantity: 0, revenue: 0, cost: 0, profit: 0, transactions: 0 },
    digital: { quantity: 0, revenue: 0, cost: 0, profit: 0, transactions: 0 }
  })
  const [businessName, setBusinessName] = useState('Bisnis Saya')
  const [totalExpense, setTotalExpense] = useState(0)

  useEffect(() => {
    const style = document.createElement('style')
    style.setAttribute('data-zs-reports', '')
    style.textContent = `
      @keyframes zsReportProgress {
        0%   { transform: translateX(-100%); }
        100% { transform: translateX(350%); }
      }
      .filter-btn { transition: background-color .2s ease, color .2s ease, border-color .2s ease; }
    `
    document.head.appendChild(style)
    return () => { style.remove() }
  }, [])

  useEffect(() => {
    if (!session?.user?.id) {
      setCheckingRole(false)
      setInitialLoading(false)
      return
    }
    let cancelled = false
    supabase.from('profiles').select('role, business_name').eq('id', session.user.id).single()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('Profile fetch error:', error)
          setErrorMessage(error.message)
          setAuthorized(false)
        } else {
          const role = data?.role || null
          setUserRole(role)
          if (data?.business_name) setBusinessName(data.business_name)
          setAuthorized(String(role || '').toLowerCase() === 'owner')
        }
        setCheckingRole(false)
      })
    return () => { cancelled = true }
  }, [session?.user?.id])

  useEffect(() => {
    if (!session?.user?.id) return
    if (checkingRole) return
    if (!authorized) { setInitialLoading(false); return }
    fetchReport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, checkingRole, authorized, startDate, endDate])

  function setQuickFilter(type) {
    const today = new Date()
    let start = new Date(today)
    let end = new Date(today)
    if (type === 'bulan-ini') start = new Date(today.getFullYear(), today.getMonth(), 1)
    else if (type === 'bulan-lalu') {
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      end = new Date(today.getFullYear(), today.getMonth(), 0)
    } else if (type === '6-bulan') start = new Date(today.getFullYear(), today.getMonth() - 5, 1)
    else if (type === 'tahun-ini') start = new Date(today.getFullYear(), 0, 1)
    else if (type === 'semua') start = new Date(2000, 0, 1)
    setStartDate(getLocalDate(start))
    setEndDate(getLocalDate(end))
    setActiveFilter(type)
  }

  async function fetchReport() {
    setLoading(true)
    setErrorMessage('')
    try {
      if (startDate > endDate) throw new Error('Tanggal awal tidak boleh melebihi tanggal akhir.')
      const endExclusive = getNextDate(endDate)

      const [{ data, error }, { data: expData, error: expError }] = await Promise.all([
        supabase.from('invoices').select(`*, customers(name), invoice_items(*, products(name, cost, product_type))`).gte('issue_date', startDate).lt('issue_date', endExclusive),
        supabase.from('expenses').select('amount').gte('date', startDate).lt('date', endExclusive)
      ])
      if (error) throw error
      if (expError) throw expError

      const invoices = (data || []).filter(isActiveInvoice)
      const expenses = expData || []
      const totalPengeluaran = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)

      let totalOmzet = 0, totalUangMasuk = 0, totalLabaKotor = 0, totalPiutang = 0
      const productMap = {}, profitMap = {}, dailyMap = {}
      const comparison = {
        physical: { quantity: 0, revenue: 0, cost: 0, profit: 0, transactions: 0 },
        digital: { quantity: 0, revenue: 0, cost: 0, profit: 0, transactions: 0 }
      }

      invoices.forEach(inv => {
        const total = Number(inv.total) || 0
        const paid = inv.status === 'paid' ? total : Math.min(total, Math.max(0, Number(inv.paid_amount) || 0))
        totalOmzet += total; totalUangMasuk += paid; totalPiutang += Math.max(0, total - paid)

        const dateKey = inv.issue_date ? String(inv.issue_date).slice(0, 10) : null
        if (dateKey) {
          if (!dailyMap[dateKey]) dailyMap[dateKey] = { date: dateKey, omzet: 0, transactions: 0 }
          dailyMap[dateKey].omzet += total
          dailyMap[dateKey].transactions += 1
        }

        const invoiceTypes = new Set()
        ;(inv.invoice_items || []).forEach(item => {
          const qty = Number(item.quantity) || 0
          const jual = Number(item.subtotal) || 0
          const modal = Number(item.products?.cost) || 0
          const costTotal = modal * qty
          const profit = jual - costTotal
          const productName = item.products?.name || item.description || 'Produk tidak diketahui'
          const productId = item.product_id
          const productType = item.products?.product_type
          totalLabaKotor += profit

          if (productType === 'physical' || productType === 'digital') {
            const t = comparison[productType]
            t.quantity += qty; t.revenue += jual; t.cost += costTotal; t.profit += profit
            invoiceTypes.add(productType)
          }
          if (productId) {
            if (!productMap[productId]) productMap[productId] = { id: productId, name: productName, qty: 0, total: 0 }
            productMap[productId].qty += qty; productMap[productId].total += jual
            if (!profitMap[productId]) profitMap[productId] = { id: productId, name: productName, qty: 0, revenue: 0, cost: 0, profit: 0 }
            profitMap[productId].qty += qty; profitMap[productId].revenue += jual; profitMap[productId].cost += costTotal; profitMap[productId].profit += profit
          }
        })
        invoiceTypes.forEach(t => { comparison[t].transactions += 1 })
      })

      setSummary({ omzet: totalOmzet, uangMasuk: totalUangMasuk, labaKotor: totalLabaKotor, piutang: totalPiutang, transaksi: invoices.length })
      setTotalExpense(totalPengeluaran)
      setReportData(invoices)
      setProductComparison(comparison)
      setChartData(Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)))
      setTopProducts(Object.values(productMap).sort((a, b) => b.qty - a.qty).slice(0, 10))
      setProfitableProducts(Object.values(profitMap).sort((a, b) => b.profit - a.profit).slice(0, 10))
    } catch (err) {
      console.error('Gagal memuat laporan:', err)
      setErrorMessage(err.message || 'Terjadi kesalahan saat memuat laporan.')
      showToast('Gagal memuat laporan: ' + err.message, 'error')
    } finally {
      setLoading(false)
      setInitialLoading(false)
    }
  }

  function handleExportCSV() {
    if (reportData.length === 0) return showToast('Tidak ada data untuk diexport.', 'error')
    const headers = ['No Invoice', 'Tanggal', 'Pelanggan', 'Status', 'Total Tagihan', 'Uang Masuk', 'Sisa Piutang']
    const escapeCSV = value => `"${String(value ?? '').replace(/"/g, '""')}"`
    const rows = reportData.map(inv => {
      const total = Number(inv.total) || 0
      const paid = inv.status === 'paid' ? total : Number(inv.paid_amount) || 0
      return [inv.invoice_number, inv.issue_date, inv.customers?.name || 'Pelanggan Umum', inv.status, total, paid, Math.max(0, total - paid)]
    })
    const csvContent = '\uFEFF' + [headers, ...rows].map(row => row.map(escapeCSV).join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Laporan_${startDate}_sampai_${endDate}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  function handleDownloadPdf() {
    const element = document.getElementById('report-paper')
    if (!element) return
    const opt = {
      margin: 0.4,
      filename: `Laporan_${startDate}_sampai_${endDate}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'] }
    }
    html2pdf().set(opt).from(element).save()
  }

  const maxChartValue = Math.max(...chartData.map(item => item.omzet), 1)
  const labaBersih = summary.labaKotor - totalExpense
  const totalProductRevenue = productComparison.physical.revenue + productComparison.digital.revenue
  const physicalPercent = totalProductRevenue > 0 ? (productComparison.physical.revenue / totalProductRevenue) * 100 : 0
  const digitalPercent = totalProductRevenue > 0 ? (productComparison.digital.revenue / totalProductRevenue) * 100 : 0
  const marginKotor = summary.omzet > 0 ? (summary.labaKotor / summary.omzet) * 100 : 0
  const bestDay = chartData.length > 0 ? chartData.reduce((best, day) => (day.omzet > best.omzet ? day : best), chartData[0]) : null
  const avgTransaction = summary.transaksi > 0 ? summary.omzet / summary.transaksi : 0

  if (checkingRole || initialLoading) {
    return <div className="card"><div className="skeleton" style={{ height: 300, width: '100%' }} /></div>
  }

  if (!authorized || String(userRole || '').toLowerCase() !== 'owner') {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 40 }}>
        <h2 style={{ marginTop: 0 }}>Akses Ditolak</h2>
        <p style={{ color: 'var(--text-muted)' }}>Halaman laporan bisnis hanya dapat diakses oleh Owner.</p>
        <Link to="/dashboard" className="filter-btn active" style={{ display: 'inline-block', textDecoration: 'none', marginTop: 12 }}>Kembali ke Dashboard</Link>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ margin: '0 0 5px' }}>Laporan Bisnis</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>Analisis penjualan dan performa bisnis.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button variant="success" onClick={handleExportCSV}><FaFileExcel /> Export CSV</Button>
          <Button variant="danger" onClick={handleDownloadPdf}><FaPrint /> Export PDF</Button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="filter-group">
          {[['bulan-ini', 'Bulan Ini'], ['bulan-lalu', 'Bulan Lalu'], ['6-bulan', '6 Bulan Terakhir'], ['tahun-ini', 'Tahun Ini'], ['semua', 'Semua Waktu']].map(([value, label]) => (
            <button key={value} className={`filter-btn ${activeFilter === value ? 'active' : ''}`} onClick={() => setQuickFilter(value)}>{label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>Dari:</span>
            <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setActiveFilter('manual') }} style={{ width: 'auto', background: 'var(--bg-color)', padding: '8px 12px' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>Sampai:</span>
            <input type="date" value={endDate} min={startDate} onChange={e => { setEndDate(e.target.value); setActiveFilter('manual') }} style={{ width: 'auto', background: 'var(--bg-color)', padding: '8px 12px' }} />
          </div>
        </div>
      </div>

      {errorMessage ? (
        <div className="card" style={{ border: '1px solid #fecaca' }}>
          <p style={{ color: '#ef4444', marginTop: 0 }}>Gagal memuat laporan: {errorMessage}</p>
          <button className="filter-btn active" onClick={fetchReport}>Coba Lagi</button>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          {loading && (
            <div style={{ position: 'absolute', top: -8, left: 0, right: 0, height: 3, borderRadius: 99, overflow: 'hidden', zIndex: 5 }}>
              <div style={{ width: '40%', height: '100%', background: 'var(--primary)', borderRadius: 99, animation: 'zsReportProgress 1.2s ease-in-out infinite' }} />
            </div>
          )}

          <div id="report-paper" style={{ padding: 24, borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid var(--border-color)', background: 'var(--card-bg)', opacity: loading ? 0.55 : 1, pointerEvents: loading ? 'none' : 'auto', transition: 'opacity 0.25s ease' }}>
            <div style={{ padding: '24px 20px', borderRadius: 12, background: 'linear-gradient(135deg, rgba(236,72,153,0.08), rgba(139,92,246,0.08))', border: '1px solid var(--border-color)', textAlign: 'center', marginBottom: 24 }}>
              <h2 style={{ margin: '0 0 8px', color: 'var(--primary)', fontSize: 26, textTransform: 'uppercase', letterSpacing: '1px' }}>Laporan Bisnis</h2>
              <h3 style={{ margin: '0 0 8px' }}>{businessName}</h3>
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>Periode: {formatTanggal(startDate)} - {formatTanggal(endDate)}</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 24 }}>
              <InsightCard icon={<FaFire />} label="Hari Terbaik" primary={bestDay ? formatTanggal(bestDay.date) : '—'} secondary={bestDay ? `${formatRupiah(bestDay.omzet)} · ${bestDay.transactions} transaksi` : 'Belum ada data'} color="#ef4444" />
              <InsightCard icon={<FaReceipt />} label="Rata-rata / Transaksi" primary={formatRupiah(avgTransaction)} secondary={`Dari ${summary.transaksi} transaksi`} color="#8b5cf6" />
              <InsightCard icon={<FaPercentage />} label="Margin Laba Kotor" primary={`${marginKotor.toFixed(1)}%`} secondary={`Laba kotor ${formatRupiah(summary.labaKotor)}`} color="#10b981" />
            </div>

            <h3 style={{ marginTop: 0 }}>Ringkasan Keuangan</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 28 }}>
              <StatCard icon={<FaShoppingBag />} label="Total Transaksi" value={summary.transaksi} prefix="" color="#8b5cf6" subtitle="Invoice" />
              <StatCard icon={<FaMoneyBillWave />} label="Omzet Penjualan" value={summary.omzet} color="#10b981" />
              <StatCard icon={<FaWallet />} label="Uang Masuk" value={summary.uangMasuk} color="#3b82f6" />
              <StatCard icon={<FaMoneyBillWave />} label="Piutang" value={summary.piutang} color="#f59e0b" />
              <StatCard icon={<FaChartLine />} label="Laba Kotor" value={summary.labaKotor} color="#0ea5e9" />
              <StatCard icon={<FaWallet />} label="Total Pengeluaran" value={totalExpense} prefix="-Rp " color="#ef4444" />
              <StatCard icon={<FaTrophy />} label="Laba Bersih" value={labaBersih} color="#10b981" subtitle="Laba kotor - pengeluaran" />
            </div>

            <div className="card" style={{ marginBottom: 24, padding: 20, border: '1px solid var(--border-color)', boxShadow: 'none', pageBreakInside: 'avoid' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <FaChartLine style={{ color: 'var(--primary)' }} />
                <div>
                  <h3 style={{ margin: 0 }}>Grafik Penjualan</h3>
                  <small style={{ color: 'var(--text-muted)' }}>Tren omzet berdasarkan tanggal transaksi.</small>
                </div>
              </div>
              {chartData.length === 0 ? (
                <EmptyState icon={<FaChartLine />} title="Belum ada data penjualan" subtitle="Tidak ada transaksi pada periode ini." />
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'end', gap: 5, height: 220, padding: '15px 5px 0', overflowX: 'auto', borderBottom: '1px solid var(--border-color)' }}>
                    {chartData.map(item => {
                      const height = Math.max((item.omzet / maxChartValue) * 180, 4)
                      const isMax = item.omzet === maxChartValue
                      return (
                        <div key={item.date} title={`${formatTanggal(item.date)}: ${formatRupiah(item.omzet)} (${item.transactions} transaksi)`} style={{ minWidth: chartData.length > 20 ? 12 : 24, flex: chartData.length > 20 ? '0 0 12px' : 1, height: '100%', display: 'flex', alignItems: 'end', justifyContent: 'center' }}>
                          <div style={{ width: '75%', height: `${height}px`, minHeight: 3, background: isMax ? 'linear-gradient(180deg, #f59e0b, rgba(245,158,11,0.5))' : 'linear-gradient(180deg, var(--primary), rgba(236,72,153,0.4))', borderRadius: '5px 5px 0 0', opacity: isMax ? 1 : 0.9, transition: 'height 0.3s ease' }} />
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 10, color: 'var(--text-muted)', fontSize: 11 }}>
                    <span>{formatTanggal(chartData[0].date)}</span>
                    <span>{formatTanggal(chartData[chartData.length - 1].date)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
                    <div>
                      <small style={{ color: 'var(--text-muted)' }}>Total omzet</small>
                      <strong style={{ display: 'block', color: 'var(--primary)', fontSize: 18 }}>{formatRupiah(summary.omzet)}</strong>
                    </div>
                    <div>
                      <small style={{ color: 'var(--text-muted)' }}>Total hari transaksi</small>
                      <strong style={{ display: 'block', fontSize: 18 }}>{chartData.length} hari</strong>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="card" style={{ marginBottom: 24, padding: 20, border: '1px solid var(--border-color)', boxShadow: 'none', pageBreakInside: 'avoid' }}>
              <h3 style={{ margin: '0 0 5px' }}>Perbandingan Produk</h3>
              <p style={{ margin: '0 0 20px', color: 'var(--text-muted)', fontSize: 13 }}>Performa penjualan barang fisik dan produk digital.</p>

              <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap', marginBottom: 20, padding: 16, borderRadius: 12, background: 'var(--bg-color)' }}>
                <div style={{ width: 130, height: 130, borderRadius: '50%', background: `conic-gradient(#10b981 0% ${physicalPercent}%, #3b82f6 ${physicalPercent}% 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, margin: '0 auto' }}>
                  <div style={{ width: 92, height: 92, borderRadius: '50%', background: 'var(--card-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <small style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total</small>
                    <strong style={{ fontSize: 12 }}>{totalProductRevenue > 0 ? formatRupiah(totalProductRevenue).replace('Rp ', 'Rp') : 'Rp 0'}</strong>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ color: '#10b981', fontWeight: 600, fontSize: 13 }}>● Fisik</span>
                      <strong style={{ color: '#10b981' }}>{physicalPercent.toFixed(1)}%</strong>
                    </div>
                    <div style={{ height: 8, background: 'var(--border-color)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ width: `${physicalPercent}%`, height: '100%', background: '#10b981' }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ color: '#3b82f6', fontWeight: 600, fontSize: 13 }}>● Digital</span>
                      <strong style={{ color: '#3b82f6' }}>{digitalPercent.toFixed(1)}%</strong>
                    </div>
                    <div style={{ height: 8, background: 'var(--border-color)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ width: `${digitalPercent}%`, height: '100%', background: '#3b82f6' }} />
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
                <div style={{ padding: 18, border: '1px solid var(--border-color)', borderRadius: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 10, background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.08))', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FaBoxOpen size={20} /></div>
                    <div>
                      <strong>Barang Fisik</strong>
                      <small style={{ display: 'block', color: 'var(--text-muted)' }}>Produk dengan stok</small>
                    </div>
                  </div>
                  <h2 style={{ margin: '0 0 5px', color: '#10b981' }}>{formatRupiah(productComparison.physical.revenue)}</h2>
                  <small style={{ color: 'var(--text-muted)' }}>Total omzet</small>
                  <div style={{ marginTop: 18, display: 'grid', gap: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Jumlah terjual</span><strong>{productComparison.physical.quantity}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Transaksi</span><strong>{productComparison.physical.transactions}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Modal produk</span><strong>{formatRupiah(productComparison.physical.cost)}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Laba kotor</span><strong style={{ color: '#10b981' }}>{formatRupiah(productComparison.physical.profit)}</strong></div>
                  </div>
                </div>

                <div style={{ padding: 18, border: '1px solid var(--border-color)', borderRadius: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 10, background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(59,130,246,0.08))', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FaMobileAlt size={20} /></div>
                    <div>
                      <strong>Produk Digital</strong>
                      <small style={{ display: 'block', color: 'var(--text-muted)' }}>Pulsa, kuota, token, e-wallet</small>
                    </div>
                  </div>
                  <h2 style={{ margin: '0 0 5px', color: '#3b82f6' }}>{formatRupiah(productComparison.digital.revenue)}</h2>
                  <small style={{ color: 'var(--text-muted)' }}>Total omzet</small>
                  <div style={{ marginTop: 18, display: 'grid', gap: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Jumlah terjual</span><strong>{productComparison.digital.quantity}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Transaksi</span><strong>{productComparison.digital.transactions}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Modal produk</span><strong>{formatRupiah(productComparison.digital.cost)}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Laba kotor</span><strong style={{ color: '#3b82f6' }}>{formatRupiah(productComparison.digital.profit)}</strong></div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
              <div>
                <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}><FaTrophy style={{ color: '#f59e0b' }} /> Produk Terlaris</h3>
                <div style={{ overflowX: 'auto', width: '100%' }}>
                  <table style={{ boxShadow: 'none', border: '1px solid var(--border-color)' }}>
                    <thead><tr><th>Produk</th><th>Qty</th><th>Penjualan</th></tr></thead>
                    <tbody>
                      {topProducts.length === 0 ? (
                        <tr><td colSpan="3" style={{ textAlign: 'center', padding: 24 }}>Belum ada produk terjual.</td></tr>
                      ) : topProducts.map((product, index) => {
                        const medal = getMedalStyle(index)
                        return (
                          <tr key={product.id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {medal && <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 6, background: medal.bg, fontSize: 13, flexShrink: 0 }}>{medal.label}</span>}
                                <strong>{!medal ? `${index + 1}. ` : ''}{product.name}</strong>
                              </div>
                            </td>
                            <td>{product.qty}</td>
                            <td>{formatRupiah(product.total)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}><FaChartLine style={{ color: '#10b981' }} /> Produk Paling Menguntungkan</h3>
                <div style={{ overflowX: 'auto', width: '100%' }}>
                  <table style={{ boxShadow: 'none', border: '1px solid var(--border-color)' }}>
                    <thead><tr><th>Produk</th><th>Qty</th><th>Laba</th></tr></thead>
                    <tbody>
                      {profitableProducts.length === 0 ? (
                        <tr><td colSpan="3" style={{ textAlign: 'center', padding: 24 }}>Belum ada data keuntungan.</td></tr>
                      ) : profitableProducts.map((product, index) => {
                        const medal = getMedalStyle(index)
                        return (
                          <tr key={product.id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {medal && <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 6, background: medal.bg, fontSize: 13, flexShrink: 0 }}>{medal.label}</span>}
                                <div>
                                  <strong>{!medal ? `${index + 1}. ` : ''}{product.name}</strong>
                                  <br />
                                  <small style={{ color: 'var(--text-muted)' }}>Omzet: {formatRupiah(product.revenue)}</small>
                                </div>
                              </div>
                            </td>
                            <td>{product.qty}</td>
                            <td><strong style={{ color: product.profit >= 0 ? '#10b981' : '#ef4444' }}>{formatRupiah(product.profit)}</strong></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 28 }}>
              <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 10 }}>Daftar Transaksi</h3>
              <div style={{ overflowX: 'auto', width: '100%' }}>
                <table style={{ boxShadow: 'none', border: '1px solid var(--border-color)' }}>
                  <thead><tr><th>Invoice</th><th>Pelanggan</th><th>Total Tagihan</th><th>Status</th></tr></thead>
                  <tbody>
                    {reportData.length === 0 ? (
                      <tr><td colSpan="4" style={{ padding: 0 }}><EmptyState icon={<FaInbox />} title="Tidak ada transaksi" subtitle="Belum ada transaksi pada periode ini." /></td></tr>
                    ) : reportData.map(inv => (
                      <tr key={inv.id}>
                        <td>
                          <strong>{inv.invoice_number}</strong>
                          <br />
                          <small style={{ color: 'var(--text-muted)' }}>{formatTanggal(inv.issue_date)}</small>
                        </td>
                        <td>{inv.customers?.name || 'Pelanggan Umum'}</td>
                        <td>{formatRupiah(inv.total)}</td>
                        <td><StatusPill status={inv.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ marginTop: 28, paddingTop: 16, borderTop: '1px solid var(--border-color)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 11 }}>
              Laporan dibuat melalui Zahra Shop.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}