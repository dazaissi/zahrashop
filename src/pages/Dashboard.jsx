import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatRupiah } from '../lib/format'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

const COLORS = ['#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b']

export default function Dashboard() {
  const { session } = useAuth()
  const [loading, setLoading] = useState(true)
  
  // State Data
  const [summary, setSummary] = useState({ omzet: 0, piutang: 0, transaksi: 0, barangTerjual: 0 })
  const [chartOmzet, setChartOmzet] = useState([])
  const [topProducts, setTopProducts] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [kritis, setKritis] = useState([])

  // State Filter Tanggal (Default: Awal bulan ini s/d hari ini)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => { if (session) loadData() }, [session, startDate, endDate])

  async function loadData() {
    setLoading(true)
    
    // 1. Ambil Data Invoice sesuai Filter
    const { data: invData } = await supabase
      .from('invoices')
      .select('*, invoice_items(*, products(name))')
      .gte('issue_date', startDate)
      .lte('issue_date', endDate)
      .neq('status', 'draft')

    // 2. Ambil Data Produk (untuk cek stok kritis)
    const { data: prodData } = await supabase.from('products').select('*')

    if (!invData || !prodData) {
      setLoading(false)
      return
    }

    // --- KALKULASI DATA ---
    let totalOmzet = 0
    let totalPiutang = 0
    let totalBarang = 0
    let omzetPerHari = {}
    let produkTerjual = {}
    let metodeBayar = {}

    invData.forEach(inv => {
      // Summary
      totalOmzet += Number(inv.paid_amount) || 0
      if (inv.status !== 'paid') totalPiutang += (Number(inv.total) - Number(inv.paid_amount))
      
      // Chart Harian
      const tgl = inv.issue_date
      omzetPerHari[tgl] = (omzetPerHari[tgl] || 0) + Number(inv.paid_amount)

      // Metode Bayar
      const method = inv.payment_method ? inv.payment_method.toUpperCase() : 'LAINNYA'
      metodeBayar[method] = (metodeBayar[method] || 0) + 1

      // Produk Terjual & Terlaris
      inv.invoice_items.forEach(item => {
        totalBarang += Number(item.quantity)
        const prodName = item.products?.name || item.description
        produkTerjual[prodName] = (produkTerjual[prodName] || 0) + Number(item.quantity)
      })
    })

    setSummary({ omzet: totalOmzet, piutang: totalPiutang, transaksi: invData.length, barangTerjual: totalBarang })

    // Format Chart Omzet (Urutkan berdasarkan tanggal)
    const sortedDates = Object.entries(omzetPerHari).sort((a, b) => new Date(a[0]) - new Date(b[0]))
    setChartOmzet(sortedDates.map(([tgl, nominal]) => ({ tanggal: tgl.slice(5), omzet: nominal })))

    // Format Top 5 Produk Terlaris
    const sortedProducts = Object.entries(produkTerjual)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }))
    setTopProducts(sortedProducts)

    // Format Metode Pembayaran
    const methods = Object.entries(metodeBayar).map(([name, value]) => ({ name, value }))
    setPaymentMethods(methods)

    // Stok Kritis
    const kritisArr = prodData.filter(p => p.stock <= p.min_stock)
    setKritis(kritisArr)

    setLoading(false)
  }

  if (loading) return (
    <div>
      <h1>Dashboard</h1>
      <div className="skeleton" style={{ height: 100, marginBottom: 24 }}></div>
      <div className="skeleton" style={{ height: 400 }}></div>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        
        {/* FILTER TANGGAL */}
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

      {/* KARTU RINGKASAN */}
      <div className="cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="stat-card stat-green">
          <span>Total Omzet</span>
          <strong>{formatRupiah(summary.omzet)}</strong>
        </div>
        <div className="stat-card stat-red">
          <span>Piutang</span>
          <strong>{formatRupiah(summary.piutang)}</strong>
        </div>
        <div className="stat-card" style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
          <span>Total Transaksi</span>
          <strong style={{ color: 'var(--text-main)' }}>{summary.transaksi} Invoice</strong>
        </div>
        <div className="stat-card" style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
          <span>Barang Terjual</span>
          <strong style={{ color: 'var(--text-main)' }}>{summary.barangTerjual} Pcs</strong>
        </div>
      </div>

      {/* GRAFIK OMZET */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginTop: 0 }}>Tren Omzet</h3>
        {chartOmzet.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>Belum ada transaksi di periode ini.</p>
        ) : (
          <div style={{ height: 300, width: '100%', marginTop: 16 }}>
            <ResponsiveContainer>
              <BarChart data={chartOmzet}>
                <XAxis dataKey="tanggal" stroke="var(--text-muted)" fontSize={12} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={(val) => `Rp ${val / 1000}k`} />
                <Tooltip formatter={(value) => formatRupiah(value)} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="omzet" fill="#ec4899" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* BARIS KEDUA: PRODUK TERLARIS & METODE BAYAR */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, marginBottom: 32 }}>
        
        {/* PRODUK TERLARIS */}
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Top 5 Produk Terlaris</h3>
          {topProducts.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>Belum ada produk terjual.</p>
          ) : (
            <div style={{ height: 250, width: '100%' }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={topProducts} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5}>
                    {topProducts.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => `${value} Pcs`} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* METODE PEMBAYARAN */}
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Metode Pembayaran</h3>
          {paymentMethods.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>Belum ada data.</p>
          ) : (
            <div style={{ height: 250, width: '100%' }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={paymentMethods} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                    {paymentMethods.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => `${value} Transaksi`} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
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