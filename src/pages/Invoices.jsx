import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatRupiah, formatTanggal } from '../lib/format'
import { FaEye, FaPlus, FaFileInvoiceDollar } from 'react-icons/fa'
import Button from '../components/ui/Button'

export default function Invoices() {
  const { session } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (session) fetchInvoices()
  }, [session])

  async function fetchInvoices() {
    setLoading(true)
    const { data } = await supabase.from('invoices').select('*, customers(name)').order('created_at', { ascending: false })
    if (data) setInvoices(data)
    setLoading(false)
  }

  const getStatusBadge = (status) => {
    const colors = { draft: '#64748b', sent: '#3b82f6', partial: '#eab308', paid: '#22c55e', overdue: '#ef4444' }
    return (
      <span style={{ 
        background: colors[status] + '20', color: colors[status], 
        padding: '6px 12px', borderRadius: '999px', fontSize: '12px', textTransform: 'uppercase', fontWeight: 'bold'
      }}>
        {status}
      </span>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <h1 style={{ margin: 0 }}>Daftar Invoice</h1>
        <Link to="/invoices/new" style={{ textDecoration: 'none' }}>
          <Button variant="solid" style={{ padding: '12px 24px' }}><FaPlus style={{ marginRight: 6 }} /> Buat Invoice</Button>
        </Link>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? <div className="skeleton" style={{ height: 300, width: '100%' }}></div> : (
          // Tabel dibungkus dengan class responsive agar bisa digeser di HP
          <div className="table-responsive">
            <table>
              <thead>
                <tr><th>No. Invoice</th><th>Pelanggan</th><th>Tanggal</th><th>Total</th><th>Status</th><th>Aksi</th></tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '60px 20px' }}>
                      <FaFileInvoiceDollar size={48} style={{ color: 'var(--primary)', opacity: 0.2, marginBottom: 16 }} />
                      <h3 style={{ margin: '0 0 8px', color: 'var(--text-muted)' }}>Belum ada invoice</h3>
                      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>Invoice yang kamu buat akan muncul di sini.</p>
                    </td>
                  </tr>
                ) : invoices.map(inv => (
                  <tr key={inv.id}>
                    <td><strong>{inv.invoice_number}</strong></td>
                    <td>{inv.customers?.name || 'Umum'}</td>
                    <td>{formatTanggal(inv.issue_date)}</td>
                    <td><strong>{formatRupiah(inv.total)}</strong></td>
                    <td>{getStatusBadge(inv.status)}</td>
                    <td>
                      <Link to={`/invoices/${inv.id}`} style={{ textDecoration: 'none' }}>
                        <Button variant="primary"><FaEye /> Detail</Button>
                      </Link>
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