import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useUI } from '../context/UIContext'
import Button from '../components/ui/Button'
import { FaUserCircle } from 'react-icons/fa'

export default function Settings() {
  const { session } = useAuth()
  const { showToast } = useUI()
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  
  // State Bisnis
  const [businessName, setBusinessName] = useState('')
  const [bankInfo, setBankInfo] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [website, setWebsite] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [logoFile, setLogoFile] = useState(null)

  // State Profil User
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarFile, setAvatarFile] = useState(null)

  useEffect(() => { if (session) fetchProfile() }, [session])

  async function fetchProfile() {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    if (data) {
      setBusinessName(data.business_name || ''); setBankInfo(data.bank_info || ''); setPhone(data.phone || ''); setEmail(data.email || ''); setAddress(data.address || ''); setWebsite(data.website || ''); setLogoUrl(data.logo_url || '');
      
      // Ambil avatar dari DB atau Google
      const googleAvatar = session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture
      setAvatarUrl(data.avatar_url || googleAvatar || '')
    }
    setLoading(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setIsSaving(true)
    
    let finalLogoUrl = logoUrl
    let finalAvatarUrl = avatarUrl

    // Upload Logo Bisnis Baru
    if (logoFile) {
      const fileName = `logo-${session.user.id}-${Date.now()}.${logoFile.name.split('.').pop()}`
      const { error } = await supabase.storage.from('logos').upload(fileName, logoFile)
      if (!error) {
        const { data } = supabase.storage.from('logos').getPublicUrl(fileName)
        finalLogoUrl = data.publicUrl
      }
    }

    // Upload Avatar Profil Baru
    if (avatarFile) {
      const fileName = `avatar-${session.user.id}-${Date.now()}.${avatarFile.name.split('.').pop()}`
      const { error } = await supabase.storage.from('logos').upload(fileName, avatarFile)
      if (!error) {
        const { data } = supabase.storage.from('logos').getPublicUrl(fileName)
        finalAvatarUrl = data.publicUrl
      }
    }

    const { error } = await supabase.from('profiles').upsert({ 
      id: session.user.id, 
      business_name: businessName, 
      bank_info: bankInfo, 
      phone, email, address, website, 
      logo_url: finalLogoUrl,
      avatar_url: finalAvatarUrl
    })
    
    if (error) showToast('Gagal menyimpan profil: ' + error.message, 'error')
    else { 
      showToast('Profil berhasil disimpan!', 'success')
      setLogoUrl(finalLogoUrl); setLogoFile(null) 
      setAvatarUrl(finalAvatarUrl); setAvatarFile(null) 
    }
    setIsSaving(false)
  }

  if (loading) return <div className="skeleton" style={{ height: 400, marginTop: 24 }}></div>

  return (
    <div>
      <h1>Pengaturan Bisnis & Profil</h1>
      <div className="card" style={{ maxWidth: 800 }}>
        <form onSubmit={handleSave} style={{ display: 'grid', gap: 24 }}>
          
          {/* SECTION 1: PROFIL PENGGUNA */}
          <div>
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 8, marginBottom: 16 }}>Profil Anda</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--primary)' }} />
              ) : (
                <FaUserCircle size={80} color="var(--text-muted)" />
              )}
              <div>
                <label style={{ display: 'block', marginBottom: 8 }}>Ganti Foto Profil</label>
                <input type="file" accept="image/*" onChange={e => setAvatarFile(e.target.files[0])} />
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>Format: JPG/PNG. Biarkan kosong jika tidak ingin mengubah.</p>
              </div>
            </div>
          </div>

          {/* SECTION 2: PENGATURAN BISNIS */}
          <div>
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 8, marginBottom: 16 }}>Pengaturan Bisnis</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div><label>Nama Bisnis *</label><input required value={businessName} onChange={e => setBusinessName(e.target.value)} /></div>
              <div><label>No. Telepon</label><input value={phone} onChange={e => setPhone(e.target.value)} /></div>
              <div><label>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
              <div><label>Website</label><input value={website} onChange={e => setWebsite(e.target.value)} /></div>
            </div>
            <div style={{ marginTop: 16 }}><label>Alamat Lengkap</label><textarea rows="2" value={address} onChange={e => setAddress(e.target.value)} /></div>
            <div style={{ marginTop: 16 }}><label>Info Rekening Pembayaran</label><textarea rows="3" value={bankInfo} onChange={e => setBankInfo(e.target.value)} /></div>
            
            <div style={{ padding: 16, border: '1px dashed var(--border-color)', borderRadius: 8, marginTop: 16 }}>
              <label style={{ display: 'block', marginBottom: 8 }}>Logo Bisnis (Untuk Invoice)</label>
              {logoUrl && !logoFile && <img src={logoUrl} alt="Logo" style={{ height: 60, marginBottom: 12, background: '#f8fafc', borderRadius: 4, padding: 4 }} />}
              <input type="file" accept="image/*" onChange={e => setLogoFile(e.target.files[0])} />
            </div>
          </div>

          <div>
            <Button type="submit" variant="solid" disabled={isSaving}>{isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}