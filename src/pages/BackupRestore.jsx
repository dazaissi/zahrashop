import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useUI } from '../context/UIContext'
import {
  FaDownload,
  FaUpload,
  FaHistory,
  FaShieldAlt,
  FaCheckCircle,
  FaTimesCircle,
  FaCloudDownloadAlt,
  FaDatabase,
  FaRedo,
  FaFileCode,
  FaFileCsv,
  FaClock
} from 'react-icons/fa'
import Button from '../components/ui/Button'

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = Number(bytes)
  let i = 0
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function formatDateTime(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  return d.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function StatusBadge({ status }) {
  const map = {
    success: { color: '#10b981', label: 'Sukses', Icon: FaCheckCircle },
    failed: { color: '#ef4444', label: 'Gagal', Icon: FaTimesCircle },
    restored: { color: '#3b82f6', label: 'Dipulihkan', Icon: FaRedo }
  }
  const { color, label, Icon } = map[status] || map.success

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 999,
        background: `${color}18`,
        color,
        fontWeight: 700,
        fontSize: 11
      }}
    >
      <Icon size={11} /> {label}
    </span>
  )
}

function backupToCsvBundle(backup) {
  const tables = [
    'customers',
    'products',
    'invoices',
    'invoice_items',
    'invoice_payments',
    'stock_movements',
    'expenses'
  ]
  const lines = []

  lines.push(`Zahra Shop Backup`)
  lines.push(`Dibuat: ${backup.meta?.created_at || '-'}`)
  lines.push(`Schema: v${backup.meta?.schema_version || 1}`)
  lines.push('')

  for (const t of tables) {
    const rows = backup[t] || []
    lines.push(`=== ${t.toUpperCase()} (${rows.length} baris) ===`)

    if (rows.length === 0) {
      lines.push('(kosong)')
      lines.push('')
      continue
    }

    const keys = Object.keys(rows[0])
    lines.push(keys.join(','))

    for (const row of rows) {
      lines.push(
        keys
          .map((k) => {
            const v = row[k]
            if (v === null || v === undefined) return ''
            if (typeof v === 'object') {
              return JSON.stringify(v).replace(/,/g, ';')
            }
            return String(v)
              .replace(/,/g, ';')
              .replace(/\n/g, ' ')
          })
          .join(',')
      )
    }
    lines.push('')
  }

  return '\uFEFF' + lines.join('\n')
}

function triggerDownload(content, filename, mime) {
  const blob =
    content instanceof Blob
      ? content
      : new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function BackupRestore() {
  const { session } = useAuth()
  const { showToast, showConfirm } = useUI()
  const navigate = useNavigate()

  const [role, setRole] = useState(null)
  const [authorized, setAuthorized] = useState(false)
  const [checking, setChecking] = useState(true)

  const [logs, setLogs] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [creating, setCreating] = useState(false)
  const [downloadingId, setDownloadingId] = useState(null)

  const [restorePreview, setRestorePreview] = useState(null)
  const [restorePayload, setRestorePayload] = useState(null)
  const [restoreMode, setRestoreMode] = useState('merge')
  const [restoring, setRestoring] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    checkRole()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id])

  async function checkRole() {
    if (!session?.user?.id) {
      setChecking(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    const userRole = String(profile?.role || '').toLowerCase()
    setRole(userRole)
    setAuthorized(userRole === 'owner')
    setChecking(false)

    if (userRole === 'owner') {
      loadLogs()
    }
  }

  async function loadLogs() {
    setLoadingLogs(true)

    const { data, error } = await supabase
      .from('backup_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      showToast('Gagal memuat riwayat: ' + error.message, 'error')
      setLogs([])
    } else {
      setLogs(data || [])
    }

    setLoadingLogs(false)
  }

  async function handleCreateBackup() {
    setCreating(true)

    try {
      const { data, error } = await supabase.functions.invoke(
        'auto-backup',
        { body: {} }
      )

      if (error) throw new Error(error.message || 'Gagal membuat backup.')
      if (data?.error) throw new Error(data.error)

      showToast('Backup berhasil dibuat!', 'success')
      await loadLogs()
    } catch (err) {
      showToast(
        'Gagal membuat backup: ' + (err.message || err),
        'error'
      )
    } finally {
      setCreating(false)
    }
  }

  async function handleDownloadJson(log) {
    if (!log.file_path) {
      return showToast('File backup tidak tersedia.', 'error')
    }

    setDownloadingId(log.id)

    try {
      const { data, error } = await supabase.storage
        .from('backups')
        .download(log.file_path)

      if (error) throw error

      triggerDownload(
        data,
        log.filename,
        'application/json'
      )
    } catch (err) {
      showToast('Gagal mengunduh: ' + (err.message || err), 'error')
    } finally {
      setDownloadingId(null)
    }
  }

  async function handleDownloadCsv(log) {
    if (!log.file_path) {
      return showToast('File backup tidak tersedia.', 'error')
    }

    setDownloadingId(log.id + '-csv')

    try {
      const { data, error } = await supabase.storage
        .from('backups')
        .download(log.file_path)

      if (error) throw error

      const text = await data.text()
      const backup = JSON.parse(text)
      const csv = backupToCsvBundle(backup)

      triggerDownload(
        csv,
        log.filename.replace(/\.json$/i, '') + '.csv',
        'text/csv;charset=utf-8'
      )
    } catch (err) {
      showToast(
        'Gagal mengunduh CSV: ' + (err.message || err),
        'error'
      )
    } finally {
      setDownloadingId(null)
    }
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.json')) {
      showToast('File harus berformat .json', 'error')
      e.target.value = ''
      return
    }

    const reader = new FileReader()

    reader.onload = async (event) => {
      try {
        const text = event.target?.result
        const parsed = JSON.parse(String(text))

        if (parsed?.meta?.app !== 'Zahra Shop') {
          showToast(
            'File bukan backup Zahra Shop yang valid.',
            'error'
          )
          return
        }

        // Preview via edge function (dry run)
        const { data, error } = await supabase.functions.invoke(
          'restore-backup',
          { body: { payload: parsed, mode: restoreMode, dryRun: true } }
        )

        if (error) throw new Error(error.message)
        if (data?.error) throw new Error(data.error)

        setRestorePayload(parsed)
        setRestorePreview(data.preview)
      } catch (err) {
        showToast(
          'File tidak valid: ' + (err.message || err),
          'error'
        )
        setRestorePayload(null)
        setRestorePreview(null)
      }
    }

    reader.readAsText(file)
  }

  async function handleConfirmRestore() {
    if (!restorePayload) return

    const confirmed = await showConfirm(
      'Konfirmasi Restore',
      `Data akan dipulihkan dengan mode "${restoreMode}". ` +
        'Pastikan sudah punya backup terbaru sebelum melanjutkan.'
    )

    if (!confirmed) return

    setRestoring(true)

    try {
      const { data, error } = await supabase.functions.invoke(
        'restore-backup',
        {
          body: {
            payload: restorePayload,
            mode: restoreMode,
            dryRun: false
          }
        }
      )

      if (error) throw new Error(error.message)
      if (data?.error) throw new Error(data.error)

      showToast('Restore berhasil!', 'success')
      setRestorePayload(null)
      setRestorePreview(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      await loadLogs()
    } catch (err) {
      showToast(
        'Gagal restore: ' + (err.message || err),
        'error'
      )
    } finally {
      setRestoring(false)
    }
  }

  function resetRestore() {
    setRestorePayload(null)
    setRestorePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (checking) {
    return (
      <div className="card">
        <div className="skeleton" style={{ height: 300 }} />
      </div>
    )
  }

  if (!authorized) {
    return (
      <div
        className="card"
        style={{ textAlign: 'center', padding: 40 }}
      >
        <h2 style={{ marginTop: 0 }}>Akses Ditolak</h2>
        <p style={{ color: 'var(--text-muted)' }}>
          Fitur backup &amp; restore hanya dapat diakses oleh Owner.
        </p>
        <Button
          variant="secondary"
          onClick={() => navigate('/dashboard')}
        >
          Kembali ke Dashboard
        </Button>
      </div>
    )
  }

  const lastSuccess = logs.find((l) => l.status === 'success')
  const totalSize = logs
    .filter((l) => l.status === 'success')
    .reduce((sum, l) => sum + Number(l.file_size || 0), 0)

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
          <h1 style={{ marginBottom: 4 }}>
            <FaShieldAlt
              style={{ color: 'var(--primary)', marginRight: 8 }}
            />
            Backup &amp; Restore
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>
            Cadangkan dan pulihkan data toko. Auto backup berjalan
            harian 02:00 WIB.
          </p>
        </div>

        <span
          style={{
            background: 'rgba(16,185,129,0.12)',
            color: '#10b981',
            fontSize: 12,
            fontWeight: 700,
            padding: '5px 12px',
            borderRadius: 999
          }}
        >
          Owner
        </span>
      </div>

      {/* RINGKASAN */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 24
        }}
      >
        <div className="card">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12
            }}
          >
            <div
              style={{
                background: 'rgba(16,185,129,0.12)',
                padding: 12,
                borderRadius: 12,
                color: '#10b981'
              }}
            >
              <FaCheckCircle size={20} />
            </div>
            <div>
              <p
                style={{
                  margin: 0,
                  color: 'var(--text-muted)',
                  fontSize: 12
                }}
              >
                Backup Terakhir
              </p>
              <strong
                style={{
                  fontSize: 14,
                  display: 'block',
                  marginTop: 2
                }}
              >
                {lastSuccess
                  ? formatDateTime(lastSuccess.created_at)
                  : 'Belum pernah'}
              </strong>
            </div>
          </div>
        </div>

        <div className="card">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12
            }}
          >
            <div
              style={{
                background: 'rgba(59,130,246,0.12)',
                padding: 12,
                borderRadius: 12,
                color: '#3b82f6'
              }}
            >
              <FaDatabase size={20} />
            </div>
            <div>
              <p
                style={{
                  margin: 0,
                  color: 'var(--text-muted)',
                  fontSize: 12
                }}
              >
                Total Backup
              </p>
              <strong
                style={{ fontSize: 18, display: 'block', marginTop: 2 }}
              >
                {logs.filter((l) => l.status === 'success').length}
              </strong>
            </div>
          </div>
        </div>

        <div className="card">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12
            }}
          >
            <div
              style={{
                background: 'rgba(139,92,246,0.12)',
                padding: 12,
                borderRadius: 12,
                color: '#8b5cf6'
              }}
            >
              <FaCloudDownloadAlt size={20} />
            </div>
            <div>
              <p
                style={{
                  margin: 0,
                  color: 'var(--text-muted)',
                  fontSize: 12
                }}
              >
                Storage Terpakai
              </p>
              <strong
                style={{ fontSize: 18, display: 'block', marginTop: 2 }}
              >
                {formatBytes(totalSize)}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* BUAT BACKUP */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12
          }}
        >
          <div>
            <h3 style={{ margin: '0 0 4px' }}>Buat Backup</h3>
            <p
              style={{
                color: 'var(--text-muted)',
                margin: 0,
                fontSize: 13
              }}
            >
              Cadangkan seluruh data toko (produk, pelanggan,
              invoice, pembayaran, stok, pengeluaran, pengaturan).
            </p>
          </div>

          <Button
            variant="solid"
            onClick={handleCreateBackup}
            disabled={creating}
          >
            <FaDownload />
            {creating ? 'Membuat backup...' : 'Buat Backup Sekarang'}
          </Button>
        </div>
      </div>

      {/* RIWAYAT BACKUP */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 16
          }}
        >
          <div>
            <h3 style={{ margin: '0 0 4px' }}>
              <FaHistory
                style={{ marginRight: 6, color: 'var(--primary)' }}
              />
              Riwayat Backup
            </h3>
            <small style={{ color: 'var(--text-muted)' }}>
              {logs.length} entri terakhir
            </small>
          </div>

          <Button variant="secondary" onClick={loadLogs}>
            Muat Ulang
          </Button>
        </div>

        {loadingLogs ? (
          <div className="skeleton" style={{ height: 200 }} />
        ) : logs.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: 40,
              color: 'var(--text-muted)'
            }}
          >
            Belum ada backup. Klik "Buat Backup Sekarang" untuk memulai.
          </div>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Nama File</th>
                  <th>Tanggal</th>
                  <th>Ukuran</th>
                  <th>Status</th>
                  <th>Pemicu</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <strong style={{ fontSize: 13 }}>
                        {log.filename}
                      </strong>
                      {log.error_message && (
                        <>
                          <br />
                          <small style={{ color: '#ef4444' }}>
                            {log.error_message.slice(0, 80)}
                          </small>
                        </>
                      )}
                    </td>
                    <td>
                      <small>{formatDateTime(log.created_at)}</small>
                    </td>
                    <td>
                      <small>{formatBytes(log.file_size)}</small>
                    </td>
                    <td>
                      <StatusBadge status={log.status} />
                    </td>
                    <td>
                      <small
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          color: 'var(--text-muted)'
                        }}
                      >
                        {log.triggered_by === 'cron' ? (
                          <>
                            <FaClock size={11} /> Auto
                          </>
                        ) : (
                          'Manual'
                        )}
                      </small>
                    </td>
                    <td>
                      {log.status === 'success' && log.file_path && (
                        <div
                          style={{
                            display: 'flex',
                            gap: 6,
                            flexWrap: 'wrap'
                          }}
                        >
                          <Button
                            variant="primary"
                            onClick={() => handleDownloadJson(log)}
                            disabled={
                              downloadingId === log.id
                            }
                            style={{ padding: '6px 10px', fontSize: 12 }}
                          >
                            <FaFileCode size={11} /> JSON
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => handleDownloadCsv(log)}
                            disabled={
                              downloadingId === log.id + '-csv'
                            }
                            style={{ padding: '6px 10px', fontSize: 12 }}
                          >
                            <FaFileCsv size={11} /> Excel/CSV
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RESTORE */}
      <div className="card">
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 4px' }}>
            <FaUpload
              style={{ marginRight: 6, color: '#f59e0b' }}
            />
            Restore Data
          </h3>
          <p
            style={{
              color: 'var(--text-muted)',
              margin: 0,
              fontSize: 13
            }}
          >
            Pulihkan data dari file JSON backup Zahra Shop. Data
            akan ditampilkan sebagai preview sebelum benar-benar
            dipulihkan.
          </p>
        </div>

        {!restorePreview && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed var(--border-color)',
                borderRadius: 12,
                padding: 32,
                textAlign: 'center',
                cursor: 'pointer',
                background: 'var(--bg-color)',
                transition: 'border-color 0.2s'
              }}
            >
              <FaUpload
                size={32}
                style={{
                  color: 'var(--text-muted)',
                  marginBottom: 12
                }}
              />
              <div>
                <strong>Klik untuk pilih file backup (.json)</strong>
              </div>
              <small style={{ color: 'var(--text-muted)' }}>
                File harus dari Zahra Shop Backup
              </small>
            </div>
          </div>
        )}

        {restorePreview && (
          <div
            style={{
              padding: 20,
              borderRadius: 12,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-color)'
            }}
          >
            <h4 style={{ marginTop: 0 }}>
              <FaCheckCircle
                style={{ color: '#10b981', marginRight: 6 }}
              />
              Preview Restore
            </h4>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 12,
                marginBottom: 16
              }}
            >
              {Object.entries(restorePreview).map(([t, count]) => (
                <div
                  key={t}
                  style={{
                    padding: 10,
                    borderRadius: 8,
                    background: 'var(--card-bg)',
                    border: '1px solid var(--border-color)'
                  }}
                >
                  <small
                    style={{
                      color: 'var(--text-muted)',
                      textTransform: 'capitalize',
                      display: 'block'
                    }}
                  >
                    {t.replace(/_/g, ' ')}
                  </small>
                  <strong style={{ fontSize: 16 }}>{count}</strong>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: 8,
                  fontWeight: 600,
                  fontSize: 13
                }}
              >
                Mode Restore
              </label>
              <div style={{ display: 'flex', gap: 16 }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    fontSize: 13
                  }}
                >
                  <input
                    type="radio"
                    checked={restoreMode === 'merge'}
                    onChange={() => setRestoreMode('merge')}
                  />
                  <div>
                    <strong>Merge</strong>
                    <br />
                    <small style={{ color: 'var(--text-muted)' }}>
                      Tambahkan data baru, data lama tetap ada
                    </small>
                  </div>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    fontSize: 13
                  }}
                >
                  <input
                    type="radio"
                    checked={restoreMode === 'replace'}
                    onChange={() => setRestoreMode('replace')}
                  />
                  <div>
                    <strong style={{ color: '#ef4444' }}>
                      Replace
                    </strong>
                    <br />
                    <small style={{ color: 'var(--text-muted)' }}>
                      Hapus data lama lalu pulihkan (berisiko)
                    </small>
                  </div>
                </label>
              </div>
            </div>

            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: 'rgba(245,158,11,0.1)',
                border: '1px solid rgba(245,158,11,0.3)',
                color: '#92400e',
                marginBottom: 16,
                fontSize: 13
              }}
            >
              <strong>Perhatian:</strong> Restore tidak bisa dibatalkan.
              Pastikan sudah membuat backup terbaru sebelum
              melanjutkan.
            </div>

            <div
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap'
              }}
            >
              <Button
                variant="solid"
                onClick={handleConfirmRestore}
                disabled={restoring}
              >
                <FaRedo />
                {restoring
                  ? 'Memulihkan...'
                  : restoreMode === 'replace'
                    ? 'Hapus & Pulihkan'
                    : 'Pulihkan Data'}
              </Button>

              <Button
                variant="secondary"
                onClick={resetRestore}
                disabled={restoring}
              >
                Batal
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}