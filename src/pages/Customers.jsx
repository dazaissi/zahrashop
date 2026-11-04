import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useUI } from '../context/UIContext'
import { formatRupiah, formatTanggal } from '../lib/format'
import { FaWhatsapp, FaHistory, FaEdit, FaTrash } from 'react-icons/fa'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'

export default function Customers() {
  const { session } = useAuth()
  const { showConfirm, showToast } = useUI()
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [id, setId] = useState(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [historyInvoices, setHistoryInvoices] = useState([])
  const [historyPayments, setHistoryPayments] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  useEffect(() => { if (session) fetchCustomers() }, [session])

  async function fetchCustomers() {
    setLoading(true)
    const { data, error } = await supabase.from('customers').select('*').order('name')
    if (error) showToast("Gagal memuat data: " + error.message, 'error')
    else setCustomers(data)
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setIsSubmitting(true)
    const payload = { name, email: email || null, phone: phone || null, address: address || null, user_id: session.user.id }
    
    let errorMsg = null
    if (id) {
      const { error } = await supabase.from('customers').update(payload).eq('id', id)
      if (error) errorMsg = error.message
    } else {
      const { error } = await supabase.from('customers').insert([payload])
      if (error) errorMsg = error.message
    }

    if (errorMsg) showToast('Gagal menyimpan: ' + errorMsg, 'error')
    else { resetForm(); fetchCustomers(); showToast('Data pelanggan disimpan!', 'success') }
    setIsSubmitting(false)
  }

  async function handleDelete(id) {
    if (await showConfirm('Hapus Pelanggan', 'Yakin ingin menghapus pelanggan ini?')) {
      await supabase.from('customers').delete().eq('id', id)
      showToast('Pelanggan dihapus', 'success')
      fetchCustomers()
    }
  }

  function editCustomer(c) {
    setId(c.id); setName(c.name); setEmail(c.email || ''); setPhone(c.phone || ''); setAddress(c.address || '')
  }

  function resetForm() { setId(null); setName(''); setEmail(''); setPhone(''); setAddress('') }

  function getWhatsAppLink(phoneStr) {
    if (!phoneStr) return '#'
    let formatted = phoneStr.replace(/\D/g, '')
    if (formatted.startsWith('0')) formatted = '62' + formatted.slice(1)
    return `https://wa.me/${formatted}`
  }

  async function openHistory(customer) {
    setSelectedCustomer(customer)
    setLoadingHistory(true)
    const { data: invData } = await supabase.from('invoices').select('*').eq('customer_id', customer.id).order('issue_date', { ascending: false })
    setHistoryInvoices(invData || [])
    if (invData && invData.length > 0) {
      const invIds = invData.map(i => i.id)
      const { data: payData } = await supabase.from('invoice_payments').select('*, invoices(invoice_number)').in('invoice_id', invIds).order('payment_date', { ascending: false })
      setHistoryPayments(payData || [])
    } else setHistoryPayments([])
    setLoadingHistory(false)
  }

  const totalBelanja = historyInvoices.reduce((sum, inv) => sum + Number(inv.paid_amount), 0)
  const totalHutang = historyInvoices.reduce((sum, inv) => sum + (Number(inv.total) - Number(inv.paid_amount)), 0)

  return (
    <div>
      <Modal isOpen={!!selectedCustomer} onClose={() => setSelectedCustomer(null)} title={`Riwayat: ${selectedCustomer?.name}`} maxWidth={900}>
        {loadingHistory ? <div className="skeleton" style={{ height: 200 }}></div> : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: 16, borderRadius: 12 }}>
                <p style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>Total Belanja</p>
                <h2 style={{ margin: 0, color: '#10b981' }}>{formatRupiah(totalBelanja)}</h2>
              </div>
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: 16, borderRadius: 12 }}>
                <p style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>Sisa Hutang</p>
                <h2 style={{ margin: 0, color: '#ef4444' }}>{formatRupiah(totalHutang)}</h2>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, maxHeight: '50vh', overflowY: 'auto' }}>
              <div>
                <h4 style={{ margin: '0 0 12px' }}>Transaksi</h4>
                <table style={{ minWidth: '100%' }}>
                  <thead><tr><th>Invoice</th><th>Total</th><th>Status</th></tr></thead>
                  <tbody>
                    {historyInvoices.map(inv => (
                      <tr key={inv.id}>
                        <td><strong>{inv.invoice_number}</strong><br/><small>{formatTanggal(inv.issue_date)}</small></td>
                        <td>{formatRupiah(inv.total)}</td>
                        <td><span style={{ textTransform: 'uppercase', fontSize: 11, color: inv.status === 'paid' ? '#10b981' : '#f59e0b', fontWeight: 'bold' }}>{inv.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <h4 style={{ margin: '0 0 12px' }}>Pembayaran</h4>
                <table style={{ minWidth: '100%' }}>
                  <thead><tr><th>Tanggal</th><th>Nominal</th></tr></thead>
                  <tbody>
                    {historyPayments.map(p => (
                      <tr key={p.id}><td>{new Date(p.payment_date).toLocaleDateString('id-ID')}</td><td><strong style={{ color: '#10b981' }}>{formatRupiah(p.amount)}</strong></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </Modal>

      <h1>Data Pelanggan</h1>
      
      <div className="card" style={{ marginBottom: 24, maxWidth: 600 }}>
        <h3>{id ? 'Edit Pelanggan' : 'Tambah Pelanggan Baru'}</h3>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
          <input required placeholder="Nama Pelanggan *" value={name} onChange={e => setName(e.target.value)} />
          <input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          <input placeholder="No. HP (Misal: 08123456789)" value={phone} onChange={e => setPhone(e.target.value)} />
          <textarea placeholder="Alamat" rows="2" value={address} onChange={e => setAddress(e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="submit" variant="solid" disabled={isSubmitting}>{isSubmitting ? 'Menyimpan...' : 'Simpan'}</Button>
            {id && <Button type="button" variant="secondary" onClick={resetForm}>Batal</Button>}
          </div>
        </form>
      </div>

      {loading ? <div className="skeleton" style={{ height: 200 }}></div> : (
        <table>
          <thead><tr><th>Nama</th><th>Kontak</th><th>Alamat</th><th>Aksi</th></tr></thead>
          <tbody>
            {customers.map(c => (
              <tr key={c.id}>
                <td><strong>{c.name}</strong></td>
                <td>
                  {c.phone ? <a href={getWhatsAppLink(c.phone)} target="_blank" rel="noopener noreferrer" style={{ color: '#25D366', textDecoration: 'none', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: 6 }}><FaWhatsapp size={18} /> {c.phone}</a> : '-'}
                  <br/><small style={{ color: 'var(--text-muted)' }}>{c.email}</small>
                </td>
                <td>{c.address}</td>
                <td>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button variant="primary" onClick={() => openHistory(c)}><FaHistory /> Riwayat</Button>
                    <Button variant="secondary" onClick={() => editCustomer(c)}><FaEdit /> Edit</Button>
                    <Button variant="danger" onClick={() => handleDelete(c.id)}><FaTrash /> Hapus</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}