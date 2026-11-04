import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useUI } from '../context/UIContext'
import Button from '../components/ui/Button'

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
  const [file, setFile] = useState(null)

  useEffect(() => { if (session) fetchProfile() }, [session])

  async function fetchProfile() {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    if (data) {
      setBusinessName(data.business_name || ''); setBankInfo(data.bank_info || ''); setPhone(data.phone || ''); setEmail(data.email || ''); setAddress(data.address || ''); setWebsite(data.website || ''); setLogoUrl(data.logo_url || '')
    }
    setLoading(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setIsSaving(true)
    let finalLogoUrl = logoUrl

    if (file) {
      const fileName = `${session.user.id}-${Date.now()}.${file.name.split('.').pop()}`
      const { error } = await supabase.storage.from('logos').upload(fileName, file)
      if (!error) {
        const { data } = supabase.storage.from('logos').getPublicUrl(fileName)
        finalLogoUrl = data.publicUrl
      }
    }

    const { error } = await supabase.from('profiles').upsert({ id: session.user.id, business_name: businessName, bank_info: bankInfo, phone, email, address, website, logo_url: finalLogoUrl })
    
    if (error) showToast('Gagal menyimpan profil: ' + error.message, 'error')
    else { showToast('Profil berhasil disimpan!', 'success'); setLogoUrl(finalLogoUrl); setFile(null) }
    setIsSaving(false)
  }

  if (loading) return <div className="skeleton" style={{ height: 400, marginTop: 24 }}></div>

  return (
    <div>
      <h1>Pengaturan Bisnis</h1>
      <div className="card" style={{ maxWidth: 800 }}>
        <form onSubmit={handleSave} style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div><label>Nama Bisnis *</label><input required value={businessName} onChange={e => setBusinessName(e.target.value)} /></div>
            <div><label>No. Telepon</label><input value={phone} onChange={e => setPhone(e.target.value)} /></div>
            <div><label>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
            <div><label>Website</label><input value={website} onChange={e => setWebsite(e.target.value)} /></div>
          </div>
          <div><label>Alamat Lengkap</label><textarea rows="2" value={address} onChange={e => setAddress(e.target.value)} /></div>
          <div><label>Info Rekening Pembayaran</label><textarea rows="3" value={bankInfo} onChange={e => setBankInfo(e.target.value)} /></div>
          <div style={{ padding: 16, border: '1px dashed var(--border-color)', borderRadius: 8 }}>
            <label style={{ display: 'block', marginBottom: 8 }}>Logo Bisnis</label>
            {logoUrl && !file && <img src={logoUrl} alt="Logo" style={{ height: 60, marginBottom: 12, background: '#f8fafc', borderRadius: 4, padding: 4 }} />}
            <input type="file" accept="image/*" onChange={e => setFile(e.target.files[0])} />
          </div>
          <div>
            <Button type="submit" variant="solid" disabled={isSaving}>{isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}