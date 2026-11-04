
import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useUI } from '../context/UIContext'
import { logActivity } from '../lib/logger'
import {
  FaInfoCircle,
  FaUserShield,
  FaUserTie,
  FaEnvelope,
  FaTrash,
  FaSync,
} from 'react-icons/fa'

export default function Team() {
  const { session, profile } = useAuth()
  const { showToast, showConfirm } = useUI()

  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    fetchTeam()
  }, [profile?.id])

  async function fetchTeam() {
    if (!profile?.id) return

    setLoading(true)

    try {
      const [
        { data: memberData, error: memberError },
        { data: inviteData, error: inviteError },
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, business_name, email, role, created_at, owner_id')
          .or(`id.eq.${profile.id},owner_id.eq.${profile.id}`)
          .order('created_at', { ascending: true }),

        supabase
          .from('team_invites')
          .select('id, email, role, created_at, accepted_at')
          .eq('owner_id', profile.id)
          .order('created_at', { ascending: false }),
      ])

      if (memberError) throw memberError
      if (inviteError) throw inviteError

      setMembers(memberData || [])
      setInvites(inviteData || [])
    } catch (error) {
      console.error('Gagal memuat tim:', error)
      showToast('Gagal memuat data tim.', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleInvite(e) {
    e.preventDefault()

    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail) {
      return showToast('Masukkan email karyawan terlebih dahulu.', 'error')
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!emailPattern.test(normalizedEmail)) {
      return showToast('Format email tidak valid.', 'error')
    }

    if (normalizedEmail === session?.user?.email?.toLowerCase()) {
      return showToast('Email Owner tidak perlu diundang.', 'error')
    }

    const existingMember = members.some(
      member => member.email?.toLowerCase() === normalizedEmail
    )

    if (existingMember) {
      return showToast('Akun tersebut sudah menjadi anggota tim.', 'error')
    }

    const existingInvite = invites.some(
      invite =>
        invite.email.toLowerCase() === normalizedEmail &&
        !invite.accepted_at
    )

    if (existingInvite) {
      return showToast('Email tersebut sudah memiliki undangan aktif.', 'error')
    }

    setSending(true)

    try {
      const { error } = await supabase
        .from('team_invites')
        .insert({
          owner_id: profile.id,
          email: normalizedEmail,
          role: 'admin',
          invited_by: session.user.id,
        })

      if (error) throw error

      await logActivity(
        session.user.id,
        'UNDANG_KARYAWAN',
        `Mengundang ${normalizedEmail} sebagai Admin`
      )

      setEmail('')
      showToast('Undangan berhasil dibuat.', 'success')
      await fetchTeam()
    } catch (error) {
      console.error('Gagal membuat undangan:', error)

      if (error.code === '23505') {
        showToast('Undangan untuk email tersebut sudah tersedia.', 'error')
      } else {
        showToast(error.message || 'Gagal membuat undangan.', 'error')
      }
    } finally {
      setSending(false)
    }
  }

  async function handleCancelInvite(invite) {
    const confirmed = await showConfirm(
      'Batalkan Undangan',
      `Yakin ingin membatalkan undangan untuk ${invite.email}?`
    )

    if (!confirmed) return

    try {
      const { error } = await supabase
        .from('team_invites')
        .delete()
        .eq('id', invite.id)
        .eq('owner_id', profile.id)

      if (error) throw error

      await logActivity(
        session.user.id,
        'BATALKAN_UNDANGAN',
        `Membatalkan undangan ${invite.email}`
      )

      showToast('Undangan berhasil dibatalkan.', 'success')
      await fetchTeam()
    } catch (error) {
      console.error('Gagal membatalkan undangan:', error)
      showToast('Gagal membatalkan undangan.', 'error')
    }
  }

  function getRoleIcon(role) {
    if (role?.toLowerCase() === 'owner') {
      return <FaUserShield style={{ marginRight: 6 }} />
    }

    return <FaUserTie style={{ marginRight: 6 }} />
  }

  function getRoleColor(role) {
    if (role?.toLowerCase() === 'owner') {
      return { bg: '#fce7f3', text: '#be185d' }
    }

    return { bg: '#dbeafe', text: '#1e40af' }
  }

  const pendingInvites = invites.filter(invite => !invite.accepted_at)
  const acceptedInvites = invites.filter(invite => invite.accepted_at)

  if (loading) {
    return (
      <div
        className="skeleton"
        style={{ height: 300, marginTop: 24 }}
      />
    )
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 24,
        }}
      >
        <h1 style={{ margin: 0 }}>Manajemen Tim</h1>

        <button
          onClick={fetchTeam}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 14px',
            border: '1px solid var(--border-color)',
            borderRadius: 8,
            background: 'var(--card-bg)',
            color: 'var(--text-main)',
            cursor: 'pointer',
          }}
        >
          <FaSync /> Muat Ulang
        </button>
      </div>

      <div
        style={{
          background: 'var(--card-bg)',
          borderLeft: '4px solid var(--primary)',
          padding: '16px 20px',
          borderRadius: 8,
          marginBottom: 24,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <FaInfoCircle
          size={20}
          color="var(--primary)"
          style={{ marginTop: 2, flexShrink: 0 }}
        />

        <div>
          <h4 style={{ margin: '0 0 4px', color: 'var(--text-main)' }}>
            Cara Menambahkan Karyawan
          </h4>

          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: 'var(--text-muted)',
              lineHeight: 1.5,
            }}
          >
            Masukkan email Google karyawan yang ingin diundang. Karyawan
            harus masuk menggunakan email yang sama agar dapat bergabung
            sebagai Admin di Zahra Shop.
          </p>
        </div>
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 24 }}>
        <h3 style={{ marginTop: 0 }}>Undang Karyawan Baru</h3>

        <form
          onSubmit={handleInvite}
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: 220 }}>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Masukkan email Google karyawan"
              required
              disabled={sending}
              style={{
                width: '100%',
                padding: 12,
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                background: 'var(--input-bg, var(--card-bg))',
                color: 'var(--text-main)',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={sending}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '11px 18px',
              border: 'none',
              borderRadius: 8,
              background: 'var(--primary)',
              color: 'white',
              fontWeight: 600,
              cursor: sending ? 'not-allowed' : 'pointer',
              opacity: sending ? 0.7 : 1,
            }}
          >
            <FaEnvelope />
            {sending ? 'Memproses...' : 'Undang Admin'}
          </button>
        </form>

        <p
          style={{
            color: 'var(--text-muted)',
            fontSize: 12,
            marginBottom: 0,
          }}
        >
          Role yang diberikan kepada karyawan adalah Admin (Kasir).
        </p>
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 24 }}>
        <h3 style={{ marginTop: 0 }}>
          Anggota Tim ({members.length})
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Nama Akun</th>
                <th>Email</th>
                <th>Role</th>
                <th>Bergabung</th>
              </tr>
            </thead>

            <tbody>
              {members.map(member => {
                const isSelf = member.id === session.user.id
                const roleColor = getRoleColor(member.role)

                return (
                  <tr key={member.id}>
                    <td>
                      <strong>
                        {member.business_name || 'Tanpa Nama'}
                      </strong>

                      {isSelf && (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 11,
                            background: 'var(--primary)',
                            color: 'white',
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontWeight: 'bold',
                          }}
                        >
                          Kamu
                        </span>
                      )}
                    </td>

                    <td>{member.email || '-'}</td>

                    <td>
                      <span
                        className="badge"
                        style={{
                          background: roleColor.bg,
                          color: roleColor.text,
                          display: 'inline-flex',
                          alignItems: 'center',
                        }}
                      >
                        {getRoleIcon(member.role)}
                        {member.role}
                      </span>
                    </td>

                    <td>
                      {member.created_at
                        ? new Date(member.created_at).toLocaleDateString('id-ID')
                        : '-'}
                    </td>
                  </tr>
                )
              })}

              {members.length === 0 && (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: 24 }}>
                    Belum ada anggota tim.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ marginTop: 0 }}>
          Undangan Menunggu ({pendingInvites.length})
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Tanggal Undangan</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>

            <tbody>
              {pendingInvites.map(invite => (
                <tr key={invite.id}>
                  <td>{invite.email}</td>
                  <td>Admin</td>
                  <td>
                    {new Date(invite.created_at).toLocaleDateString('id-ID')}
                  </td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background: '#fef3c7',
                        color: '#92400e',
                      }}
                    >
                      Menunggu
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => handleCancelInvite(invite)}
                      title="Batalkan undangan"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        border: 'none',
                        borderRadius: 6,
                        padding: '7px 10px',
                        background: '#fee2e2',
                        color: '#b91c1c',
                        cursor: 'pointer',
                      }}
                    >
                      <FaTrash /> Batalkan
                    </button>
                  </td>
                </tr>
              ))}

              {pendingInvites.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: 24 }}>
                    Belum ada undangan yang menunggu.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {acceptedInvites.length > 0 && (
          <p
            style={{
              marginBottom: 0,
              color: 'var(--text-muted)',
              fontSize: 12,
            }}
          >
            {acceptedInvites.length} undangan telah diterima.
          </p>
        )}
      </div>
    </div>
  )
}
