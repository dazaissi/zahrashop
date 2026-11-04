
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function ActivityLog() {
  const { session } = useAuth()

  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [checkingRole, setCheckingRole] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (session?.user?.id) {
      checkAccess()
    }
  }, [session])

  async function checkAccess() {
    setCheckingRole(true)
    setErrorMessage('')

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (error) throw error

      if (profile?.role !== 'owner') {
        setAuthorized(false)
        setLogs([])
        return
      }

      setAuthorized(true)
      await fetchLogs()
    } catch (error) {
      console.error('Gagal memeriksa akses:', error)
      setErrorMessage(error.message || 'Gagal memeriksa akses pengguna.')
    } finally {
      setCheckingRole(false)
      setLoading(false)
    }
  }

  async function fetchLogs() {
    setLoading(true)
    setErrorMessage('')

    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      setLogs(data || [])
    } catch (error) {
      console.error('Gagal mengambil riwayat aktivitas:', error)
      setErrorMessage(error.message || 'Gagal memuat riwayat aktivitas.')
    } finally {
      setLoading(false)
    }
  }

  if (checkingRole || loading) {
    return (
      <div>
        <h1>Riwayat Aktivitas</h1>
        <div className="card">
          <div className="skeleton" style={{ height: 300 }} />
        </div>
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 40 }}>
        <h2 style={{ marginTop: 0 }}>Akses Ditolak</h2>

        <p style={{ color: 'var(--text-muted)' }}>
          Riwayat aktivitas hanya dapat diakses oleh Owner.
        </p>

        <Link
          to="/dashboard"
          className="filter-btn active"
          style={{
            display: 'inline-block',
            textDecoration: 'none',
            marginTop: 12
          }}
        >
          Kembali ke Dashboard
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 20
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Riwayat Aktivitas</h1>
          <p style={{ color: 'var(--text-muted)', margin: '6px 0 0' }}>
            Catatan aktivitas yang tercatat di sistem.
          </p>
        </div>

        <button
          className="filter-btn active"
          onClick={fetchLogs}
          disabled={loading}
        >
          Muat Ulang
        </button>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        {errorMessage ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <p style={{ color: '#ef4444' }}>{errorMessage}</p>

            <button className="filter-btn active" onClick={fetchLogs}>
              Coba Lagi
            </button>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Aksi</th>
                <th>Keterangan</th>
              </tr>
            </thead>

            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td
                    colSpan="3"
                    style={{ textAlign: 'center', padding: 24 }}
                  >
                    Belum ada aktivitas.
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {log.created_at
                        ? new Date(log.created_at).toLocaleString('id-ID', {
                            dateStyle: 'medium',
                            timeStyle: 'short'
                          })
                        : '-'}
                    </td>

                    <td>
                      <span
                        style={{
                          background: 'var(--bg-color)',
                          padding: '4px 8px',
                          borderRadius: 4,
                          fontWeight: 'bold',
                          fontSize: 12
                        }}
                      >
                        {log.action || '-'}
                      </span>
                    </td>

                    <td>{log.details || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
