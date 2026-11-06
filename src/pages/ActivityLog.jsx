import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useUI } from '../context/UIContext'
import { formatTanggal } from '../lib/format'
import { FaSearch, FaTimes, FaSyncAlt, FaFilter } from 'react-icons/fa'

const MAX_ROWS = 500
const RANGE_OPTIONS = [
  { value: '7', label: '7 Hari Terakhir' },
  { value: '30', label: '30 Hari Terakhir' },
  { value: '90', label: '90 Hari Terakhir' },
  { value: 'all', label: 'Semua Waktu' }
]

const getLocalDate = d => {
  const t = d || new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}
const getRangeStart = days => {
  if (days === 'all') return null
  const d = new Date()
  d.setDate(d.getDate() - Number(days))
  return getLocalDate(d)
}

export default function ActivityLog() {
  const { session } = useAuth()
  const { showToast } = useUI()

  const [roleChecked, setRoleChecked] = useState(false)
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState([])
  const [errorMessage, setErrorMessage] = useState('')
  const [truncated, setTruncated] = useState(false)

  const [range, setRange] = useState('30')
  const [actionFilter, setActionFilter] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  const fetchRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!session?.user?.id) { setRoleChecked(true); return }
    let cancelled = false
    supabase.from('profiles').select('role').eq('id', session.user.id).single()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) { console.error(error); setAuthorized(false); setErrorMessage(error.message) }
        else setAuthorized(String(data?.role || '').toLowerCase() === 'owner')
        setRoleChecked(true)
      })
    return () => { cancelled = true }
  }, [session?.user?.id])

  const fetchLogs = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    setErrorMessage('')
    try {
      let query = supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(MAX_ROWS)

      const start = getRangeStart(range)
      if (start) query = query.gte('created_at', `${start}T00:00:00`)

      const { data, error } = await query
      if (error) throw error

      const rows = data || []
      setLogs(rows)
      setTruncated(rows.length >= MAX_ROWS)
    } catch (err) {
      console.error('Gagal mengambil riwayat aktivitas:', err)
      setErrorMessage(err.message || 'Gagal memuat riwayat aktivitas.')
      if (!silent) showToast('Gagal memuat riwayat: ' + err.message, 'error')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [range, showToast])

  useEffect(() => { fetchRef.current = fetchLogs }, [fetchLogs])

  useEffect(() => {
    if (roleChecked && authorized) fetchLogs()
  }, [roleChecked, authorized, range])

  useEffect(() => {
    if (!authorized) return
    const ch = supabase.channel(`activity-realtime-${session?.user?.id}-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, () => {
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => fetchRef.current?.({ silent: true }), 400)
      })
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [authorized, session?.user?.id])

  const actions = useMemo(() => {
    return [...new Set(logs.map(l => l.action).filter(Boolean))].sort()
  }, [logs])

  const filteredLogs = useMemo(() => {
    const kw = searchTerm.trim().toLowerCase()
    return logs.filter(l => {
      if (actionFilter && l.action !== actionFilter) return false
      if (kw && !(String(l.details || '').toLowerCase().includes(kw) || String(l.action || '').toLowerCase().includes(kw))) return false
      return true
    })
  }, [logs, actionFilter, searchTerm])

  if (!roleChecked || loading) {
    return (
      <div>
        <h1>Riwayat Aktivitas</h1>
        <div className="card"><div className="skeleton" style={{ height: 300 }} /></div>
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 40 }}>
        <h2 style={{ marginTop: 0 }}>Akses Ditolak</h2>
        <p style={{ color: 'var(--text-muted)' }}>Riwayat aktivitas hanya dapat diakses oleh Owner.</p>
        <Link to="/dashboard" className="filter-btn active" style={{ display: 'inline-block', textDecoration: 'none', marginTop: 12 }}>Kembali ke Dashboard</Link>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0 }}>Riwayat Aktivitas</h1>
          <p style={{ color: 'var(--text-muted)', margin: '6px 0 0' }}>Catatan aktivitas toko ({filteredLogs.length} dari {logs.length}).</p>
        </div>
        <button className="filter-btn active" onClick={() => fetchLogs()} disabled={loading}>
          <FaSyncAlt /> Muat Ulang
        </button>
      </div>

      {truncated && (
        <div className="card" style={{ marginBottom: 16, background: '#fef3c7', border: '1px solid #f59e0b' }}>
          <small style={{ color: '#92400e', fontWeight: 600 }}>Menampilkan {MAX_ROWS} log terbaru. Persempit rentang waktu untuk melihat lebih detail.</small>
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <FaFilter style={{ color: 'var(--primary)' }} />
          <h3 style={{ margin: 0 }}>Filter</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Rentang Waktu</label>
            <select value={range} onChange={e => setRange(e.target.value)} style={{ width: '100%' }}>
              {RANGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Jenis Aksi</label>
            <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} style={{ width: '100%' }}>
              <option value="">Semua Aksi</option>
              {actions.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cari Keterangan</label>
            <div style={{ position: 'relative' }}>
              <FaSearch style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input type="text" placeholder="Cari..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ width: '100%', paddingLeft: 40, paddingRight: 36 }} />
              {searchTerm && (
                <button type="button" onClick={() => setSearchTerm('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', padding: 6 }}><FaTimes /></button>
              )}
            </div>
          </div>
        </div>
        {(actionFilter || searchTerm) && (
          <button type="button" onClick={() => { setActionFilter(''); setSearchTerm('') }} style={{ marginTop: 12, border: 'none', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>Reset Filter</button>
        )}
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        {errorMessage ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <p style={{ color: '#ef4444' }}>{errorMessage}</p>
            <button className="filter-btn active" onClick={() => fetchLogs()}>Coba Lagi</button>
          </div>
        ) : (
          <table>
            <thead>
              <tr><th>Waktu</th><th>Aksi</th><th>Keterangan</th></tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr><td colSpan="3" style={{ textAlign: 'center', padding: 24 }}>Tidak ada aktivitas pada filter ini.</td></tr>
              ) : filteredLogs.map(log => (
                <tr key={log.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {log.created_at ? new Date(log.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-'}
                  </td>
                  <td><span style={{ background: 'var(--bg-color)', padding: '4px 8px', borderRadius: 4, fontWeight: 'bold', fontSize: 12 }}>{log.action || '-'}</span></td>
                  <td>{log.details || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}