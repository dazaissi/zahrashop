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
import Select from '../components/ui/Select'

const STATIC_QRIS = "00020101021126570011ID.DANA.WWW011893600915315843978402091584397840303UMI51440014ID.CO.QRIS.WWW0215ID10210814007440303UMI5204729853033605802ID5914Stella's Store6012Kota Bandung6105402656304E9BC"

const emptyItem = () => ({
  product_id: '',
  description: '',
  quantity: 0,
  unit_price: '',
  subtotal: 0
})

function getLocalDate() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getNumber(value) {
  return Number(String(value ?? '').replace(/\./g, '')) || 0
}

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
  const [issueDate, setIssueDate] = useState(getLocalDate())
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [cashTendered, setCashTendered] = useState('')
  const [dpType, setDpType] = useState('nominal')
  const [paidAmount, setPaidAmount] = useState('')
  const [isQrisPaid, setIsQrisPaid] = useState(false)
  const [qrisSplitConfirmed, setQrisSplitConfirmed] = useState({})
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
  const [items, setItems] = useState([emptyItem()])

  useEffect(() => {
    if (session?.user?.id) {
      fetchCustomers()
      fetchProducts()
      generateInvoiceNumber()
    }
  }, [session?.user?.id])

  useEffect(() => {
    if (paymentMethod !== 'qris') setIsQrisPaid(false)
  }, [paymentMethod])

  useEffect(() => {
    if (paymentMethod === 'hutang' && tempoMode === 'durasi') {
      const date = new Date(`${issueDate}T12:00:00`)
      date.setDate(date.getDate() + Number(tempoDays || 0))

      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      setDueDate(`${year}-${month}-${day}`)

      const now = new Date()
      setDueTime(
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      )
    }
  }, [tempoDays, tempoMode, issueDate, paymentMethod])

  async function fetchCustomers() {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('name')

    if (error) {
      showToast('Gagal memuat pelanggan: ' + error.message, 'error')
      return
    }

    setCustomers(data || [])
  }

  async function fetchProducts() {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .gt('stock', 0)
      .order('name')

    if (error) {
      showToast('Gagal memuat produk: ' + error.message, 'error')
      return
    }

    setProducts(data || [])
  }

  async function generateInvoiceNumber() {
    const now = new Date()
    const prefix = `INV/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/`

    const { data, error } = await supabase
      .from('invoices')
      .select('invoice_number')
      .like('invoice_number', `${prefix}%`)
      .order('invoice_number', { ascending: false })
      .limit(1)

    if (error) {
      showToast('Gagal membuat nomor invoice: ' + error.message, 'error')
      setInvoiceNumber('')
      return
    }

    if (data?.length) {
      const lastNumber = parseInt(data[0].invoice_number.split('/').pop(), 10)

      if (!Number.isNaN(lastNumber)) {
        setInvoiceNumber(`${prefix}${String(lastNumber + 1).padStart(3, '0')}`)
        return
      }
    }

    setInvoiceNumber(`${prefix}001`)
  }

  function getAvailableStock(productId, currentIndex) {
    const product = products.find(p => String(p.id) === String(productId))
    if (!product) return 0

    const usedInOtherRows = items.reduce((sum, item, i) => {
      return i !== currentIndex && String(item.product_id) === String(product.id)
        ? sum + (Number(item.quantity) || 0)
        : sum
    }, 0)

    return Math.max(0, Number(product.stock || 0) - usedInOtherRows)
  }

  function handleBarcodeScan(scannedCode) {
    const found = products.find(p => p.sku === scannedCode)

    if (!found) {
      showToast(`Barcode/SKU "${scannedCode}" tidak ditemukan atau stok habis.`, 'error')
      return
    }

    const existIdx = items.findIndex(item => String(item.product_id) === String(found.id))

    if (existIdx !== -1) {
      const usedQty = items.reduce((sum, item, i) => {
        return i !== existIdx && String(item.product_id) === String(found.id)
          ? sum + Number(item.quantity || 0)
          : sum
      }, 0)

      if (Number(items[existIdx].quantity) + 1 > Number(found.stock) - usedQty) {
        return showToast('Stok tidak mencukupi untuk ditambah!', 'error')
      }

      const newItems = [...items]
      newItems[existIdx] = {
        ...newItems[existIdx],
        quantity: Number(newItems[existIdx].quantity) + 1,
        subtotal: (Number(newItems[existIdx].quantity) + 1) * Number(newItems[existIdx].unit_price)
      }
      setItems(newItems)
    } else {
      const emptyIdx = items.findIndex(item => !item.product_id && !item.description)
      const newItem = {
        product_id: String(found.id),
        description: found.name,
        quantity: 1,
        unit_price: found.price,
        subtotal: Number(found.price)
      }

      if (emptyIdx !== -1) {
        const newItems = [...items]
        newItems[emptyIdx] = newItem
        setItems(newItems)
      } else {
        setItems([...items, newItem])
      }
    }

    setShowScanner(false)
  }

  function handleItemChange(index, field, value) {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }

    if (field === 'product_id') {
      const product = products.find(p => String(p.id) === String(value))

      if (product) {
        newItems[index].unit_price = product.price
        newItems[index].description = product.name
        if (Number(newItems[index].quantity) === 0) newItems[index].quantity = 1
      } else {
        newItems[index] = emptyItem()
      }
    }

    if (field === 'quantity') {
      const product = products.find(p => String(p.id) === String(newItems[index].product_id))

      if (product) {
        const available = getAvailableStock(product.id, index)
        const requested = Math.max(0, Number(value) || 0)

        if (requested > available) {
          showToast(`Maksimal sisa stok ${product.name} adalah ${available}`, 'error')
          newItems[index].quantity = available
        } else {
          newItems[index].quantity = requested
        }
      }
    }

    newItems[index].subtotal =
      (Number(newItems[index].quantity) || 0) *
      (Number(newItems[index].unit_price) || 0)

    setItems(newItems)
  }

  function handleAddSplit() {
    setSplitPayments([...splitPayments, { method: 'cash', amount: '' }])
  }

  function handleRemoveSplit(index) {
    if (splitPayments.length <= 1) return

    setSplitPayments(splitPayments.filter((_, i) => i !== index))

    const nextConfirmed = {}
    Object.keys(qrisSplitConfirmed).forEach(key => {
      const oldIndex = Number(key)
      if (oldIndex < index) nextConfirmed[oldIndex] = qrisSplitConfirmed[key]
      if (oldIndex > index) nextConfirmed[oldIndex - 1] = qrisSplitConfirmed[key]
    })
    setQrisSplitConfirmed(nextConfirmed)
  }

  function handleSplitChange(index, field, value) {
    const newSplits = [...splitPayments]
    newSplits[index] = { ...newSplits[index], [field]: value }
    setSplitPayments(newSplits)

    if (field === 'method' || field === 'amount') {
      setQrisSplitConfirmed(prev => ({ ...prev, [index]: false }))
    }
  }

  const subtotal = items.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0)
  const safeDiscountInput = getNumber(discount)
  const safeDiscount = discountType === 'persen'
    ? (subtotal * safeDiscountInput) / 100
    : safeDiscountInput
  const safeTaxInput = getNumber(taxValue)
  const taxAmount = taxType === 'persen'
    ? (subtotal - safeDiscount) * (safeTaxInput / 100)
    : safeTaxInput
  const safeShipping = getNumber(shipping)
  const grandTotal = subtotal - safeDiscount + taxAmount + safeShipping

  const totalSplitPaid = splitPayments.reduce(
    (sum, payment) => sum + getNumber(payment.amount),
    0
  )

  const remainingAmount = grandTotal - totalSplitPaid
  const safeDpInput = getNumber(paidAmount)
  const dpAmount = dpType === 'persen'
    ? (grandTotal * safeDpInput) / 100
    : safeDpInput

  const cashTenderedNumber = getNumber(cashTendered)
  const changeAmount = paymentMethod === 'cash' && cashTenderedNumber > grandTotal
    ? cashTenderedNumber - grandTotal
    : 0

  const dynamicQrisString = paymentMethod === 'qris' && grandTotal > 0
    ? generateDynamicQris(STATIC_QRIS, grandTotal)
    : ''

  async function handleSubmit(e) {
    e.preventDefault()

    if (isSubmitting) return
    if (!session?.user?.id) return showToast('Sesi login tidak ditemukan.', 'error')
    if (!invoiceNumber.trim() || invoiceNumber === 'Memuat...') {
      return showToast('Nomor invoice belum siap.', 'error')
    }
    if (!items.some(item => item.description && Number(item.quantity) > 0)) {
      return showToast('Tambahkan minimal satu barang dengan jumlah lebih dari 0.', 'error')
    }
    if (grandTotal <= 0 || !Number.isFinite(grandTotal)) {
      return showToast('Total invoice tidak valid.', 'error')
    }
    if (safeDiscount < 0 || safeDiscount > subtotal) {
      return showToast('Diskon tidak valid.', 'error')
    }
    if (safeTaxInput < 0 || (taxType === 'persen' && safeTaxInput > 100)) {
      return showToast('Nilai pajak tidak valid.', 'error')
    }

    let finalPaidAmount = 0
    let finalNotes = notes
    let paymentRecords = []

    if (paymentMethod === 'cash') {
      if (cashTenderedNumber < grandTotal) {
        return showToast('Uang tunai kurang dari total!', 'error')
      }

      finalPaidAmount = grandTotal
      paymentRecords = [{
        amount: grandTotal,
        payment_method: 'cash'
      }]

      if (changeAmount > 0) {
        finalNotes += `\n(Kembalian: ${formatRupiah(changeAmount)})`
      }
    } else if (paymentMethod === 'qris') {
      if (!dynamicQrisString) return showToast('Format QRIS tidak valid.', 'error')
      if (!isQrisPaid) return showToast('Centang konfirmasi dana QRIS masuk!', 'error')

      finalPaidAmount = grandTotal
      paymentRecords = [{
        amount: grandTotal,
        payment_method: 'qris'
      }]
    } else if (paymentMethod === 'split') {
      if (Math.abs(totalSplitPaid - grandTotal) > 0.01) {
        return showToast('Total pembayaran gabungan harus sama dengan total invoice.', 'error')
      }

      const hasUnconfirmedQris = splitPayments.some((payment, index) => {
        return payment.method === 'qris' &&
          getNumber(payment.amount) > 0 &&
          !qrisSplitConfirmed[index]
      })

      if (hasUnconfirmedQris) {
        return showToast('Konfirmasikan dana untuk setiap pembayaran QRIS.', 'error')
      }

      finalPaidAmount = grandTotal
      paymentRecords = splitPayments
        .filter(payment => getNumber(payment.amount) > 0)
        .map(payment => ({
          amount: getNumber(payment.amount),
          payment_method: payment.method
        }))
    } else if (paymentMethod === 'hutang') {
      finalPaidAmount = dpAmount

      if (finalPaidAmount < 0 || finalPaidAmount > grandTotal) {
        return showToast('DP tidak boleh melebihi total invoice.', 'error')
      }

      if (safeDpInput < 0 || (dpType === 'persen' && safeDpInput > 100)) {
        return showToast('Nilai DP tidak valid.', 'error')
      }

      if (finalPaidAmount > 0) {
        paymentRecords = [{
          amount: finalPaidAmount,
          payment_method: 'transfer'
        }]
      }
    }

    setIsSubmitting(true)

    let createdInvoiceId = null

    try {
      let finalCustomerId = customerId || null

      if (!finalCustomerId) {
        const { data: newCustomer, error: customerError } = await supabase
          .rpc('create_anonymous_customer')

        if (customerError) throw customerError
        if (!newCustomer?.id) throw new Error('Gagal membuat pelanggan anonim.')

        finalCustomerId = newCustomer.id
      }

      const payload = {
        user_id: session.user.id,
        customer_id: finalCustomerId,
        invoice_number: invoiceNumber.trim(),
        issue_date: issueDate,
        due_date: paymentMethod === 'hutang' ? (dueDate || null) : null,
        due_time: paymentMethod === 'hutang' ? (dueTime || null) : null,
        payment_method: paymentMethod,
        status: 'draft',
        subtotal,
        discount: safeDiscount,
        tax_percent: taxType === 'persen' ? safeTaxInput : 0,
        tax_amount: taxAmount,
        shipping: safeShipping,
        total: grandTotal,
        paid_amount: finalPaidAmount,
        notes: finalNotes
      }

      const { data: invData, error: invoiceError } = await supabase
        .from('invoices')
        .insert([payload])
        .select()
        .single()

      if (invoiceError) throw invoiceError
      if (!invData?.id) throw new Error('Invoice gagal dibuat.')

      createdInvoiceId = invData.id

      // ===== PERUBAHAN: Snapshot netto ke invoice_items =====
      const itemPayloads = items
        .filter(item => item.description && Number(item.quantity) > 0)
        .map(item => {
          const selectedProduct = products.find(
            product => String(product.id) === String(item.product_id)
          )

          return {
            invoice_id: invData.id,
            product_id: item.product_id || null,
            description: item.description,
            quantity: Number(item.quantity),
            unit_price: Number(item.unit_price) || 0,
            subtotal: Number(item.subtotal) || 0,
            net_weight: selectedProduct?.net_weight
              ? Number(selectedProduct.net_weight)
              : null,
            net_weight_unit: selectedProduct?.net_weight
              ? selectedProduct.net_weight_unit || null
              : null
          }
        })
      // ===== END PERUBAHAN =====

      const { error: itemError } = await supabase
        .from('invoice_items')
        .insert(itemPayloads)

      if (itemError) throw itemError

      if (paymentRecords.length > 0) {
        const records = paymentRecords.map(payment => ({
          invoice_id: invData.id,
          user_id: session.user.id,
          amount: payment.amount,
          payment_method: payment.payment_method,
          payment_date: new Date().toISOString()
        }))

        const { error: paymentError } = await supabase
          .from('invoice_payments')
          .insert(records)

        if (paymentError) throw paymentError
      }

      const { data: finalizeData, error: finalizeError } = await supabase
        .rpc('finalize_invoice', {
          p_invoice_id: invData.id
        })

      if (finalizeError) {
        console.error('FINALIZE INVOICE ERROR:', {
          message: finalizeError.message,
          details: finalizeError.details,
          hint: finalizeError.hint,
          code: finalizeError.code
        })

        throw new Error(
          `Finalisasi gagal: ${finalizeError.message}\nDetail: ${finalizeError.details || '-'}\nKode: ${finalizeError.code || '-'}`
        )
      }

      if (!finalizeData?.success) {
        throw new Error('Invoice gagal difinalisasi.')
      }

      console.log('FINALIZE INVOICE RESULT:', finalizeData)

      try {
        await logActivity(
          session.user.id,
          'BUAT_INVOICE',
          `Membuat invoice ${invoiceNumber} (${paymentMethod}) senilai ${formatRupiah(grandTotal)}`
        )
      } catch (logError) {
        console.error('Gagal mencatat aktivitas:', logError)
      }

      showToast('Invoice berhasil dibuat!', 'success')
      navigate(`/invoices/${invData.id}`)
    } catch (error) {
      console.error('GAGAL MEMBUAT INVOICE:', error)

      const errorMessage = [
        error.message,
        error.details,
        error.hint,
        error.code ? `Kode: ${error.code}` : null
      ].filter(Boolean).join('\n')

      if (createdInvoiceId) {
        showToast(
          'Invoice masih Draft. ' + errorMessage,
          'error'
        )
      } else {
        showToast('Gagal: ' + errorMessage, 'error')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const customerOptions = [
    { value: '', label: 'Pelanggan Umum (Otomatis)' },
    ...customers.map(customer => ({
      value: String(customer.id),
      label: `${customer.name} ${customer.customer_code ? `(${customer.customer_code})` : ''}`
    }))
  ]

  const discountTypeOptions = [
    { value: 'persen', label: '%' },
    { value: 'nominal', label: 'Rp' }
  ]

  const taxTypeOptions = [
    { value: 'persen', label: '%' },
    { value: 'nominal', label: 'Rp' }
  ]

  const paymentMethodOptions = [
    { value: 'cash', label: 'Cash / Tunai' },
    { value: 'qris', label: 'QRIS (Lunas)' },
    { value: 'split', label: 'Split Payment (Gabungan)' },
    { value: 'hutang', label: 'Hutang / Tempo' }
  ]

  const splitMethodOptions = [
    { value: 'cash', label: 'Cash' },
    { value: 'qris', label: 'QRIS' }
  ]

  return (
    <div>
      {showScanner && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onClose={() => setShowScanner(false)}
        />
      )}

      <h1>Buat Invoice Baru</h1>

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16
          }}>
            <div>
              <label>Pelanggan</label>
              <Select
                options={customerOptions}
                value={customerId}
                onChange={setCustomerId}
                placeholder="Pelanggan Umum (Otomatis)"
              />
            </div>
            <div>
              <label>No. Invoice</label>
              <input
                required
                value={invoiceNumber}
                onChange={e => setInvoiceNumber(e.target.value)}
              />
            </div>
            <div>
              <label>Tanggal Terbit</label>
              <input
                type="date"
                required
                value={issueDate}
                onChange={e => setIssueDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16, overflowX: 'auto' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12
          }}>
            <h3 style={{ margin: 0 }}>Daftar Barang</h3>
            <Button
              type="button"
              variant="primary"
              onClick={() => setShowScanner(true)}
            >
              <FaBarcode /> Scan Barcode
            </Button>
          </div>

          <div className="table-responsive">
            <table style={{ minWidth: 600 }}>
              <thead>
                <tr>
                  <th>Produk</th>
                  <th width="200">Deskripsi</th>
                  <th width="100" style={{ textAlign: 'center' }}>Qty</th>
                  <th width="150">Harga</th>
                  <th width="150">Subtotal</th>
                  <th width="50"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const productOptions = [
                    { value: '', label: '-- Pilih Produk --' },
                    ...products.map(product => {
                      const totalUsed = items.reduce((sum, current) => {
                        return String(current.product_id) === String(product.id)
                          ? sum + (Number(current.quantity) || 0)
                          : sum
                      }, 0)

                      return {
                        value: String(product.id),
                        label: `${product.name} (Sisa: ${Math.max(0, product.stock - totalUsed)})`
                      }
                    })
                  ]

                  return (
                    <tr key={index}>
                      <td>
                        <Select
                          options={productOptions}
                          value={item.product_id}
                          onChange={value => handleItemChange(index, 'product_id', value)}
                          placeholder="-- Pilih Produk --"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={item.description}
                          readOnly
                          placeholder="Pilih produk..."
                          style={{
                            width: '100%',
                            backgroundColor: 'var(--bg-color)',
                            color: 'var(--text-muted)',
                            cursor: 'not-allowed',
                            border: '1px dashed var(--border-color)'
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          disabled={!item.product_id}
                          max={item.product_id ? getAvailableStock(item.product_id, index) : 99}
                          value={item.quantity}
                          onChange={e => handleItemChange(index, 'quantity', e.target.value)}
                          style={{
                            textAlign: 'center',
                            fontWeight: 'bold',
                            fontSize: 16,
                            padding: '12px 8px',
                            backgroundColor: !item.product_id ? 'var(--bg-color)' : 'var(--card-bg)',
                            color: !item.product_id ? 'var(--text-muted)' : 'var(--text-main)',
                            cursor: !item.product_id ? 'not-allowed' : 'text',
                            border: '1px solid var(--border-color)'
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={item.unit_price}
                          readOnly
                          style={{
                            width: '100%',
                            backgroundColor: 'var(--bg-color)',
                            color: 'var(--text-muted)',
                            cursor: 'not-allowed',
                            border: '1px dashed var(--border-color)'
                          }}
                        />
                      </td>
                      <td>{formatRupiah(item.subtotal)}</td>
                      <td>
                        <Button
                          type="button"
                          variant="danger"
                          onClick={() => {
                            if (items.length > 1) {
                              setItems(items.filter((_, i) => i !== index))
                            } else {
                              setItems([emptyItem()])
                            }
                          }}
                          style={{ padding: '8px 12px' }}
                        >
                          <FaTrash />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <Button
            type="button"
            variant="secondary"
            onClick={() => setItems([...items, emptyItem()])}
            style={{ marginTop: 12 }}
          >
            <FaPlus /> Tambah Baris
          </Button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 24
        }}>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Biaya Tambahan</h3>

            <label>Diskon</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <Select
                options={discountTypeOptions}
                value={discountType}
                onChange={setDiscountType}
                style={{ width: '80px' }}
              />
              <input
                type="text"
                placeholder="0"
                value={discountType === 'nominal' ? formatNumberInput(discount) : discount}
                onChange={e => setDiscount(
                  discountType === 'nominal'
                    ? e.target.value.replace(/\./g, '')
                    : e.target.value
                )}
                style={{ flex: 1 }}
              />
            </div>

            <label>Pajak / Biaya Admin</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <Select
                options={taxTypeOptions}
                value={taxType}
                onChange={setTaxType}
                style={{ width: '80px' }}
              />
              <input
                type="text"
                placeholder="0"
                value={taxType === 'nominal' ? formatNumberInput(taxValue) : taxValue}
                onChange={e => setTaxValue(
                  taxType === 'nominal'
                    ? e.target.value.replace(/\./g, '')
                    : e.target.value
                )}
                style={{ flex: 1 }}
              />
            </div>

            <label>Ongkos Kirim (Rp)</label>
            <input
              type="text"
              placeholder="0"
              value={formatNumberInput(shipping)}
              onChange={e => setShipping(e.target.value.replace(/\./g, ''))}
              style={{ marginBottom: 24 }}
            />

            <h3>Metode Pembayaran</h3>
            <Select
              options={paymentMethodOptions}
              value={paymentMethod}
              onChange={setPaymentMethod}
              style={{ marginBottom: 12, fontWeight: 'bold' }}
            />

            {paymentMethod === 'cash' && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.1)',
                padding: 16,
                borderRadius: 8,
                border: '1px solid #bbf7d0'
              }}>
                <label style={{ color: '#10b981' }}>Uang Tunai Diterima (Rp)</label>
                <input
                  type="text"
                  value={formatNumberInput(cashTendered)}
                  onChange={e => setCashTendered(e.target.value.replace(/\./g, ''))}
                  style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 8 }}
                  placeholder="0"
                />
                <Button
                  type="button"
                  variant="success"
                  onClick={() => setCashTendered(String(Math.ceil(grandTotal)))}
                >
                  Uang Pas
                </Button>
              </div>
            )}

            {paymentMethod === 'split' && (
              <div style={{
                background: 'rgba(236, 72, 153, 0.1)',
                padding: 16,
                borderRadius: 8,
                border: '1px solid rgba(236, 72, 153, 0.3)'
              }}>
                <label style={{ color: '#ec4899', fontWeight: 'bold' }}>
                  Rincian Pembayaran Gabungan
                </label>

                {splitPayments.map((payment, index) => (
                  <div key={index} style={{ marginBottom: 12 }}>
                    <div style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center'
                    }}>
                      <Select
                        options={splitMethodOptions}
                        value={payment.method}
                        onChange={value => handleSplitChange(index, 'method', value)}
                        style={{ width: '100px' }}
                      />
                      <input
                        type="text"
                        placeholder="Nominal"
                        value={formatNumberInput(payment.amount)}
                        onChange={e => handleSplitChange(
                          index,
                          'amount',
                          e.target.value.replace(/\./g, '')
                        )}
                        style={{ flex: 1 }}
                      />
                      {splitPayments.length > 1 && (
                        <Button
                          type="button"
                          variant="danger"
                          onClick={() => handleRemoveSplit(index)}
                          style={{ padding: 8 }}
                        >
                          <FaTrash />
                        </Button>
                      )}
                    </div>

                    {payment.method === 'qris' && getNumber(payment.amount) > 0 && (
                      <div style={{
                        marginTop: 10,
                        padding: 12,
                        background: 'white',
                        borderRadius: 8,
                        textAlign: 'center',
                        color: '#1f2937'
                      }}>
                        <p style={{ margin: '0 0 8px', fontWeight: 'bold' }}>
                          QRIS Pembayaran ke-{index + 1}
                        </p>
                        <QRCodeSVG
                          value={generateDynamicQris(STATIC_QRIS, getNumber(payment.amount))}
                          size={160}
                        />
                        <label style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          marginTop: 12,
                          padding: 10,
                          borderRadius: 8,
                          background: qrisSplitConfirmed[index] ? '#dcfce7' : '#fef3c7',
                          color: qrisSplitConfirmed[index] ? '#166534' : '#92400e',
                          textAlign: 'left'
                        }}>
                          <input
                            type="checkbox"
                            checked={!!qrisSplitConfirmed[index]}
                            onChange={e => setQrisSplitConfirmed(prev => ({
                              ...prev,
                              [index]: e.target.checked
                            }))}
                          />
                          Dana QRIS pembayaran ini sudah masuk
                        </label>
                      </div>
                    )}
                  </div>
                ))}

                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleAddSplit}
                  style={{ marginTop: 4 }}
                >
                  <FaPlus /> Tambah Baris
                </Button>

                {remainingAmount > 0 && (
                  <p style={{ margin: '12px 0 0', color: '#ef4444', fontWeight: 'bold', fontSize: 14 }}>
                    Sisa: {formatRupiah(remainingAmount)}
                  </p>
                )}
                {remainingAmount < 0 && (
                  <p style={{ margin: '12px 0 0', color: '#f59e0b', fontWeight: 'bold', fontSize: 14 }}>
                    Kelebihan: {formatRupiah(Math.abs(remainingAmount))}
                  </p>
                )}
                {Math.abs(remainingAmount) < 0.01 && (
                  <p style={{ margin: '12px 0 0', color: '#10b981', fontWeight: 'bold', fontSize: 14 }}>
                    Pembayaran sudah pas!
                  </p>
                )}
              </div>
            )}

            {paymentMethod === 'hutang' && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                padding: 16,
                borderRadius: 8,
                border: '1px solid #fecaca'
              }}>
                <label style={{ color: '#ef4444' }}>DP / Dibayar Sekarang</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <Select
                    options={[
                      { value: 'nominal', label: 'Rp' },
                      { value: 'persen', label: '%' }
                    ]}
                    value={dpType}
                    onChange={setDpType}
                    style={{ width: '80px' }}
                  />
                  <input
                    type="text"
                    placeholder="0"
                    value={dpType === 'nominal' ? formatNumberInput(paidAmount) : paidAmount}
                    onChange={e => setPaidAmount(
                      dpType === 'nominal'
                        ? e.target.value.replace(/\./g, '')
                        : e.target.value
                    )}
                    style={{ flex: 1 }}
                  />
                </div>

                {dpType === 'persen' && safeDpInput > 0 && (
                  <p style={{ margin: '-4px 0 12px', fontSize: 12, color: '#ef4444' }}>
                    Nominal: <strong>{formatRupiah(dpAmount)}</strong>
                  </p>
                )}

                <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 13 }}>
                    <input
                      type="radio"
                      checked={tempoMode === 'durasi'}
                      onChange={() => setTempoMode('durasi')}
                    />
                    Durasi
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 13 }}>
                    <input
                      type="radio"
                      checked={tempoMode === 'manual'}
                      onChange={() => setTempoMode('manual')}
                    />
                    Manual
                  </label>
                </div>

                {tempoMode === 'durasi' ? (
                  <div>
                    <label>Berapa hari?</label>
                    <input
                      type="number"
                      min="1"
                      value={tempoDays}
                      onChange={e => setTempoDays(e.target.value)}
                    />
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 8
                  }}>
                    <div>
                      <label>Tanggal</label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={e => setDueDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label>Jam</label>
                      <input
                        type="time"
                        value={dueTime}
                        onChange={e => setDueTime(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <label style={{ marginTop: 16 }}>Catatan Invoice</label>
            <textarea
              rows="2"
              placeholder="Terima kasih sudah berbelanja..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <div
            className="card"
            style={{
              textAlign: 'right',
              background: 'var(--bg-color)',
              border: '1px solid var(--border-color)'
            }}
          >
            <p style={{ margin: '8px 0', color: 'var(--text-muted)' }}>
              Subtotal: <strong style={{ color: 'var(--text-main)' }}>{formatRupiah(subtotal)}</strong>
            </p>
            <p style={{ margin: '8px 0', color: 'var(--text-muted)' }}>
              Diskon: <strong style={{ color: 'red' }}>-{formatRupiah(safeDiscount)}</strong>
            </p>
            <p style={{ margin: '8px 0', color: 'var(--text-muted)' }}>
              Pajak / Biaya: <strong style={{ color: 'var(--text-main)' }}>{formatRupiah(taxAmount)}</strong>
            </p>
            <hr style={{ margin: '16px 0', borderColor: 'var(--border-color)' }} />
            <p style={{ fontSize: 28, color: 'var(--primary)', margin: '0 0 16px' }}>
              Total: <strong>{formatRupiah(grandTotal)}</strong>
            </p>

            {paymentMethod === 'cash' && cashTenderedNumber > 0 && (
              <div style={{
                padding: 12,
                background: cashTenderedNumber >= grandTotal
                  ? 'rgba(16, 185, 129, 0.1)'
                  : 'rgba(239, 68, 68, 0.1)',
                borderRadius: 8
              }}>
                <p style={{
                  margin: 0,
                  color: cashTenderedNumber >= grandTotal ? '#10b981' : '#ef4444',
                  fontWeight: 'bold'
                }}>
                  Kembalian: {formatRupiah(changeAmount)}
                </p>
              </div>
            )}

            {paymentMethod === 'hutang' && dpAmount > 0 && (
              <div style={{
                padding: 12,
                background: 'rgba(245, 158, 11, 0.1)',
                borderRadius: 8
              }}>
                <p style={{ margin: 0, color: '#f59e0b', fontWeight: 'bold' }}>
                  Sisa: {formatRupiah(grandTotal - dpAmount)}
                </p>
              </div>
            )}

            {paymentMethod === 'qris' && grandTotal > 0 && (
              <div style={{
                marginTop: 20,
                background: 'white',
                padding: 16,
                borderRadius: 8,
                border: '1px solid #e2e8f0'
              }}>
                <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 'bold', color: '#1f2937' }}>
                  Scan QRIS:
                </p>
                {dynamicQrisString ? (
                  <QRCodeSVG value={dynamicQrisString} size={180} />
                ) : (
                  <p style={{ color: 'red' }}>Format QRIS salah.</p>
                )}

                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 16,
                  cursor: 'pointer',
                  background: isQrisPaid ? '#dcfce7' : '#fef3c7',
                  padding: 12,
                  borderRadius: 8,
                  textAlign: 'left'
                }}>
                  <input
                    type="checkbox"
                    checked={isQrisPaid}
                    onChange={e => setIsQrisPaid(e.target.checked)}
                    style={{ width: 20, height: 20 }}
                  />
                  <span style={{
                    fontWeight: 'bold',
                    color: isQrisPaid ? '#166534' : '#92400e',
                    fontSize: 13
                  }}>
                    Dana QRIS sudah masuk
                  </span>
                </label>
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 24, textAlign: 'right' }}>
          <Button
            type="submit"
            variant="solid"
            disabled={isSubmitting}
            style={{ padding: '16px 32px', fontSize: 16 }}
          >
            <FaSave /> {isSubmitting ? 'Menyimpan...' : 'Simpan & Proses'}
          </Button>
        </div>
      </form>
    </div>
  )
}