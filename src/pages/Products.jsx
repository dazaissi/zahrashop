import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useUI } from '../context/UIContext'
import { formatRupiah } from '../lib/format'
import BarcodeScanner from '../components/BarcodeScanner'
import { FaBoxOpen, FaEdit, FaTrash, FaBarcode, FaMinusCircle, FaFileExcel } from 'react-icons/fa'
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

  useEffect(() => { if (session) fetchProducts() }, [session])

  async function fetchProducts() {
    setLoading(true)
    const { data, error } = await supabase.from('products').select('*').order('name')
    if (error) showToast("Gagal memuat produk: " + error.message, 'error')
    else setProducts(data)
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setIsSubmitting(true)
    const payload = { name, sku: sku || null, price: Number(price) || 0, cost: Number(cost) || 0, stock: Number(stock) || 0, min_stock: Number(minStock) || 0, user_id: session.user.id }
    if (id) await supabase.from('products').update(payload).eq('id', id)
    else await supabase.from('products').insert([payload])
    resetForm(); fetchProducts(); setIsSubmitting(false); showToast('Produk disimpan!', 'success')
  }

  async function handleStockChange(product, isAdding) {
    const label = isAdding ? "masuk" : "keluar/rusak"
    const qtyStr = await showPrompt('Update Stok', `Berapa jumlah stok yang ${label} untuk ${product.name}?`, "1")
    if (!qtyStr) return
    const qty = parseInt(qtyStr, 10)
    if (isNaN(qty) || qty <= 0) return showToast('Masukkan angka yang valid!', 'error')
    if (!isAdding && qty > product.stock) return showToast('Stok tidak mencukupi!', 'error')

    let reason = 'restock'
    if (!isAdding) {
      reason = await showPrompt('Alasan Pengurangan', `Alasan pengurangan stok ${product.name}:`, "Barang Rusak")
      if (reason === null) return
    }

    setIsSubmitting(true)
    const newStock = isAdding ? product.stock + qty : product.stock - qty
    const { error } = await supabase.from('products').update({ stock: newStock }).eq('id', product.id)
    
    if (!error) {
      await supabase.from('stock_movements').insert([{ user_id: session.user.id, product_id: product.id, change: isAdding ? qty : -qty, reason: isAdding ? 'restock' : `adjustment: ${reason}` }])
      showToast(`Stok ${product.name} diupdate!`, 'success')
      fetchProducts()
    }
    setIsSubmitting(false)
  }

  async function handleDelete(id) {
    if (await showConfirm('Hapus Produk', 'Yakin ingin menghapus produk ini?')) {
      await supabase.from('products').delete().eq('id', id)
      showToast('Produk dihapus', 'success')
      fetchProducts()
    }
  }

  function editProduct(p) { setId(p.id); setName(p.name); setSku(p.sku || ''); setPrice(p.price); setCost(p.cost); setStock(p.stock); setMinStock(p.min_stock) }
  function resetForm() { setId(null); setName(''); setSku(''); setPrice(''); setCost(''); setStock(''); setMinStock('') }

  function handleImportExcel(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
        if (data.length === 0) return showToast('File Excel kosong atau format salah.', 'error')

        setIsSubmitting(true)
        const payload = data.map(row => ({
          user_id: session.user.id, name: row['Nama Produk'] || row['nama'] || 'Tanpa Nama',
          sku: row['SKU'] || row['sku'] || null, price: Number(row['Harga Jual']) || 0,
          cost: Number(row['Harga Modal']) || 0, stock: Number(row['Stok']) || 0, min_stock: Number(row['Min Stok']) || 0
        }))
        const { error } = await supabase.from('products').insert(payload)
        if (error) showToast('Gagal import: ' + error.message, 'error')
        else showToast(`Berhasil import ${payload.length} produk!`, 'success')
        fetchProducts(); setIsSubmitting(false)
      } catch (err) { showToast('Gagal membaca file Excel.', 'error') }
    }
    reader.readAsBinaryString(file); e.target.value = null
  }

  return (
    <div>
      {showScanner && <BarcodeScanner onScan={(code) => { setSku(code); setShowScanner(false) }} onClose={() => setShowScanner(false)} />}
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <h1 style={{ margin: 0 }}>Produk & Stok</h1>
        <label htmlFor="excel-upload" className="btn-primary" style={{ background: '#10b981', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <FaFileExcel /> Import Excel
        </label>
        <input id="excel-upload" type="file" accept=".xlsx, .xls" onChange={handleImportExcel} style={{ display: 'none' }} />
      </div>
      
      <div className="card" style={{ marginBottom: 24, maxWidth: 700 }}>
        <h3>{id ? 'Edit Produk' : 'Tambah Produk Baru'}</h3>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
          <input required placeholder="Nama Produk *" value={name} onChange={e => setName(e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <input placeholder="SKU / Kode Barcode" value={sku} onChange={e => setSku(e.target.value)} style={{ flex: 1 }} />
            <button 
              type="button" 
              onClick={() => setShowScanner(true)} 
              className="btn-primary" 
              style={{ padding: '0 24px', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}
            >
              <FaBarcode size={18} /> Scan
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <input required type="number" placeholder="Harga Jual (Rp) *" value={price} onChange={e => setPrice(e.target.value)} />
            <input type="number" placeholder="Harga Modal/HPP (Rp)" value={cost} onChange={e => setCost(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <input required type="number" placeholder="Stok Saat Ini *" value={stock} onChange={e => setStock(e.target.value)} />
            <input type="number" placeholder="Batas Stok Menipis" value={minStock} onChange={e => setMinStock(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="submit" variant="solid" disabled={isSubmitting}>{isSubmitting ? 'Menyimpan...' : 'Simpan Produk'}</Button>
            {id && <Button type="button" variant="secondary" onClick={resetForm}>Batal</Button>}
          </div>
        </form>
      </div>

      {loading ? <div className="skeleton" style={{ height: 200 }}></div> : (
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table>
            <thead><tr><th>Nama Produk</th><th>Harga Jual</th><th>Stok</th><th>Aksi</th></tr></thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong><br/><small style={{ color: 'var(--text-muted)' }}>SKU: {p.sku || '-'}</small></td>
                  <td>{formatRupiah(p.price)}</td>
                  <td><span style={{ color: p.stock <= p.min_stock ? 'red' : 'inherit', fontWeight: p.stock <= p.min_stock ? 'bold' : 'normal' }}>{p.stock}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Button variant="success" onClick={() => handleStockChange(p, true)} disabled={isSubmitting}><FaBoxOpen /> + Stok</Button>
                      <Button variant="warning" onClick={() => handleStockChange(p, false)} disabled={isSubmitting}><FaMinusCircle /> - Stok</Button>
                      <Button variant="secondary" onClick={() => editProduct(p)}><FaEdit /> Edit</Button>
                      <Button variant="danger" onClick={() => handleDelete(p.id)}><FaTrash /> Hapus</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}