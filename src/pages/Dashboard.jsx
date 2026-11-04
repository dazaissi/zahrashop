import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatRupiah } from '../lib/format'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { FaChartPie, FaMoneyBillWave, FaWallet, FaHandHoldingUsd, FaArrowRight, FaBoxOpen } from 'react-icons/fa'

const COLORS = ['#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b']

export default function Dashboard() {
  const { session } = useAuth()
  const [loading, setLoading] = useState(true)
  
  // State Data
  const [summary, setSummary] = useState({ omzet: 0, pengeluaran: 0, laba: 0, piutang: 0, transaksi: 0, barangTerjual: 0 })
  const [chartKeuangan, setChartKeuangan] = useState([])
  const [topProducts, setTopProducts] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [kritis, setKritis] = useState([])

  // State Filter Tanggal & Tipe Grafik
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [chartType, setChartType] = useState('keuangan')

  useEffect(() => { if (session) loadData() }, [session, startDate, endDate])

  async function loadData() {
    setLoading(true)
    
    // 1. Ambil Data Invoice
    const { data: invData } = await supabase
      .from('invoices')
      .select('*, invoice_items(*, products(name))')
      .gte('issue_date', startDate)
      .lte('issue_date', endDate)
      .neq('status', 'draft')

    // 2. Ambil Data Pengeluaran
    const { data: expData } = await supabase
      .from('expenses')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)

    // 3. Ambil Data Produk
    const { data: prodData } = await supabase.from('products').select('*')

    if (!invData || !prodData || !expData) {
      setLoading(false)
      return
    }

    // --- KALKULASI DATA ---
    let totalOmzet = 0
    let totalPiutang = 0
    let totalPengeluaran = 0
    let totalBarangTerjual = 0
    let keuanganPerHari = {}
    let produkTerjual = {}
    let metodeBayar = {}

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

    setSummary({ 
      omzet: totalOmzet, 
      pengeluaran: totalPengeluaran, 
      laba: totalOmzet - totalPengeluaran, 
      piutang: totalPiutang,
      transaksi: invData.length,
      barangTerjual: totalBarangTerjual
    })

    const sortedDates = Object.keys(keuanganPerHari).sort((a, b) => new Date(a) - new Date(b))
    setChartKeuangan(sortedDates.map(date => keuanganPerHari[date]))

    const sortedProducts = Object.entries(produkTerjual)
      .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value }))
    setTopProducts(sortedProducts)

    setPaymentMethods(Object.entries(metodeBayar).map(([name, value]) => ({ name, value })))
    setKritis(prodData.filter(p => p.stock <= p.min_stock))

    setLoading(false)
  }

  if (loading) return (
    <div>
      <h1>Dashboard</h1>
      <div className="skeleton" style={{ height: 100, marginBottom: 24 }}></div>
      <div className="skeleton" style={{ height: 400 }}></div>
    </div>
  )

  // Komponen Kartu yang bisa diklik
  const ClickableCard = ({ to, title, value, icon, colorClass, textColor }) => (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <div className={`stat-card ${colorClass}`} style={{ height: '100%', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon} <span>{title}</span>
        </div>
        <strong style={{ color: textColor, marginTop: 8 }}>{value}</strong>
        <div style={{ position: 'absolute', bottom: 16, right: 16, opacity: 0.5 }}>
          <FaArrowRight size={14} />
        </div>
      </div>
    </Link>
  )

  return (
    <div>
      {/* HEADER & FILTER TANGGAL */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        
        <div className="card" style={{ padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>Dari:</span>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '6px 10px', width: 'auto', background: 'var(--bg-color)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>Sampai:</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: '6px 10px', width: 'auto', background: 'var(--bg-color)' }} />
          </div>
        </div>
      </div>

      {/* KARTU RINGKASAN (BISA DIKLIK) */}
      <div className="cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <ClickableCard 
          to="/invoices" 
          title="Omzet" 
          value={formatRupiah(summary.omzet)} 
          icon={<FaMoneyBillWave />} 
          colorClass="stat-green" 
          textColor="#10b981" 
        />
        <ClickableCard 
          to="/invoices" 
          title="Piutang" 
          value={formatRupiah(summary.piutang)} 
          icon={<FaHandHoldingUsd />} 
          colorClass="stat-blue" 
          textColor="#f59e0b" 
        />
        <ClickableCard 
          to="/expenses" 
          title="Pengeluaran" 
          value={formatRupiah(summary.pengeluaran)} 
          icon={<FaWallet />} 
          colorClass="stat-red" 
          textColor="#ef4444" 
        />
        <ClickableCard 
          to="/invoices" 
          title="Total Transaksi" 
          value={`${summary.transaksi} Invoice`} 
          icon={<FaChartPie />} 
          colorClass="" 
          textColor="var(--text-main)" 
        />
        <ClickableCard 
          to="/products" 
          title="Barang Terjual" 
          value={`${summary.barangTerjual} Pcs`} 
          icon={<FaBoxOpen />} 
          colorClass="" 
          textColor="var(--text-main)" 
        />
      </div>

      {/* AREA GRAFIK */}
      <div className="card" style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <h3 style={{ margin: 0 }}>Analitik Bisnis</h3>
          
          <select 
            value={chartType} 
            onChange={e => setChartType(e.target.value)} 
            style={{ width: 'auto', padding: '8px 32px 8px 16px', fontWeight: 'bold', cursor: 'pointer', border: '2px solid var(--primary)', color: 'var(--primary)' }}
          >
            <option value="keuangan">Grafik Arus Kas (Omzet vs Pengeluaran)</option>
            <option value="produk">Grafik Produk Terlaris</option>
            <option value="metode">Grafik Metode Pembayaran</option>
          </select>
        </div>

        <div style={{ height: 350, width: '100%', minWidth: 0 }}>
          {chartType === 'keuangan' && (
            chartKeuangan.length === 0 ? <EmptyState /> :
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartKeuangan} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="tanggal" stroke="var(--text-muted)" fontSize={12} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={(val) => `Rp ${val / 1000}k`} />
                <Tooltip formatter={(value) => formatRupiah(value)} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Legend verticalAlign="top" height={36} iconType="circle" />
                <Bar dataKey="omzet" name="Omzet" fill="#10b981" radius={[4, 4, 0, 0]} barSize={30} />
                <Bar dataKey="pengeluaran" name="Pengeluaran" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          )}

          {chartType === 'produk' && (
            topProducts.length === 0 ? <EmptyState /> :
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={topProducts} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5}>
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
                <Pie data={paymentMethods} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}>
                  {paymentMethods.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(value) => `${value} Transaksi`} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 13 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* STOK MENIPIS */}
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
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
      <FaChartPie size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
      <p>Belum ada data untuk ditampilkan di periode ini.</p>
    </div>
  )
}