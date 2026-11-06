import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useUI } from '../context/UIContext'
import { formatRupiah, formatTanggal, formatNumberInput } from '../lib/format'
import { FaEdit, FaTrash, FaSave, FaWallet, FaPlus, FaReceipt, FaSyncAlt, FaCircle } from 'react-icons/fa'
import Button from '../components/ui/Button'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

const COLORS = ['#ec4899', '#8b5cf6', '#3b82f6', '#f59e0b', '#10b981']
const CATEGORIES = ['Operasional', 'Pembelian Stok', 'Gaji Karyawan', 'Pemasaran', 'Lainnya']
const MAX_ROWS = 500

const getLocalDate = () => {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

const getFirstDayOfMonth = () => {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-01`
}

const getCategoryColor = (cat) => {
  switch (cat) {
    case 'Operasional': return { bg: '#dbeafe', text: '#1e40af' }
    case 'Pembelian Stok': return { bg: '#dcfce7', text: '#166534' }
    case 'Gaji Karyawan': return { bg: '#f3e8ff', text: '#6b21a8' }
    case 'Pemasaran': return { bg: '#ffedd5', text: '#9a3412' }
    default: return { bg: '#f3f4f6', text: '#374151' }
  }
}

export default function Expenses() {
  const { session } = useAuth()
  const { showConfirm, showToast } = useUI()

  const [roleChecked, setRoleChecked] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const [truncated, setTruncated] = useState(false)

  const [id, setId] = useState(null)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(getLocalDate)
  const [category, setCategory] = useState('Operasional')

  const [startDate, setStartDate] = useState(getFirstDayOfMonth)
  const [endDate, setEndDate] = useState(getLocalDate)

  const [totalExpense, setTotalExpense] = useState(0)
  const [chartCategory, setChartCategory] = useState([])
  const [chartTrend, setChartTrend] = useState([])

  const fetchRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!session?.user?.id) { setRoleChecked(true); return }
    let cancelled = false
    supabase.from('profiles').select('role').eq('id', session.user.id).single()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) { console.error('Cek role gagal:', error); setIsOwner(false) }
        else setIsOwner(String(data?.role || '').toLowerCase() === 'owner')
        setRoleChecked(true)
      })
    return () => { cancelled = true }
  }, [session?.user?.id])

  const fetchExpenses = useCallback(async ({ silent = false } = {}) => {
    if (!session?.user?.id) return
    if (!silent) setLoading(true)
    try {
      const { data, error } = await supabase
        .from('expenses').select('*')
        .gte('date', startDate).lte('date', endDate)
        .order('date', { ascending: false })
        .limit(MAX_ROWS)
      if (error) throw error
      const rows = data || []
      setExpenses(rows)
      setTruncated(rows.length >= MAX_ROWS)
      processAnalytics(rows)
    } catch (err) {
      console.error('Gagal mengambil pengeluaran:', err)
      if (!silent) showToast(`Gagal memuat pengeluaran: ${err.message}`, 'error')
      setExpenses([]); processAnalytics([])
    } finally {
      if (!silent) setLoading(false)
    }
  }, [session?.user?.id, startDate, endDate, showToast])

  useEffect(() => { fetchRef.current = fetchExpenses }, [fetchExpenses])

  useEffect(() => {
    if (roleChecked && isOwner && session?.user?.id) fetchExpenses()
  }, [roleChecked, isOwner, session?.user?.id, startDate, endDate])

  useEffect(() => {
    if (!session?.user?.id) return
    const ch = supabase.channel(`expenses-realtime-${session.user.id}-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => {
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => fetchRef.current?.({ silent: true }), 250)
      })
      .subscribe(s => setRealtimeConnected(s === 'SUBSCRIBED'))
    return () => {
      setRealtimeConnected(false)
      supabase.removeChannel(ch)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [session?.user?.id])

  useEffect(() => {
    if (!session?.user?.id) return
    const onVisible = () => { if (document.visibilityState === 'visible') fetchRef.current?.({ silent: true }) }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [session?.user?.id])

  function processAnalytics(data) {
    let total = 0
    const catMap = {}; const trendMap = {}
    data.forEach(ex => {
      const amt = Number(ex.amount) || 0
      total += amt
      const cat = ex.category || 'Lainnya'
      catMap[cat] = (catMap[cat] || 0) + amt
      trendMap[ex.date] = (trendMap[ex.date] || 0) + amt
    })
    setTotalExpense(total)
    setChartCategory(Object.entries(catMap).map(([name, value]) => ({ name, value })))
    setChartTrend(Object.keys(trendMap).sort().map(tgl => ({ tanggal: tgl.slice(5), nominal: trendMap[tgl] })))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!session?.user?.id) return showToast('Sesi login tidak ditemukan.', 'error')
    const nominal = Number(String(amount).replace(/\./g, '').replace(/,/g, ''))
    if (!description.trim()) return showToast('Keterangan pengeluaran wajib diisi.', 'error')
    if (!Number.isFinite(nominal) || nominal <= 0) return showToast('Nominal pengeluaran harus lebih dari 0.', 'error')
    if (!date) return showToast('Tanggal pengeluaran wajib diisi.', 'error')
    setIsSubmitting(true)
    try {
      const payload = { description: description.trim(), amount: nominal, date, category, user_id: session.user.id }
      let result
      if (id) {
        result = await supabase.from('expenses').update(payload).eq('id', id).select('id').maybeSingle()
      } else {
        result = await supabase.from('expenses').insert([payload]).select('id').single()
      }
      if (result.error) throw result.error
      if (!result.data) throw new Error('Data tidak ditemukan atau kamu tidak memiliki izin mengubahnya.')
      showToast(id ? 'Pengeluaran berhasil diperbarui!' : 'Pengeluaran berhasil dicatat!', 'success')
      resetForm()
      await fetchExpenses({ silent: true })
    } catch (err) {
      console.error('Gagal menyimpan pengeluaran:', err)
      showToast(`Gagal menyimpan pengeluaran: ${err.message}`, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(idToDelete) {
    const confirmed = await showConfirm('Hapus Pengeluaran', 'Yakin ingin menghapus catatan pengeluaran ini?')
    if (!confirmed) return
    setDeletingId(idToDelete)
    try {
      const { data, error } = await supabase.from('expenses').delete().eq('id', idToDelete).select('id').maybeSingle()
      if (error) throw error
      if (!data) throw new Error('Data tidak ditemukan atau kamu tidak memiliki izin menghapusnya.')
      if (id === idToDelete) resetForm()
      showToast('Pengeluaran berhasil dihapus!', 'success')
      await fetchExpenses({ silent: true })
    } catch (err) {
      console.error('Gagal menghapus pengeluaran:', err)
      showToast(`Gagal menghapus pengeluaran: ${err.message}`, 'error')
    } finally {
      setDeletingId(null)
    }
  }

  function handleEdit(ex) {
    setId(ex.id)
    setDescription(ex.description || '')
    setAmount(String(ex.amount || ''))
    setDate(ex.date)
    setCategory(ex.category || 'Lainnya')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetForm() {
    setId(null); setDescription(''); setAmount(''); setDate(getLocalDate()); setCategory('Operasional')
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null
    return (
      <div style={{ background: 'var(--text-main)', padding: '10px 16px', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', color: 'white' }}>
        <p style={{ margin: 0, fontWeight: 'bold', marginBottom: 4 }}>{label || payload[0].name}</p>
        <p style={{ margin: 0, color: '#fbcfe8', fontWeight: 'bold', fontSize: 16 }}>{formatRupiah(payload[0].value)}</p>
      </div>
    )
  }

  if (!roleChecked) {
    return <div className="card"><div className="skeleton" style={{ height: 300 }} /></div>
  }

  if (!isOwner) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 40 }}>
        <h2 style={{ marginTop: 0 }}>Akses Ditolak</h2>
        <p style={{ color: 'var(--text-muted)' }}>Halaman pengeluaran hanya dapat diakses oleh Owner.</p>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
            <FaWallet color="var(--primary)" /> Keuangan & Pengeluaran
            <span title={realtimeConnected ? 'Realtime aktif' : 'Realtime tidak aktif'} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: realtimeConnected ? '#dcfce7' : '#fee2e2', color: realtimeConnected ? '#166534' : '#991b1b' }}>
              <FaCircle size={6} /> {realtimeConnected ? 'LIVE' : 'OFFLINE'}
            </span>
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: 14 }}>Lacak semua uang keluar untuk bisnismu di sini.</p>
        </div>

        <div className="card" style={{ padding: '8px 16px', display: 'flex', gap: 16, alignItems: 'center', background: 'var(--bg-color)', border: 'none', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>DARI</span>
            <input type="date" value={startDate} max={endDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '6px 10px', width: 'auto', background: 'white' }} />
          </div>
          <div style={{ width: 1, height: 24, background: 'var(--border-color)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>SAMPAI</span>
            <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} style={{ padding: '6px 10px', width: 'auto', background: 'white' }} />
          </div>
          <Button variant="secondary" onClick={() => fetchExpenses()} disabled={loading || isSubmitting}>
            <FaSyncAlt style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
          </Button>
        </div>
      </div>

      {truncated && (
        <div className="card" style={{ marginBottom: 16, background: '#fef3c7', border: '1px solid #f59e0b' }}>
          <small style={{ color: '#92400e', fontWeight: 600 }}>Menampilkan {MAX_ROWS} transaksi terbaru. Persempit filter tanggal untuk melihat semua data.</small>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, marginBottom: 32 }}>
        <div className="hero-card" style={{ background: 'linear-gradient(135deg, #be185d 0%, #ec4899 100%)', borderRadius: 20, padding: 32, color: 'white', boxShadow: '0 10px 25px -5px rgba(236, 72, 153, 0.4)', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
          <FaWallet size={150} style={{ position: 'absolute', right: -20, bottom: -20, opacity: 0.1, transform: 'rotate(-15deg)' }} />
          <span style={{ fontSize: 15, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.9 }}>Total Pengeluaran</span>
          <h1 style={{ margin: '12px 0 8px', fontSize: 42, fontWeight: 800, color: 'white' }}>{formatRupiah(totalExpense)}</h1>
          <p style={{ margin: 0, opacity: 0.8, fontSize: 14 }}>Berdasarkan filter tanggal di atas.</p>
        </div>

        <div className="card" style={{ position: 'relative' }}>
          <h3 style={{ marginTop: 0, marginBottom: 16 }}>Distribusi Kategori</h3>
          {chartCategory.length === 0 ? (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Belum ada data</div>
          ) : (
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={4}>
                    {chartCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={CustomTooltip} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 12, fontWeight: 'bold' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 32 }}>
        <h3 style={{ marginTop: 0, marginBottom: 20 }}>Tren Pengeluaran Harian</h3>
        {chartTrend.length === 0 ? (
          <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Belum ada data</div>
        ) : (
          <div style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartTrend}>
                <XAxis dataKey="tanggal" stroke="var(--text-muted)" fontSize={12} axisLine={false} tickLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={v => `Rp ${v / 1000}k`} axisLine={false} tickLine={false} />
                <Tooltip content={CustomTooltip} cursor={{ fill: 'rgba(236, 72, 153, 0.05)' }} />
                <Bar dataKey="nominal" fill="var(--primary)" radius={[6, 6, 0, 0]} barSize={35} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 24, alignItems: 'start' }}>
        <div className="card" style={{ borderTop: '4px solid var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ margin: 0 }}>{id ? 'Edit Pengeluaran' : 'Catat Pengeluaran'}</h3>
            {id && (
              <button type="button" onClick={resetForm} style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 13, fontWeight: 'bold', cursor: 'pointer' }}>Batal Edit</button>
            )}
          </div>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
            <div>
              <label>Kategori</label>
              <select value={category} onChange={e => setCategory(e.target.value)} style={{ background: 'var(--bg-color)' }}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label>Keterangan *</label>
              <input required placeholder="Misal: Bayar Listrik" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <div>
              <label>Nominal (Rp) *</label>
              <input required type="text" inputMode="numeric" placeholder="0" value={formatNumberInput(amount)} onChange={e => setAmount(e.target.value.replace(/\D/g, ''))} style={{ fontSize: 18, fontWeight: 'bold' }} />
            </div>
            <div>
              <label>Tanggal</label>
              <input required type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <Button type="submit" variant="solid" disabled={isSubmitting} style={{ marginTop: 8 }}>
              {isSubmitting ? 'Menyimpan...' : id ? <><FaSave /> Simpan Perubahan</> : <><FaPlus /> Catat Pengeluaran</>}
            </Button>
          </form>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FaReceipt color="var(--text-muted)" />
            <h3 style={{ margin: 0 }}>Riwayat Transaksi ({expenses.length})</h3>
          </div>
          {loading ? (
            <div className="skeleton" style={{ height: 300, margin: 24 }} />
          ) : (
            <div style={{ maxHeight: 500, overflowY: 'auto', overflowX: 'auto' }}>
              <table style={{ border: 'none', borderRadius: 0 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--card-bg)' }}>
                  <tr>
                    <th style={{ paddingLeft: 24 }}>Keterangan / Tanggal</th>
                    <th>Kategori</th>
                    <th style={{ textAlign: 'right' }}>Nominal</th>
                    <th style={{ textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.length === 0 ? (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Belum ada transaksi pengeluaran.</td></tr>
                  ) : expenses.map(ex => {
                    const catColor = getCategoryColor(ex.category)
                    return (
                      <tr key={ex.id}>
                        <td style={{ paddingLeft: 24 }}>
                          <strong style={{ display: 'block', fontSize: 15 }}>{ex.description}</strong>
                          <small style={{ color: 'var(--text-muted)' }}>{formatTanggal(ex.date)}</small>
                        </td>
                        <td><span style={{ background: catColor.bg, color: catColor.text, padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{ex.category || 'Lainnya'}</span></td>
                        <td style={{ textAlign: 'right', color: '#ef4444', fontWeight: 800, fontSize: 15 }}>-{formatRupiah(ex.amount)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <button type="button" onClick={() => handleEdit(ex)} title="Edit" style={{ background: 'var(--bg-color)', border: 'none', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-main)' }}><FaEdit size={14} /></button>
                            <button type="button" onClick={() => handleDelete(ex.id)} disabled={deletingId === ex.id} title="Hapus" style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', width: 32, height: 32, borderRadius: 8, cursor: deletingId === ex.id ? 'not-allowed' : 'pointer', opacity: deletingId === ex.id ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}><FaTrash size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}