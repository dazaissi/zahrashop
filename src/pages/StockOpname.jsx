import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useUI } from '../context/UIContext'
import { logActivity } from '../lib/logger'
import Button from '../components/ui/Button'
import { FaCheck, FaClipboardList, FaBoxOpen, FaExclamationTriangle, FaSyncAlt, FaCircle } from 'react-icons/fa'

export default function StockOpname() {
  const { session } = useAuth()
  const { showToast } = useUI()

  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [auditData, setAuditData] = useState({})
  const [realtimeConnected, setRealtimeConnected] = useState(false)

  const userId = session?.user?.id
  const fetchRef = useRef(null)
  const timerRef = useRef(null)

  const fetchProducts = useCallback(async ({ silent = false } = {}) => {
    if (!userId) return
    if (!silent) setLoading(true)
    try {
      // Perbaikan: Hapus .eq('user_id', userId) agar Admin bisa melihat produk Owner
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('Fetch stock opname error:', error)
      if (!silent) showToast('Gagal memuat data stok: ' + error.message, 'error')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [userId, showToast])

  useEffect(() => { fetchRef.current = fetchProducts }, [fetchProducts])

  useEffect(() => {
    if (userId) fetchProducts()
  }, [userId, fetchProducts])

  // Realtime untuk update stok dari perangkat lain
  useEffect(() => {
    if (!userId) return
    const ch = supabase.channel(`opname-rt-${userId}-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => fetchRef.current?.({ silent: true }), 250)
      })
      .subscribe(s => setRealtimeConnected(s === 'SUBSCRIBED'))
    return () => {
      setRealtimeConnected(false)
      supabase.removeChannel(ch)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [userId])

  function handleActualStockChange(id, value) {
    if (value !== '' && (!/^\d+$/.test(value) || Number(value) < 0)) return
    setAuditData(prev => ({ ...prev, [id]: value }))
  }

  async function handleSaveAudit() {
    if (!userId) return showToast('Sesi login tidak ditemukan.', 'error')

    const changedProducts = products.filter(product => {
      const value = auditData[product.id]
      return value !== undefined && value !== ''
    })

    if (changedProducts.length === 0) return showToast('Belum ada stok fisik yang diisi.', 'error')

    for (const product of changedProducts) {
      const actual = Number(auditData[product.id])
      if (!Number.isInteger(actual) || actual < 0) {
        return showToast(`Stok fisik ${product.name} tidak valid.`, 'error')
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
          const { data: updated, error } = await supabase
            .from('products')
            .update({ stock: actual })
            .eq('id', product.id)
            .eq('stock', oldStock)
            .select('id')

          if (error) throw error
          if (!updated || updated.length === 0) throw new Error('Stok sudah berubah. Muat ulang data.')

          const { error: movementError } = await supabase
            .from('stock_movements')
            .insert([{ user_id: userId, product_id: product.id, change: diff, reason: 'stock_opname' }])

          if (movementError) {
            await supabase.from('products').update({ stock: oldStock }).eq('id', product.id).eq('stock', actual)
            throw movementError
          }

          updatedCount++
          delete remainingAudit[product.id]
        } catch (error) {
          console.error(`Stock opname error for ${product.name}:`, error)
          failedCount++
          failedNames.push(product.name)
        }
      }

      if (updatedCount > 0) {
        try { await logActivity(userId, 'STOCK_OPNAME', `Melakukan penyesuaian stok untuk ${updatedCount} produk.`) } catch (e) {}
      }

      setAuditData(remainingAudit)
      await fetchProducts({ silent: true })

      if (failedCount === 0) showToast(`Stock Opname berhasil! ${updatedCount} produk disesuaikan.`, 'success')
      else showToast(`${updatedCount} berhasil, ${failedCount} gagal.`, 'error')

    } catch (error) {
      showToast('Gagal menyimpan Stock Opname: ' + error.message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  if (!userId) return <div className="card">Sesi login tidak ditemukan.</div>
  if (loading) return <div className="skeleton" style={{ height: 400, marginTop: 24 }} />

  const pendingCount = products.filter(product => auditData[product.id] !== undefined && auditData[product.id] !== '').length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
            <FaClipboardList color="var(--primary)" /> Stock Opname
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: 14 }}>Masukkan jumlah stok fisik asli. Sistem akan menghitung selisihnya.</p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" onClick={() => fetchProducts()} disabled={isSaving || loading}>
            <FaSyncAlt style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
          </Button>
          <Button variant="solid" onClick={handleSaveAudit} disabled={isSaving || pendingCount === 0}>
            <FaCheck /> {isSaving ? 'Menyimpan...' : 'Simpan Penyesuaian'}
          </Button>
        </div>
      </div>

      {pendingCount > 0 && (
        <div style={{ padding: 12, borderRadius: 8, background: 'var(--bg-color)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <FaExclamationTriangle color="#eab308" />
          <span style={{ fontSize: 14 }}>{pendingCount} produk sudah diisi dan menunggu penyesuaian.</span>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <table style={{ minWidth: 600 }}>
            <thead style={{ background: 'var(--bg-color)' }}>
              <tr>
                <th>Nama Produk</th>
                <th style={{ textAlign: 'center' }}>Stok Sistem</th>
                <th style={{ textAlign: 'center', width: 150 }}>Stok Fisik (Asli)</th>
                <th style={{ textAlign: 'center' }}>Selisih</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr><td colSpan="4" style={{ textAlign: 'center', padding: '40px 20px' }}><FaBoxOpen size={40} style={{ opacity: 0.2, marginBottom: 12 }} /><p style={{ color: 'var(--text-muted)', margin: 0 }}>Belum ada produk.</p></td></tr>
              ) : products.map(product => {
                const actualStr = auditData[product.id]
                const actual = actualStr !== undefined && actualStr !== '' ? Number(actualStr) : null
                const diff = actual !== null ? actual - Number(product.stock) : null

                return (
                  <tr key={product.id}>
                    <td>
                      <strong>{product.name}</strong><br />
                      <small style={{ color: 'var(--text-muted)' }}>SKU: {product.sku || '-'}</small>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 16 }}>{product.stock}</td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="number" min="0" step="1" placeholder="-"
                        value={actualStr ?? ''} disabled={isSaving}
                        onChange={e => handleActualStockChange(product.id, e.target.value)}
                        style={{ width: '100%', maxWidth: 120, textAlign: 'center', fontWeight: 'bold', fontSize: 16, border: actual !== null ? '2px solid var(--primary)' : '1px solid var(--border-color)' }}
                      />
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 16, color: diff === null ? 'inherit' : diff === 0 ? '#10b981' : diff > 0 ? '#3b82f6' : '#ef4444' }}>
                      {diff === null ? '-' : diff > 0 ? `+${diff}` : diff}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}