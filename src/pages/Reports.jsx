import { useEffect, useState } from 'react'
import html2pdf from 'html2pdf.js'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useUI } from '../context/UIContext'
import { formatRupiah, formatTanggal } from '../lib/format'
import Button from '../components/ui/Button'
import { FaFileExcel, FaPrint } from 'react-icons/fa'
import { motion } from 'framer-motion'

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

export default function Reports() {
  const { session } = useAuth()
  const { showToast } = useUI()
  
  const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; })
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [activeFilter, setActiveFilter] = useState('bulan-ini')

  const [loading, setLoading] = useState(true)
  const [reportData, setReportData] = useState([])
  const [summary, setSummary] = useState({ omzet: 0, laba: 0, piutang: 0, transaksi: 0 })
  const [topProducts, setTopProducts] = useState([])
  const [businessName, setBusinessName] = useState('Bisnis Saya')
  const [totalExpense, setTotalExpense] = useState(0)

  useEffect(() => { if (session) fetchReport() }, [session, startDate, endDate])

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

  async function fetchReport() {
    setLoading(true)
    const { data: profData } = await supabase.from('profiles').select('business_name').eq('id', session.user.id).single()
    if (profData?.business_name) setBusinessName(profData.business_name)

    const { data, error } = await supabase.from('invoices')
      .select('*, customers(name), invoice_items(*, products(cost))')
      .gte('issue_date', startDate).lte('issue_date', endDate).neq('status', 'draft') 

    if (error) { showToast('Gagal memuat laporan: ' + error.message, 'error'); setLoading(false); return }

    const { data: expData } = await supabase.from('expenses').select('amount').gte('date', startDate).lte('date', endDate)
    setTotalExpense((expData || []).reduce((sum, e) => sum + Number(e.amount), 0))

    let totalOmzet = 0, totalLaba = 0, totalPiutang = 0
    const productMap = {}

    data.forEach(inv => {
      totalOmzet += Number(inv.paid_amount) || 0
      const sisa = Number(inv.total) - (Number(inv.paid_amount) || 0)
      if (sisa > 0) totalPiutang += sisa
      inv.invoice_items.forEach(item => {
        const qty = Number(item.quantity)
        const jual = Number(item.subtotal)
        const modal = item.products?.cost ? (Number(item.products.cost) * qty) : 0
        totalLaba += (jual - modal)
        if (item.product_id) {
          if (!productMap[item.product_id]) productMap[item.product_id] = { name: item.description, qty: 0, total: 0 }
          productMap[item.product_id].qty += qty
          productMap[item.product_id].total += jual
        }
      })
    })

    setSummary({ omzet: totalOmzet, laba: totalLaba, piutang: totalPiutang, transaksi: data.length })
    setReportData(data)
    setTopProducts(Object.values(productMap).sort((a, b) => b.qty - a.qty).slice(0, 10))
    setLoading(false)
  }

  function handleExportCSV() {
    if (reportData.length === 0) return showToast('Tidak ada data untuk diexport', 'error')
    const headers = ['No Invoice', 'Tanggal', 'Pelanggan', 'Status', 'Total', 'Dibayar', 'Sisa Piutang']
    const rows = reportData.map(inv => [inv.invoice_number, inv.issue_date, inv.customers?.name || 'Umum', inv.status, inv.total, inv.paid_amount, Number(inv.total) - Number(inv.paid_amount)])
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const link = document.createElement('a')
    link.setAttribute('href', encodeURI(csvContent))
    link.setAttribute('download', `Laporan_${startDate}_sampai_${endDate}.csv`)
    document.body.appendChild(link); link.click(); document.body.removeChild(link)
  }

  function handleDownloadPdf() {
    const element = document.getElementById('report-paper')
    const opt = { margin: 0.5, filename: `Laporan_${startDate}_sampai_${endDate}.pdf`, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' } }
    html2pdf().set(opt).from(element).save()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <h1 style={{ margin: 0 }}>Laporan Bisnis</h1>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button variant="success" onClick={handleExportCSV}><FaFileExcel /> Export Excel</Button>
          <Button variant="danger" onClick={handleDownloadPdf}><FaPrint /> Export PDF</Button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
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

      <div id="report-paper" style={{ padding: '40px', borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid var(--border-color)', background: 'var(--card-bg)' }}>
        <div style={{ textAlign: 'center', borderBottom: '2px solid var(--border-color)', paddingBottom: 20, marginBottom: 24 }}>
          <h2 style={{ margin: '0 0 8px', color: 'var(--primary)', fontSize: 28, textTransform: 'uppercase' }}>Laporan Bisnis</h2>
          <h3 style={{ margin: '0 0 8px' }}>{businessName}</h3>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>Periode: {formatTanggal(startDate)} - {formatTanggal(endDate)}</p>
        </div>

        {loading ? <div className="skeleton" style={{ height: 300, width: '100%' }}></div> : (
          <>
            <div className="report-stats-grid">
              <div className="stat-card" style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
                <span>Total Transaksi</span>
                <strong>{summary.transaksi} Invoice</strong>
              </div>
              <div className="stat-card stat-green">
                <span>Total Uang Masuk (Omzet)</span>
                <strong><AnimatedNumber value={summary.omzet} /></strong>
              </div>
              <div className="stat-card stat-blue">
                <span>Laba Kotor</span>
                <strong><AnimatedNumber value={summary.laba} /></strong>
              </div>
              <div className="stat-card stat-red">
                <span>Total Pengeluaran</span>
                <strong><AnimatedNumber value={totalExpense} prefix="-Rp " /></strong>
              </div>
              <div className="stat-card stat-green" style={{ borderWidth: 2 }}>
                <span>Laba Bersih</span>
                <strong><AnimatedNumber value={summary.laba - totalExpense} /></strong>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
              <div>
                <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>Daftar Transaksi</h3>
                <div style={{ overflowX: 'auto', width: '100%' }}>
                  <table style={{ boxShadow: 'none', border: '1px solid var(--border-color)' }}>
                    <thead><tr><th>Invoice</th><th>Pelanggan</th><th>Total Tagihan</th><th>Status</th></tr></thead>
                    <tbody>
                      {reportData.length === 0 ? (
                        <tr><td colSpan="4" style={{ textAlign: 'center', padding: 24 }}>Tidak ada transaksi di periode ini.</td></tr>
                      ) : reportData.map(inv => (
                        <tr key={inv.id}>
                          <td><strong>{inv.invoice_number}</strong><br/><small style={{ color: 'var(--text-muted)' }}>{formatTanggal(inv.issue_date)}</small></td>
                          <td>{inv.customers?.name || 'Umum'}</td>
                          <td>{formatRupiah(inv.total)}</td>
                          <td><span style={{ textTransform: 'uppercase', fontWeight: 'bold', fontSize: 12, color: inv.status === 'paid' ? '#10b981' : '#f59e0b' }}>{inv.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>Produk Terlaris</h3>
                <div style={{ overflowX: 'auto', width: '100%' }}>
                  <table style={{ boxShadow: 'none', border: '1px solid var(--border-color)' }}>
                    <thead><tr><th>Produk</th><th>Qty</th></tr></thead>
                    <tbody>
                      {topProducts.length === 0 ? (
                        <tr><td colSpan="2" style={{ textAlign: 'center', padding: 24 }}>Belum ada produk terjual.</td></tr>
                      ) : topProducts.map((p, i) => (<tr key={i}><td>{p.name}</td><td><strong>{p.qty}</strong></td></tr>))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}