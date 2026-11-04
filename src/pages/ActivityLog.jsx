import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { formatTanggal } from '../lib/format'

export default function ActivityLog() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLogs()
  }, [])

  async function fetchLogs() {
    setLoading(true)
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (data) setLogs(data)
    setLoading(false)
  }

  return (
    <div>
      <h1>Riwayat Aktivitas</h1>
      <div className="card">
        {loading ? <p>Memuat riwayat...</p> : (
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
                <tr><td colSpan="3" style={{ textAlign: 'center' }}>Belum ada aktivitas tercatat.</td></tr>
              ) : logs.map(log => (
                <tr key={log.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {new Date(log.created_at).toLocaleString('id-ID')}
                  </td>
                  <td>
                    <span style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: 4, fontWeight: 'bold', fontSize: 12 }}>
                      {log.action}
                    </span>
                  </td>
                  <td>{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}