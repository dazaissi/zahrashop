import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useUI } from '../context/UIContext'
import { formatRupiah, formatNumberInput } from '../lib/format'
import { generateDynamicQris } from '../lib/qris'
import BarcodeScanner from '../components/BarcodeScanner'
import { logActivity } from '../lib/logger'
import { FaBarcode, FaPlus, FaSave, FaTrash } from 'react-icons/fa'
import Button from '../components/ui/Button'

const STATIC_QRIS = "00020101021126570011ID.DANA.WWW011893600915315843978402091584397840303UMI51440014ID.CO.QRIS.WWW0215ID10210814007440303UMI5204729853033605802ID5914Stella's Store6012Kota Bandung6105402656304E9BC"

export default function InvoiceForm() {
  const { session } = useAuth()
  const { showToast } = useUI()
  const navigate = useNavigate()
  
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showScanner, setShowScanner] = useState(false)

  const [customerId, setCustomerId] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('Memuat...')
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0])
  
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [cashTendered, setCashTendered] = useState('') 
  const [dpType, setDpType] = useState('nominal')
  const [paidAmount, setPaidAmount] = useState('') 
  const [isQrisPaid, setIsQrisPaid] = useState(false) 
  const [splitPayments, setSplitPayments] = useState([{ method: 'cash', amount: '' }])

  const [tempoMode, setTempoMode] = useState('durasi')
  const [tempoDays, setTempoDays] = useState(3)
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [notes, setNotes] = useState('')

  const [taxType, setTaxType] = useState('persen')
  const [taxValue, setTaxValue] = useState('')
  const [discountType, setDiscountType] = useState('persen')
  const [discount, setDiscount] = useState('')
  const [shipping, setShipping] = useState('')
  
  const [items, setItems] = useState([{ product_id: '', description: '', quantity: 1, unit_price: '', subtotal: 0 }])

  useEffect(() => { if (session) { fetchCustomers(); fetchProducts(); generateInvoiceNumber() } }, [session])
  useEffect(() => { if (paymentMethod !== 'qris') setIsQrisPaid(false) }, [paymentMethod])
  useEffect(() => {
    if (paymentMethod === 'hutang' && tempoMode === 'durasi') {
      const date = new Date(issueDate); date.setDate(date.getDate() + Number(tempoDays))
      setDueDate(date.toISOString().split('T')[0])
      const now = new Date(); setDueTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)
    }
  }, [tempoDays, tempoMode, issueDate, paymentMethod])

  async function fetchCustomers() { const { data } = await supabase.from('customers').select('*').order('name'); if (data) setCustomers(data) }
  async function fetchProducts() { const { data } = await supabase.from('products').select('*').order('name'); if (data) setProducts(data) }

  async function generateInvoiceNumber() {
    const prefix = `INV/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/`
    const { data } = await supabase.from('invoices').select('invoice_number').like('invoice_number', `${prefix}%`).order('invoice_number', { ascending: false }).limit(1)
    if (data && data.length > 0) {
      const lastNumber = parseInt(data[0].invoice_number.split('/').pop(), 10)
      if (!isNaN(lastNumber)) { setInvoiceNumber(`${prefix}${String(lastNumber + 1).padStart(3, '0')}`); return }
    }
    setInvoiceNumber(`${prefix}001`)
  }

  function handleBarcodeScan(scannedCode) {
    const found = products.find(p => p.sku === scannedCode)
    if (found) {
      const existIdx = items.findIndex(item => item.product_id === String(found.id))
      if (existIdx !== -1) {
        const newItems = [...items]; newItems[existIdx].quantity += 1; newItems[existIdx].subtotal = newItems[existIdx].quantity * newItems[existIdx].unit_price; setItems(newItems)
      } else {
        const emptyIdx = items.findIndex(item => !item.product_id)
        const newItem = { product_id: String(found.id), description: found.name, quantity: 1, unit_price: found.price, subtotal: found.price }
        if (emptyIdx !== -1) { const newItems = [...items]; newItems[emptyIdx] = newItem; setItems(newItems) }
        else setItems([...items, newItem])
      }
      setShowScanner(false)
    } else showToast(`Barcode/SKU "${scannedCode}" tidak ditemukan.`, 'error')
  }

  function handleItemChange(index, field, value) {
    const newItems = [...items]; newItems[index][field] = value
    if (field === 'product_id') {
      const p = products.find(p => p.id === Number(value))
      if (p) { newItems[index].unit_price = p.price; newItems[index].description = p.name }
    }
    newItems[index].subtotal = (Number(newItems[index].quantity) || 0) * (Number(newItems[index].unit_price) || 0)
    setItems(newItems)
  }

  function handleAddSplit() { setSplitPayments([...splitPayments, { method: 'cash', amount: '' }]) }
  function handleRemoveSplit(index) { if (splitPayments.length > 1) setSplitPayments(splitPayments.filter((_, i) => i !== index)) }
  function handleSplitChange(index, field, value) { const newSplits = [...splitPayments]; newSplits[index][field] = value; setSplitPayments(newSplits) }

  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0)
  const safeDiscountInput = Number(discount.replace(/\./g, '')) || 0
  const safeDiscount = discountType === 'persen' ? (subtotal * safeDiscountInput) / 100 : safeDiscountInput
  const safeTaxInput = Number(taxValue.replace(/\./g, '')) || 0
  const taxAmount = taxType === 'persen' ? (subtotal - safeDiscount) * (safeTaxInput / 100) : safeTaxInput
  const safeShipping = Number(shipping.replace(/\./g, '')) || 0
  const grandTotal = subtotal - safeDiscount + taxAmount + safeShipping
  
  const totalSplitPaid = splitPayments.reduce((sum, p) => sum + (Number(p.amount.replace(/\./g, '')) || 0), 0)
  const remainingAmount = grandTotal - totalSplitPaid
  const safeDpInput = Number(paidAmount.replace(/\./g, '')) || 0
  const dpAmount = dpType === 'persen' ? (grandTotal * safeDpInput) / 100 : safeDpInput
  const cashTenderedNumber = Number(cashTendered.replace(/\./g, '')) || 0
  const changeAmount = paymentMethod === 'cash' && cashTenderedNumber > grandTotal ? cashTenderedNumber - grandTotal : 0
  const dynamicQrisString = paymentMethod === 'qris' && grandTotal > 0 ? generateDynamicQris(STATIC_QRIS, grandTotal) : ''

  async function handleSubmit(e) {
    e.preventDefault()
    if (isSubmitting) return

    if (paymentMethod === 'split' && totalSplitPaid < grandTotal) return showToast(`Total pembayaran kurang dari Tagihan!`, 'error')

    let invoiceStatus = 'draft', finalPaidAmount = 0, finalNotes = notes

    if (paymentMethod === 'cash') {
      if (cashTenderedNumber < grandTotal) return showToast(`Uang tunai kurang dari Total!`, 'error')
      invoiceStatus = 'paid'; finalPaidAmount = grandTotal
      if (changeAmount > 0) finalNotes += `\n(Kembalian: ${formatRupiah(changeAmount)})`
    } 
    else if (paymentMethod === 'qris') {
      if (!isQrisPaid) return showToast('Centang konfirmasi dana QRIS masuk!', 'error')
      invoiceStatus = 'paid'; finalPaidAmount = grandTotal
    } 
    else if (paymentMethod === 'split') { invoiceStatus = 'paid'; finalPaidAmount = totalSplitPaid }
    else if (paymentMethod === 'hutang') {
      finalPaidAmount = dpAmount
      if (finalPaidAmount > grandTotal) return showToast('DP tidak boleh melebihi Total!', 'error')
      if (finalPaidAmount === grandTotal && grandTotal > 0) invoiceStatus = 'paid'
      else if (finalPaidAmount > 0) invoiceStatus = 'partial'
      else invoiceStatus = 'sent'
    }

    setIsSubmitting(true)
    try {
      const payload = { user_id: session.user.id, customer_id: customerId ? Number(customerId) : null, invoice_number: invoiceNumber, issue_date: issueDate, due_date: paymentMethod === 'hutang' ? (dueDate || null) : null, due_time: paymentMethod === 'hutang' ? (dueTime || null) : null, payment_method: paymentMethod, status: 'draft', subtotal, discount: safeDiscount, tax_percent: taxType === 'persen' ? safeTaxInput : 0, tax_amount: taxAmount, shipping: safeShipping, total: grandTotal, paid_amount: finalPaidAmount, notes: finalNotes }
      const { data: invData, error } = await supabase.from('invoices').insert([payload]).select().single()
      if (error) throw error

      const itemPayloads = items.filter(item => item.product_id || item.description).map(item => ({ invoice_id: invData.id, product_id: item.product_id ? Number(item.product_id) : null, description: item.description, quantity: Number(item.quantity) || 0, unit_price: Number(item.unit_price) || 0, subtotal: Number(item.subtotal) || 0 }))
      await supabase.from('invoice_items').insert(itemPayloads)

      if (paymentMethod === 'split') {
        const paymentRecords = splitPayments.map(p => ({ invoice_id: invData.id, user_id: session.user.id, amount: Number(p.amount.replace(/\./g, '')), payment_method: p.method }))
        await supabase.from('invoice_payments').insert(paymentRecords)
      }

      if (invoiceStatus !== 'draft') await supabase.from('invoices').update({ status: invoiceStatus }).eq('id', invData.id)
      await logActivity(session.user.id, 'BUAT_INVOICE', `Membuat invoice ${invoiceNumber} (${paymentMethod}) senilai ${formatRupiah(grandTotal)}`)
      
      showToast('Invoice berhasil dibuat!', 'success')
      setTimeout(() => navigate(`/invoices/${invData.id}`), 1000)
    } catch (err) { 
      showToast('Gagal: ' + err.message, 'error')
    } finally { 
      setIsSubmitting(false) 
    }
  }

  return (
    <div>
      {showScanner && <BarcodeScanner onScan={handleBarcodeScan} onClose={() => setShowScanner(false)} />}
      <h1>Buat Invoice Baru</h1>
      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div><label>Pelanggan</label><select value={customerId} onChange={e => setCustomerId(e.target.value)}><option value="">-- Pelanggan Umum --</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label>No. Invoice</label><input required value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} /></div>
            <div><label>Tanggal Terbit</label><input type="date" required value={issueDate} onChange={e => setIssueDate(e.target.value)} /></div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16, overflowX: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Daftar Barang</h3>
            <Button type="button" variant="primary" onClick={() => setShowScanner(true)}><FaBarcode /> Scan Barcode</Button>
          </div>
          <table style={{ minWidth: 600 }}>
            <thead><tr><th>Produk</th><th>Deskripsi</th><th width="100" style={{ textAlign: 'center' }}>Qty</th><th width="150">Harga</th><th width="150">Subtotal</th><th width="50"></th></tr></thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index}>
                  <td><select value={item.product_id} onChange={e => handleItemChange(index, 'product_id', e.target.value)}><option value="">-- Pilih Produk --</option>{products.map(p => <option key={p.id} value={p.id}>{p.name} (Stok: {p.stock})</option>)}</select></td>
                  <td><input value={item.description} onChange={e => handleItemChange(index, 'description', e.target.value)} placeholder="Deskripsi" /></td>
                  <td><input type="number" min="1" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', e.target.value)} style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 16, padding: '12px 8px' }} /></td>
                  <td><input type="number" min="0" value={item.unit_price} onChange={e => handleItemChange(index, 'unit_price', e.target.value)} /></td>
                  <td>{formatRupiah(item.subtotal)}</td>
                  <td><Button type="button" variant="danger" onClick={() => items.length > 1 && setItems(items.filter((_, i) => i !== index))} style={{ padding: '8px 12px' }}>X</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <Button type="button" variant="secondary" onClick={() => setItems([...items, { product_id: '', description: '', quantity: 1, unit_price: '', subtotal: 0 }])} style={{ marginTop: 12 }}><FaPlus /> Tambah Baris</Button>
        </div>

        <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div>
            <h3 style={{ marginTop: 0 }}>Biaya Tambahan</h3>
            <label>Diskon</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <select value={discountType} onChange={e => setDiscountType(e.target.value)} style={{ width: '80px' }}><option value="persen">%</option><option value="nominal">Rp</option></select>
              <input type="text" placeholder="0" value={discountType === 'nominal' ? formatNumberInput(discount) : discount} onChange={e => setDiscount(discountType === 'nominal' ? e.target.value.replace(/\./g, '') : e.target.value)} style={{ flex: 1 }} />
            </div>
            
            <label>Pajak / Biaya Admin</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <select value={taxType} onChange={e => setTaxType(e.target.value)} style={{ width: '80px' }}><option value="persen">%</option><option value="nominal">Rp</option></select>
              <input type="text" placeholder="0" value={taxType === 'nominal' ? formatNumberInput(taxValue) : taxValue} onChange={e => setTaxValue(taxType === 'nominal' ? e.target.value.replace(/\./g, '') : e.target.value)} style={{ flex: 1 }} />
            </div>
            
            <label>Ongkos Kirim (Rp)</label>
            <input type="text" placeholder="0" value={formatNumberInput(shipping)} onChange={e => setShipping(e.target.value.replace(/\./g, ''))} style={{ marginBottom: 24 }} />

            <h3>Metode Pembayaran</h3>
            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} style={{ marginBottom: 12, fontWeight: 'bold' }}>
              <option value="cash">Cash / Tunai</option>
              <option value="qris">QRIS (Lunas)</option>
              <option value="split">Split Payment (Gabungan)</option>
              <option value="hutang">Hutang / Tempo</option>
            </select>

            {paymentMethod === 'cash' && (
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: 16, borderRadius: 8, border: '1px solid #bbf7d0' }}>
                <label style={{ color: '#10b981' }}>Uang Tunai Diterima (Rp)</label>
                <input type="text" value={formatNumberInput(cashTendered)} onChange={e => setCashTendered(e.target.value.replace(/\./g, ''))} style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 8 }} placeholder="0" />
                <Button type="button" variant="success" onClick={() => setCashTendered(grandTotal.toString())}>Uang Pas</Button>
              </div>
            )}

            {paymentMethod === 'split' && (
              <div style={{ background: 'rgba(236, 72, 153, 0.1)', padding: 16, borderRadius: 8, border: '1px solid rgba(236, 72, 153, 0.3)' }}>
                <label style={{ color: '#ec4899', fontWeight: 'bold' }}>Rincian Pembayaran Gabungan</label>
                {splitPayments.map((sp, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <select value={sp.method} onChange={e => handleSplitChange(idx, 'method', e.target.value)} style={{ width: '100px' }}><option value="cash">Cash</option><option value="qris">QRIS</option></select>
                    <input type="text" placeholder="Nominal" value={formatNumberInput(sp.amount)} onChange={e => handleSplitChange(idx, 'amount', e.target.value.replace(/\./g, ''))} style={{ flex: 1 }} />
                    {splitPayments.length > 1 && <Button type="button" variant="danger" onClick={() => handleRemoveSplit(idx)} style={{ padding: '8px' }}><FaTrash /></Button>}
                  </div>
                ))}
                <Button type="button" variant="secondary" onClick={handleAddSplit} style={{ marginTop: 4 }}><FaPlus /> Tambah Baris</Button>
                {remainingAmount > 0 && <p style={{ margin: '12px 0 0', color: '#ef4444', fontWeight: 'bold', fontSize: 14 }}>Sisa: {formatRupiah(remainingAmount)}</p>}
                {remainingAmount < 0 && <p style={{ margin: '12px 0 0', color: '#f59e0b', fontWeight: 'bold', fontSize: 14 }}>Kembalian: {formatRupiah(Math.abs(remainingAmount))}</p>}
                {remainingAmount === 0 && <p style={{ margin: '12px 0 0', color: '#10b981', fontWeight: 'bold', fontSize: 14 }}>Pembayaran sudah pas!</p>}
              </div>
            )}

            {paymentMethod === 'hutang' && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: 16, borderRadius: 8, border: '1px solid #fecaca' }}>
                <label style={{ color: '#ef4444' }}>DP / Dibayar Sekarang</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <select value={dpType} onChange={e => setDpType(e.target.value)} style={{ width: '80px' }}><option value="nominal">Rp</option><option value="persen">%</option></select>
                  <input type="text" placeholder="0" value={dpType === 'nominal' ? formatNumberInput(paidAmount) : paidAmount} onChange={e => setPaidAmount(dpType === 'nominal' ? e.target.value.replace(/\./g, '') : e.target.value)} style={{ flex: 1 }} />
                </div>
                {dpType === 'persen' && safeDpInput > 0 && <p style={{ margin: '-4px 0 12px', fontSize: 12, color: '#ef4444' }}>Nominal: <strong>{formatRupiah(dpAmount)}</strong></p>}
                <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 13 }}><input type="radio" checked={tempoMode === 'durasi'} onChange={() => setTempoMode('durasi')} /> Durasi</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 13 }}><input type="radio" checked={tempoMode === 'manual'} onChange={() => setTempoMode('manual')} /> Manual</label>
                </div>
                {tempoMode === 'durasi' ? (
                  <div><label>Berapa hari?</label><input type="number" min="1" value={tempoDays} onChange={e => setTempoDays(e.target.value)} /></div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div><label>Tanggal</label><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
                    <div><label>Jam</label><input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)} /></div>
                  </div>
                )}
              </div>
            )}
            <label style={{ marginTop: 16 }}>Catatan Invoice</label>
            <textarea rows="2" placeholder="Terima kasih sudah berbelanja..." value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          <div style={{ textAlign: 'right', background: 'var(--bg-color)', padding: 20, borderRadius: 12, border: '1px solid var(--border-color)' }}>
            <p style={{ margin: '8px 0', color: 'var(--text-muted)' }}>Subtotal: <strong style={{ color: 'var(--text-main)' }}>{formatRupiah(subtotal)}</strong></p>
            <p style={{ margin: '8px 0', color: 'var(--text-muted)' }}>Diskon: <strong style={{ color: 'red' }}>-{formatRupiah(safeDiscount)}</strong></p>
            <p style={{ margin: '8px 0', color: 'var(--text-muted)' }}>Pajak / Biaya: <strong style={{ color: 'var(--text-main)' }}>{formatRupiah(taxAmount)}</strong></p>
            <hr style={{ margin: '16px 0', borderColor: 'var(--border-color)' }} />
            <p style={{ fontSize: 28, color: 'var(--primary)', margin: '0 0 16px' }}>Total: <strong>{formatRupiah(grandTotal)}</strong></p>
            
            {paymentMethod === 'cash' && cashTenderedNumber > 0 && (
              <div style={{ padding: 12, background: cashTenderedNumber >= grandTotal ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', borderRadius: 8 }}>
                <p style={{ margin: 0, color: cashTenderedNumber >= grandTotal ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>Kembalian: {formatRupiah(changeAmount)}</p>
              </div>
            )}
            {paymentMethod === 'hutang' && dpAmount > 0 && (
              <div style={{ padding: 12, background: 'rgba(245, 158, 11, 0.1)', borderRadius: 8 }}>
                <p style={{ margin: 0, color: '#f59e0b', fontWeight: 'bold' }}>Sisa: {formatRupiah(grandTotal - dpAmount)}</p>
              </div>
            )}
            {paymentMethod === 'qris' && grandTotal > 0 && (
              <div style={{ marginTop: 20, background: 'white', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 'bold', color: '#1f2937' }}>Scan QRIS:</p>
                {dynamicQrisString ? <QRCodeSVG value={dynamicQrisString} size={180} /> : <p style={{ color: 'red' }}>Format QRIS salah.</p>}
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, cursor: 'pointer', background: isQrisPaid ? '#dcfce7' : '#fef3c7', padding: 12, borderRadius: 8, textAlign: 'left' }}>
                  <input type="checkbox" checked={isQrisPaid} onChange={(e) => setIsQrisPaid(e.target.checked)} style={{ width: 20, height: 20 }} />
                  <span style={{ fontWeight: 'bold', color: isQrisPaid ? '#166534' : '#92400e', fontSize: 13 }}>Dana QRIS sudah masuk</span>
                </label>
              </div>
            )}
            {paymentMethod === 'split' && splitPayments.map((sp, i) => {
              if (sp.method === 'qris' && Number(sp.amount.replace(/\./g, '')) > 0) {
                return (
                  <div key={i} style={{ marginTop: 20, background: 'white', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 'bold', color: '#1f2937' }}>QRIS (Pembayaran ke-{i+1}):</p>
                    <QRCodeSVG value={generateDynamicQris(STATIC_QRIS, Number(sp.amount.replace(/\./g, '')))} size={180} />
                  </div>
                )
              }
              return null
            })}
          </div>
        </div>

        <div style={{ marginTop: 24, textAlign: 'right' }}>
          <Button type="submit" variant="solid" disabled={isSubmitting} style={{ padding: '16px 32px', fontSize: 16 }}>
            <FaSave /> {isSubmitting ? 'Menyimpan...' : 'Simpan & Proses'}
          </Button>
        </div>
      </form>
    </div>
  )
}