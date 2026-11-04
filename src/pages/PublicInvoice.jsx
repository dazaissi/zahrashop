import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { formatRupiah, formatTanggal } from '../lib/format'
import { FaCheckCircle, FaClock } from 'react-icons/fa'

export default function PublicInvoice() {
  const { number } = useParams()
  const [invoice, setInvoice] = useState(null)
  const [profile, setProfile] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchInvoice() {
      const { data: invData } = await supabase.from('invoices').select('*, customers(*), invoice_items(*, products(name))').eq('invoice_number', decodeURIComponent(number)).single()
      if (invData) {
        setInvoice(invData)
        setItems(invData.invoice_items || [])
        const { data: profData } = await supabase.from('profiles').select('*').eq('id', invData.user_id).single()
        setProfile(profData)
      }
      setLoading(false)
    }
    fetchInvoice()
  }, [number])

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Memuat Invoice...</div>
  if (!invoice) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Invoice tidak ditemukan.</div>

  const sisaTagihan = invoice.total - invoice.paid_amount

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', padding: '20px', display: 'flex', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: 'white', maxWidth: 600, width: '100%', borderRadius: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.1)', overflow: 'hidden', height: 'fit-content' }}>
        <div style={{ background: invoice.status === 'paid' ? '#10b981' : '#f59e0b', padding: '24px', color: 'white', textAlign: 'center' }}>
          {invoice.status === 'paid' ? <FaCheckCircle size={48} style={{ marginBottom: 12 }} /> : <FaClock size={48} style={{ marginBottom: 12 }} />}
          <h2 style={{ margin: 0, color: 'white' }}>{invoice.status === 'paid' ? 'LUNAS' : 'BELUM LUNAS'}</h2>
          <p style={{ margin: '4px 0 0', opacity: 0.9 }}>Invoice {invoice.invoice_number}</p>
        </div>
        <div style={{ padding: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e5e7eb', paddingBottom: 20, marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
            <div>
              {profile?.logo_url && <img src={profile.logo_url} alt="Logo" style={{ height: 40, marginBottom: 8, mixBlendMode: 'multiply' }} />}
              <h3 style={{ margin: 0, color: '#1f2937' }}>{profile?.business_name}</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280', maxWidth: 200 }}>{profile?.address}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>Ditagihkan Kepada:</p>
              <h4 style={{ margin: '4px 0', color: '#1f2937' }}>{invoice.customers?.name || 'Pelanggan Umum'}</h4>
              <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>{invoice.customers?.phone}</p>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', marginBottom: 24, borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: '1px solid #e5e7eb' }}><th style={{ padding: '8px 0', textAlign: 'left', fontSize: 13, color: '#6b7280' }}>Item</th><th style={{ padding: '8px 0', textAlign: 'center', fontSize: 13, color: '#6b7280' }}>Qty</th><th style={{ padding: '8px 0', textAlign: 'right', fontSize: 13, color: '#6b7280' }}>Total</th></tr></thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '12px 0', fontSize: 14, color: '#374151' }}>{item.description}</td>
                    <td style={{ padding: '12px 0', textAlign: 'center', fontSize: 14, color: '#374151' }}>{item.quantity}</td>
                    <td style={{ padding: '12px 0', textAlign: 'right', fontSize: 14, color: '#374151' }}>{formatRupiah(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ background: '#f8fafc', padding: 20, borderRadius: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14, color: '#6b7280' }}><span>Total Tagihan</span><strong style={{ color: '#1f2937' }}>{formatRupiah(invoice.total)}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14, color: '#6b7280' }}><span>Sudah Dibayar</span><strong style={{ color: '#10b981' }}>{formatRupiah(invoice.paid_amount)}</strong></div>
            <hr style={{ border: 'none', borderTop: '1px dashed #cbd5e1', margin: '12px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 'bold', color: invoice.status === 'paid' ? '#10b981' : '#ef4444' }}><span>Sisa Tagihan</span><span>{formatRupiah(sisaTagihan)}</span></div>
          </div>

          {profile?.bank_info && <div style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: '#6b7280' }}><strong>Pembayaran via Transfer:</strong><br/><span style={{ whiteSpace: 'pre-wrap' }}>{profile.bank_info}</span></div>}
          <div style={{ marginTop: 32, textAlign: 'center' }}><p style={{ fontSize: 12, color: '#9ca3af' }}>Invoice ini dibuat secara otomatis oleh sistem Zahrashop.</p></div>
        </div>
      </div>
    </div>
  )
}