
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
import * as XLSX from 'xlsx'

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

  const userId = session?.user?.id

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
  }

  function editProduct(product) {
    setId(product.id)
    setName(product.name)
    setSku(product.sku || '')
    setPrice(product.price)
    setCost(product.cost)
    setStock(String(product.stock ?? 0))
    setMinStock(String(product.min_stock ?? 0))

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
    const initialStock = Number(stock)
    const minimumStock = minStock === '' ? 0 : Number(minStock)

    if (!productName) {
      showToast('Nama produk wajib diisi.', 'error')
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
      !id &&
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
        min_stock: minimumStock,
        user_id: userId
      }

      if (id) {
        // Edit produk tidak boleh mengubah stok secara langsung.
        const { error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', id)
          .eq('user_id', userId)

        if (error) throw error

        showToast('Produk berhasil diperbarui!', 'success')
      } else {
        // Tambahkan produk baru.
        const { data: newProduct, error } = await supabase
          .from('products')
          .insert([{
            ...payload,
            stock: initialStock
          }])
          .select()
          .single()

        if (error) throw error

        // Catat stok awal jika jumlahnya lebih dari 0.
        if (initialStock > 0) {
          const { error: movementError } = await supabase
            .from('stock_movements')
            .insert([{
              user_id: userId,
              product_id: newProduct.id,
              change: initialStock,
              reason: 'initial_stock'
            }])

          if (movementError) {
            // Coba batalkan produk jika histori gagal dicatat.
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
    if (!userId) {
      showToast('Sesi login tidak ditemukan.', 'error')
      return
    }

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
    const newStock = isAdding
      ? oldStock + qty
      : oldStock - qty

    setIsSubmitting(true)

    try {
      // Update stok dengan pengecekan stok sebelumnya.
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

      // Catat histori pergerakan stok.
      const { error: movementError } = await supabase
        .from('stock_movements')
        .insert([{
          user_id: userId,
          product_id: product.id,
          change: isAdding ? qty : -qty,
          reason: isAdding
            ? 'restock'
            : `adjustment: ${reason.trim()}`
        }])

      if (movementError) {
        // Rollback stok jika histori gagal disimpan.
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

      showToast(
        `Stok ${product.name} berhasil diperbarui!`,
        'success'
      )

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

      const payload = rows.map((row, index) => {
        const productName = String(
          row['Nama Produk'] ?? row['nama'] ?? ''
        ).trim()

        const productPrice = Number(row['Harga Jual'] ?? 0)
        const productCost = Number(row['Harga Modal'] ?? 0)
        const productStock = Number(row['Stok'] ?? 0)
        const minimumStock = Number(row['Min Stok'] ?? 0)

        if (!productName) {
          throw new Error(`Nama produk pada baris ${index + 2} kosong.`)
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

        return {
          user_id: userId,
          name: productName,
          sku: row['SKU'] || row['sku'] || null,
          price: productPrice,
          cost: productCost,
          stock: productStock,
          min_stock: minimumStock
        }
      })

      // Simpan produk dan ambil ID yang berhasil dibuat.
      const { data: insertedProducts, error } = await supabase
        .from('products')
        .insert(payload)
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
          // Coba batalkan seluruh produk hasil import.
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

      <div
        className="card"
        style={{ marginBottom: 24, maxWidth: 700 }}
      >
        <h3>{id ? 'Edit Produk' : 'Tambah Produk Baru'}</h3>

        <form
          onSubmit={handleSubmit}
          style={{ display: 'grid', gap: 12 }}
        >
          <input
            required
            placeholder="Nama Produk *"
            value={name}
            onChange={e => setName(e.target.value)}
          />

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              placeholder="SKU / Kode Barcode"
              value={sku}
              onChange={e => setSku(e.target.value)}
              style={{ flex: 1, minWidth: 0 }}
            />

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

          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type="submit"
              variant="solid"
              disabled={isSubmitting}
            >
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
                <th>Harga Jual</th>
                <th>Stok</th>
                <th>Aksi</th>
              </tr>
            </thead>

            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: 40 }}>
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
                products.map(product => (
                  <tr key={product.id}>
                    <td>
                      <strong>{product.name}</strong>
                      <br />
                      <small style={{ color: 'var(--text-muted)' }}>
                        SKU: {product.sku || '-'}
                      </small>
                    </td>

                    <td>{formatRupiah(product.price)}</td>

                    <td>
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
                    </td>

                    <td>
                      <div
                        style={{
                          display: 'flex',
                          gap: 8,
                          flexWrap: 'wrap'
                        }}
                      >
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
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
