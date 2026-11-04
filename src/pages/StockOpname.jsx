import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useUI } from '../context/UIContext'
import { logActivity } from '../lib/logger'
import Button from '../components/ui/Button'
import { FaCheck, FaClipboardList } from 'react-icons/fa'

export default function StockOpname() {
  const { session } = useAuth()
  const { showToast } = useUI()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [auditData, setAuditData] = useState({}) // Format: { productId: stokFisik }

  useEffect(() => {
    async function fetchProducts() {
      const { data } = await supabase.from('products').select('*').order('name')
      if (data) setProducts(data)
      setLoading(false)
    }
    fetchProducts()
  }, [])

  function handleActualStockChange(id, value) {
    setAuditData(prev => ({ ...prev, [id]: value }))
  }

  async function handleSaveAudit() {
    setIsSaving(true)
    let updatedCount = 0

    try {
      for (const prod of products) {
        const actualStr = auditData[prod.id]
        if (actualStr === undefined || actualStr === '') continue // Skip jika tidak diisi

        const actual = Number(actualStr)
        const diff = actual - prod.stock

        // Jika ada selisih, update database dan catat di log
        if (diff !== 0) {
          // 1. Update stok di tabel produk
          await supabase.from('products').update({ stock: actual }).eq('id', prod.id)
          
          // 2. Catat pergerakan stok (selisihnya)
          await supabase.from('stock_movements').insert([{
            user_id: session.user.id,
            product_id: prod.id,
            change: diff,
            reason: 'stock_opname'
          }])
          updatedCount++
        }
      }
      
      await logActivity(session.user.id, 'STOCK_OPNAME', `Melakukan penyesuaian stok untuk ${updatedCount} produk.`)
      showToast(`Stock Opname berhasil! ${updatedCount} produk disesuaikan.`, 'success')
      setAuditData({}) // Reset form
      
      // Refresh data produk
      const { data } = await supabase.from('products').select('*').order('name')
      if (data) setProducts(data)

    } catch (error) {
      showToast('Gagal menyimpan audit stok.', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) return <div className="skeleton" style={{ height: 400, marginTop: 24 }}></div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}><FaClipboardList color="var(--primary)"/> Stock Opname (Audit Stok)</h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: 14 }}>Masukkan jumlah stok fisik asli di toko. Sistem akan menghitung selisihnya.</p>
        </div>
        <Button variant="solid" onClick={handleSaveAudit} disabled={isSaving || Object.keys(auditData).length === 0}>
          <FaCheck /> {isSaving ? 'Menyimpan...' : 'Simpan Penyesuaian'}
        </Button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead style={{ background: 'var(--bg-color)' }}>
            <tr>
              <th>Nama Produk</th>
              <th style={{ textAlign: 'center' }}>Stok Sistem</th>
              <th style={{ textAlign: 'center', width: 150 }}>Stok Fisik (Asli)</th>
              <th style={{ textAlign: 'center' }}>Selisih</th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => {
              const actualStr = auditData[p.id]
              const actual = actualStr !== undefined && actualStr !== '' ? Number(actualStr) : null
              const diff = actual !== null ? actual - p.stock : null

              return (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong><br/><small style={{ color: 'var(--text-muted)' }}>SKU: {p.sku || '-'}</small></td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 16 }}>{p.stock}</td>
                  <td style={{ textAlign: 'center' }}>
                    <input 
                      type="number" 
                      min="0" 
                      placeholder="-" 
                      value={actualStr || ''} 
                      onChange={e => handleActualStockChange(p.id, e.target.value)}
                      style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 16, border: actual !== null ? '2px solid var(--primary)' : '1px solid var(--border-color)' }} 
                    />
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 16, color: diff === 0 ? '#10b981' : diff > 0 ? '#3b82f6' : '#ef4444' }}>
                    {diff === null ? '-' : diff > 0 ? `+${diff}` : diff}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}