import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import html2pdf from 'html2pdf.js'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useUI } from '../context/UIContext'
import { formatRupiah, formatTanggal, formatNumberInput } from '../lib/format'
import { FaWhatsapp, FaTrash, FaPrint, FaShareAlt } from 'react-icons/fa'
import { logActivity } from '../lib/logger'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'

export default function InvoiceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const { showConfirm, showToast } = useUI()

  const [invoice, setInvoice] = useState(null)
  const [items, setItems] = useState([])
  const [payments, setPayments] = useState([])
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)

  const [isPayModalOpen, setIsPayModalOpen] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [selectedReceipt, setSelectedReceipt] = useState(null)

  useEffect(() => { if (session && id) fetchInvoice() }, [session, id])

  async function fetchInvoice() {
    setLoading(true)
    const { data: profData } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    setProfile(profData)

    const { data: invData, error } = await supabase.from('invoices').select('*, customers(*), invoice_items(*, products(name))').eq('id', id).single()
    
    if (error) { 
      showToast('Gagal memuat: ' + error.message, 'error')
      navigate('/invoices') 
    } else {
      setInvoice(invData)
      setItems(invData.invoice_items || [])
      const { data: payData } = await supabase.from('invoice_payments').select('*').eq('invoice_id', id).order('created_at', { ascending: false })
      setPayments(payData || [])
    }
    setLoading(false)
  }

  function handleDownloadPdf() {
    const element = document.getElementById('invoice-paper')
    html2pdf().set({ margin: 0.5, filename: `Invoice-${invoice.invoice_number.replace(/\//g, '-')}.pdf`, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' } }).from(element).save()
  }

  function handleDownloadReceipt(payment) {
    const element = document.getElementById('receipt-paper')
    html2pdf().set({ margin: 0.5, filename: `Kwitansi-${payment.id}.pdf`, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'in', format: 'a5', orientation: 'landscape' } }).from(element).save()
  }

  function getPublicLink() { return `${window.location.origin}/#/public-invoice/${encodeURIComponent(invoice.invoice_number)}` }

  function handleShareLink() {
    navigator.clipboard.writeText(getPublicLink())
    showToast('Link publik berhasil di-copy! Kirim ke pelanggan.', 'success')
  }

  function getWhatsAppLink() {
    if (!invoice.customers?.phone) return '#'
    let phone = invoice.customers.phone.replace(/\D/g, '')
    if (phone.startsWith('0')) phone = '62' + phone.slice(1)
    const link = getPublicLink()
    const pesan = `Halo *${invoice.customers.name}*,\n\nBerikut kami kirimkan Invoice *${invoice.invoice_number}* dengan total *${formatRupiah(invoice.total)}*.\n\nStatus: *${invoice.status.toUpperCase()}*\n\nAnda dapat melihat rincian invoice secara online melalui link berikut:\n${link}\n\nTerima kasih.`
    return `https://wa.me/${phone}?text=${encodeURIComponent(pesan)}`
  }

  async function handleSavePayment(e) {
    e.preventDefault()
    const sisa = invoice.total - invoice.paid_amount
    const bayar = Number(payAmount.replace(/\./g, ''))
    if (isNaN(bayar) || bayar <= 0 || bayar > sisa) return showToast('Nominal tidak valid atau melebihi sisa!', 'error')

    setIsUpdating(true)
    const newPaid = Number(invoice.paid_amount) + bayar
    const newStatus = newPaid >= invoice.total ? 'paid' : 'partial'
    
    await supabase.from('invoice_payments').insert([{ invoice_id: invoice.id, user_id: session.user.id, amount: bayar, payment_method: 'transfer' }])
    await supabase.from('invoices').update({ paid_amount: newPaid, status: newStatus }).eq('id', invoice.id)
    await logActivity(session.user.id, 'BAYAR', `Menerima ${formatRupiah(bayar)} untuk invoice ${invoice.invoice_number}`)
    
    setIsPayModalOpen(false)
    showToast('Pembayaran dicatat!', 'success')
    fetchInvoice()
    setIsUpdating(false)
  }

  async function handleDelete() {
    if (!(await showConfirm('Hapus Invoice', 'Hapus invoice ini? Stok akan dikembalikan.'))) return
    setIsUpdating(true)
    if (invoice.status !== 'draft') {
      for (const item of items) {
        if (item.product_id) {
          const { data: prod } = await supabase.from('products').select('stock').eq('id', item.product_id).single()
          if (prod) {
            await supabase.from('products').update({ stock: prod.stock + item.quantity }).eq('id', item.product_id)
            await supabase.from('stock_movements').insert([{ user_id: session.user.id, product_id: item.product_id, change: item.quantity, reason: 'invoice_deleted' }])
          }
        }
      }
    }
    await supabase.from('invoices').delete().eq('id', invoice.id)
    showToast('Invoice dihapus!', 'success')
    navigate('/invoices')
  }

  if (loading) return <div className="skeleton" style={{ height: 600, marginTop: 24 }}></div>
  if (!invoice) return <p>Invoice tidak ditemukan.</p>

  const sisaTagihan = invoice.total - invoice.paid_amount
  const colors = { draft: '#64748b', sent: '#3b82f6', partial: '#eab308', paid: '#22c55e', overdue: '#ef4444' }
  
  return (
    <div>
      <Modal isOpen={isPayModalOpen} onClose={() => setIsPayModalOpen(false)} title="Catat Pembayaran">
        <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>Sisa Tagihan: <strong style={{ color: '#ef4444', fontSize: 18 }}>{formatRupiah(sisaTagihan)}</strong></p>
        <form onSubmit={handleSavePayment}>
          <input type="text" value={formatNumberInput(payAmount)} onChange={e => setPayAmount(e.target.value.replace(/\./g, ''))} style={{ width: '100%', fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 24, padding: '16px' }} placeholder="0" autoFocus />
          <div style={{ display: 'flex', gap: 12 }}>
            <Button type="button" variant="danger" onClick={async () => { if (await showConfirm('Batal', 'Yakin ingin membatalkan pembayaran ini?')) setIsPayModalOpen(false) }} style={{ flex: 1, justifyContent: 'center', padding: '12px' }}>Batal</Button>
            <Button type="submit" variant="success" disabled={isUpdating} style={{ flex: 1, justifyContent: 'center', padding: '12px' }}>{isUpdating ? 'Menyimpan...' : 'Simpan'}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!selectedReceipt} onClose={() => setSelectedReceipt(null)} title="Kwitansi Pembayaran" maxWidth={700}>
        <div id="receipt-paper" style={{ padding: 40, borderRadius: 8, background: 'white', color: '#1f2937' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #111827', paddingBottom: 20, marginBottom: 24 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 28 }}>{profile?.business_name || 'Bisnis Saya'}</h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>{profile?.address}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <h3 style={{ margin: 0, color: '#4f46e5', fontSize: 24 }}>KWITANSI</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>No: KW-{selectedReceipt?.id.toString().padStart(5, '0')}</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 16, marginBottom: 40 }}>
            <div style={{ color: '#6b7280' }}>Telah Diterima Dari:</div>
            <div style={{ fontWeight: 700 }}>{invoice.customers?.name || 'Umum'}</div>
            <div style={{ color: '#6b7280' }}>Uang Sejumlah:</div>
            <div style={{ fontWeight: 800, fontSize: 24, color: '#4f46e5' }}>{formatRupiah(selectedReceipt?.amount)}</div>
            <div style={{ color: '#6b7280' }}>Untuk Pembayaran:</div>
            <div>Invoice <strong>{invoice.invoice_number}</strong></div>
            <div style={{ color: '#6b7280' }}>Tanggal:</div>
            <div>{selectedReceipt && new Date(selectedReceipt.payment_date).toLocaleString('id-ID')}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 48 }}>
            <div style={{ textAlign: 'center', width: 200 }}><p style={{ marginBottom: 64 }}>Penerima,</p><p style={{ borderTop: '1px solid #111827', paddingTop: 8 }}>( {profile?.business_name} )</p></div>
            <div style={{ textAlign: 'center', width: 200 }}><p style={{ marginBottom: 64 }}>Penyetor,</p><p style={{ borderTop: '1px solid #111827', paddingTop: 8 }}>( {invoice.customers?.name} )</p></div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <Button variant="secondary" onClick={() => setSelectedReceipt(null)} style={{ flex: 1, justifyContent: 'center' }}>Tutup</Button>
          <Button variant="solid" onClick={() => handleDownloadReceipt(selectedReceipt)} style={{ flex: 2, justifyContent: 'center' }}><FaPrint /> Download PDF Kwitansi</Button>
        </div>
      </Modal>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Link to="/invoices" className="btn-back">&larr; Kembali</Link>
          <h1 style={{ margin: 0, fontSize: 24 }}>Detail Invoice</h1>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {profile?.role === 'owner' && (
            <Button variant="danger" onClick={handleDelete} disabled={isUpdating}><FaTrash /> Hapus</Button>
          )}
          
          <button 
            onClick={handleShareLink} 
            className="btn-action btn-action-primary" 
            style={{ background: 'var(--primary)', color: 'white', padding: '10px 16px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 'bold', border: 'none', cursor: 'pointer' }}
          >
            <FaShareAlt size={18} /> Share Link
          </button>

          <a href={getWhatsAppLink()} target="_blank" rel="noopener noreferrer" className="btn-action btn-action-green" style={{ textDecoration: 'none', padding: '10px 16px', borderRadius: 8 }}>
            <FaWhatsapp size={18} /> WhatsApp
          </a>
          
          <Button variant="primary" onClick={handleDownloadPdf}><FaPrint /> PDF</Button>
        </div>
      </div>

      {invoice.status !== 'paid' && (
        <div className="alert-warning">
          <div className="alert-warning-text">
            <h4>Tagihan Belum Lunas</h4>
            <p>Total: <strong>{formatRupiah(invoice.total)}</strong> | Dibayar: <strong>{formatRupiah(invoice.paid_amount)}</strong> | Sisa: <strong>{formatRupiah(sisaTagihan)}</strong></p>
          </div>
          <div className="alert-warning-actions">
            <Button variant="primary" onClick={() => { setPayAmount(sisaTagihan.toString()); setIsPayModalOpen(true) }}>💵 Catat Pembayaran</Button>
          </div>
        </div>
      )}

      <div id="invoice-paper" style={{ background: 'var(--card-bg)', padding: '40px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid var(--border-color)', paddingBottom: 20, marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
              {profile?.logo_url && <img src={profile.logo_url} alt="Logo" style={{ height: 60, objectFit: 'contain', mixBlendMode: 'multiply' }} />}
              <h2 style={{ margin: 0, color: 'var(--primary)', fontSize: 28 }}>INVOICE</h2>
            </div>
            <p style={{ margin: 0, fontWeight: 'bold' }}>{profile?.business_name || 'Bisnis Saya'}</p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)', maxWidth: 250 }}>{profile?.address}<br/>{profile?.phone && `Telp: ${profile.phone} | `}{profile?.email}</p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>No. Inv: {invoice.invoice_number}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: '0 0 4px' }}><strong>Tanggal:</strong> {formatTanggal(invoice.issue_date)}</p>
            {invoice.due_date && <p style={{ margin: '0 0 4px', color: 'red' }}><strong>Jatuh Tempo:</strong> {formatTanggal(invoice.due_date)} {invoice.due_time && `(${invoice.due_time})`}</p>}
            <div style={{ marginTop: 8 }}><span className="badge" style={{ background: colors[invoice.status] + '20', color: colors[invoice.status] }}><span className="badge-dot" style={{ background: colors[invoice.status] }}></span>{invoice.status}</span></div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <p style={{ margin: '0 0 8px', color: 'var(--text-muted)', fontSize: 13, textTransform: 'uppercase' }}>Ditagihkan Kepada:</p>
            <h3 style={{ margin: '0 0 4px' }}>{invoice.customers?.name || 'Pelanggan Umum'}</h3>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>{invoice.customers?.phone}</p>
            <p style={{ margin: 0, color: 'var(--text-muted)', maxWidth: 200 }}>{invoice.customers?.address}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: '0 0 8px', color: 'var(--text-muted)', fontSize: 13, textTransform: 'uppercase' }}>Metode:</p>
            <h3 style={{ margin: '0 0 4px', textTransform: 'uppercase' }}>{invoice.payment_method}</h3>
            {invoice.payment_method === 'hutang' && <p style={{ margin: 0, color: 'red', fontSize: 13 }}>Sisa: {formatRupiah(sisaTagihan)}</p>}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ marginBottom: 32, boxShadow: 'none', border: '1px solid var(--border-color)' }}>
            <thead><tr><th>Deskripsi</th><th width="80" style={{ textAlign: 'center' }}>Qty</th><th width="150" style={{ textAlign: 'right' }}>Harga</th><th width="150" style={{ textAlign: 'right' }}>Subtotal</th></tr></thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i}>
                  <td><strong>{item.description}</strong>{item.products && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.products.name}</div>}</td>
                  <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                  <td style={{ textAlign: 'right' }}>{formatRupiah(item.unit_price)}</td>
                  <td style={{ textAlign: 'right' }}>{formatRupiah(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: '100%', maxWidth: 300 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}><span style={{ color: 'var(--text-muted)' }}>Subtotal</span><strong>{formatRupiah(invoice.subtotal)}</strong></div>
            {invoice.discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)', color: 'red' }}><span>Diskon</span><strong>-{formatRupiah(invoice.discount)}</strong></div>}
            {invoice.tax_amount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}><span style={{ color: 'var(--text-muted)' }}>Pajak ({invoice.tax_percent}%)</span><strong>{formatRupiah(invoice.tax_amount)}</strong></div>}
            {invoice.shipping > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}><span style={{ color: 'var(--text-muted)' }}>Ongkir</span><strong>{formatRupiah(invoice.shipping)}</strong></div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', fontSize: 20, color: 'var(--primary)', fontWeight: 'bold' }}><span>Total</span><span>{formatRupiah(invoice.total)}</span></div>
          </div>
        </div>

        <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px dashed var(--border-color)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>
          <div>{invoice.notes && <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}><strong>Catatan:</strong> {invoice.notes}</p>}</div>
          <div style={{ textAlign: 'right' }}>{profile?.bank_info && <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}><strong>Transfer:</strong><br/>{profile.bank_info}</p>}</div>
        </div>
      </div>

      {payments.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 20, marginBottom: 16 }}>Riwayat Pembayaran</h2>
          <div className="card" style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>Tanggal</th><th>Nominal</th><th>Metode</th><th>Aksi</th></tr></thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id}>
                    <td>{new Date(p.payment_date).toLocaleString('id-ID')}</td>
                    <td><strong style={{ color: '#10b981' }}>{formatRupiah(p.amount)}</strong></td>
                    <td style={{ textTransform: 'uppercase' }}>{p.payment_method}</td>
                    <td><Button variant="secondary" onClick={() => setSelectedReceipt(p)}><FaPrint /> Cetak Kwitansi</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}