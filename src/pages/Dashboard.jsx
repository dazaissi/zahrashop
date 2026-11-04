import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatRupiah } from '../lib/format'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { FaChartPie, FaMoneyBillWave, FaWallet, FaHandHoldingUsd, FaArrowRight, FaBoxOpen, FaRobot, FaLightbulb } from 'react-icons/fa'
import { motion } from 'framer-motion'

const COLORS = ['#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b']

const AnimatedNumber = ({ value, prefix = 'Rp ' }) => {
  const [displayValue, setDisplayValue] = useState(0)
  useEffect(() => {
    let start = 0
    const end = value
    if (start === end) return
    const duration = 1000
    const incrementTime = 20
    const steps = duration / incrementTime
    const increment = (end - start) / steps
    const timer = setInterval(() => {
      start += increment
      if (start >= end) { setDisplayValue(end); clearInterval(timer) }
      else { setDisplayValue(Math.floor(start)) }
    }, incrementTime)
    return () => clearInterval(timer)
  }, [value])
  return <span>{prefix}{displayValue.toLocaleString('id-ID')}</span>
}

export default function Dashboard() {
  const { session } = useAuth()
  const [loading, setLoading] = useState(true)
  
  const [summary, setSummary] = useState({ omzet: 0, pengeluaran: 0, laba: 0, piutang: 0, transaksi: 0, barangTerjual: 0 })
  const [chartKeuangan, setChartKeuangan] = useState([])
  const [topProducts, setTopProducts] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [kritis, setKritis] = useState([])
  const [insights, setInsights] = useState([])

  const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0] })
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [activeFilter, setActiveFilter] = useState('bulan-ini')
  const [chartType, setChartType] = useState('keuangan')

  useEffect(() => { if (session) loadData() }, [session, startDate, endDate])

  function setQuickFilter(type) {
    const today = new Date()
    let start = new Date()
    let end = new Date()
    
    if (type === 'bulan-ini') {
      start = new Date(today.getFullYear(), today.getMonth(), 1)
    } else if (type === 'bulan-lalu') {
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      end = new Date(today.getFullYear(), today.getMonth(), 0)
    } else if (type === '6-bulan') {
      start = new Date(today.getFullYear(), today.getMonth() - 5, 1)
    } else if (type === 'tahun-ini') {
      start = new Date(today.getFullYear(), 0, 1)
    } else if (type === 'semua') {
      start = new Date(2000, 0, 1)
    }

    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])
    setActiveFilter(type)
  }

  async function loadData() {
    setLoading(true)
    
    const { data: invData } = await supabase.from('invoices').select('*, invoice_items(*, products(name))').gte('issue_date', startDate).lte('issue_date', endDate).neq('status', 'draft')
    const { data: expData } = await supabase.from('expenses').select('*').gte('date', startDate).lte('date', endDate)
    const { data: prodData } = await supabase.from('products').select('*')

    if (!invData || !prodData || !expData) { setLoading(false); return }

    let totalOmzet = 0, totalPiutang = 0, totalPengeluaran = 0, totalBarangTerjual = 0
    let keuanganPerHari = {}, produkTerjual = {}, metodeBayar = {}

    invData.forEach(inv => {
      const paid = Number(inv.paid_amount) || 0
      totalOmzet += paid
      if (inv.status !== 'paid') totalPiutang += (Number(inv.total) - paid)
      
      const tgl = inv.issue_date
      if (!keuanganPerHari[tgl]) keuanganPerHari[tgl] = { tanggal: tgl.slice(5), omzet: 0, pengeluaran: 0 }
      keuanganPerHari[tgl].omzet += paid

      const method = inv.payment_method ? inv.payment_method.toUpperCase() : 'LAINNYA'
      metodeBayar[method] = (metodeBayar[method] || 0) + 1

      inv.invoice_items.forEach(item => {
        totalBarangTerjual += Number(item.quantity)
        const prodName = item.products?.name || item.description
        produkTerjual[prodName] = (produkTerjual[prodName] || 0) + Number(item.quantity)
      })
    })

    expData.forEach(exp => {
      totalPengeluaran += Number(exp.amount)
      const tgl = exp.date
      if (!keuanganPerHari[tgl]) keuanganPerHari[tgl] = { tanggal: tgl.slice(5), omzet: 0, pengeluaran: 0 }
      keuanganPerHari[tgl].pengeluaran += Number(exp.amount)
    })

    const labaBersih = totalOmzet - totalPengeluaran
    const kritisArr = prodData.filter(p => p.stock <= p.min_stock)

    setSummary({ omzet: totalOmzet, pengeluaran: totalPengeluaran, laba: labaBersih, piutang: totalPiutang, transaksi: invData.length, barangTerjual: totalBarangTerjual })
    setChartKeuangan(Object.keys(keuanganPerHari).sort((a, b) => new Date(a) - new Date(b)).map(date => keuanganPerHari[date]))
    
    const sortedProducts = Object.entries(produkTerjual).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value }))
    setTopProducts(sortedProducts)
    setPaymentMethods(Object.entries(metodeBayar).map(([name, value]) => ({ name, value })))
    setKritis(kritisArr)

    let newInsights = []
    if (totalOmzet > 0) newInsights.push(`📈 Performa bagus! Omzet di periode ini mencapai ${formatRupiah(totalOmzet)}.`)
    else newInsights.push(`📊 Belum ada omzet di periode ini. Ayo buat promo atau iklan untuk menarik pembeli!`)
    if (sortedProducts.length > 0) newInsights.push(`🔥 Produk terlarismu adalah **${sortedProducts[0].name}** (terjual ${sortedProducts[0].value} pcs). Pastikan stoknya selalu ada!`)
    if (kritisArr.length > 0) newInsights.push(`📦 Terdapat **${kritisArr.length} produk** yang stoknya menipis. Segera lakukan restock agar tidak kehabisan.`)
    if (totalPiutang > 0) newInsights.push(`💰 Ada piutang sebesar ${formatRupiah(totalPiutang)} yang belum tertagih. Segera ingatkan pelanggan via WhatsApp.`)

    setInsights(newInsights)
    setLoading(false)
  }

  const AnimatedCard = ({ to, title, value, icon, colorClass, textColor, delay }) => (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <motion.div className={`stat-card ${colorClass}`} style={{ height: '100%', cursor: 'pointer', position: 'relative', overflow: 'hidden' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay, ease: 'easeOut' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{icon} <span>{title}</span></div>
        <strong style={{ color: textColor, marginTop: 8 }}>{typeof value === 'number' && title.includes('Rp') ? <AnimatedNumber value={value} /> : value}</strong>
        <div style={{ position: 'absolute', bottom: 16, right: 16, opacity: 0.5 }}><FaArrowRight size={14} /></div>
      </motion.div>
    </Link>
  )

  // Cek apakah data grafik sedang kosong
  const isEmpty = 
    (chartType === 'keuangan' && chartKeuangan.length === 0) ||
    (chartType === 'produk' && topProducts.length === 0) ||
    (chartType === 'metode' && paymentMethods.length === 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
      </div>

      <div className="card" style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="filter-group">
          <button className={`filter-btn ${activeFilter === 'bulan-ini' ? 'active' : ''}`} onClick={() => setQuickFilter('bulan-ini')}>Bulan Ini</button>
          <button className={`filter-btn ${activeFilter === 'bulan-lalu' ? 'active' : ''}`} onClick={() => setQuickFilter('bulan-lalu')}>Bulan Lalu</button>
          <button className={`filter-btn ${activeFilter === '6-bulan' ? 'active' : ''}`} onClick={() => setQuickFilter('6-bulan')}>6 Bulan Terakhir</button>
          <button className={`filter-btn ${activeFilter === 'tahun-ini' ? 'active' : ''}`} onClick={() => setQuickFilter('tahun-ini')}>Tahun Ini</button>
          <button className={`filter-btn ${activeFilter === 'semua' ? 'active' : ''}`} onClick={() => setQuickFilter('semua')}>Semua Waktu</button>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>Dari:</span>
            <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setActiveFilter('manual'); }} style={{ width: 'auto', background: 'var(--bg-color)', padding: '8px 12px' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>Sampai:</span>
            <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setActiveFilter('manual'); }} style={{ width: 'auto', background: 'var(--bg-color)', padding: '8px 12px' }} />
          </div>
        </div>
      </div>

      {loading ? (
        <div>
          <div className="skeleton" style={{ height: 120, marginBottom: 24 }}></div>
          <div className="skeleton" style={{ height: 200, marginBottom: 24 }}></div>
          <div className="skeleton" style={{ height: 350 }}></div>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
          <div className="card" style={{ marginBottom: 24, background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)', color: 'white', border: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ background: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 8 }}><FaRobot size={20} color="white" /></div>
              <div>
                <h3 style={{ margin: 0, color: 'white' }}>Asisten Bisnis Zahrashop</h3>
                <p style={{ margin: 0, fontSize: 13, color: '#fbcfe8' }}>Analisis pintar berdasarkan data periode ini.</p>
              </div>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              {insights.map((insight, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: 'rgba(255,255,255,0.1)', padding: '12px 16px', borderRadius: 8 }}>
                  <FaLightbulb color="#fbbf24" style={{ marginTop: 4, flexShrink: 0 }} />
                  <span style={{ fontSize: 14, lineHeight: 1.5, color: 'white' }} dangerouslySetInnerHTML={{ __html: insight.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                </div>
              ))}
            </div>
          </div>

          <div className="dashboard-cards-grid">
            <AnimatedCard to="/invoices" title="Omzet" value={summary.omzet} icon={<FaMoneyBillWave />} colorClass="stat-green" textColor="#10b981" delay={0.1} />
            <AnimatedCard to="/invoices" title="Piutang" value={summary.piutang} icon={<FaHandHoldingUsd />} colorClass="stat-blue" textColor="#f59e0b" delay={0.2} />
            <AnimatedCard to="/expenses" title="Pengeluaran" value={summary.pengeluaran} icon={<FaWallet />} colorClass="stat-red" textColor="#ef4444" delay={0.3} />
            <AnimatedCard to="/invoices" title="Total Transaksi" value={`${summary.transaksi} Invoice`} icon={<FaChartPie />} colorClass="" textColor="var(--text-main)" delay={0.4} />
            <AnimatedCard to="/products" title="Barang Terjual" value={`${summary.barangTerjual} Pcs`} icon={<FaBoxOpen />} colorClass="" textColor="var(--text-main)" delay={0.5} />
          </div>

          <div className="card" style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <h3 style={{ margin: 0 }}>Analitik Bisnis</h3>
              <select value={chartType} onChange={e => setChartType(e.target.value)} style={{ width: 'auto', padding: '8px 32px 8px 16px', fontWeight: 'bold', cursor: 'pointer', border: '2px solid var(--primary)', color: 'var(--primary)' }}>
                <option value="keuangan">Grafik Arus Kas (Omzet vs Pengeluaran)</option>
                <option value="produk">Grafik Produk Terlaris</option>
                <option value="metode">Grafik Metode Pembayaran</option>
              </select>
            </div>

            {/* TINGGI GRAFIK AKAN OTOMATIS MENYESUAIKAN JIKA KOSONG */}
            <div style={{ height: isEmpty ? 200 : 350, width: '100%', minWidth: 0, transition: 'height 0.3s ease' }}>
              {chartType === 'keuangan' && (
                chartKeuangan.length === 0 ? <EmptyState /> :
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartKeuangan} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                    <XAxis dataKey="tanggal" stroke="var(--text-muted)" fontSize={12} />
                    <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={(val) => `Rp ${val / 1000}k`} />
                    <Tooltip formatter={(value) => formatRupiah(value)} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Legend verticalAlign="top" height={36} iconType="circle" />
                    <Bar dataKey="omzet" name="Omzet" fill="#10b981" radius={[4, 4, 0, 0]} barSize={30} isAnimationActive={true} animationDuration={1500} />
                    <Bar dataKey="pengeluaran" name="Pengeluaran" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={30} isAnimationActive={true} animationDuration={1500} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              {chartType === 'produk' && (
                topProducts.length === 0 ? <EmptyState /> :
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={topProducts} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} isAnimationActive={true} animationDuration={1500}>
                      {topProducts.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value) => `${value} Pcs`} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 13 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
              {chartType === 'metode' && (
                paymentMethods.length === 0 ? <EmptyState /> :
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={paymentMethods} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} isAnimationActive={true} animationDuration={1500}>
                      {paymentMethods.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value) => `${value} Transaksi`} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 13 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {kritis.length > 0 && (
            <div className="card" style={{ border: '1px solid #fecaca' }}>
              <h3 style={{ marginTop: 0, color: '#ef4444' }}>⚠️ Peringatan Stok Menipis</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12, marginTop: 16 }}>
                {kritis.map(p => (
                  <Link key={p.id} to="/products" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 8, textDecoration: 'none', color: '#ef4444', fontWeight: 'bold' }}>
                    <span>{p.name}</span>
                    <span>Sisa: {p.stock}</span>
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

// KOMPONEN EMPTY STATE YANG DIPERBAIKI
function EmptyState() {
  return (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      color: 'var(--text-muted)',
      background: 'var(--bg-color)',
      borderRadius: 12,
      border: '2px dashed var(--border-color)',
      gap: 12
    }}>
      <FaChartPie size={40} style={{ opacity: 0.3 }} />
      <p style={{ margin: 0, fontWeight: 500 }}>Belum ada data untuk ditampilkan di periode ini.</p>
    </div>
  )
}