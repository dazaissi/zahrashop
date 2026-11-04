import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useUI } from '../context/UIContext'
import { logActivity } from '../lib/logger'
import { FaInfoCircle, FaUserShield, FaUserTie } from 'react-icons/fa'

export default function Team() {
  const { session } = useAuth()
  const { showToast } = useUI()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchMembers() }, [])

  async function fetchMembers() {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('created_at')
    if (data) setMembers(data)
    setLoading(false)
  }

  async function handleRoleChange(memberId, newRole, memberName) {
    if (memberId === session.user.id) return showToast('Kamu tidak bisa mengubah role dirimu sendiri!', 'error')
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', memberId)
    if (!error) {
      await logActivity(session.user.id, 'UBAH_ROLE', `Mengubah role ${memberName} menjadi ${newRole}`)
      fetchMembers()
      showToast(`Role ${memberName} diubah ke ${newRole}!`, 'success')
    }
  }

  const getRoleIcon = (role) => { if (role === 'owner') return <FaUserShield style={{ marginRight: 6 }} />; return <FaUserTie style={{ marginRight: 6 }} /> }
  const getRoleColor = (role) => { if (role === 'owner') return { bg: '#fce7f3', text: '#be185d' }; return { bg: '#dbeafe', text: '#1e40af' } }

  if (loading) return <div className="skeleton" style={{ height: 300, marginTop: 24 }}></div>

  return (
    <div>
      <h1>Manajemen Tim</h1>
      <div style={{ background: 'var(--card-bg)', borderLeft: '4px solid var(--primary)', padding: '16px 20px', borderRadius: '8px', marginBottom: 24, display: 'flex', alignItems: 'flex-start', gap: 12, boxShadow: 'var(--shadow-sm)' }}>
        <FaInfoCircle size={20} color="var(--primary)" style={{ marginTop: 2, flexShrink: 0 }} />
        <div>
          <h4 style={{ margin: '0 0 4px', color: 'var(--text-main)' }}>Cara Menambah Karyawan Baru</h4>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5 }}>Minta karyawan membuka website Zahrashop dan klik <strong>Masuk dengan Google</strong>. Nama mereka akan otomatis muncul di bawah ini. Kamu tinggal mengubah role-nya.</p>
        </div>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Nama Bisnis / Akun</th><th>Role Saat Ini</th><th>Ubah Role</th></tr></thead>
          <tbody>
            {members.map(m => {
              const isSelf = m.id === session.user.id
              const roleColor = getRoleColor(m.role)
              return (
                <tr key={m.id}>
                  <td>
                    <strong>{m.business_name || 'Tanpa Nama'}</strong>
                    {isSelf && <span style={{ marginLeft: 8, fontSize: 11, background: 'var(--primary)', color: 'white', padding: '2px 6px', borderRadius: 4, fontWeight: 'bold' }}>Kamu</span>}
                    <br/><small style={{ color: 'var(--text-muted)' }}>ID: {m.id.slice(0,8)}...</small>
                  </td>
                  <td><span className="badge" style={{ background: roleColor.bg, color: roleColor.text, display: 'inline-flex', alignItems: 'center' }}>{getRoleIcon(m.role)}{m.role}</span></td>
                  <td>
                    <select value={m.role} onChange={(e) => handleRoleChange(m.id, e.target.value, m.business_name)} disabled={isSelf || m.role === 'owner'} style={{ width: 150, opacity: (isSelf || m.role === 'owner') ? 0.5 : 1 }}>
                      <option value="owner" disabled>Owner</option>
                      <option value="admin">Admin (Kasir)</option>
                    </select>
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