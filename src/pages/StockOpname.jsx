
import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useUI } from '../context/UIContext'
import { logActivity } from '../lib/logger'

import Button from '../components/ui/Button'
import {
  FaCheck,
  FaClipboardList,
  FaBoxOpen,
  FaExclamationTriangle
} from 'react-icons/fa'

export default function StockOpname() {
  const { session } = useAuth()
  const { showToast } = useUI()

  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [auditData, setAuditData] = useState({})

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
      console.error('Fetch stock opname error:', error)
      showToast('Gagal memuat data stok: ' + error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  function handleActualStockChange(id, value) {
    if (value !== '' && (!/^\d+$/.test(value) || Number(value) < 0)) {
      return
    }

    setAuditData(prev => ({
      ...prev,
      [id]: value
    }))
  }

  async function handleSaveAudit() {
    if (!userId) {
      showToast('Sesi login tidak ditemukan.', 'error')
      return
    }

    const changedProducts = products.filter(product => {
      const value = auditData[product.id]

      return value !== undefined && value !== ''
    })

    if (changedProducts.length === 0) {
      showToast('Belum ada stok fisik yang diisi.', 'error')
      return
    }

    // Validasi seluruh input sebelum menyimpan.
    for (const product of changedProducts) {
      const actual = Number(auditData[product.id])

      if (!Number.isInteger(actual) || actual < 0) {
        showToast(
          `Stok fisik ${product.name} tidak valid.`,
          'error'
        )
        return
      }
    }

    setIsSaving(true)

    let updatedCount = 0
    let failedCount = 0
    const remainingAudit = { ...auditData }
    const failedNames = []

    try {
      for (const product of changedProducts) {
        const actual = Number(auditData[product.id])
        const oldStock = Number(product.stock)
        const diff = actual - oldStock

        if (diff === 0) {
          delete remainingAudit[product.id]
          continue
        }

        try {
          // Update hanya jika stok belum berubah sejak data dimuat.
          const { data: updated, error } = await supabase
            .from('products')
            .update({ stock: actual })
            .eq('id', product.id)
            .eq('user_id', userId)
            .eq('stock', oldStock)
            .select('id')

          if (error) throw error

          if (!updated || updated.length === 0) {
            throw new Error(
              'Stok sudah berubah. Muat ulang data sebelum melakukan opname.'
            )
          }

          // Catat selisih stok.
          const { error: movementError } = await supabase
            .from('stock_movements')
            .insert([{
              user_id: userId,
              product_id: product.id,
              change: diff,
              reason: 'stock_opname'
            }])

          if (movementError) {
            // Kembalikan stok apabila histori gagal disimpan.
            const { error: rollbackError } = await supabase
              .from('products')
              .update({ stock: oldStock })
              .eq('id', product.id)
              .eq('user_id', userId)
              .eq('stock', actual)

            if (rollbackError) {
              console.error('Stock opname rollback error:', rollbackError)

              throw new Error(
                'Histori gagal disimpan dan rollback gagal. Periksa stok secara manual.'
              )
            }

            throw movementError
          }

          updatedCount++
          delete remainingAudit[product.id]

        } catch (error) {
          console.error(
            `Stock opname error for ${product.name}:`,
            error
          )

          failedCount++
          failedNames.push(product.name)
        }
      }

      // Simpan log aktivitas jika ada perubahan yang berhasil.
      if (updatedCount > 0) {
        try {
          await logActivity(
            userId,
            'STOCK_OPNAME',
            `Melakukan penyesuaian stok untuk ${updatedCount} produk.`
          )
        } catch (logError) {
          // Kegagalan log aktivitas tidak membatalkan perubahan stok.
          console.error('Activity log error:', logError)
        }
      }

      setAuditData(remainingAudit)

      await fetchProducts()

      if (failedCount === 0) {
        showToast(
          `Stock Opname berhasil! ${updatedCount} produk disesuaikan.`,
          'success'
        )
      } else {
        showToast(
          `${updatedCount} produk berhasil, ${failedCount} produk gagal. Input yang gagal tetap dipertahankan.`,
          'error'
        )

        console.error('Failed products:', failedNames)
      }

    } catch (error) {
      console.error('Save stock opname error:', error)
      showToast('Gagal menyimpan Stock Opname: ' + error.message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  if (!userId) {
    return (
      <div className="card">
        Sesi login tidak ditemukan. Silakan login kembali.
      </div>
    )
  }

  if (loading) {
    return (
      <div
        className="skeleton"
        style={{ height: 400, marginTop: 24 }}
      />
    )
  }

  const pendingCount = products.filter(product => {
    const value = auditData[product.id]

    return value !== undefined && value !== ''
  }).length

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
        <div>
          <h1
            style={{
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 12
            }}
          >
            <FaClipboardList color="var(--primary)" />
            Stock Opname
          </h1>

          <p
            style={{
              color: 'var(--text-muted)',
              margin: '4px 0 0',
              fontSize: 14
            }}
          >
            Masukkan jumlah stok fisik asli. Sistem akan menghitung
            selisihnya secara otomatis.
          </p>
        </div>

        <Button
          variant="solid"
          onClick={handleSaveAudit}
          disabled={isSaving || pendingCount === 0}
        >
          <FaCheck />
          {isSaving ? 'Menyimpan...' : 'Simpan Penyesuaian'}
        </Button>
      </div>

      {pendingCount > 0 && (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: 'var(--bg-color)',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <FaExclamationTriangle color="#eab308" />

          <span style={{ fontSize: 14 }}>
            {pendingCount} produk sudah diisi dan menunggu penyesuaian.
          </span>
        </div>
      )}

      <div
        className="card"
        style={{ padding: 0, overflow: 'hidden' }}
      >
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <table style={{ minWidth: 600 }}>
            <thead style={{ background: 'var(--bg-color)' }}>
              <tr>
                <th>Nama Produk</th>

                <th style={{ textAlign: 'center' }}>
                  Stok Sistem
                </th>

                <th style={{ textAlign: 'center', width: 150 }}>
                  Stok Fisik (Asli)
                </th>

                <th style={{ textAlign: 'center' }}>
                  Selisih
                </th>
              </tr>
            </thead>

            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td
                    colSpan="4"
                    style={{
                      textAlign: 'center',
                      padding: '40px 20px'
                    }}
                  >
                    <FaBoxOpen
                      size={40}
                      style={{
                        opacity: 0.2,
                        marginBottom: 12
                      }}
                    />

                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                      Belum ada produk di database.
                    </p>
                  </td>
                </tr>
              ) : (
                products.map(product => {
                  const actualStr = auditData[product.id]

                  const actual =
                    actualStr !== undefined && actualStr !== ''
                      ? Number(actualStr)
                      : null

                  const diff =
                    actual !== null
                      ? actual - Number(product.stock)
                      : null

                  return (
                    <tr key={product.id}>
                      <td>
                        <strong>{product.name}</strong>
                        <br />

                        <small style={{ color: 'var(--text-muted)' }}>
                          SKU: {product.sku || '-'}
                        </small>
                      </td>

                      <td
                        style={{
                          textAlign: 'center',
                          fontWeight: 'bold',
                          fontSize: 16
                        }}
                      >
                        {product.stock}
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="-"
                          value={actualStr ?? ''}
                          disabled={isSaving}
                          onChange={e =>
                            handleActualStockChange(
                              product.id,
                              e.target.value
                            )
                          }
                          style={{
                            width: '100%',
                            maxWidth: 120,
                            textAlign: 'center',
                            fontWeight: 'bold',
                            fontSize: 16,
                            border:
                              actual !== null
                                ? '2px solid var(--primary)'
                                : '1px solid var(--border-color)'
                          }}
                        />
                      </td>

                      <td
                        style={{
                          textAlign: 'center',
                          fontWeight: 'bold',
                          fontSize: 16,
                          color:
                            diff === null
                              ? 'inherit'
                              : diff === 0
                                ? '#10b981'
                                : diff > 0
                                  ? '#3b82f6'
                                  : '#ef4444'
                        }}
                      >
                        {diff === null
                          ? '-'
                          : diff > 0
                            ? `+${diff}`
                            : diff}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
