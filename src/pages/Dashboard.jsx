import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function Dashboard() {
  const { session } = useAuth()
  const [stats, setStats] = useState({ omzet: 0, piutang: 0, kritis: [], chart: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (session) load() }, [session])

  async function load() {
    setLoading(true)
    const { data: inv } = await supabase.from('invoices').select('*')
    const { data: prod } = await supabase.from('products').select('*')

    const paid = inv?.filter(i => i.status === 'paid') || []
    const omzet = paid.reduce((s, i) => s + Number(i.total), 0)
    const piutang = (inv || []).filter(i => ['sent','partial','overdue'].includes(i.status)).reduce((s, i) => s + (Number(i.total) - Number(i.paid_amount)), 0)

    const months = {}
    paid.forEach(i => {
      const m = i.issue_date?.slice(0, 7)
      if (m) months[m] = (months[m] || 0) + Number(i.total)
    })
    const chart = Object.entries(months).sort().slice(-6).map(([m, v]) => ({ bulan: m, omzet: v }))
    const kritis = (prod || []).filter(p => p.stock <= p.min_stock)

    setStats({ omzet, piutang, kritis, chart })
    setLoading(false)
  }

  if (loading) return (
    <div>
      <h1>Dashboard</h1>
      <div className="cards">
        <div className="skeleton" style={{ height: 100 }}></div>
        <div className="skeleton" style={{ height: 100 }}></div>
        <div className="skeleton" style={{ height: 100 }}></div>
      </div>
      <div className="skeleton" style={{ height: 300, marginTop: 32 }}></div>
    </div>
  )

  return (
    <div>
      <h1>Dashboard</h1>
      <div className="cards">
        <div className="stat-card stat-green">
          <span>Total Omzet</span>
          <strong>Rp {stats.omzet.toLocaleString('id-ID')}</strong>
        </div>
        <div className="stat-card stat-red">
          <span>Piutang Belum Dibayar</span>
          <strong>Rp {stats.piutang.toLocaleString('id-ID')}</strong>
        </div>
        <div className="stat-card stat-blue">
          <span>Stok Kritis</span>
          <strong>{stats.kritis.length} Produk</strong>
        </div>
      </div>

      <h2>Omzet 6 Bulan Terakhir</h2>
      <div className="card" style={{ height: 350, marginBottom: 32 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats.chart}>
            <XAxis dataKey="bulan" />
            <YAxis />
            <Tooltip formatter={v => `Rp ${v.toLocaleString('id-ID')}`} />
            <Bar dataKey="omzet" fill="#ec4899" radius={[4, 4, 0, 0]} /> {/* Warna Pink */}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {stats.kritis.length > 0 && (
        <div className="card" style={{ border: '1px solid #fecaca' }}>
          <h2 style={{ marginTop: 0, color: '#ef4444', fontSize: 18 }}>⚠️ Stok Menipis</h2>
          <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
            {stats.kritis.map(p => (
              <Link key={p.id} to="/products" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 8, textDecoration: 'none', color: '#ef4444', fontWeight: 'bold' }}>
                <span>{p.name}</span>
                <span>Sisa: {p.stock} (Min: {p.min_stock})</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}