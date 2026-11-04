import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useUI } from '../context/UIContext'
import { formatRupiah } from '../lib/format'
import BarcodeScanner from '../components/BarcodeScanner'
import {
  FaBoxOpen,
  FaEdit,
  FaTrash,
  FaBarcode,
  FaMinusCircle,
  FaFileExcel
} from 'react-icons/fa'
import Button from '../components/ui/Button'
import Select from '../components/ui/Select' // <-- IMPORT SELECT COMPONENT
import * as XLSX from 'xlsx'

const NET_WEIGHT_UNITS = [
  { value: 'g', label: 'Gram (g)' },
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'ml', label: 'Mililiter (ml)' },
  { value: 'L', label: 'Liter (L)' }
]

const PROVIDERS = [
  { value: 'Telkomsel', label: 'Telkomsel', short: 'TSEL', color: '#e31e26' },
  { value: 'Indosat', label: 'Indosat', short: 'IM3', color: '#f5c400' },
  { value: 'XL', label: 'XL', short: 'XL', color: '#1684d8' },
  { value: 'AXIS', label: 'AXIS', short: 'AXIS', color: '#7136a8' },
  { value: 'Tri', label: 'Tri', short: '3', color: '#ed1c24' },
  { value: 'Smartfren', label: 'Smartfren', short: 'SF', color: '#e52429' },
  { value: 'PLN', label: 'PLN', short: 'PLN', color: '#0875bd' },
  { value: 'DANA', label: 'DANA', short: 'DANA', color: '#118eea' },
  { value: 'GoPay', label: 'GoPay', short: 'GOPAY', color: '#00a5cf' },
  { value: 'OVO', label: 'OVO', short: 'OVO', color: '#4c2a86' },
  { value: 'ShopeePay', label: 'ShopeePay', short: 'SPAY', color: '#ee4d2d' }
]

function ProviderBadge({ provider, size = 42 }) {
  const item = PROVIDERS.find(p => p.value === provider)
  const color = item?.color || '#64748b'
  const label = item?.short || provider?.slice(0, 5).toUpperCase() || '?'

  return (
    <div
      title={provider || 'Provider'}
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: 10,
        background: color,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        fontSize: label.length > 4 ? 10 : 13,
        letterSpacing: 0.3
      }}
    >
      {label}
    </div>
  )
}

export default function Products() {
  const { session } = useAuth()
  const { showConfirm, showPrompt, showToast } = useUI()

  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showScanner, setShowScanner] = useState(false)

  const [id, setId] = useState(null)
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [price, setPrice] = useState('')
  const [cost, setCost] = useState('')
  const [stock, setStock] = useState('')
  const [minStock, setMinStock] = useState('')
  const [netWeight, setNetWeight] = useState('')
  const [netWeightUnit, setNetWeightUnit] = useState('g')
  const [productType, setProductType] = useState('physical')
  const [providerName, setProviderName] = useState('')

  const userId = session?.user?.id
  const isDigital = productType === 'digital'

  useEffect(() => {
    if (userId) fetchProducts()
  }, [userId])

  async function fetchProducts() {
    if (!userId) return

    setLoading(true)

    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', userId)
        .order('name', { ascending: true })

      if (error) throw error

      setProducts(data || [])
    } catch (error) {
      console.error('Fetch products error:', error)
      showToast('Gagal memuat produk: ' + error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setId(null)
    setName('')
    setSku('')
    setPrice('')
    setCost('')
    setStock('')
    setMinStock('')
    setNetWeight('')
    setNetWeightUnit('g')
    setProductType('physical')
    setProviderName('')
  }

  function editProduct(product) {
    setId(product.id)
    setName(product.name)
    setSku(product.sku || '')
    setPrice(product.price)
    setCost(product.cost)
    setStock(String(product.stock ?? 0))
    setMinStock(String(product.min_stock ?? 0))
    setNetWeight(product.net_weight ?? '')
    setNetWeightUnit(product.net_weight_unit || 'g')
    setProductType(product.product_type || 'physical')
    setProviderName(product.provider_name || '')

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!userId) {
      showToast('Sesi login tidak ditemukan.', 'error')
      return
    }

    const productName = name.trim()
    const productPrice = Number(price)
    const productCost = cost === '' ? 0 : Number(cost)
    const initialStock = isDigital ? 0 : Number(stock)
    const minimumStock = isDigital ? 0 : (minStock === '' ? 0 : Number(minStock))
    const weightValue = isDigital || netWeight === '' ? null : Number(netWeight)

    if (!productName) {
      showToast('Nama produk wajib diisi.', 'error')
      return
    }

    if (isDigital && !providerName) {
      showToast('Pilih provider produk digital.', 'error')
      return
    }

    if (
      !Number.isFinite(productPrice) ||
      productPrice < 0 ||
      !Number.isFinite(productCost) ||
      productCost < 0 ||
      !Number.isInteger(minimumStock) ||
      minimumStock < 0
    ) {
      showToast('Periksa kembali harga dan batas stok.', 'error')
      return
    }

    if (
      weightValue !== null &&
      (!Number.isFinite(weightValue) || weightValue <= 0)
    ) {
      showToast('Netto harus lebih dari 0.', 'error')
      return
    }

    if (
      !id &&
      !isDigital &&
      (!Number.isInteger(initialStock) || initialStock < 0)
    ) {
      showToast('Stok awal harus berupa bilangan bulat minimal 0.', 'error')
      return
    }

    setIsSubmitting(true)

    try {
      const payload = {
        name: productName,
        sku: sku.trim() || null,
        price: productPrice,
        cost: productCost,
        product_type: productType,
        provider_name: isDigital ? providerName : null,
        min_stock: minimumStock,
        net_weight: weightValue,
        net_weight_unit: weightValue !== null ? netWeightUnit : null,
        user_id: userId
      }

      if (id) {
        const { error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', id)
          .eq('user_id', userId)

        if (error) throw error

        showToast('Produk berhasil diperbarui!', 'success')
      } else {
        const { data: newProduct, error } = await supabase
          .from('products')
          .insert([{
            ...payload,
            stock: initialStock
          }])
          .select()
          .single()

        if (error) throw error

        if (!isDigital && initialStock > 0) {
          const { error: movementError } = await supabase
            .from('stock_movements')
            .insert([{
              user_id: userId,
              product_id: newProduct.id,
              change: initialStock,
              reason: 'initial_stock'
            }])

          if (movementError) {
            const { error: rollbackError } = await supabase
              .from('products')
              .delete()
              .eq('id', newProduct.id)
              .eq('user_id', userId)

            if (rollbackError) {
              console.error('Product rollback error:', rollbackError)
              throw new Error(
                'Histori stok gagal disimpan dan produk belum berhasil dibatalkan. Periksa database.'
              )
            }

            throw movementError
          }
        }

        showToast('Produk berhasil ditambahkan!', 'success')
      }

      resetForm()
      await fetchProducts()

    } catch (error) {
      console.error('Save product error:', error)
      showToast('Gagal menyimpan produk: ' + error.message, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleStockChange(product, isAdding) {
    if (!userId || product.product_type === 'digital') return

    const label = isAdding ? 'masuk' : 'keluar/rusak'

    const qtyStr = await showPrompt(
      'Update Stok',
      `Berapa jumlah stok yang ${label} untuk ${product.name}?`,
      '1'
    )

    if (qtyStr === null || qtyStr === '') return

    const qty = Number(qtyStr)

    if (!Number.isInteger(qty) || qty <= 0) {
      showToast('Masukkan jumlah bilangan bulat yang valid!', 'error')
      return
    }

    if (!isAdding && qty > product.stock) {
      showToast('Stok tidak mencukupi!', 'error')
      return
    }

    let reason = 'restock'

    if (!isAdding) {
      reason = await showPrompt(
        'Alasan Pengurangan',
        `Alasan pengurangan stok ${product.name}:`,
        'Barang Rusak'
      )

      if (reason === null) return

      if (!reason.trim()) {
        showToast('Alasan pengurangan wajib diisi.', 'error')
        return
      }
    }

    const oldStock = Number(product.stock)
    const newStock = isAdding ? oldStock + qty : oldStock - qty

    setIsSubmitting(true)

    try {
      const { data: updated, error } = await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', product.id)
        .eq('user_id', userId)
        .eq('stock', oldStock)
        .select('id')

      if (error) throw error

      if (!updated || updated.length === 0) {
        throw new Error(
          'Stok sudah berubah. Muat ulang produk sebelum mencoba lagi.'
        )
      }

      const { error: movementError } = await supabase
        .from('stock_movements')
        .insert([{
          user_id: userId,
          product_id: product.id,
          change: isAdding ? qty : -qty,
          reason: isAdding ? 'restock' : `adjustment: ${reason.trim()}`
        }])

      if (movementError) {
        const { error: rollbackError } = await supabase
          .from('products')
          .update({ stock: oldStock })
          .eq('id', product.id)
          .eq('user_id', userId)
          .eq('stock', newStock)

        if (rollbackError) {
          console.error('Stock rollback error:', rollbackError)
          throw new Error(
            'Histori stok gagal disimpan dan rollback stok juga gagal. Periksa data stok secara manual.'
          )
        }

        throw movementError
      }

      showToast(`Stok ${product.name} berhasil diperbarui!`, 'success')
      await fetchProducts()

    } catch (error) {
      console.error('Stock update error:', error)
      showToast('Gagal memperbarui stok: ' + error.message, 'error')
      await fetchProducts()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(productId) {
    if (!userId) return

    const confirmed = await showConfirm(
      'Hapus Produk',
      'Yakin ingin menghapus produk ini?'
    )

    if (!confirmed) return

    setIsSubmitting(true)

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId)
        .eq('user_id', userId)

      if (error) throw error

      showToast('Produk berhasil dihapus!', 'success')
      await fetchProducts()

    } catch (error) {
      console.error('Delete product error:', error)
      showToast(
        'Gagal menghapus produk. Produk mungkin sudah digunakan dalam transaksi. ' +
        error.message,
        'error'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleImportExcel(e) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!userId) {
      showToast('Sesi login tidak ditemukan.', 'error')
      e.target.value = ''
      return
    }

    setIsSubmitting(true)

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(worksheet)

      if (!rows.length) {
        throw new Error('File Excel kosong atau format salah.')
      }

      const insertedPayload = rows.map((row, index) => {
        const typeValue = String(row['Jenis Produk'] || 'physical').toLowerCase().trim()
        const type = ['digital', 'produk digital'].includes(typeValue)
          ? 'digital'
          : 'physical'

        const productName = String(
          row['Nama Produk'] ?? row['nama'] ?? ''
        ).trim()

        const productPrice = Number(row['Harga Jual'] ?? 0)
        const productCost = Number(row['Harga Modal'] ?? 0)
        const productStock = type === 'digital' ? 0 : Number(row['Stok'] ?? 0)
        const minimumStock = type === 'digital' ? 0 : Number(row['Min Stok'] ?? 0)

        const provider = String(row['Provider'] || '').trim()

        const rawWeight = row['Netto'] ?? row['Berat'] ?? ''
        const weightValue = type === 'digital' || rawWeight === '' || rawWeight === null
          ? null
          : Number(rawWeight)

        const weightUnit = String(
          row['Satuan Netto'] ?? row['Satuan'] ?? ''
        ).trim()

        if (!productName) {
          throw new Error(`Nama produk pada baris ${index + 2} kosong.`)
        }

        if (type === 'digital' && !PROVIDERS.some(p => p.value.toLowerCase() === provider.toLowerCase())) {
          throw new Error(`Provider tidak valid pada baris ${index + 2}.`)
        }

        if (
          !Number.isFinite(productPrice) ||
          productPrice < 0 ||
          !Number.isFinite(productCost) ||
          productCost < 0 ||
          !Number.isInteger(productStock) ||
          productStock < 0 ||
          !Number.isInteger(minimumStock) ||
          minimumStock < 0
        ) {
          throw new Error(`Data tidak valid pada baris ${index + 2}.`)
        }

        if (
          weightValue !== null &&
          (!Number.isFinite(weightValue) ||
            weightValue <= 0 ||
            !NET_WEIGHT_UNITS.some(unit => unit.value === weightUnit))
        ) {
          throw new Error(`Netto atau satuan tidak valid pada baris ${index + 2}.`)
        }

        return {
          user_id: userId,
          name: productName,
          sku: row['SKU'] || row['sku'] || null,
          price: productPrice,
          cost: productCost,
          stock: productStock,
          min_stock: minimumStock,
          product_type: type,
          provider_name: type === 'digital' ? provider : null,
          net_weight: weightValue,
          net_weight_unit: weightValue !== null ? weightUnit : null
        }
      })

      const { data: insertedProducts, error } = await supabase
        .from('products')
        .insert(insertedPayload)
        .select('id, stock')

      if (error) throw error

      const movements = (insertedProducts || [])
        .filter(product => Number(product.stock) > 0)
        .map(product => ({
          user_id: userId,
          product_id: product.id,
          change: product.stock,
          reason: 'initial_stock'
        }))

      if (movements.length > 0) {
        const { error: movementError } = await supabase
          .from('stock_movements')
          .insert(movements)

        if (movementError) {
          const ids = insertedProducts.map(product => product.id)

          const { error: rollbackError } = await supabase
            .from('products')
            .delete()
            .eq('user_id', userId)
            .in('id', ids)

          if (rollbackError) {
            console.error('Import rollback error:', rollbackError)
            throw new Error(
              'Histori import gagal dan rollback juga gagal. Periksa database.'
            )
          }

          throw movementError
        }
      }

      showToast(
        `Berhasil mengimport ${insertedProducts.length} produk!`,
        'success'
      )

      await fetchProducts()

    } catch (error) {
      console.error('Import Excel error:', error)
      showToast('Gagal import: ' + error.message, 'error')
      await fetchProducts()
    } finally {
      setIsSubmitting(false)
      e.target.value = ''
    }
  }

  if (!userId) {
    return (
      <div className="card">
        Sesi login tidak ditemukan. Silakan login kembali.
      </div>
    )
  }

  return (
    <div>
      {showScanner && (
        <BarcodeScanner
          onScan={(code) => {
            setSku(code)
            setShowScanner(false)
          }}
          onClose={() => setShowScanner(false)}
        />
      )}

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
        <h1 style={{ margin: 0 }}>Produk & Stok</h1>

        <label
          htmlFor="excel-upload"
          className="btn-primary"
          style={{
            background: '#10b981',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            opacity: isSubmitting ? 0.6 : 1
          }}
        >
          <FaFileExcel /> Import Excel
        </label>

        <input
          id="excel-upload"
          type="file"
          accept=".xlsx,.xls"
          onChange={handleImportExcel}
          disabled={isSubmitting}
          style={{ display: 'none' }}
        />
      </div>

      <div className="card" style={{ marginBottom: 24, maxWidth: 700 }}>
        <h3>{id ? 'Edit Produk' : 'Tambah Produk Baru'}</h3>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
          <div>
            <label>Jenis Produk</label>
            {/* MENGGUNAKAN SELECT COMPONENT */}
            <Select
              options={[
                { value: 'physical', label: 'Barang Fisik' },
                { value: 'digital', label: 'Produk Digital' }
              ]}
              value={productType}
              onChange={value => {
                setProductType(value)
                if (value === 'digital') {
                  setStock('0')
                  setMinStock('0')
                  setNetWeight('')
                } else if (!id) {
                  setStock('')
                }
              }}
              disabled={!!id}
            />
            {id && (
              <small style={{ color: 'var(--text-muted)' }}>
                Jenis produk tidak dapat diubah setelah produk dibuat.
              </small>
            )}
          </div>

          <input
            required
            placeholder="Nama Produk *"
            value={name}
            onChange={e => setName(e.target.value)}
          />

          {isDigital && (
            <div>
              <label>Provider *</label>
              {/* MENGGUNAKAN SELECT COMPONENT */}
              <Select
                options={PROVIDERS.map(p => ({ value: p.value, label: p.label }))}
                value={providerName}
                onChange={setProviderName}
                placeholder="Pilih Provider"
              />

              {providerName && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                  <ProviderBadge provider={providerName} size={46} />
                  <span style={{ fontWeight: 600 }}>{providerName}</span>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              placeholder="SKU / Kode Barcode"
              value={sku}
              onChange={e => setSku(e.target.value)}
              style={{ flex: 1, minWidth: 0 }}
            />

            {!isDigital && (
              <button
                type="button"
                onClick={() => setShowScanner(true)}
                className="btn-primary"
                disabled={isSubmitting}
                style={{
                  padding: '0 24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  whiteSpace: 'nowrap'
                }}
              >
                <FaBarcode size={18} /> Scan
              </button>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 12
            }}
          >
            <input
              required
              type="number"
              min="0"
              step="1"
              placeholder="Harga Jual (Rp) *"
              value={price}
              onChange={e => setPrice(e.target.value)}
            />

            <input
              type="number"
              min="0"
              step="1"
              placeholder="Harga Modal/HPP (Rp)"
              value={cost}
              onChange={e => setCost(e.target.value)}
            />
          </div>

          {!isDigital && (
            <>
              <div>
                <label>Netto / Berat Bersih</label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 130px',
                    gap: 12
                  }}
                >
                  <input
                    type="number"
                    min="0.001"
                    step="0.001"
                    placeholder="Contoh: 250"
                    value={netWeight}
                    onChange={e => setNetWeight(e.target.value)}
                  />

                  {/* MENGGUNAKAN SELECT COMPONENT */}
                  <Select
                    options={NET_WEIGHT_UNITS.map(u => ({ value: u.value, label: u.label }))}
                    value={netWeightUnit}
                    onChange={setNetWeightUnit}
                  />
                </div>
                <small style={{ color: 'var(--text-muted)' }}>
                  Opsional. Kosongkan jika produk tidak memiliki informasi netto.
                </small>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: 12
                }}
              >
                <div>
                  <input
                    required
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Stok Saat Ini *"
                    value={stock}
                    onChange={e => setStock(e.target.value)}
                    disabled={!!id}
                    style={{ width: '100%' }}
                  />

                  {id && (
                    <small style={{ color: 'var(--text-muted)' }}>
                      Gunakan tombol + Stok atau - Stok untuk mengubah jumlah.
                    </small>
                  )}
                </div>

                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Batas Stok Menipis"
                  value={minStock}
                  onChange={e => setMinStock(e.target.value)}
                />
              </div>
            </>
          )}

          {isDigital && (
            <small style={{ color: 'var(--text-muted)' }}>
              Produk digital tidak menggunakan stok fisik dan netto.
            </small>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="submit" variant="solid" disabled={isSubmitting}>
              {isSubmitting ? 'Menyimpan...' : 'Simpan Produk'}
            </Button>

            {id && (
              <Button
                type="button"
                variant="secondary"
                onClick={resetForm}
                disabled={isSubmitting}
              >
                Batal
              </Button>
            )}
          </div>
        </form>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 200 }} />
      ) : (
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Nama Produk</th>
                <th>Jenis</th>
                <th>Netto / Provider</th>
                <th>Harga Jual</th>
                <th>Stok</th>
                <th>Aksi</th>
              </tr>
            </thead>

            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: 40 }}>
                    <FaBoxOpen
                      size={40}
                      style={{ opacity: 0.2, marginBottom: 12 }}
                    />
                    <p style={{ color: 'var(--text-muted)' }}>
                      Belum ada produk.
                    </p>
                  </td>
                </tr>
              ) : (
                products.map(product => {
                  const digital = product.product_type === 'digital'

                  return (
                    <tr key={product.id}>
                      <td>
                        <strong>{product.name}</strong>
                        <br />
                        <small style={{ color: 'var(--text-muted)' }}>
                          SKU: {product.sku || '-'}
                        </small>
                      </td>

                      <td>
                        <span
                          style={{
                            padding: '4px 8px',
                            borderRadius: 6,
                            fontSize: 12,
                            background: digital ? '#e0f2fe' : '#dcfce7',
                            color: digital ? '#0369a1' : '#166534'
                          }}
                        >
                          {digital ? 'Digital' : 'Fisik'}
                        </span>
                      </td>

                      <td>
                        {digital ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <ProviderBadge provider={product.provider_name} size={34} />
                            <span>{product.provider_name || '-'}</span>
                          </div>
                        ) : (
                          product.net_weight
                            ? `${Number(product.net_weight)} ${product.net_weight_unit || ''}`
                            : '-'
                        )}
                      </td>

                      <td>{formatRupiah(product.price)}</td>

                      <td>
                        {digital ? (
                          <span style={{ color: 'var(--text-muted)' }}>-</span>
                        ) : (
                          <span
                            style={{
                              color:
                                product.stock <= product.min_stock
                                  ? 'red'
                                  : 'inherit',
                              fontWeight:
                                product.stock <= product.min_stock
                                  ? 'bold'
                                  : 'normal'
                            }}
                          >
                            {product.stock}
                          </span>
                        )}
                      </td>

                      <td>
                        <div
                          style={{
                            display: 'flex',
                            gap: 8,
                            flexWrap: 'wrap'
                          }}
                        >
                          {!digital && (
                            <>
                              <Button
                                variant="success"
                                onClick={() => handleStockChange(product, true)}
                                disabled={isSubmitting}
                              >
                                <FaBoxOpen /> + Stok
                              </Button>

                              <Button
                                variant="warning"
                                onClick={() => handleStockChange(product, false)}
                                disabled={isSubmitting}
                              >
                                <FaMinusCircle /> - Stok
                              </Button>
                            </>
                          )}

                          <Button
                            variant="secondary"
                            onClick={() => editProduct(product)}
                            disabled={isSubmitting}
                          >
                            <FaEdit /> Edit
                          </Button>

                          <Button
                            variant="danger"
                            onClick={() => handleDelete(product.id)}
                            disabled={isSubmitting}
                          >
                            <FaTrash /> Hapus
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}