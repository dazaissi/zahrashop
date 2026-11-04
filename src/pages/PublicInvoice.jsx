
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { formatRupiah, formatTanggal } from '../lib/format'

import {
  FaCheckCircle,
  FaClock,
  FaBuilding,
  FaUser,
  FaPhoneAlt
} from 'react-icons/fa'

export default function PublicInvoice() {
  const { number, token } = useParams()

  const [invoice, setInvoice] = useState(null)
  const [profile, setProfile] = useState(null)
  const [customer, setCustomer] = useState(null)
  const [items, setItems] = useState([])

  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const isValidUUID = (value) => {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  }

  useEffect(() => {
    let isMounted = true

    async function fetchInvoice() {
      setLoading(true)
      setErrorMessage('')

      try {
        if (!number || !token || !isValidUUID(token)) {
          throw new Error('Link invoice tidak valid.')
        }

        const decodedNumber = decodeURIComponent(number)

        // Validasi invoice melalui RPC, bukan SELECT langsung ke tabel
        const { data, error } = await supabase.rpc(
          'get_public_invoice',
          {
            p_invoice_number: decodedNumber,
            p_public_token: token
          }
        )

        if (error) {
          throw error
        }

        // Nomor invoice dan token tidak cocok
        if (!data || !data.invoice) {
          throw new Error('Invoice tidak ditemukan atau link tidak valid.')
        }

        if (isMounted) {
          setInvoice(data.invoice)
          setProfile(data.profile || null)
          setCustomer(data.customer || null)
          setItems(Array.isArray(data.items) ? data.items : [])
        }
      } catch (error) {
        console.error('Gagal memuat invoice publik:', error)

        if (isMounted) {
          setInvoice(null)
          setProfile(null)
          setCustomer(null)
          setItems([])

          setErrorMessage(
            'Invoice tidak ditemukan atau link tidak valid.'
          )
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchInvoice()

    return () => {
      isMounted = false
    }
  }, [number, token])

  // LOADING
  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          color: '#64748b',
          fontFamily: 'system-ui, sans-serif'
        }}
      >
        Memuat Invoice...
      </div>
    )
  }

  // INVOICE TIDAK DITEMUKAN
  if (!invoice) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          color: '#ef4444',
          fontWeight: 'bold',
          padding: 24,
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif'
        }}
      >
        <FaClock size={48} />

        <h2>Invoice tidak dapat ditampilkan.</h2>

        <p
          style={{
            color: '#64748b',
            fontWeight: 'normal',
            fontSize: 14
          }}
        >
          {errorMessage || 'Invoice tidak ditemukan.'}
        </p>
      </div>
    )
  }

  // PERHITUNGAN TAGIHAN
  const total = Number(invoice.total) || 0
  const paidAmount = Number(invoice.paid_amount) || 0

  const sisaTagihan = Math.max(0, total - paidAmount)

  const isPaid =
    invoice.status === 'paid' || sisaTagihan <= 0

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f1f5f9',
        padding: '24px 16px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
    >
      <div
        style={{
          background: 'white',
          maxWidth: 650,
          width: '100%',
          borderRadius: 16,
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
          overflow: 'hidden'
        }}
      >
        {/* STATUS BANNER */}
        <div
          style={{
            background: isPaid ? '#ecfdf5' : '#fffbeb',
            padding: 24,
            color: isPaid ? '#065f46' : '#92400e',
            textAlign: 'center',
            borderBottom: `1px solid ${
              isPaid ? '#d1fae5' : '#fde68a'
            }`
          }}
        >
          {isPaid ? (
            <FaCheckCircle
              size={40}
              style={{ marginBottom: 12 }}
            />
          ) : (
            <FaClock
              size={40}
              style={{ marginBottom: 12 }}
            />
          )}

          <h2
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: '0.5px'
            }}
          >
            {isPaid ? 'INVOICE LUNAS' : 'MENUNGGU PEMBAYARAN'}
          </h2>

          <p
            style={{
              margin: '6px 0 0',
              fontSize: 14,
              opacity: 0.8,
              fontWeight: 500
            }}
          >
            No. {invoice.invoice_number}
          </p>
        </div>

        <div style={{ padding: 32 }}>
          {/* INFORMASI BISNIS DAN PELANGGAN */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 24,
              marginBottom: 32,
              borderBottom: '1px solid #f1f5f9',
              paddingBottom: 24
            }}
          >
            {/* INFORMASI BISNIS */}
            <div style={{ flex: '1 1 200px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 8
                }}
              >
                {profile?.logo_url ? (
                  <img
                    src={profile.logo_url}
                    alt="Logo Bisnis"
                    style={{
                      height: 40,
                      maxWidth: 120,
                      objectFit: 'contain'
                    }}
                  />
                ) : (
                  <FaBuilding size={24} color="#ec4899" />
                )}

                <h3
                  style={{
                    margin: 0,
                    color: '#0f172a',
                    fontSize: 18
                  }}
                >
                  {profile?.business_name || 'Bisnis Saya'}
                </h3>
              </div>

              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: 13,
                  color: '#64748b',
                  lineHeight: 1.5
                }}
              >
                {profile?.address || 'Alamat belum diatur'}
              </p>

              {profile?.phone && (
                <p
                  style={{
                    margin: '4px 0 0',
                    fontSize: 13,
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <FaPhoneAlt size={12} />
                  {profile.phone}
                </p>
              )}
            </div>

            {/* INFORMASI PELANGGAN */}
            <div
              style={{
                flex: '1 1 200px',
                textAlign: 'right'
              }}
            >
              <p
                style={{
                  margin: '0 0 8px',
                  fontSize: 12,
                  color: '#94a3b8',
                  textTransform: 'uppercase',
                  fontWeight: 'bold',
                  letterSpacing: '0.5px'
                }}
              >
                Ditagihkan Kepada
              </p>

              <h4
                style={{
                  margin: '0 0 4px',
                  color: '#0f172a',
                  fontSize: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: 6
                }}
              >
                <FaUser size={14} color="#64748b" />
                {customer?.name || 'Pelanggan Umum'}
              </h4>

              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: '#64748b'
                }}
              >
                {customer?.phone || '-'}
              </p>

              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: 13,
                  color: '#64748b'
                }}
              >
                Tgl Terbit: {formatTanggal(invoice.issue_date)}
              </p>
            </div>
          </div>

          {/* TABEL ITEM */}
          <div
            style={{
              overflowX: 'auto',
              marginBottom: 32
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                minWidth: 400
              }}
            >
              <thead>
                <tr
                  style={{
                    background: '#f8fafc',
                    borderBottom: '2px solid #e2e8f0'
                  }}
                >
                  <th
                    style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: 13,
                      color: '#475569',
                      fontWeight: 700
                    }}
                  >
                    Deskripsi Item
                  </th>

                  <th
                    style={{
                      padding: '12px 16px',
                      textAlign: 'center',
                      fontSize: 13,
                      color: '#475569',
                      fontWeight: 700
                    }}
                  >
                    Qty
                  </th>

                  <th
                    style={{
                      padding: '12px 16px',
                      textAlign: 'right',
                      fontSize: 13,
                      color: '#475569',
                      fontWeight: 700
                    }}
                  >
                    Total
                  </th>
                </tr>
              </thead>

              <tbody>
                {items.map((item, index) => (
                  <tr
                    key={item.id || `${item.product_name || 'item'}-${index}`}
                    style={{
                      borderBottom: '1px solid #f1f5f9'
                    }}
                  >
                    <td
                      style={{
                        padding: '14px 16px',
                        fontSize: 14,
                        color: '#1e293b',
                        fontWeight: 500
                      }}
                    >
                      {item.description || item.product_name || '-'}

                      {item.product_name && item.description && (
                        <span
                          style={{
                            display: 'block',
                            fontSize: 12,
                            color: '#94a3b8',
                            marginTop: 2
                          }}
                        >
                          {item.product_name}
                        </span>
                      )}
                    </td>

                    <td
                      style={{
                        padding: '14px 16px',
                        textAlign: 'center',
                        fontSize: 14,
                        color: '#1e293b'
                      }}
                    >
                      {item.quantity}
                    </td>

                    <td
                      style={{
                        padding: '14px 16px',
                        textAlign: 'right',
                        fontSize: 14,
                        color: '#1e293b',
                        fontWeight: 600
                      }}
                    >
                      {formatRupiah(item.subtotal)}
                    </td>
                  </tr>
                ))}

                {items.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      style={{
                        padding: 24,
                        textAlign: 'center',
                        color: '#94a3b8'
                      }}
                    >
                      Tidak ada item invoice.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* RINGKASAN TAGIHAN */}
          <div
            style={{
              background: '#f8fafc',
              padding: 24,
              borderRadius: 12,
              border: '1px solid #e2e8f0'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 12,
                fontSize: 14,
                color: '#64748b'
              }}
            >
              <span>Total Tagihan</span>

              <strong style={{ color: '#0f172a' }}>
                {formatRupiah(total)}
              </strong>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 16,
                fontSize: 14,
                color: '#64748b'
              }}
            >
              <span>Sudah Dibayar</span>

              <strong style={{ color: '#10b981' }}>
                {formatRupiah(paidAmount)}
              </strong>
            </div>

            <hr
              style={{
                border: 'none',
                borderTop: '1px dashed #cbd5e1',
                margin: '0 0 16px'
              }}
            />

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12
              }}
            >
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#334155'
                }}
              >
                Sisa Tagihan
              </span>

              <span
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: isPaid ? '#10b981' : '#ef4444'
                }}
              >
                {formatRupiah(sisaTagihan)}
              </span>
            </div>
          </div>

          {/* INFORMASI TRANSFER */}
          {profile?.bank_info && !isPaid && (
            <div
              style={{
                marginTop: 24,
                padding: 16,
                background: '#fffbeb',
                border: '1px dashed #fcd34d',
                borderRadius: 12,
                textAlign: 'center'
              }}
            >
              <p
                style={{
                  margin: '0 0 8px',
                  fontSize: 13,
                  color: '#92400e',
                  fontWeight: 'bold'
                }}
              >
                Instruksi Pembayaran Transfer
              </p>

              <div
                style={{
                  fontSize: 14,
                  color: '#78350f',
                  whiteSpace: 'pre-wrap',
                  fontWeight: 500,
                  lineHeight: 1.5
                }}
              >
                {profile.bank_info}
              </div>
            </div>
          )}

          {/* FOOTER */}
          <div
            style={{
              marginTop: 40,
              textAlign: 'center',
              borderTop: '1px solid #f1f5f9',
              paddingTop: 20
            }}
          >
            <p
              style={{
                fontSize: 12,
                color: '#94a3b8',
                margin: 0
              }}
            >
              Terima kasih atas kepercayaan Anda.
              <br />
              Invoice ini dibuat secara otomatis oleh sistem{' '}
              <strong style={{ color: '#cbd5e1' }}>
                Zahrashop
              </strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
