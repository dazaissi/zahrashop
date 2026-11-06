import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatRupiah } from '../lib/format'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { FaChartPie, FaMoneyBillWave, FaHandHoldingUsd, FaArrowRight, FaBoxOpen, FaLightbulb, FaSyncAlt, FaCircle } from 'react-icons/fa'
import { motion } from 'framer-motion'

const COLORS = ['#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b']

const getLocalDate = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const AnimatedNumber = ({ value, prefix = 'Rp ' }) => {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    const end = Number(value) || 0
    const duration = 1000
    const steps = duration / 20
    let currentStep = 0

    if (end === 0) { setDisplayValue(0); return }

    const timer = setInterval(() => {
      currentStep++
      const progress = Math.min(currentStep / steps, 1)
      setDisplayValue(Math.floor(end * progress))
      if (progress >= 1) { setDisplayValue(end); clearInterval(timer) }
    }, 20)

    return () => clearInterval(timer)
  }, [value])

  return <span>{prefix}{Math.round(displayValue).toLocaleString('id-ID')}</span>
}

export default function Dashboard() {
  const { session, profile } = useAuth()
  const [userRole, setUserRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [summary, setSummary] = useState({ uangMasuk: 0, piutang: 0, transaksi: 0, barangTerjual: 0 })
  const [chartKeuangan, setChartKeuangan] = useState([])
  const [topProducts, setTopProducts] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [kritis, setKritis] = useState([])
  const [insights, setInsights] = useState([])
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(1)
    return getLocalDate(date)
  })
  const [endDate, setEndDate] = useState(() => getLocalDate(new Date()))
  const [activeFilter, setActiveFilter] = useState('bulan-ini')
  const [chartType, setChartType] = useState('keuangan')

  const fetchRef = useRef(null)
  const timerRef = useRef(null)

  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (!session?.user?.id || !profile?.id) return
    if (!silent) setLoading(true)
    setErrorMessage('')

    try {
      if (startDate > endDate) throw new Error('Tanggal awal tidak boleh melebihi tanggal akhir.')

      const role = profile.role?.toLowerCase()
      if (!['owner', 'admin'].includes(role)) throw new Error('Role pengguna tidak dikenali.')

      const isOwner = role === 'owner'
      setUserRole(role)

      if (!isOwner) setChartType(current => current === 'keuangan' ? 'produk' : current)

      const invoiceQuery = supabase
        .from('invoices')
        .select('*, invoice_items(*, products(name))')
        .gte('issue_date', startDate)
        .lte('issue_date', endDate)
        .neq('status', 'draft')

      const productQuery = supabase
        .from('products')
        .select('id, name, stock, min_stock, product_type')
        .order('name')

      const requests = [invoiceQuery, productQuery]

      if (isOwner) {
        requests.push(
          supabase.from('expenses').select('amount, date').gte('date', startDate).lte('date', endDate)
        )
      }

      const results = await Promise.all(requests)
      const { data: invData, error: invError } = results[0]
      const { data: prodData, error: prodError } = results[1]
      const expData = isOwner ? results[2]?.data : []
      const expError = isOwner ? results[2]?.error : null

      if (invError) throw invError
      if (prodError) throw prodError
      if (expError) throw expError

      const invoices = invData || []
      const products = prodData || []
      const expenses = expData || []

      let totalUangMasuk = 0
      let totalPiutang = 0
      let totalBarangTerjual = 0
      const keuanganPerHari = {}
      const produkTerjual = {}
      const metodeBayar = {}

      invoices.forEach(inv => {
        const paid = Number(inv.paid_amount) || 0
        const total = Number(inv.total) || 0
        totalUangMasuk += paid
        totalPiutang += Math.max(0, total - paid)

        const tanggal = inv.issue_date
        if (tanggal) {
          if (!keuanganPerHari[tanggal]) {
            keuanganPerHari[tanggal] = { tanggal: tanggal.slice(5), uangMasuk: 0, pengeluaran: 0 }
          }
          keuanganPerHari[tanggal].uangMasuk += paid
        }

        const method = inv.payment_method ? inv.payment_method.toUpperCase() : 'LAINNYA'
        metodeBayar[method] = (metodeBayar[method] || 0) + 1

        ;(inv.invoice_items || []).forEach(item => {
          const qty = Number(item.quantity) || 0
          totalBarangTerjual += qty
          const namaProduk = item.products?.name || item.description || 'Produk tidak diketahui'
          produkTerjual[namaProduk] = (produkTerjual[namaProduk] || 0) + qty
        })
      })

      if (isOwner) {
        expenses.forEach(exp => {
          const tanggal = exp.date
          if (tanggal) {
            if (!keuanganPerHari[tanggal]) {
              keuanganPerHari[tanggal] = { tanggal: tanggal.slice(5), uangMasuk: 0, pengeluaran: 0 }
            }
            keuanganPerHari[tanggal].pengeluaran += Number(exp.amount) || 0
          }
        })
      }

      // Fix: exclude produk digital & produk dengan min_stock = 0 dari "kritis"
      const kritisArr = products.filter(product => {
        if (product.product_type === 'digital') return false
        const stock = Number(product.stock) || 0
        const minStock = Number(product.min_stock) || 0
        if (minStock <= 0) return false
        return stock <= minStock
      })

      const sortedProducts = Object.entries(produkTerjual)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, value]) => ({ name, value }))

      const sortedPayments = Object.entries(metodeBayar).map(([name, value]) => ({ name, value }))

      setSummary({
        uangMasuk: totalUangMasuk,
        piutang: totalPiutang,
        transaksi: invoices.length,
        barangTerjual: totalBarangTerjual
      })

      setChartKeuangan(
        Object.keys(keuanganPerHari).sort((a, b) => new Date(a) - new Date(b)).map(date => keuanganPerHari[date])
      )
      setTopProducts(sortedProducts)
      setPaymentMethods(sortedPayments)
      setKritis(kritisArr)

      const newInsights = []
      if (invoices.length > 0) newInsights.push(`Terdapat ${invoices.length} transaksi invoice pada periode yang dipilih.`)
      else newInsights.push('Belum ada transaksi pada periode yang dipilih.')

      newInsights.push(`Total barang terjual sebanyak ${totalBarangTerjual} pcs.`)

      if (sortedProducts.length > 0) {
        newInsights.push(`Produk terlaris adalah ${sortedProducts[0].name}, dengan penjualan ${sortedProducts[0].value} pcs.`)
      }
      if (kritisArr.length > 0) {
        newInsights.push(`Ada ${kritisArr.length} produk yang stoknya sudah mencapai batas minimum. Segera periksa stok.`)
      }
      if (isOwner && totalPiutang > 0) {
        newInsights.push(`Masih ada piutang sebesar ${formatRupiah(totalPiutang)} yang belum diterima.`)
      }
      setInsights(newInsights)

    } catch (error) {
      console.error('Gagal memuat Dashboard:', error)
      if (!silent) setErrorMessage(error.message || 'Terjadi kesalahan saat memuat data.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [session?.user?.id, profile?.id, startDate, endDate])

  useEffect(() => { fetchRef.current = loadData }, [loadData])

  useEffect(() => {
    if (session?.user?.id && profile?.id) loadData()
  }, [session?.user?.id, profile?.id, startDate, endDate, loadData])

  // Realtime subscription
  useEffect(() => {
    if (!session?.user?.id || !profile?.id) return
    const ch = supabase.channel(`dashboard-rt-${session.user.id}-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => {
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => fetchRef.current?.({ silent: true }), 400)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoice_payments' }, () => {
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => fetchRef.current?.({ silent: true }), 400)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => fetchRef.current?.({ silent: true }), 400)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => {
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => fetchRef.current?.({ silent: true }), 400)
      })
      .subscribe(s => setRealtimeConnected(s === 'SUBSCRIBED'))

    return () => {
      setRealtimeConnected(false)
      supabase.removeChannel(ch)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [session?.user?.id, profile?.id])

  // Refetch saat tab aktif kembali
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

  const AnimatedCard = ({ to, title, value, icon, colorClass, textColor, delay, isMoney = false }) => (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <motion.div className={`stat-card ${colorClass}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay, ease: 'easeOut' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, zIndex: 2 }}>{icon}<span>{title}</span></div>
        <strong style={{ color: textColor, marginTop: 8, zIndex: 2 }}>
          {isMoney ? <AnimatedNumber value={value} /> : value}
        </strong>
        <div style={{ position: 'absolute', bottom: 16, right: 16, opacity: 0.5, zIndex: 2 }}><FaArrowRight size={14} /></div>
      </motion.div>
    </Link>
  )

  const isEmpty =
    (chartType === 'keuangan' && chartKeuangan.length === 0) ||
    (chartType === 'produk' && topProducts.length === 0) ||
    (chartType === 'metode' && paymentMethods.length === 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
            Dashboard
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontWeight: 500 }}>Ringkasan aktivitas bisnis Zahra Shop</p>
        </div>
        <button className="filter-btn" onClick={() => loadData()} disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 14px' }}>
          <FaSyncAlt style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
        </button>
      </div>

      <div className="card" style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="filter-group">
          {[
            ['bulan-ini', 'Bulan Ini'],
            ['bulan-lalu', 'Bulan Lalu'],
            ['6-bulan', '6 Bulan Terakhir'],
            ['tahun-ini', 'Tahun Ini'],
            ['semua', 'Semua Waktu']
          ].map(([value, label]) => (
            <button key={value} className={`filter-btn ${activeFilter === value ? 'active' : ''}`} onClick={() => setQuickFilter(value)}>{label}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>Dari:</span>
            <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setActiveFilter('manual') }} style={{ width: 'auto', padding: '8px 12px' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>Sampai:</span>
            <input type="date" value={endDate} min={startDate} onChange={e => { setEndDate(e.target.value); setActiveFilter('manual') }} style={{ width: 'auto', padding: '8px 12px' }} />
          </div>
        </div>
      </div>

      {loading ? (
        <div>
          <div className="skeleton" style={{ height: 120, marginBottom: 24 }} />
          <div className="skeleton" style={{ height: 200, marginBottom: 24 }} />
          <div className="skeleton" style={{ height: 350 }} />
        </div>
      ) : errorMessage ? (
        <div className="card" style={{ border: '1px solid #fecaca' }}>
          <p style={{ color: '#ef4444', marginTop: 0 }}>Gagal memuat Dashboard: {errorMessage}</p>
          <button className="filter-btn active" onClick={() => loadData()}>Coba Lagi</button>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
          <div className="card" style={{ marginBottom: 24, background: 'linear-gradient(135deg, rgba(236,72,153,0.95) 0%, rgba(190,24,93,0.95) 100%)', color: 'white', border: 'none', backdropFilter: 'blur(10px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ background: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 10 }}><FaLightbulb size={22} color="white" /></div>
              <div>
                <h3 style={{ margin: 0, color: 'white', fontSize: 20 }}>Ringkasan Aktivitas Zahra Shop</h3>
                <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>Informasi berdasarkan periode yang dipilih.</p>
              </div>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {insights.map((insight, index) => (
                <div key={index} style={{ background: 'rgba(255,255,255,0.15)', padding: '14px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)' }}>
                  <span style={{ fontSize: 14, lineHeight: 1.6, color: 'white', fontWeight: 500 }}>{insight}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="dashboard-cards-grid">
            <AnimatedCard to="/invoices" title="Uang Masuk" value={summary.uangMasuk} icon={<FaMoneyBillWave />} colorClass="stat-green" textColor="#10b981" delay={0.1} isMoney />
            {userRole === 'owner' && <AnimatedCard to="/invoices" title="Piutang" value={summary.piutang} icon={<FaHandHoldingUsd />} colorClass="stat-blue" textColor="#f59e0b" delay={0.2} isMoney />}
            <AnimatedCard to="/invoices" title="Total Transaksi" value={`${summary.transaksi} Invoice`} icon={<FaChartPie />} colorClass="" textColor="var(--text-main)" delay={0.3} />
            <AnimatedCard to="/products" title="Barang Terjual" value={`${summary.barangTerjual} Pcs`} icon={<FaBoxOpen />} colorClass="" textColor="var(--text-main)" delay={0.4} />
          </div>

          <div className="card" style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <h3 style={{ margin: 0 }}>Analitik Bisnis</h3>
              <select value={chartType} onChange={e => setChartType(e.target.value)} style={{ width: 'auto', padding: '8px 32px 8px 16px', fontWeight: 'bold', cursor: 'pointer', border: '2px solid var(--primary)', color: 'var(--primary)', background: 'rgba(255,255,255,0.5)' }}>
                {userRole === 'owner' && <option value="keuangan">Grafik Uang Masuk</option>}
                <option value="produk">Grafik Produk Terlaris</option>
                <option value="metode">Grafik Metode Pembayaran</option>
              </select>
            </div>

            <div style={{ height: isEmpty ? 200 : 350, width: '100%', minWidth: 0, transition: 'height 0.3s ease' }}>
              {chartType === 'keuangan' && userRole === 'owner' && (
                chartKeuangan.length === 0 ? <EmptyState /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartKeuangan} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                      <XAxis dataKey="tanggal" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={value => `Rp ${value / 1000}k`} />
                      <Tooltip formatter={value => formatRupiah(value)} contentStyle={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.5)', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)' }} />
                      <Legend verticalAlign="top" height={36} iconType="circle" />
                      <Bar dataKey="uangMasuk" name="Uang Masuk" fill="#10b981" radius={[6, 6, 0, 0]} barSize={30} animationDuration={1500} />
                      <Bar dataKey="pengeluaran" name="Pengeluaran" fill="#ef4444" radius={[6, 6, 0, 0]} barSize={30} animationDuration={1500} />
                    </BarChart>
                  </ResponsiveContainer>
                )
              )}

              {chartType === 'produk' && (
                topProducts.length === 0 ? <EmptyState /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={topProducts} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} animationDuration={1500}>
                        {topProducts.map((entry, index) => <Cell key={`product-${index}`} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={value => `${value} Pcs`} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 13, fontWeight: 600 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )
              )}

              {chartType === 'metode' && (
                paymentMethods.length === 0 ? <EmptyState /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={paymentMethods} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} animationDuration={1500}>
                        {paymentMethods.map((entry, index) => <Cell key={`payment-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={value => `${value} Transaksi`} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 13, fontWeight: 600 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )
              )}
            </div>
          </div>

          {kritis.length > 0 && (
            <div className="card" style={{ border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(254, 242, 242, 0.6)', marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <h3 style={{ margin: 0, color: '#ef4444' }}>Peringatan Stok Menipis</h3>
                <Link to="/products" style={{ color: 'var(--primary)', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>Kelola Produk →</Link>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12, marginTop: 16 }}>
                {kritis.map(product => (
                  <Link key={product.id} to="/products" style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 18px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, textDecoration: 'none', color: '#ef4444', fontWeight: 'bold', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                    <span>{product.name}</span>
                    <span>Sisa: {product.stock}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.3)', borderRadius: 12, border: '2px dashed var(--border-color)', gap: 12 }}>
      <FaChartPie size={40} style={{ opacity: 0.3 }} />
      <p style={{ margin: 0, fontWeight: 600 }}>Belum ada data untuk ditampilkan di periode ini.</p>
    </div>
  )
}