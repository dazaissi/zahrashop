
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import html2pdf from 'html2pdf.js'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useUI } from '../context/UIContext'
import { formatRupiah, formatTanggal } from '../lib/format'
import Button from '../components/ui/Button'
import { FaFileExcel, FaPrint } from 'react-icons/fa'

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
    const incrementTime = 20
    const steps = duration / incrementTime
    let currentStep = 0

    if (end === 0) {
      setDisplayValue(0)
      return
    }

    const timer = setInterval(() => {
      currentStep++

      const progress = Math.min(currentStep / steps, 1)
      setDisplayValue(Math.floor(end * progress))

      if (progress >= 1) {
        setDisplayValue(end)
        clearInterval(timer)
      }
    }, incrementTime)

    return () => clearInterval(timer)
  }, [value])

  return (
    <span>
      {prefix}{Math.round(displayValue).toLocaleString('id-ID')}
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
  const [errorMessage, setErrorMessage] = useState('')

  const [reportData, setReportData] = useState([])
  const [summary, setSummary] = useState({
    omzet: 0,
    uangMasuk: 0,
    labaKotor: 0,
    piutang: 0,
    transaksi: 0
  })

  const [topProducts, setTopProducts] = useState([])
  const [businessName, setBusinessName] = useState('Bisnis Saya')
  const [totalExpense, setTotalExpense] = useState(0)

  useEffect(() => {
    if (session?.user?.id) {
      fetchReport()
    }
  }, [session, startDate, endDate])

  function setQuickFilter(type) {
    const today = new Date()
    let start = new Date(today)
    let end = new Date(today)

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

    setStartDate(getLocalDate(start))
    setEndDate(getLocalDate(end))
    setActiveFilter(type)
  }

  async function fetchReport() {
    if (!session?.user?.id) return

    setLoading(true)
    setErrorMessage('')

    try {
      if (startDate > endDate) {
        throw new Error('Tanggal awal tidak boleh melebihi tanggal akhir.')
      }

      // Periksa role sebelum mengambil data laporan.
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, business_name')
        .eq('id', session.user.id)
        .single()

      if (profileError) throw profileError

      setUserRole(profile?.role || null)

      if (profile?.role !== 'owner') {
        setAuthorized(false)
        setReportData([])
        setTopProducts([])
        setSummary({
          omzet: 0,
          uangMasuk: 0,
          labaKotor: 0,
          piutang: 0,
          transaksi: 0
        })
        setTotalExpense(0)
        return
      }

      setAuthorized(true)

      if (profile.business_name) {
        setBusinessName(profile.business_name)
      }

      const [
        { data, error },
        { data: expData, error: expError }
      ] = await Promise.all([
        supabase
          .from('invoices')
          .select('*, customers(name), invoice_items(*, products(name, cost))')
          .gte('issue_date', startDate)
          .lte('issue_date', endDate)
          .neq('status', 'draft'),

        supabase
          .from('expenses')
          .select('amount')
          .gte('date', startDate)
          .lte('date', endDate)
      ])

      if (error) throw error
      if (expError) throw expError

      const invoices = data || []
      const expenses = expData || []

      const totalPengeluaran = expenses.reduce(
        (sum, expense) => sum + (Number(expense.amount) || 0),
        0
      )

      let totalOmzet = 0
      let totalUangMasuk = 0
      let totalLabaKotor = 0
      let totalPiutang = 0

      const productMap = {}

      invoices.forEach(inv => {
        const total = Number(inv.total) || 0
        const paid = Number(inv.paid_amount) || 0

        totalOmzet += total
        totalUangMasuk += paid
        totalPiutang += Math.max(0, total - paid)

        ;(inv.invoice_items || []).forEach(item => {
          const qty = Number(item.quantity) || 0
          const jual = Number(item.subtotal) || 0
          const modal = Number(item.products?.cost) || 0

          totalLabaKotor += jual - (modal * qty)

          const productId = item.product_id

          if (productId) {
            if (!productMap[productId]) {
              productMap[productId] = {
                name:
                  item.products?.name ||
                  item.description ||
                  'Produk tidak diketahui',
                qty: 0,
                total: 0
              }
            }

            productMap[productId].qty += qty
            productMap[productId].total += jual
          }
        })
      })

      setSummary({
        omzet: totalOmzet,
        uangMasuk: totalUangMasuk,
        labaKotor: totalLabaKotor,
        piutang: totalPiutang,
        transaksi: invoices.length
      })

      setTotalExpense(totalPengeluaran)
      setReportData(invoices)

      setTopProducts(
        Object.values(productMap)
          .sort((a, b) => b.qty - a.qty)
          .slice(0, 10)
      )
    } catch (error) {
      console.error('Gagal memuat laporan:', error)
      setErrorMessage(
        error.message || 'Terjadi kesalahan saat memuat laporan.'
      )
      showToast('Gagal memuat laporan: ' + error.message, 'error')
    } finally {
      setLoading(false)
      setCheckingRole(false)
    }
  }

  function handleExportCSV() {
    if (reportData.length === 0) {
      return showToast('Tidak ada data untuk diexport.', 'error')
    }

    const headers = [
      'No Invoice',
      'Tanggal',
      'Pelanggan',
      'Status',
      'Total Tagihan',
      'Uang Masuk',
      'Sisa Piutang'
    ]

    const escapeCSV = value => {
      const text = String(value ?? '')
      return `"${text.replace(/"/g, '""')}"`
    }

    const rows = reportData.map(inv => [
      inv.invoice_number,
      inv.issue_date,
      inv.customers?.name || 'Pelanggan Umum',
      inv.status,
      Number(inv.total) || 0,
      Number(inv.paid_amount) || 0,
      Math.max(
        0,
        (Number(inv.total) || 0) - (Number(inv.paid_amount) || 0)
      )
    ])

    const csvContent =
      '\uFEFF' +
      [headers, ...rows]
        .map(row => row.map(escapeCSV).join(','))
        .join('\n')

    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;'
    })

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
      margin: 0.5,
      filename: `Laporan_${startDate}_sampai_${endDate}.pdf`,
      image: {
        type: 'jpeg',
        quality: 0.98
      },
      html2canvas: {
        scale: 2,
        useCORS: true
      },
      jsPDF: {
        unit: 'in',
        format: 'a4',
        orientation: 'portrait'
      }
    }

    html2pdf().set(opt).from(element).save()
  }

  if (checkingRole || loading) {
    return (
      <div className="card">
        <div className="skeleton" style={{ height: 300, width: '100%' }} />
      </div>
    )
  }

  if (!authorized || userRole !== 'owner') {
    return (
      <div
        className="card"
        style={{
          textAlign: 'center',
          padding: 40
        }}
      >
        <h2 style={{ marginTop: 0 }}>Akses Ditolak</h2>

        <p style={{ color: 'var(--text-muted)' }}>
          Halaman laporan bisnis hanya dapat diakses oleh Owner.
        </p>

        <Link
          to="/dashboard"
          className="filter-btn active"
          style={{
            display: 'inline-block',
            textDecoration: 'none',
            marginTop: 12
          }}
        >
          Kembali ke Dashboard
        </Link>
      </div>
    )
  }

  const labaBersih = summary.labaKotor - totalExpense

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 16
        }}
      >
        <h1 style={{ margin: 0 }}>Laporan Bisnis</h1>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Button variant="success" onClick={handleExportCSV}>
            <FaFileExcel /> Export CSV
          </Button>

          <Button variant="danger" onClick={handleDownloadPdf}>
            <FaPrint /> Export PDF
          </Button>
        </div>
      </div>

      <div
        className="card"
        style={{
          marginBottom: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 20
        }}
      >
        <div className="filter-group">
          <button
            className={`filter-btn ${activeFilter === 'bulan-ini' ? 'active' : ''}`}
            onClick={() => setQuickFilter('bulan-ini')}
          >
            Bulan Ini
          </button>

          <button
            className={`filter-btn ${activeFilter === 'bulan-lalu' ? 'active' : ''}`}
            onClick={() => setQuickFilter('bulan-lalu')}
          >
            Bulan Lalu
          </button>

          <button
            className={`filter-btn ${activeFilter === '6-bulan' ? 'active' : ''}`}
            onClick={() => setQuickFilter('6-bulan')}
          >
            6 Bulan Terakhir
          </button>

          <button
            className={`filter-btn ${activeFilter === 'tahun-ini' ? 'active' : ''}`}
            onClick={() => setQuickFilter('tahun-ini')}
          >
            Tahun Ini
          </button>

          <button
            className={`filter-btn ${activeFilter === 'semua' ? 'active' : ''}`}
            onClick={() => setQuickFilter('semua')}
          >
            Semua Waktu
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 16,
            alignItems: 'center',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>
              Dari:
            </span>

            <input
              type="date"
              value={startDate}
              onChange={e => {
                setStartDate(e.target.value)
                setActiveFilter('manual')
              }}
              style={{
                width: 'auto',
                background: 'var(--bg-color)',
                padding: '8px 12px'
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>
              Sampai:
            </span>

            <input
              type="date"
              value={endDate}
              onChange={e => {
                setEndDate(e.target.value)
                setActiveFilter('manual')
              }}
              style={{
                width: 'auto',
                background: 'var(--bg-color)',
                padding: '8px 12px'
              }}
            />
          </div>
        </div>
      </div>

      {errorMessage ? (
        <div className="card" style={{ border: '1px solid #fecaca' }}>
          <p style={{ color: '#ef4444', marginTop: 0 }}>
            Gagal memuat laporan: {errorMessage}
          </p>

          <button className="filter-btn active" onClick={fetchReport}>
            Coba Lagi
          </button>
        </div>
      ) : (
        <div
          id="report-paper"
          style={{
            padding: 40,
            borderRadius: 8,
            boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
            border: '1px solid var(--border-color)',
            background: 'var(--card-bg)'
          }}
        >
          <div
            style={{
              textAlign: 'center',
              borderBottom: '2px solid var(--border-color)',
              paddingBottom: 20,
              marginBottom: 24
            }}
          >
            <h2
              style={{
                margin: '0 0 8px',
                color: 'var(--primary)',
                fontSize: 28,
                textTransform: 'uppercase'
              }}
            >
              Laporan Bisnis
            </h2>

            <h3 style={{ margin: '0 0 8px' }}>
              {businessName}
            </h3>

            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
              Periode: {formatTanggal(startDate)} - {formatTanggal(endDate)}
            </p>
          </div>

          <div className="report-stats-grid">
            <div
              className="stat-card"
              style={{
                background: 'var(--card-bg)',
                borderColor: 'var(--border-color)'
              }}
            >
              <span>Total Transaksi</span>
              <strong>{summary.transaksi} Invoice</strong>
            </div>

            <div className="stat-card stat-green">
              <span>Omzet Penjualan</span>
              <strong>
                <AnimatedNumber value={summary.omzet} />
              </strong>
            </div>

            <div className="stat-card stat-blue">
              <span>Uang Masuk</span>
              <strong>
                <AnimatedNumber value={summary.uangMasuk} />
              </strong>
            </div>

            <div className="stat-card">
              <span>Piutang</span>
              <strong>
                <AnimatedNumber value={summary.piutang} />
              </strong>
            </div>

            <div className="stat-card stat-blue">
              <span>Laba Kotor</span>
              <strong>
                <AnimatedNumber value={summary.labaKotor} />
              </strong>
            </div>

            <div className="stat-card stat-red">
              <span>Total Pengeluaran</span>
              <strong>
                <AnimatedNumber value={totalExpense} prefix="-Rp " />
              </strong>
            </div>

            <div
              className="stat-card stat-green"
              style={{ borderWidth: 2 }}
            >
              <span>Laba Bersih</span>
              <strong>
                <AnimatedNumber value={labaBersih} />
              </strong>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 24
            }}
          >
            <div>
              <h3
                style={{
                  borderBottom: '1px solid var(--border-color)',
                  paddingBottom: 8
                }}
              >
                Daftar Transaksi
              </h3>

              <div style={{ overflowX: 'auto', width: '100%' }}>
                <table
                  style={{
                    boxShadow: 'none',
                    border: '1px solid var(--border-color)'
                  }}
                >
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Pelanggan</th>
                      <th>Total Tagihan</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {reportData.length === 0 ? (
                      <tr>
                        <td
                          colSpan="4"
                          style={{
                            textAlign: 'center',
                            padding: 24
                          }}
                        >
                          Tidak ada transaksi di periode ini.
                        </td>
                      </tr>
                    ) : (
                      reportData.map(inv => (
                        <tr key={inv.id}>
                          <td>
                            <strong>{inv.invoice_number}</strong>
                            <br />
                            <small style={{ color: 'var(--text-muted)' }}>
                              {formatTanggal(inv.issue_date)}
                            </small>
                          </td>

                          <td>
                            {inv.customers?.name || 'Pelanggan Umum'}
                          </td>

                          <td>{formatRupiah(inv.total)}</td>

                          <td>
                            <span
                              style={{
                                textTransform: 'uppercase',
                                fontWeight: 'bold',
                                fontSize: 12,
                                color: inv.status === 'paid'
                                  ? '#10b981'
                                  : '#f59e0b'
                              }}
                            >
                              {inv.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3
                style={{
                  borderBottom: '1px solid var(--border-color)',
                  paddingBottom: 8
                }}
              >
                Produk Terlaris
              </h3>

              <div style={{ overflowX: 'auto', width: '100%' }}>
                <table
                  style={{
                    boxShadow: 'none',
                    border: '1px solid var(--border-color)'
                  }}
                >
                  <thead>
                    <tr>
                      <th>Produk</th>
                      <th>Qty</th>
                      <th>Total Penjualan</th>
                    </tr>
                  </thead>

                  <tbody>
                    {topProducts.length === 0 ? (
                      <tr>
                        <td
                          colSpan="3"
                          style={{
                            textAlign: 'center',
                            padding: 24
                          }}
                        >
                          Belum ada produk terjual.
                        </td>
                      </tr>
                    ) : (
                      topProducts.map((product, index) => (
                        <tr key={`${product.name}-${index}`}>
                          <td>{product.name}</td>
                          <td>
                            <strong>{product.qty}</strong>
                          </td>
                          <td>{formatRupiah(product.total)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
