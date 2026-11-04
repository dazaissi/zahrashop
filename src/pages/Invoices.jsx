import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatRupiah, formatTanggal } from '../lib/format'
import { FaEye, FaPlus } from 'react-icons/fa'
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
      <span className="badge" style={{ background: colors[status] + '20', color: colors[status] }}>
        <span className="badge-dot" style={{ background: colors[status] }}></span>
        {status}
      </span>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Daftar Invoice</h1>
        <Link to="/invoices/new" style={{ textDecoration: 'none' }}>
          <Button variant="solid"><FaPlus style={{ marginRight: 6 }} /> Buat Invoice</Button>
        </Link>
      </div>

      <div className="card">
        {loading ? <div className="skeleton" style={{ height: 300, width: '100%' }}></div> : (
          <table>
            <thead>
              <tr><th>No. Invoice</th><th>Pelanggan</th><th>Tanggal</th><th>Total</th><th>Status</th><th>Aksi</th></tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: 24 }}>Belum ada invoice.</td></tr>
              ) : invoices.map(inv => (
                <tr key={inv.id}>
                  <td><strong>{inv.invoice_number}</strong></td>
                  <td>{inv.customers?.name || 'Umum'}</td>
                  <td>{formatTanggal(inv.issue_date)}</td>
                  <td>{formatRupiah(inv.total)}</td>
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
        )}
      </div>
    </div>
  )
}