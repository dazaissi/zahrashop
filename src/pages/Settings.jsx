import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useUI } from '../context/UIContext'
import Button from '../components/ui/Button'
import { FaUserCircle, FaCamera, FaImage } from 'react-icons/fa'

export default function Settings() {
  const { session } = useAuth()
  const { showToast } = useUI()
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  
  const [businessName, setBusinessName] = useState('')
  const [bankInfo, setBankInfo] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [website, setWebsite] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [logoFile, setLogoFile] = useState(null)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarFile, setAvatarFile] = useState(null)

  useEffect(() => { if (session) fetchProfile() }, [session])

  async function fetchProfile() {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    if (data) {
      setBusinessName(data.business_name || ''); setBankInfo(data.bank_info || ''); setPhone(data.phone || ''); setEmail(data.email || ''); setAddress(data.address || ''); setWebsite(data.website || ''); setLogoUrl(data.logo_url || '');
      const googleAvatar = session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture
      setAvatarUrl(data.avatar_url || googleAvatar || '')
    }
    setLoading(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setIsSaving(true)
    let finalLogoUrl = logoUrl, finalAvatarUrl = avatarUrl

    if (logoFile) {
      const fileName = `logo-${session.user.id}-${Date.now()}.${logoFile.name.split('.').pop()}`
      const { error } = await supabase.storage.from('logos').upload(fileName, logoFile)
      if (!error) { const { data } = supabase.storage.from('logos').getPublicUrl(fileName); finalLogoUrl = data.publicUrl }
    }

    if (avatarFile) {
      const fileName = `avatar-${session.user.id}-${Date.now()}.${avatarFile.name.split('.').pop()}`
      const { error } = await supabase.storage.from('logos').upload(fileName, avatarFile)
      if (!error) { const { data } = supabase.storage.from('logos').getPublicUrl(fileName); finalAvatarUrl = data.publicUrl }
    }

    const { error } = await supabase.from('profiles').upsert({ id: session.user.id, business_name: businessName, bank_info: bankInfo, phone, email, address, website, logo_url: finalLogoUrl, avatar_url: finalAvatarUrl })
    
    if (error) showToast('Gagal menyimpan profil: ' + error.message, 'error')
    else { showToast('Pengaturan berhasil disimpan!', 'success'); setLogoUrl(finalLogoUrl); setLogoFile(null); setAvatarUrl(finalAvatarUrl); setAvatarFile(null) }
    setIsSaving(false)
  }

  if (loading) return <div className="skeleton" style={{ height: 400, marginTop: 24 }}></div>

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Pengaturan</h1>
      <form onSubmit={handleSave} style={{ maxWidth: 900 }}>
        
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 12, marginBottom: 24 }}>Profil Anda</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              {avatarUrl ? <img src={avatarUrl} alt="Avatar" style={{ width: 100, height: 100, borderRadius: '50%', objectFit: 'cover', border: '4px solid var(--primary)', padding: 2, background: 'white' }} /> : <FaUserCircle size={100} color="var(--text-muted)" />}
            </div>
            <div style={{ flex: 1, minWidth: 250 }}>
              <label>Ganti Foto Profil</label>
              <div className="file-upload-wrapper">
                <input type="file" accept="image/*" onChange={e => setAvatarFile(e.target.files[0])} />
                <div className="file-upload-box">
                  <FaCamera size={24} style={{ color: 'var(--primary)', marginBottom: 8 }} />
                  <p><span>Klik untuk upload</span> foto profil</p>
                </div>
              </div>
              {avatarFile && <p style={{ fontSize: 13, color: 'var(--primary)', marginTop: 8, fontWeight: 'bold' }}>File terpilih: {avatarFile.name}</p>}
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 12, marginBottom: 24 }}>Pengaturan Bisnis</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20, marginBottom: 20 }}>
            <div><label>Nama Bisnis *</label><input required value={businessName} onChange={e => setBusinessName(e.target.value)} /></div>
            <div><label>No. Telepon</label><input value={phone} onChange={e => setPhone(e.target.value)} /></div>
            <div><label>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
            <div><label>Website</label><input value={website} onChange={e => setWebsite(e.target.value)} /></div>
          </div>
          <div style={{ marginBottom: 20 }}><label>Alamat Lengkap</label><textarea rows="2" value={address} onChange={e => setAddress(e.target.value)} /></div>
          <div style={{ marginBottom: 24 }}><label>Info Rekening Pembayaran</label><textarea rows="3" value={bankInfo} onChange={e => setBankInfo(e.target.value)} placeholder="Contoh: BCA 123456789 a.n Zahra" /></div>
          
          <div>
            <label>Logo Bisnis (Untuk Invoice)</label>
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {logoUrl && <div style={{ background: 'var(--bg-color)', padding: 12, borderRadius: 12, border: '1px solid var(--border-color)' }}><img src={logoUrl} alt="Logo" style={{ height: 60, objectFit: 'contain', mixBlendMode: 'multiply' }} /></div>}
              <div className="file-upload-wrapper" style={{ flex: 1, minWidth: 250 }}>
                <input type="file" accept="image/*" onChange={e => setLogoFile(e.target.files[0])} />
                <div className="file-upload-box">
                  <FaImage size={24} style={{ color: 'var(--primary)', marginBottom: 8 }} />
                  <p><span>Klik untuk upload logo</span></p>
                </div>
              </div>
            </div>
            {logoFile && <p style={{ fontSize: 13, color: 'var(--primary)', marginTop: 8, fontWeight: 'bold' }}>File terpilih: {logoFile.name}</p>}
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <Button type="submit" variant="solid" disabled={isSaving} style={{ padding: '14px 32px', fontSize: 16 }}>{isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}</Button>
        </div>
      </form>
    </div>
  )
}