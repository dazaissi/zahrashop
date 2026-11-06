import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useUI } from '../context/UIContext'
import { formatRupiah, formatTanggal } from '../lib/format' // Tambah formatTanggal
import { logActivity } from '../lib/logger'
import BarcodeScanner from '../components/BarcodeScanner'
import { FaBoxOpen, FaEdit, FaTrash, FaBarcode, FaMinusCircle, FaFileExcel, FaFileExport, FaSearch, FaTimes, FaTags, FaCheck, FaSyncAlt, FaCircle, FaHistory } from 'react-icons/fa'
import Button from '../components/ui/Button'
import Select from '../components/ui/Select'
import Modal from '../components/ui/Modal' // Import Modal
import * as XLSX from 'xlsx'

const NET_WEIGHT_UNITS = [{ value: 'g', label: 'Gram (g)' }, { value: 'kg', label: 'Kilogram (kg)' }, { value: 'ml', label: 'Mililiter (ml)' }, { value: 'L', label: 'Liter (L)' }]
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

function getCategoryColorClass(category) {
  if (!category) return ''
  const colors = ['cat-pink', 'cat-blue', 'cat-green', 'cat-purple', 'cat-orange', 'cat-teal', 'cat-indigo']
  let hash = 0
  for (let i = 0; i < category.length; i++) hash = category.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function ProviderBadge({ provider, size = 42 }) {
  const item = PROVIDERS.find(p => p.value === provider)
  const color = item?.color || '#64748b'
  const label = item?.short || provider?.slice(0, 5).toUpperCase() || '?'
  return (
    <div title={provider || 'Provider'} style={{ width: size, height: size, minWidth: size, borderRadius: 10, background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: label.length > 4 ? 10 : 13, letterSpacing: 0.3 }}>
      {label}
    </div>
  )
}

function getTimeAgo(iso) {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'baru saja'
  if (min < 60) return `${min} menit lalu`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} jam lalu`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day} hari lalu`
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function Products() {
  const { session, profile } = useAuth() 
  const { showConfirm, showPrompt, showToast } = useUI()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const [id, setId] = useState(null)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [sku, setSku] = useState('')
  const [price, setPrice] = useState('')
  const [cost, setCost] = useState('')
  const [stock, setStock] = useState('')
  const [minStock, setMinStock] = useState('')
  const [netWeight, setNetWeight] = useState('')
  const [netWeightUnit, setNetWeightUnit] = useState('g')
  const [productType, setProductType] = useState('physical')
  const [providerName, setProviderName] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [customCategories, setCustomCategories] = useState([])

  // STATE UNTUK KARTU STOK
  const [showHistory, setShowHistory] = useState(false)
  const [historyProduct, setHistoryProduct] = useState(null)
  const [historyMovements, setHistoryMovements] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const userId = session?.user?.id
  const isDigital = productType === 'digital'

  const userRole = String(profile?.role || '').toLowerCase()
  const canEditStock = userRole === 'owner' || userRole === 'admin'
  const canEditProduct = userRole === 'owner' || userRole === 'admin'
  const canDelete = userRole === 'owner' 

  const fetchProductsRef = useRef(null)
  const refetchTimerRef = useRef(null)

  const fetchProducts = useCallback(async ({ silent = false } = {}) => {
    if (!userId) return
    if (!silent) setLoading(true)
    try {
      const { data, error } = await supabase.from('products').select('*').order('name', { ascending: true })
      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('Fetch products error:', error)
      if (!silent) showToast('Gagal memuat produk: ' + error.message, 'error')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [userId, showToast])

  useEffect(() => { fetchProductsRef.current = fetchProducts }, [fetchProducts])

  const scheduleRefetch = useCallback(() => {
    if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current)
    refetchTimerRef.current = setTimeout(() => { fetchProductsRef.current?.({ silent: true }) }, 250)
  }, [])

  useEffect(() => { return () => { if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current) } }, [])
  useEffect(() => { if (userId) fetchProducts() }, [userId, fetchProducts])

  useEffect(() => {
    if (!userId) return
    const channelName = `products-realtime-${userId}-${crypto.randomUUID()}`
    const channel = supabase.channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_movements' }, scheduleRefetch)
      .subscribe((status) => { setRealtimeConnected(status === 'SUBSCRIBED') })
    return () => { setRealtimeConnected(false); supabase.removeChannel(channel) }
  }, [userId, scheduleRefetch])

  useEffect(() => {
    if (!userId) return
    const onVisible = () => { if (document.visibilityState === 'visible') fetchProductsRef.current?.({ silent: true }) }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [userId])

  const categories = useMemo(() => {
    const fromProducts = products.map(product => product.category?.trim()).filter(Boolean)
    const combined = [...new Set([...fromProducts, ...customCategories])]
    return combined.sort((a, b) => a.localeCompare(b, 'id', { sensitivity: 'base' }))
  }, [products, customCategories])

  const filteredProducts = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()
    return products.filter(product => {
      const matchesSearch = !keyword || product.name?.toLowerCase().includes(keyword) || product.sku?.toLowerCase().includes(keyword) || product.provider_name?.toLowerCase().includes(keyword)
      const productCategory = product.category?.trim() || ''
      const matchesCategory = categoryFilter === '' ? true : categoryFilter === '__uncategorized__' ? !productCategory : productCategory.toLowerCase() === categoryFilter.toLowerCase()
      return matchesSearch && matchesCategory
    })
  }, [products, searchTerm, categoryFilter])

  // FUNGSI KARTU STOK
  async function handleViewHistory(product) {
    setHistoryProduct(product)
    setShowHistory(true)
    setLoadingHistory(true)
    try {
      const { data, error } = await supabase
        .from('stock_movements')
        .select('*')
        .eq('product_id', product.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      setHistoryMovements(data || [])
    } catch (err) {
      showToast('Gagal memuat riwayat stok: ' + err.message, 'error')
    } finally {
      setLoadingHistory(false)
    }
  }

  function resetForm() {
    setId(null); setName(''); setCategory(''); setIsAddingCategory(false); setNewCategory(''); setSku(''); setPrice(''); setCost(''); setStock(''); setMinStock(''); setNetWeight(''); setNetWeightUnit('g'); setProductType('physical'); setProviderName('')
  }

  function handleCategoryChange(value) {
    if (value === '__add_new__') { setIsAddingCategory(true); setNewCategory(''); setCategory(''); return }
    setIsAddingCategory(false); setNewCategory(''); setCategory(value)
  }

  function confirmNewCategory() {
    const value = newCategory.trim()
    if (!value) { showToast('Nama kategori wajib diisi.', 'error'); return }
    const existing = categories.find(item => item.toLowerCase() === value.toLowerCase())
    const finalVal = existing || value
    if (!existing) setCustomCategories(prev => [...prev, value])
    setCategory(finalVal)
    setIsAddingCategory(false)
    setNewCategory('')
  }

  function editProduct(product) {
    if (!canEditProduct) { showToast('Anda tidak memiliki izin mengedit produk.', 'error'); return }
    setId(product.id); setName(product.name); setCategory(product.category || ''); setIsAddingCategory(false); setNewCategory(''); setSku(product.sku || ''); setPrice(product.price); setCost(product.cost); setStock(String(product.stock ?? 0)); setMinStock(String(product.min_stock ?? 0)); setNetWeight(product.net_weight ?? ''); setNetWeightUnit(product.net_weight_unit || 'g'); setProductType(product.product_type || 'physical'); setProviderName(product.provider_name || '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!userId) return showToast('Sesi login tidak ditemukan.', 'error')
    if (!canEditProduct) return showToast('Anda tidak memiliki izin menyimpan produk.', 'error')
    if (isAddingCategory) return showToast('Selesaikan pilihan kategori terlebih dahulu.', 'error')
    const productName = name.trim()
    const productCategory = category.trim() || null
    const productPrice = Number(price)
    const productCost = cost === '' ? 0 : Number(cost)
    const initialStock = isDigital ? 0 : Number(stock)
    const minimumStock = isDigital ? 0 : (minStock === '' ? 0 : Number(minStock))
    const weightValue = isDigital || netWeight === '' ? null : Number(netWeight)
    if (!productName) return showToast('Nama produk wajib diisi.', 'error')
    if (isDigital && !providerName) return showToast('Pilih provider produk digital.', 'error')
    if (!Number.isFinite(productPrice) || productPrice < 0 || !Number.isFinite(productCost) || productCost < 0 || !Number.isInteger(minimumStock) || minimumStock < 0) return showToast('Periksa kembali harga dan batas stok.', 'error')
    if (weightValue !== null && (!Number.isFinite(weightValue) || weightValue <= 0)) return showToast('Netto harus lebih dari 0.', 'error')
    if (!id && !isDigital && (!Number.isInteger(initialStock) || initialStock < 0)) return showToast('Stok awal harus berupa bilangan bulat minimal 0.', 'error')
    
    setIsSubmitting(true)
    const wasEditing = Boolean(id)

    try {
      const payload = { name: productName, category: productCategory, sku: sku.trim() || null, price: productPrice, cost: productCost, product_type: productType, provider_name: isDigital ? providerName : null, min_stock: minimumStock, net_weight: weightValue, net_weight_unit: weightValue !== null ? netWeightUnit : null }
      if (id) {
        const { error } = await supabase.from('products').update(payload).eq('id', id)
        if (error) throw error
        try { await logActivity(userId, 'EDIT_PRODUK', `Memperbarui produk: ${productName}`) } catch (e) {}
        showToast('Produk berhasil diperbarui!', 'success')
      } else {
        const { data: newProduct, error } = await supabase.from('products').insert([{ ...payload, user_id: userId, stock: initialStock }]).select().single()
        if (error) throw error
        if (!isDigital && initialStock > 0) {
          const { error: movementError } = await supabase.from('stock_movements').insert([{ user_id: userId, product_id: newProduct.id, change: initialStock, reason: 'initial_stock' }])
          if (movementError) {
            const { error: rollbackError } = await supabase.from('products').delete().eq('id', newProduct.id)
            if (rollbackError) { throw new Error('Histori stok gagal disimpan dan produk belum berhasil dibatalkan. Periksa database.') }
            throw movementError
          }
        }
        try { await logActivity(userId, 'TAMBAH_PRODUK', `Menambahkan produk baru: ${productName}`) } catch (e) {}
        showToast('Produk berhasil ditambahkan!', 'success')
      }
      resetForm()
      await fetchProducts({ silent: true })
    } catch (error) {
      console.error('Save product error:', error)
      showToast('Gagal menyimpan produk: ' + error.message, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleStockChange(product, isAdding) {
    if (!userId || product.product_type === 'digital') return
    if (!canEditStock) return showToast('Anda tidak memiliki izin mengubah stok.', 'error')
    const label = isAdding ? 'masuk' : 'keluar/rusak'
    const qtyStr = await showPrompt('Update Stok', `Berapa jumlah stok yang ${label} untuk ${product.name}?`, '1')
    if (qtyStr === null || qtyStr === '') return
    const qty = Number(qtyStr)
    if (!Number.isInteger(qty) || qty <= 0) return showToast('Masukkan jumlah bilangan bulat yang valid!', 'error')
    if (!isAdding && qty > product.stock) return showToast('Stok tidak mencukupi!', 'error')
    let reason = 'restock'
    if (!isAdding) {
      reason = await showPrompt('Alasan Pengurangan', `Alasan pengurangan stok ${product.name}:`, 'Barang Rusak')
      if (reason === null) return
      if (!reason.trim()) return showToast('Alasan pengurangan wajib diisi.', 'error')
    }
    const oldStock = Number(product.stock)
    const newStock = isAdding ? oldStock + qty : oldStock - qty
    setIsSubmitting(true)
    try {
      const { data: updated, error } = await supabase.from('products').update({ stock: newStock }).eq('id', product.id).eq('stock', oldStock).select('id')
      if (error) throw error
      if (!updated || updated.length === 0) throw new Error('Stok sudah berubah. Muat ulang produk sebelum mencoba lagi.')
      const { error: movementError } = await supabase.from('stock_movements').insert([{ user_id: userId, product_id: product.id, change: isAdding ? qty : -qty, reason: isAdding ? 'restock' : `adjustment: ${reason.trim()}` }])
      if (movementError) {
        const { error: rollbackError } = await supabase.from('products').update({ stock: oldStock }).eq('id', product.id).eq('stock', newStock)
        if (rollbackError) { throw new Error('Histori stok gagal disimpan dan rollback stok juga gagal. Periksa data stok secara manual.') }
        throw movementError
      }
      try { await logActivity(userId, 'UPDATE_STOK', `Mengubah stok ${product.name}: ${oldStock} -> ${newStock} (${isAdding ? '+' : '-'}${qty})`) } catch (e) {}
      showToast(`Stok ${product.name} berhasil diperbarui!`, 'success')
      await fetchProducts({ silent: true })
    } catch (error) {
      console.error('Stock update error:', error)
      showToast('Gagal memperbarui stok: ' + error.message, 'error')
      await fetchProducts({ silent: true })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(product) {
    if (!userId) return
    if (!canDelete) return showToast('Hanya owner yang dapat menghapus produk.', 'error')
    const confirmed = await showConfirm('Hapus Produk', `Yakin ingin menghapus produk "${product.name}" ini?`)
    if (!confirmed) return
    setIsSubmitting(true)
    try {
      const { error } = await supabase.from('products').delete().eq('id', product.id)
      if (error) throw error
      if (id === product.id) resetForm()
      try { await logActivity(userId, 'HAPUS_PRODUK', `Menghapus produk: ${product.name}`) } catch (e) {}
      showToast('Produk berhasil dihapus!', 'success')
      await fetchProducts({ silent: true })
    } catch (error) {
      console.error('Delete product error:', error)
      showToast('Gagal menghapus produk. Produk mungkin sudah digunakan dalam transaksi. ' + error.message, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleImportExcel(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!userId) { showToast('Sesi login tidak ditemukan.', 'error'); e.target.value = ''; return }
    if (!canEditProduct) { showToast('Anda tidak memiliki izin import produk.', 'error'); e.target.value = ''; return }
    setIsSubmitting(true)
    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(worksheet)
      if (!rows.length) throw new Error('File Excel kosong atau format salah.')
      const insertedPayload = rows.map((row, index) => {
        const typeValue = String(row['Jenis Produk'] || 'physical').toLowerCase().trim()
        const type = ['digital', 'produk digital'].includes(typeValue) ? 'digital' : 'physical'
        const productName = String(row['Nama Produk'] ?? row['nama'] ?? '').trim()
        const productCategory = String(row['Kategori'] ?? row['category'] ?? '').trim()
        const productPrice = Number(row['Harga Jual'] ?? 0)
        const productCost = Number(row['Harga Modal'] ?? 0)
        const productStock = type === 'digital' ? 0 : Number(row['Stok'] ?? 0)
        const minimumStock = type === 'digital' ? 0 : Number(row['Min Stok'] ?? 0)
        const provider = String(row['Provider'] || '').trim()
        const rawWeight = row['Netto'] ?? row['Berat'] ?? ''
        const weightValue = type === 'digital' || rawWeight === '' || rawWeight === null ? null : Number(rawWeight)
        const weightUnit = String(row['Satuan Netto'] ?? row['Satuan'] ?? '').trim()
        if (!productName) throw new Error(`Nama produk pada baris ${index + 2} kosong.`)
        if (type === 'digital' && !PROVIDERS.some(p => p.value.toLowerCase() === provider.toLowerCase())) throw new Error(`Provider tidak valid pada baris ${index + 2}.`)
        if (!Number.isFinite(productPrice) || productPrice < 0 || !Number.isFinite(productCost) || productCost < 0 || !Number.isInteger(productStock) || productStock < 0 || !Number.isInteger(minimumStock) || minimumStock < 0) throw new Error(`Data tidak valid pada baris ${index + 2}.`)
        if (weightValue !== null && (!Number.isFinite(weightValue) || weightValue <= 0 || !NET_WEIGHT_UNITS.some(unit => unit.value === weightUnit))) throw new Error(`Netto atau satuan tidak valid pada baris ${index + 2}.`)
        return { user_id: userId, name: productName, category: productCategory || null, sku: row['SKU'] || row['sku'] || null, price: productPrice, cost: productCost, stock: productStock, min_stock: minimumStock, product_type: type, provider_name: type === 'digital' ? provider : null, net_weight: weightValue, net_weight_unit: weightValue !== null ? weightUnit : null }
      })
      const { data: insertedProducts, error } = await supabase.from('products').insert(insertedPayload).select('id, stock')
      if (error) throw error
      const movements = (insertedProducts || []).filter(product => Number(product.stock) > 0).map(product => ({ user_id: userId, product_id: product.id, change: product.stock, reason: 'initial_stock' }))
      if (movements.length > 0) {
        const { error: movementError } = await supabase.from('stock_movements').insert(movements)
        if (movementError) {
          const ids = insertedProducts.map(product => product.id)
          const { error: rollbackError } = await supabase.from('products').delete().in('id', ids)
          if (rollbackError) { throw new Error('Histori import gagal dan rollback juga gagal. Periksa database.') }
          throw movementError
        }
      }
      try { await logActivity(userId, 'IMPORT_PRODUK', `Mengimpor ${insertedProducts.length} produk dari file Excel`) } catch (e) {}
      showToast(`Berhasil mengimport ${insertedProducts.length} produk!`, 'success')
      await fetchProducts({ silent: true })
    } catch (error) {
      console.error('Import Excel error:', error)
      showToast('Gagal import: ' + error.message, 'error')
      await fetchProducts({ silent: true })
    } finally {
      setIsSubmitting(false)
      e.target.value = ''
    }
  }

  async function handleExportExcel() {
    if (!filteredProducts.length) return showToast('Tidak ada produk untuk diexport.', 'error')
    try {
      const rows = filteredProducts.map(p => ({
        'Nama Produk': p.name || '',
        'Kategori': p.category || '',
        'SKU': p.sku || '',
        'Jenis Produk': p.product_type === 'digital' ? 'Digital' : 'Fisik',
        'Provider': p.provider_name || '',
        'Harga Jual': Number(p.price) || 0,
        'Harga Modal': Number(p.cost) || 0,
        'Stok': Number(p.stock) || 0,
        'Min Stok': Number(p.min_stock) || 0,
        'Netto': p.net_weight ?? '',
        'Satuan Netto': p.net_weight_unit || '',
        'Terakhir Update': p.updated_at || p.created_at || ''
      }))
      const worksheet = XLSX.utils.json_to_sheet(rows)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Produk')
      const date = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(workbook, `Produk_${date}.xlsx`)
      showToast(`Berhasil export ${rows.length} produk!`, 'success')
    } catch (error) {
      console.error('Export Excel error:', error)
      showToast('Gagal export: ' + error.message, 'error')
    }
  }

  async function handleManualRefresh() { await fetchProducts() }

  if (!userId) return <div className="card">Sesi login tidak ditemukan. Silakan login kembali.</div>

  const categoryOptions = [{ value: '', label: 'Tanpa Kategori' }, ...categories.map(item => ({ value: item, label: item })), { value: '__add_new__', label: '+ Tambah Kategori Baru', isAction: true }]
  const filterCategoryOptions = [{ value: '', label: 'Semua Kategori' }, ...categories.map(item => ({ value: item, label: item })), ...(products.some(p => !p.category?.trim()) ? [{ value: '__uncategorized__', label: 'Tanpa Kategori' }] : [])]

  return (
    <div>
      {/* MODAL KARTU STOK */}
      <Modal isOpen={showHistory} onClose={() => setShowHistory(false)} title={`Riwayat Stok: ${historyProduct?.name}`} maxWidth={600}>
        {loadingHistory ? (
          <div className="skeleton" style={{ height: 200 }} />
        ) : historyMovements.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada riwayat pergerakan stok untuk produk ini.</p>
        ) : (
          <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            <table style={{ boxShadow: 'none', border: '1px solid var(--border-color)' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--card-bg)' }}>
                <tr><th>Waktu</th><th>Perubahan</th><th>Keterangan</th></tr>
              </thead>
              <tbody>
                {historyMovements.map(m => (
                  <tr key={m.id}>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{new Date(m.created_at).toLocaleString('id-ID')}</td>
                    <td>
                      <strong style={{ color: m.change > 0 ? '#10b981' : '#ef4444' }}>
                        {m.change > 0 ? '+' : ''}{m.change}
                      </strong>
                    </td>
                    <td style={{ fontSize: 13, textTransform: 'capitalize' }}>
                      {m.reason === 'initial_stock' ? 'Stok Awal' : 
                       m.reason === 'restock' ? 'Restock (Tambah)' : 
                       m.reason === 'stock_opname' ? 'Stock Opname' : 
                       m.reason.replace('adjustment: ', 'Penyesuaian: ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Button variant="secondary" onClick={() => setShowHistory(false)}>Tutup</Button>
        </div>
      </Modal>

      {showScanner && (
        <BarcodeScanner onScan={(code) => { setSku(code); setShowScanner(false) }} onClose={() => setShowScanner(false)} />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ margin: 0 }}>Produk & Stok</h1>
          <span title={realtimeConnected ? 'Terhubung ke realtime' : 'Realtime tidak terhubung'} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: realtimeConnected ? '#dcfce7' : '#fee2e2', color: realtimeConnected ? '#166534' : '#991b1b' }}>
            <FaCircle size={6} />{realtimeConnected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={handleManualRefresh} disabled={loading || isSubmitting}>
            <FaSyncAlt style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
          </Button>
          <Button variant="secondary" onClick={handleExportExcel} disabled={isSubmitting || filteredProducts.length === 0}>
            <FaFileExport style={{ color: '#10b981' }} /> Export Excel
          </Button>
          {canEditProduct && (
            <>
              <label htmlFor="excel-upload" className="btn-primary" style={{ background: '#10b981', cursor: isSubmitting ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, opacity: isSubmitting ? 0.6 : 1 }}>
                <FaFileExcel /> Import Excel
              </label>
              <input id="excel-upload" type="file" accept=".xlsx,.xls" onChange={handleImportExcel} disabled={isSubmitting} style={{ display: 'none' }} />
            </>
          )}
        </div>
      </div>

      {canEditProduct ? (
        <div className="card" style={{ marginBottom: 24, maxWidth: 700 }}>
          <h3>{id ? 'Edit Produk' : 'Tambah Produk Baru'}</h3>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
            <div>
              <label>Jenis Produk</label>
              <Select options={[{ value: 'physical', label: 'Barang Fisik' }, { value: 'digital', label: 'Produk Digital' }]} value={productType} onChange={value => { setProductType(value); if (value === 'digital') { setStock('0'); setMinStock('0'); setNetWeight('') } else if (!id) { setStock('') } }} disabled={!!id} />
              {id && <small style={{ color: 'var(--text-muted)' }}>Jenis produk tidak dapat diubah setelah produk dibuat.</small>}
            </div>
            <input required placeholder="Nama Produk *" value={name} onChange={e => setName(e.target.value)} />
            <div>
              <label>Kategori Produk</label>
              {!isAddingCategory ? (
                <Select options={categoryOptions} value={category} onChange={handleCategoryChange} placeholder="Pilih Kategori" />
              ) : (
                <div style={{ background: 'rgba(236, 72, 153, 0.05)', border: '2px dashed var(--primary)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, animation: 'fadeIn 0.3s ease-out' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--primary)', fontWeight: 700, fontSize: 14 }}><FaTags /> Buat Kategori Baru</div>
                  <input autoFocus type="text" placeholder="Misal: Minuman Dingin, Alat Tulis..." value={newCategory} maxLength={100} onChange={e => setNewCategory(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmNewCategory() } }} style={{ width: '100%', background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: '12px 14px', borderRadius: 8, boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button type="button" variant="solid" onClick={confirmNewCategory} style={{ flex: 1, padding: '10px', display: 'flex', gap: 6 }}><FaCheck /> Simpan</Button>
                    <Button type="button" variant="secondary" onClick={() => { setIsAddingCategory(false); setNewCategory('') }} style={{ flex: 1, padding: '10px' }}>Batal</Button>
                  </div>
                </div>
              )}
              <small style={{ color: 'var(--text-muted)', marginTop: 6, display: 'block' }}>Pilih kategori yang tersedia atau tambahkan kategori baru.</small>
            </div>
            {isDigital && (
              <div>
                <label>Provider *</label>
                <Select options={PROVIDERS.map(p => ({ value: p.value, label: p.label }))} value={providerName} onChange={setProviderName} placeholder="Pilih Provider" />
                {providerName && (<div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}><ProviderBadge provider={providerName} size={46} /><span style={{ fontWeight: 600 }}>{providerName}</span></div>)}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <input placeholder="SKU / Kode Barcode" value={sku} onChange={e => setSku(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
              {!isDigital && (
                <button type="button" onClick={() => setShowScanner(true)} className="btn-primary" disabled={isSubmitting} style={{ padding: '0 24px', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}><FaBarcode size={18} /> Scan</button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
              <input required type="number" min="0" step="1" placeholder="Harga Jual (Rp) *" value={price} onChange={e => setPrice(e.target.value)} />
              <input type="number" min="0" step="1" placeholder="Harga Modal/HPP (Rp)" value={cost} onChange={e => setCost(e.target.value)} />
            </div>
            {!isDigital && (
              <>
                <div>
                  <label>Netto / Berat Bersih</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: 12 }}>
                    <input type="number" min="0.001" step="0.001" placeholder="Contoh: 250" value={netWeight} onChange={e => setNetWeight(e.target.value)} />
                    <Select options={NET_WEIGHT_UNITS.map(u => ({ value: u.value, label: u.label }))} value={netWeightUnit} onChange={setNetWeightUnit} />
                  </div>
                  <small style={{ color: 'var(--text-muted)' }}>Opsional. Kosongkan jika produk tidak memiliki informasi netto.</small>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                  <div>
                    <input required type="number" min="0" step="1" placeholder="Stok Saat Ini *" value={stock} onChange={e => setStock(e.target.value)} disabled={!!id} style={{ width: '100%' }} />
                    {id && <small style={{ color: 'var(--text-muted)' }}>Gunakan tombol + Stok atau - Stok untuk mengubah jumlah.</small>}
                  </div>
                  <input type="number" min="0" step="1" placeholder="Batas Stok Menipis" value={minStock} onChange={e => setMinStock(e.target.value)} />
                </div>
              </>
            )}
            {isDigital && <small style={{ color: 'var(--text-muted)' }}>Produk digital tidak menggunakan stok fisik dan netto.</small>}
            <div style={{ display: 'flex', gap: 8 }}>
              <Button type="submit" variant="solid" disabled={isSubmitting}>{isSubmitting ? 'Menyimpan...' : 'Simpan Produk'}</Button>
              {id && (<Button type="button" variant="secondary" onClick={resetForm} disabled={isSubmitting}>Batal</Button>)}
            </div>
          </form>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 24 }}><p style={{ margin: 0, color: 'var(--text-muted)' }}>Anda hanya memiliki akses melihat. Hubungi owner untuk menambah atau mengubah produk.</p></div>
      )}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}><FaTags style={{ color: 'var(--primary)' }} /><h3 style={{ margin: 0 }}>Filter Produk</h3></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <FaSearch style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input type="text" placeholder="Cari nama produk atau SKU..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ width: '100%', paddingLeft: 40, paddingRight: 36 }} />
            {searchTerm && (<button type="button" onClick={() => setSearchTerm('')} title="Hapus pencarian" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', padding: 6 }}><FaTimes /></button>)}
          </div>
          <Select options={filterCategoryOptions} value={categoryFilter} onChange={setCategoryFilter} placeholder="Filter Kategori" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          <small style={{ color: 'var(--text-muted)' }}>Menampilkan {filteredProducts.length} dari {products.length} produk</small>
          {(searchTerm || categoryFilter) && (<button type="button" onClick={() => { setSearchTerm(''); setCategoryFilter('') }} style={{ border: 'none', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>Reset Filter</button>)}
        </div>
      </div>
      {loading ? (
        <div className="skeleton" style={{ height: 200 }} />
      ) : (
        <div className="table-responsive">
          <table>
            <thead>
              <tr><th>Nama Produk</th><th>Kategori</th><th>Jenis</th><th>Netto / Provider</th><th>Harga Jual</th><th>Stok</th><th>Terakhir Update</th><th>Aksi</th></tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: 40 }}><FaBoxOpen size={40} style={{ opacity: 0.2, marginBottom: 12 }} /><p style={{ color: 'var(--text-muted)' }}>{products.length === 0 ? 'Belum ada produk.' : 'Produk tidak ditemukan.'}</p></td></tr>
              ) : (
                filteredProducts.map(product => {
                  const digital = product.product_type === 'digital'
                  return (
                    <tr key={product.id}>
                      <td><strong>{product.name}</strong><br /><small style={{ color: 'var(--text-muted)' }}>SKU: {product.sku || '-'}</small></td>
                      <td>{product.category ? (<span className={`category-badge ${getCategoryColorClass(product.category)}`}>{product.category}</span>) : (<span style={{ color: 'var(--text-muted)' }}>-</span>)}</td>
                      <td><span style={{ padding: '4px 8px', borderRadius: 6, fontSize: 12, background: digital ? '#e0f2fe' : '#dcfce7', color: digital ? '#0369a1' : '#166534' }}>{digital ? 'Digital' : 'Fisik'}</span></td>
                      <td>{digital ? (<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ProviderBadge provider={product.provider_name} size={34} /><span>{product.provider_name || '-'}</span></div>) : (product.net_weight ? `${Number(product.net_weight)} ${product.net_weight_unit || ''}` : '-')}</td>
                      <td>{formatRupiah(product.price)}</td>
                      <td>{digital ? (<span style={{ color: 'var(--text-muted)' }}>-</span>) : (<span style={{ color: product.stock <= product.min_stock ? 'red' : 'inherit', fontWeight: product.stock <= product.min_stock ? 'bold' : 'normal' }}>{product.stock}</span>)}</td>
                      <td><small style={{ color: 'var(--text-muted)' }}>{getTimeAgo(product.updated_at || product.created_at) || '-'}</small></td>
                      <td>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {!digital && canEditStock && (<>
                            <Button variant="success" onClick={() => handleStockChange(product, true)} disabled={isSubmitting}><FaBoxOpen /> + Stok</Button>
                            <Button variant="warning" onClick={() => handleStockChange(product, false)} disabled={isSubmitting}><FaMinusCircle /> - Stok</Button>
                          </>)}
                          <Button variant="secondary" onClick={() => handleViewHistory(product)} disabled={isSubmitting} title="Riwayat Stok">
                            <FaHistory />
                          </Button>
                          {canEditProduct && (<Button variant="secondary" onClick={() => editProduct(product)} disabled={isSubmitting}><FaEdit /> Edit</Button>)}
                          {canDelete && (
                            <Button variant="danger" onClick={() => handleDelete(product)} disabled={isSubmitting}><FaTrash /> Hapus</Button>
                          )}
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